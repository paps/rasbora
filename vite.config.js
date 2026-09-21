import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ["**/worktrees/**"],
    },
  },
  // Scan this app's entry point, not HTML files in other worktrees.
  optimizeDeps: {
    entries: ["index.html"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
