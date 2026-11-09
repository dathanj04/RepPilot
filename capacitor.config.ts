import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || "https://reppilot.apps.grok.bot";

const config: CapacitorConfig = {
  appId: "com.reppilot.app",
  appName: "RepPilot",
  webDir: "mobile/www",
  server: {
    url: serverUrl,
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
