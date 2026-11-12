import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const FIREBASE_KEYS = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"];

// A production build without the backend URL would ship a site that silently calls localhost: stop with a clear
// message instead (on Vercel: Project → Settings → Environment Variables, then redeploy)
const checkProductionEnv = (env: Record<string, string>) => {
  if (!/^https?:\/\/.+/.test(env.VITE_API_URL ?? "")) {
    throw new Error("VITE_API_URL must be set to the backend URL ending in /api (e.g. https://chargehub-api.onrender.com/api)");
  }
  const missing = FIREBASE_KEYS.filter((key) => !env[key]);
  if (missing.length) console.warn(`⚠️  ${missing.join(", ")} not set: Google sign-in will not work`);
};

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") checkProductionEnv(loadEnv(mode, process.cwd(), "VITE_"));
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Strip console/debugger statements from production bundles
    esbuild: mode === "production" ? { drop: ["console", "debugger"] } : undefined,
    build: {
      rollupOptions: {
        output: {
          // Large libraries in their own long-term-cacheable chunks (matched by package path so
          // shared helpers stay in the main bundle and pages only load the libraries they use)
          manualChunks(id) {
            if (id.includes("commonjsHelpers")) return "vendor"; // Rollup's CommonJS interop helper, shared by all chunks
            if (!id.includes("node_modules")) return undefined;
            // Core runtime + tiny utilities shared with the chart library (otherwise pulled into the charts chunk)
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge)\//.test(id)) return "vendor";
            if (/node_modules\/(recharts|d3-[^/]+|victory-vendor)\//.test(id)) return "charts";
            if (/node_modules\/leaflet\//.test(id)) return "map";
            if (/node_modules\/(firebase|@firebase)\//.test(id)) return "firebase";
            return undefined;
          },
        },
      },
    },
  };
});
