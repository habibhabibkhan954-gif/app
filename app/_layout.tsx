import AppUpdateDialog from "@/components/common/AppUpdateDialog";
import GlobalSnackbar from "@/components/common/GlobalSnackbar";
import { THEMES, ThemeKey } from "@/constants/themes";
import { playerService } from "@/services/PlayerService";
import { updateService } from "@/services/UpdateService";
import { usePlayerStore } from "@/stores/playerStore";
import { useUIStore } from "@/stores/uiStore";
import { iconFonts } from "@/utils/loadFonts";
import { setFetchConfig } from "@saavn-labs/sdk";
import { useFonts } from "expo-font";
import { Link, Stack } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import * as SplashScreen from "expo-splash-screen";
import { setStatusBarBackgroundColor, StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  AppState,
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";
import { configureFonts, PaperProvider } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync();

setFetchConfig({
  baseUrl: "https://sausico.pages.dev/saavn",
});

const fonts = configureFonts({
  config: {
    fontFamily: "SpotifyMedium",
  },
});

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    SpotifyMedium: require("../assets/fonts/SpotifyMedium.ttf"),
    ...iconFonts,
  });

  const { restoreLastTrack } = usePlayerStore();
  const { currentTheme, biometricsEnabled } = useUIStore();
  const [isUnlocked, setIsUnlocked] = useState(false);

  const theme = useMemo(() => {
    const selectedTheme = THEMES[currentTheme as ThemeKey] || THEMES.spotify;
    return {
      ...selectedTheme,
      fonts,
      roundness: 12,
    };
  }, [currentTheme]);

  useEffect(() => {
    if (fontsLoaded) {
      const text = RNText as typeof RNText & {
        defaultProps?: { style?: unknown };
      };
      text.defaultProps = {
        ...text.defaultProps,
        style: [text.defaultProps?.style, { fontFamily: "SpotifyMedium" }],
      };

      const textInput = RNTextInput as typeof RNTextInput & {
        defaultProps?: { style?: unknown };
      };
      textInput.defaultProps = {
        ...textInput.defaultProps,
        style: [textInput.defaultProps?.style, { fontFamily: "SpotifyMedium" }],
      };
    }
  }, [fontsLoaded]);

  useEffect(() => {
    playerService.initialize();
    void updateService.checkOnLaunch();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "inactive") {
        playerService.stop();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        if (biometricsEnabled) {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (hasHardware && isEnrolled) {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: "Unlock Sausico",
              fallbackLabel: "Use Passcode",
            });

            setIsUnlocked(result.success);
          } else {
            setIsUnlocked(true);
          }
        } else {
          setIsUnlocked(true);
        }
      } catch (error) {
        console.error("[Layout] Biometric auth error:", error);
        setIsUnlocked(true);
      }
    };

    if (fontsLoaded || fontError) {
      void handleAuth();
    }
  }, [fontsLoaded, fontError, biometricsEnabled]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && isUnlocked) {
      void SplashScreen.hideAsync();
      void restoreLastTrack();
    }
  }, [fontsLoaded, fontError, restoreLastTrack, isUnlocked]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (!isUnlocked && biometricsEnabled) {
    return null;
  }

  return (
    <PaperProvider theme={theme}>
      <StatusBar
        backgroundColor={theme.colors.background}
        style={theme.dark ? "light" : "dark"}
      />
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={["top", "bottom", "left", "right"]}
      >
        <Link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@mdi/font/css/materialdesignicons.min.css"
        />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="song/[id]"
            options={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
              gestureEnabled: false,
              animationDuration: 0,
            }}
          />
          <Stack.Screen
            name="album/[id]"
            options={{
              presentation: "modal",
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="artist/[id]"
            options={{
              presentation: "modal",
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
          <Stack.Screen
            name="playlist/[id]"
            options={{
              presentation: "modal",
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
        </Stack>
        <AppUpdateDialog />
        <GlobalSnackbar />
      </SafeAreaView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#121212",
  },
  screenStyle: {
    backgroundColor: "#121212",
  },
});
