import { STORAGE_KEYS } from "@/constants";
import { appStorage } from "@/stores/storage";
import { useUpdateStore } from "@/stores/updateStore";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import { NativeModules, Platform } from "react-native";
import RNFetchBlob from "react-native-blob-util";

type CheckResponse = {
  updateAvailable: boolean;
  apkUrl?: string;
  latestVersion?: string;
  version?: string;
  releaseUrl?: string;
  name?: string;
  apk?: { url?: string };
  forceUpdate?: boolean;
};

const UPDATE_CHECK_ENDPOINT = "https://sausico.pages.dev/update/check";

class UpdateService {
  async checkOnLaunch(): Promise<void> {
    if (Platform.OS !== "android") return;

    try {
      const payload = {
        version: this.getCurrentVersion(),
        arch: this.getDeviceArchitecture(),
      };

      const res = await fetch(UPDATE_CHECK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return;

      const data = (await res.json()) as CheckResponse;

      await appStorage.setItem(
        STORAGE_KEYS.UPDATE_CHECK_CACHE,
        JSON.stringify({
          checkedAt: Date.now(),
          response: data,
        })
      );

      this.handleCheckResponse(data);
    } catch { }
  }

  private handleCheckResponse(response: CheckResponse): void {
    if (!response.updateAvailable) {
      return;
    }

    const apkUrl = response.apkUrl ?? response.apk?.url;
    const latestVersion = response.latestVersion ?? response.version;

    if (!apkUrl) {
      return;
    }

    const forceUpdate = Boolean(response.forceUpdate);

    if (forceUpdate) {
      useUpdateStore.getState().showUpdate({
        latestVersion,
        apkUrl,
        releaseName: response.name,
        releaseUrl: response.releaseUrl,
        forceUpdate,
      });
      return;
    }

    useUpdateStore.getState().setUpdateAvailable({
      latestVersion,
      apkUrl,
      releaseName: response.name,
      releaseUrl: response.releaseUrl,
      forceUpdate,
    });
  }

  // Starts the download and installation flow
  async startDownloadAndInstall(): Promise<void> {
    if (Platform.OS !== "android") return;

    const hasPermission = await this.checkInstallPermission();

    if (!hasPermission) {
      await this.requestInstallPermission();
      return;
    }

    const apkPath = await this.downloadApk();

    if (apkPath) {
      await this.installApk(apkPath);
    }
  }

  // Phase 1: Check
  private async checkInstallPermission(): Promise<boolean> {
    return await Device.isSideLoadingEnabledAsync();
  }

  private async requestInstallPermission(): Promise<void> {
    const updateStore = useUpdateStore.getState();

    updateStore.setPrompt("install-permission");
    updateStore.setError(null);
    updateStore.setDownloadState("idle");
    updateStore.openUpdateDialog();
  }

  async openInstallPermissionSettings(): Promise<void> {
    const packageName = Application.applicationId;

    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
        {
          data: `package:${packageName}`,
        },
      );
    } catch (error) {
      console.error("Settings open failed:", error);
    }
  }

  // Phase 3: Download
  private async downloadApk(): Promise<string | null> {
    const { apkUrl } = useUpdateStore.getState();
    if (!apkUrl) return null;

    const updateStore = useUpdateStore.getState();

    updateStore.setError(null);
    updateStore.setProgress(0);
    updateStore.setDownloadState("downloading");

    try {
      const { config, fs } = RNFetchBlob;
      const path = `${fs.dirs.DownloadDir}/app-update.apk`;

      const task = config({
        fileCache: true,
        path,
      }).fetch("GET", apkUrl);

      task.progress((received, total) => {
        const receivedBytes = Number(received);
        const totalBytes = Number(total);

        if (Number.isFinite(totalBytes) && totalBytes > 0) {
          updateStore.setProgress(Math.min(1, receivedBytes / totalBytes));
        }
      });

      const res = await task;

      const apkPath = res.path();

      updateStore.setProgress(1);
      updateStore.setDownloadState("installing");

      await appStorage.setItem(STORAGE_KEYS.UPDATE_APK_URI, apkPath);

      return apkPath;
    } catch (err) {
      console.error("Update failed:", err);

      updateStore.setDownloadState("download-failed");
      updateStore.setError("Could not download update.");

      updateStore.setPrompt("none");
      updateStore.openUpdateDialog();

      return null;
    }
  }

  // Phase 4: Install
  private async installApk(apkPath: string): Promise<void> {
    try {
      await RNFetchBlob.android.actionViewIntent(
        apkPath,
        "application/vnd.android.package-archive"
      );

      useUpdateStore.getState().completeFlow();
    } catch (err) {
      console.error("Install failed:", err);

      // Fallback triggers ask phase if the initial check was bypassed
      await this.requestInstallPermission();
    }
  }

  getCurrentVersion(): string {
    return (
      Application.nativeApplicationVersion ??
      Application.nativeBuildVersion ??
      "0.0.0"
    );
  }

  getDeviceArchitecture(): string {
    const platformConstants = Platform.constants as
      | { SupportedAbis?: string[] }
      | undefined;

    const nativeSupportedAbis = (
      NativeModules.PlatformConstants as
      | { SupportedAbis?: string[] }
      | undefined
    )?.SupportedAbis;

    const supportedAbis =
      platformConstants?.SupportedAbis ?? nativeSupportedAbis ?? [];

    return supportedAbis[0] ?? "arm64-v8a";
  }
}

export const updateService = new UpdateService();