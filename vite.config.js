import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    // 打包配置
    build: {
        lib: {
            entry: resolve(__dirname, "src/main.ts"),
            name: "xmmath",
            fileName: (format) => `xmmath.${format}.js`,
        },
        sourcemap: true,
    },
});
