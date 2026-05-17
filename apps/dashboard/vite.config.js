import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  envDir: "../..",
  plugins: [tailwindcss(), react()],
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: ["eip-dashboard.up.railway.app"],
  },
});
