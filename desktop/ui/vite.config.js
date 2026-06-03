import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react":    ["react","react-dom"],
          "firebase": ["firebase/app","firebase/auth","firebase/database"],
          "lucide":   ["lucide-react"],
        },
      },
    },
    minify: "esbuild",
    target: ["es2021","chrome100","safari15"],
  },
  envPrefix: ["VITE_","TAURI_"],
});
