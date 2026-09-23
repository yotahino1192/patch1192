import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Registered App ID; shared by Debug and Release (environment is in the sealed bundle).
  appId: "com.patch.learning",
  appName: "Patch",
  webDir: "dist/mobile",
  // CSS owns safe-area padding; keep the WebView and its scroll surface white.
  ios: { contentInset: "never", backgroundColor: "#ffffff" },
};

export default config;
