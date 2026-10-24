import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { target: ["chrome107", "edge107", "firefox104", "safari16"] },
  base: "/stock-investment-assistant/",
});
