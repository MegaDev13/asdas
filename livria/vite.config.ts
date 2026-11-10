import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.WEB_BASE || "./",
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
  server: { host: "0.0.0.0", allowedHosts: true },
});
