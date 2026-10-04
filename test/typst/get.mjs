// 从上游 typst 测试例目录抽取数学式，写入语料 test/fixtures/math.json。
// 用法：把 typst 仓库的 tests/suite/math/*.typ 放到 test/typst/math/（该目录已 gitignore），
// 然后 node test/typst/get.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const mathDirPath = join(here, "math");
const OUT = join(root, "test/fixtures/math.json");

const cases = [];
for (const file of readdirSync(mathDirPath).sort()) {
	const content = readFileSync(join(mathDirPath, file), "utf8");
	const cat = file.replace(/\.typ$/, "");
	const l = [];
	let s = false;
	for (const t of content) {
		if (t === "$") {
			s = !s;
			if (s) l.push("");
			continue;
		}
		if (s) l[l.length - 1] += t;
	}
	// 与旧版一致：内容以空格/换行开头即 typst 块级公式
	l.forEach((text, i) => {
		cases.push({
			id: `${cat}-${String(i + 1).padStart(2, "0")}`,
			cat,
			text: text.trim(),
			block: text.startsWith(" ") || text.startsWith("\n"),
		});
	});
}

const cats = [...new Set(cases.map((c) => c.cat))];
writeFileSync(
	OUT,
	`${JSON.stringify({ meta: { source: "typst tests/suite/math（test/typst/get.mjs 抽取）", categories: cats.length, cases: cases.length }, cases }, null, "\t")}\n`,
);
console.log(`已写入 ${OUT}：${cases.length} 例 / ${cats.length} 类`);
