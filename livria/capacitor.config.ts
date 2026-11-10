import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.livria.app",
  appName: "LIVRIA",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { backgroundColor: "#f7f5ef", allowMixedContent: false },
};
export default config;
