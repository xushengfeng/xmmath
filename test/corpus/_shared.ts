import { describe, expect, it } from "vitest";
import { toMMLV } from "../../src/main.js";
import { toHtml, type VNode } from "../../src/vdom.js";
import math from "../fixtures/math.json";

export type CorpusCase = {
	id: string;
	cat: string;
	text: string;
	block: boolean;
};

const ALL: CorpusCase[] = math.cases as CorpusCase[];

// 目前会在渲染阶段抛错的语料（未实现的函数），快照里以 error 形式记录
export const knownBroken = ["class-01", "interactions-24"];

export function allCases(): CorpusCase[] {
	return ALL;
}

export function casesOf(cat: string): CorpusCase[] {
	return ALL.filter((c) => c.cat === cat);
}

// 紧凑快照形式：元素 = [tag, attrs?, ...children]，文本 = string
function compact(n: VNode): unknown {
	if (n.type === "text") return n.text;
	const kids = n.childNodes.map(compact);
	if (n.type === "frag") return ["#frag", ...kids];
	const attrs: Record<string, unknown> = { ...n.attrs };
	if (Object.keys(n.style).length) attrs.style = { ...n.style };
	return Object.keys(attrs).length ? [n.tag, attrs, ...kids] : [n.tag, ...kids];
}

export function renderCase(c: CorpusCase) {
	const v = toMMLV(c.text, !c.block);
	return { vdom: compact(v), html: toHtml(v) };
}

function run(c: CorpusCase): Record<string, unknown> {
	try {
		return renderCase(c) as Record<string, unknown>;
	} catch (e) {
		return { error: String(e instanceof Error ? e.message : e) };
	}
}

// 一个文件跑完整份 math.json：每个分类一个 describe，每例一个 it + 快照。
// 渲染抛错的用例把错误写进快照，避免整批中断，也让已知缺口可见。
export function describeCorpus() {
	for (const cat of [...new Set(ALL.map((c) => c.cat))]) {
		describe(`corpus/${cat}`, () => {
			for (const c of casesOf(cat)) {
				it(c.id, () => {
					expect({ text: c.text, block: c.block, ...run(c) }).toMatchSnapshot();
				});
			}
		});
	}
}
