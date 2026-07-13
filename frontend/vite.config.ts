import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8010",
        changeOrigin: true,
      },
    },
  },
});
