/**
 * SOVEREIGN MATRIX — Mobile App Configuration (Expo)
 *
 * This config is used by `npx create-expo-app` after setup.
 * Copy this into the generated Expo project.
 */

export default {
  expo: {
    name: "Sovereign Matrix",
    slug: "sovereign-matrix",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "sovereign",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#030303",
    },
    ios: {
      bundleIdentifier: "agency.sovereignmatrix.app",
      supportsTablet: true,
      infoPlist: {
        NSMicrophoneUsageDescription: "Voice delegation to AI agents",
        NSSpeechRecognitionUsageDescription: "Voice commands for agent control",
      },
    },
    android: {
      package: "agency.sovereignmatrix.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#030303",
      },
    },
    plugins: [
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#10b981",
        },
      ],
    ],
    extra: {
      apiBaseUrl: "https://sovereignmatrix.agency",
      eas: {
        projectId: "sovereign-matrix-mobile",
      },
    },
  },
};
