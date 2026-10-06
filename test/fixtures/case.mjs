// 语料取例器：test/fixtures/math.json 按 id 读取，供 render 工具（--id）与
// script/ 下的工具共用。vitest 侧的 test/corpus/_shared.ts 自己读同一份 json
// （那边要从字段派生 knownBroken 豁免清单，是 TS 测试的事，两边不混用）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "math.json");

let cache = null;
export function loadCases() {
	if (!cache) cache = JSON.parse(readFileSync(FILE, "utf8")).cases;
	return cache;
}

// 按 id 取一例；id 重复（review 页顶部会警告的那类脏数据）时用第一个并告警。
export function findCase(id) {
	const all = loadCases();
	const hits = all.filter((c) => c.id === id);
	if (!hits.length) {
		const near = all.map((c) => c.id).filter((x) => x.includes(id)).slice(0, 8);
		throw new Error(
			`no corpus case with id "${id}"${near.length ? ` (similar: ${near.join(", ")})` : ""}`,
		);
	}
	if (hits.length > 1)
		console.error(`warning: ${hits.length} cases share id "${id}", using the first`);
	return hits[0];
}

// render 工具共用的 --id 解析：把语料例的文字与 block/inline 模式落到 opts 上。
// 显式 --inline / --block 覆盖语料的 block 标志；--id 与 --expr/--code/--file 互斥。
// 返回 null 表示没用 --id，返回 { ok:false, error } 表示参数有问题。
export function applyCase(opts) {
	if (opts.id == null) return null;
	if (opts.expr != null || opts.code != null || opts.file != null)
		return { ok: false, error: "--id 与 --expr/--code/--file 互斥" };
	if (opts.inline && opts.block)
		return { ok: false, error: "--inline 与 --block 互斥" };
	let c;
	try {
		c = findCase(opts.id);
	} catch (e) {
		return { ok: false, error: e.message };
	}
	opts.expr = c.text;
	if (!opts.inline && !opts.block) opts.inline = !c.block; // 语料声明的模式
	opts.caseId = c.id;
	opts.caseMode = c.block ? "block" : "inline";
	return { ok: true, caseId: c.id, block: c.block };
}
