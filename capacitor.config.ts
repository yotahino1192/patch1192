import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Development identifier: replace with your registered ID before distribution.
  appId: "com.patch.learning",
  appName: "Patch",
  webDir: "dist/mobile",
  // CSS owns safe-area padding; keep the WebView and its scroll surface white.
  ios: { contentInset: "never", backgroundColor: "#ffffff" },
};

export default config;
