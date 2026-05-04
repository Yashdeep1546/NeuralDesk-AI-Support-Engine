import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "embed.ts"),
      name: "NeuralDeskWidget",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        extend: true,
        // Force output to widget.js (not widget.iife.js)
        entryFileNames: "widget.js",
      }
    }
  },
  server: {
    port: 3002,
    open: "/demo.html"
  },
});
