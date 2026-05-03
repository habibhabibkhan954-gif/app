import { create } from "zustand";

export type UpdateDownloadState =
  | "idle"
  | "downloading"
  | "download-failed"
  | "installing";

interface UpdateState {
  visible: boolean;
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestVersion: string | null;
  apkUrl: string | null;
  releaseName: string | null;
  releaseUrl: string | null;
  downloadState: UpdateDownloadState;
  progress: number;
  error: string | null;
  setUpdateAvailable: (payload: {
    latestVersion?: string;
    apkUrl: string;
    forceUpdate?: boolean;
    releaseName?: string;
    releaseUrl?: string;
  }) => void;
  openUpdateDialog: () => void;
  clearUpdateAvailable: () => void;
  showUpdate: (payload: {
    latestVersion?: string;
    apkUrl: string;
    forceUpdate?: boolean;
    releaseName?: string;
    releaseUrl?: string;
  }) => void;
  hideUpdate: () => void;
  setDownloadState: (state: UpdateDownloadState) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  resetFlow: () => void;
  completeFlow: () => void;
}

const initialState = {
  visible: false,
  updateAvailable: false,
  forceUpdate: false,
  latestVersion: null,
  apkUrl: null,
  releaseName: null,
  releaseUrl: null,
  downloadState: "idle" as UpdateDownloadState,
  progress: 0,
  error: null,
};

export const useUpdateStore = create<UpdateState>((set) => ({
  ...initialState,
  setUpdateAvailable: ({
    latestVersion,
    apkUrl,
    forceUpdate = false,
    releaseName,
    releaseUrl,
  }) =>
    set({
      visible: false,
      updateAvailable: true,
      latestVersion: latestVersion ?? null,
      apkUrl,
      releaseName: releaseName ?? null,
      releaseUrl: releaseUrl ?? null,
      forceUpdate,
      downloadState: "idle",
      progress: 0,
      error: null,
    }),
  openUpdateDialog: () =>
    set((state) =>
      state.updateAvailable
        ? {
            visible: true,
          }
        : state,
    ),
  clearUpdateAvailable: () =>
    set({
      updateAvailable: false,
      forceUpdate: false,
      latestVersion: null,
      apkUrl: null,
      releaseName: null,
      releaseUrl: null,
      visible: false,
      downloadState: "idle",
      progress: 0,
      error: null,
    }),
  showUpdate: ({
    latestVersion,
    apkUrl,
    forceUpdate = false,
    releaseName,
    releaseUrl,
  }) =>
    set({
      visible: true,
      updateAvailable: true,
      latestVersion: latestVersion ?? null,
      apkUrl,
      releaseName: releaseName ?? null,
      releaseUrl: releaseUrl ?? null,
      forceUpdate,
      downloadState: "idle",
      progress: 0,
      error: null,
    }),
  hideUpdate: () =>
    set((state) => (state.forceUpdate ? state : { visible: false })),
  setDownloadState: (downloadState) => set({ downloadState }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  resetFlow: () =>
    set((state) => ({
      ...state,
      downloadState: "idle",
      progress: 0,
      error: null,
    })),
  completeFlow: () =>
    set({
      visible: false,
      updateAvailable: false,
      forceUpdate: false,
      latestVersion: null,
      apkUrl: null,
      releaseName: null,
      releaseUrl: null,
      downloadState: "idle",
      progress: 0,
      error: null,
    }),
}));
