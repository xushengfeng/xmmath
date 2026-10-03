// Sync typst symbols/emoji from the `codex` crate into src/symbols.json & src/emoji.json.
//
// typst moved its symbol data out of sym.rs/emoji.rs into the `codex` crate
// (crates.io `codex`), whose source of truth is two plain-text files:
//   src/modules/sym.txt   src/modules/emoji.txt
// The grammar mirrors codex's build.rs parser:
//   name value            -> a single symbol
//   name                  -> module start (with `{`) OR a symbol with only variants
//   .path value           -> a variant (modifier) of the preceding symbol
//   name {  ...  }        -> a nested module
//   @deprecated: msg      -> annotates the next definition (ignored here)
//   // ...                -> line comment
//   \u{XXXX} / \vs{name}  -> escapes (decodeValue below)
//
// Usage:
//   node test/symbols/gen.mjs                 # fetch pinned CODEX_REF
//   node test/symbols/gen.mjs sym.txt emoji.txt   # use local files instead
//   CODEX_REF=v0.4.0 node test/symbols/gen.mjs     # override version
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const CODEX_REPO = "typst/codex";
const CODEX_REF = process.env.CODEX_REF || "v0.3.0"; // bundled with typst v0.15.1
const SRC = dirname(dirname(dirname(fileURLToPath(import.meta.url)))) + "/src";

const VS = {
	1: "︀",
	2: "︁",
	3: "︂",
	4: "︃",
	5: "︄",
	6: "︅",
	7: "︆",
	8: "︇",
	9: "︈",
	10: "︉",
	11: "︊",
	12: "︋",
	13: "︌",
	14: "︍",
	15: "︎",
	text: "︎",
	16: "️",
	emoji: "️",
};

function decodeValue(text) {
	let result = "";
	let t = text;
	for (;;) {
		if (t.startsWith("\\u{")) {
			const end = t.indexOf("}");
			result += String.fromCodePoint(parseInt(t.slice(3, end), 16));
			t = t.slice(end + 1);
		} else if (t.startsWith("\\vs{")) {
			const end = t.indexOf("}");
			const val = t.slice(4, end);
			if (!(val in VS)) throw new Error(`bad \\vs{${val}}`);
			result += VS[val];
			t = t.slice(end + 1);
		} else {
			const i = t.indexOf("\\");
			if (i === -1) {
				result += t;
				break;
			}
			if (i === 0) throw new Error(`invalid escape: ${t}`);
			result += t.slice(0, i);
			t = t.slice(i);
		}
	}
	return result;
}

function tokenize(line) {
	const trimmed = (line.split("//")[0] ?? "").trim();
	if (trimmed === "") return { kind: "blank" };
	const sp = trimmed.indexOf(" ");
	const first = sp === -1 ? trimmed : trimmed.slice(0, sp);
	const tail = sp === -1 ? null : trimmed.slice(sp + 1).trim();
	if (first === "@deprecated:") return { kind: "deprecated", msg: tail };
	if (tail === "{") return { kind: "moduleStart", name: first };
	if (first === "}" && tail === null) return { kind: "moduleEnd" };
	if (first.startsWith("."))
		return { kind: "variant", path: first.slice(1), value: decodeValue(tail) };
	return {
		kind: "symbol",
		name: first,
		value: tail === null ? null : decodeValue(tail),
	};
}

// Recursive-descent mirror of codex build.rs parse(). Consumes `lines` in place.
function parse(lines) {
	const defs = [];
	while (lines.length) {
		const tok = lines[0];
		if (tok.kind === "moduleEnd") return defs;
		if (tok.kind === "moduleStart") {
			lines.shift();
			const children = parse(lines);
			if (lines[0]?.kind === "moduleEnd") lines.shift();
			defs.push({ name: tok.name, type: "module", children });
			continue;
		}
		if (tok.kind === "symbol") {
			lines.shift();
			const variants = [];
			while (lines[0]?.kind === "variant") variants.push(lines.shift());
			defs.push({ name: tok.name, type: "symbol", value: tok.value, variants });
			continue;
		}
		throw new Error(`unexpected token: ${JSON.stringify(tok)}`);
	}
	return defs;
}

function encodeSymbol(d) {
	if (d.variants.length === 0) {
		if (d.value == null)
			throw new Error(`symbol ${d.name}: needs value or variants`);
		return d.value;
	}
	const arr = [];
	if (d.value != null) arr.push(d.value);
	const obj = {};
	for (const v of d.variants) obj[v.path] = v.value;
	arr.push(obj);
	return arr;
}

// Modules have no default glyph; flatten children into dotted keys of one object.
function flattenModule(children, prefix, obj) {
	for (const d of children) {
		const key = prefix ? `${prefix}.${d.name}` : d.name;
		if (d.type === "module") {
			flattenModule(d.children, key, obj);
		} else if (d.variants.length === 0) {
			obj[key] = d.value;
		} else {
			if (d.value != null) obj[key] = d.value;
			for (const v of d.variants) obj[`${key}.${v.path}`] = v.value;
		}
	}
}

function encodeTop(defs) {
	const out = {};
	for (const d of defs) {
		if (d.type === "module") {
			const obj = {};
			flattenModule(d.children, "", obj);
			out[d.name] = [obj];
		} else {
			out[d.name] = encodeSymbol(d);
		}
	}
	return out;
}

// Matches src/normalize.ts simple_dot(): flatten JSON to resolved name->char map.
function resolveKeys(json) {
	const ss = {};
	for (const i in json) {
		const v = json[i];
		if (typeof v === "string") {
			ss[i] = v;
			continue;
		}
		for (const o of v) {
			if (typeof o === "string") {
				ss[i] = o;
			} else {
				if (!ss[i]) ss[i] = o[Object.keys(o)[0]];
				for (const j in o) ss[`${i}.${j}`] = o[j];
			}
		}
	}
	return ss;
}

async function fetchTxt(which) {
	const url = `https://raw.githubusercontent.com/${CODEX_REPO}/${CODEX_REF}/src/modules/${which}.txt`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
	return res.text();
}

function gen(text) {
	const toks = text
		.split("\n")
		.map(tokenize)
		.filter((t) => t.kind !== "blank" && t.kind !== "deprecated");
	return encodeTop(parse(toks));
}

function loadOld(name) {
	try {
		return JSON.parse(readFileSync(`${SRC}/${name}`, "utf8"));
	} catch {
		return {};
	}
}

function summarize(name, oldJson, newJson) {
	const o = resolveKeys(oldJson);
	const n = resolveKeys(newJson);
	const added = Object.keys(n).filter((k) => !(k in o));
	const removed = Object.keys(o).filter((k) => !(k in n));
	console.log(
		`${name}: ${Object.keys(o).length} -> ${Object.keys(n).length} (added ${added.length}, removed ${removed.length})`,
	);
	if (removed.length)
		console.log(`  removed (typst renamed/dropped): ${removed.join(", ")}`);
}

async function main() {
	const [symArg, emojiArg] = process.argv.slice(2);
	const symText = symArg ? readFileSync(symArg, "utf8") : await fetchTxt("sym");
	const emojiText = emojiArg
		? readFileSync(emojiArg, "utf8")
		: await fetchTxt("emoji");

	const sym = gen(symText);
	const emoji = gen(emojiText);

	summarize("symbols", loadOld("symbols.json"), sym);
	summarize("emoji", loadOld("emoji.json"), emoji);

	writeFileSync(`${SRC}/symbols.json`, JSON.stringify(sym, null, "\t") + "\n");
	writeFileSync(`${SRC}/emoji.json`, JSON.stringify(emoji, null, "\t") + "\n");
	console.log(
		`wrote ${SRC}/symbols.json and ${SRC}/emoji.json (codex ${CODEX_REF})`,
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
