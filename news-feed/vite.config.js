import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Avatar Studio TTS + Rhubarb — local dev only; see public/avatar-studio/CHANGES.md
import { avatarStudioApi, avatarApiProxyBypass } from "./vite-plugins/avatarStudioApi.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), avatarStudioApi()],
  server: {
    proxy: {
      // Java backend for news-feed APIs; avatar routes bypass via avatarApiProxyBypass
      "/api": {
        target: "http://localhost:8080",
        bypass: avatarApiProxyBypass,
      },
      "/auth": "http://localhost:8080",
      "/ai": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai/, ""),
      },
    },
  },
});