import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "firebase": ["firebase/app", "firebase/auth", "firebase/database"],
          "react":    ["react", "react-dom"],
          "lucide":   ["lucide-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  optimizeDeps: {
    include: ["firebase/app", "firebase/auth", "firebase/database"],
  },
});
