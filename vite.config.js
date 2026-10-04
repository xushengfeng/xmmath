import { defineConfig } from "vite";
import { resolve } from "path";
import { reviewServer } from "./test/review/plugin.mjs";

export default defineConfig({
	// review 页的 dev 中间件（apply: "serve"，不影响 build）
	plugins: [reviewServer()],
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
