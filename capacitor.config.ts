import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Development identifier: replace with your registered ID before distribution.
  appId: "com.patch.learning",
  appName: "Patch",
  webDir: "dist/mobile",
  ios: { contentInset: "automatic" },
};

export default config;
