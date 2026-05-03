import { updateService } from "@/services/UpdateService";
import { useUpdateStore } from "@/stores/updateStore";
import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

const AppUpdateDialog: React.FC = () => {
  const {
    visible,
    forceUpdate,
    prompt,
    latestVersion,
    releaseName,
    releaseUrl,
    downloadState,
    progress,
    error,
    hideUpdate,
    setPrompt,
  } = useUpdateStore();

  const theme = useTheme();

  const isBusy =
    downloadState === "downloading" || downloadState === "installing";

  const isPermissionPrompt =
    prompt === "install-permission" || prompt === "install-permission-return";
  const statusMessage =
    downloadState === "installing"
      ? "Opening the Android installer..."
      : forceUpdate
        ? "This update is required to continue."
        : "You can update now for the latest fixes and improvements.";

  const title = isPermissionPrompt ? "Permission Required" : "Update Available";

  return (
    <Portal>
      <Dialog
        visible={visible}
        dismissable={!forceUpdate && !isBusy}
        onDismiss={() => {
          setPrompt("none");
          hideUpdate();
        }}
        style={styles.dialog}
      >
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        <Dialog.Content>
          <View style={styles.content}>
            {releaseName ? (
              <Text
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text
                  variant="bodyLarge"
                  style={{ color: theme.colors.primary }}
                >
                  Name:&nbsp;
                </Text>
                <Text variant="bodyMedium">{releaseName}</Text>
              </Text>
            ) : null}

            <Text style={{ flexDirection: "row", alignItems: "center" }}>
              <Text variant="bodyLarge" style={{ color: theme.colors.primary }}>
                Version:&nbsp;
              </Text>
              {latestVersion ? (
                <Text variant="bodyMedium">{latestVersion}</Text>
              ) : (
                "Unknown"
              )}
            </Text>

            {isPermissionPrompt ? (
              <Text variant="bodyMedium">
                {prompt === "install-permission"
                  ? "To install this update, allow installs from this app in your Android settings. Tap Continue to proceed."
                  : "Tap Continue to resume the update."}
              </Text>
            ) : (
              <Text variant="bodyMedium">{statusMessage}</Text>
            )}

            {(downloadState === "downloading" ||
              downloadState === "installing") && (
              <ProgressBar progress={progress} style={styles.progress} />
            )}

            {error ? (
              <Text
                variant="bodyMedium"
                style={[styles.error, { color: theme.colors.error }]}
              >
                {error}
              </Text>
            ) : null}
          </View>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <View style={styles.actionsRow}>
            {!forceUpdate && !isBusy ? (
              <Button
                compact
                contentStyle={styles.secondaryActionContent}
                onPress={() => {
                  setPrompt("none");
                  hideUpdate();
                }}
              >
                {isPermissionPrompt ? "Cancel" : "Later"}
              </Button>
            ) : null}

            {releaseUrl && !isBusy && !isPermissionPrompt ? (
              <Button
                compact
                contentStyle={styles.secondaryActionContent}
                onPress={() => {
                  void Linking.openURL(releaseUrl);
                }}
              >
                View Notes
              </Button>
            ) : null}

            <Button
              mode="contained"
              disabled={isBusy}
              contentStyle={styles.primaryActionContent}
              onPress={() => {
                if (prompt === "install-permission") {
                  setPrompt("install-permission-return");
                  void updateService.openInstallPermissionSettings();
                  return;
                }

                setPrompt("none");
                void updateService.startDownloadAndInstall();
              }}
            >
              {isPermissionPrompt
                ? "Continue"
                : downloadState === "download-failed"
                  ? "Retry"
                  : "Update"}
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 24,
  },
  title: {
    paddingBottom: 0,
  },
  content: {
    gap: 8,
  },
  progress: {
    marginTop: 4,
  },
  error: {
    marginTop: 4,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  actionsRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  secondaryActionContent: {
    paddingHorizontal: 4,
  },
  primaryActionContent: {
    paddingHorizontal: 12,
  },
});

export default AppUpdateDialog;
