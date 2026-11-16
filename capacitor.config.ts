import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || "https://reppilot.app";

const target = new URL(serverUrl);
if (target.protocol !== "https:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
  throw new Error("CAPACITOR_SERVER_URL must be an HTTPS origin without credentials, a path, or query parameters.");
}

const config: CapacitorConfig = {
  appId: "com.reppilot.app",
  appName: "RepPilot",
  webDir: "mobile/www",
  appendUserAgent: " RepPilotNative/1.0",
  server: {
    url: serverUrl,
    androidScheme: "https",
    cleartext: false,
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
