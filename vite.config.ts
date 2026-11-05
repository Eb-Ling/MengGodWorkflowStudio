import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

export default defineConfig({
  root: resolve(import.meta.dirname, "frontend"),
  base: "./",
  plugins: [
    vue(),
    {
      name: "studio-plugin-assets",
      configureServer(server) {
        // 与离线包使用相同资源 URL；只服务固定内置资源，不接受任意路径。
        server.middlewares.use(
          "/assets/starsector/WorkflowRuntime.java",
          async (_request, response, next) => {
            try {
              const source = await readFile(
                resolve(
                  import.meta.dirname,
                  "plugins/starsector/runtime/WorkflowRuntime.java",
                ),
              );
              response.setHeader("Content-Type", "text/plain; charset=utf-8");
              response.end(source);
            } catch (error) {
              next(error);
            }
          },
        );
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4173 },
  build: {
    outDir: resolve(import.meta.dirname, "build/ui"),
    emptyOutDir: true,
    target: "chrome134",
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, "frontend/index.html"),
      },
    },
  },
});
