import math from "../fixtures/math.json";

export type CorpusCase = {
	id: string;
	cat: string;
	text: string;
	block: boolean;
	// 该例想钉住的规则说明（可选）；review 页卡片上显示，方便对照官方图时知道该看什么
	desc?: string;
	// math.json 里标 `knownBroken: true` 的用例：当前实现会抛错（未实现的函数），
	// 全语料跑通断言放行它们；修好后字段还在 → 断言反过来变红，逼你摘掉标记
	knownBroken?: boolean;
};

const ALL: CorpusCase[] = math.cases as CorpusCase[];

// 渲染阶段会抛错的语料 id（从用例上的 knownBroken 字段派生）
export const knownBroken = ALL.filter((c) => c.knownBroken).map((c) => c.id);

export function allCases(): CorpusCase[] {
	return ALL;
}
