import { ExpoConfig, ConfigContext } from "@expo/config";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";

loadEnv();

const packageJsonPath = path.resolve(__dirname, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  name?: string;
  version?: string;
};

const version = packageJson.version ?? "0.0.0";
const versionSegments = version
  .split(".")
  .map((segment) => Number.parseInt(segment, 10));
const [major = 0, minor = 0, patch = 0] = versionSegments;
const androidVersionCode = major * 10000 + minor * 100 + patch;

const requireEnv = (key: string, { optional = false } = {}) => {
  const value = process.env[key];

  if (!value && !optional) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const projectConfig: ExpoConfig = {
  name: "en-study",
  slug: "bwcystapp",
  version,
  orientation: "portrait",
  icon: "./Vocab.png",
  scheme: [
    "haloword",
    "com.googleusercontent.apps.1040547063297-kghqjd3jrk7oiai1viu6hnp030pi99vb",
  ],
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.bwcyst.chiwordstudy",
  },
  android: {
    versionCode: androidVersionCode,
    package: "com.bwcyst.chiwordstudy",
    adaptiveIcon: {
      foregroundImage: "./Vocab.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    intentFilters: [
      {
        action: "VIEW",
        data: [
          {
            scheme: "com.googleusercontent.apps.1040547063297-kghqjd3jrk7oiai1viu6hnp030pi99vb",
            host: "oauth2redirect",
            pathPrefix: "/google",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    "react-native-edge-to-edge",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    google: {
      androidClientId: "1040547063297-kghqjd3jrk7oiai1viu6hnp030pi99vb.apps.googleusercontent.com",
    },
    eas: {
      projectId: "4726f1b8-456d-47d3-829a-4d682802dce9",
    },
    buildDate: process.env.EXPO_PUBLIC_BUILD_DATE ?? new Date().toISOString(),
    openaiApiKey: requireEnv("EXPO_PUBLIC_OPENAI_API_KEY", { optional: true }),
  },
  owner: "bwcyst",
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...projectConfig,
});
