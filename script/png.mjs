// 极简 PNG 编解码（只用 node:zlib，不引依赖）——script/cmp.mjs 并排拼图用。
// 解码：8-bit 非交错、colorType 0/2/4/6（灰度/RGB/灰度+alpha/RGBA），全部转 RGBA8；
// 编码：固定 RGBA8、filter 0。两个 render 工具产出的图（firefox/typst）都是 8-bit
// 非交错，够用；碰到 palette/16-bit/隔行会明确报错而不是解出花屏。
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---- CRC32（PNG chunk 校验） ----
const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

// ---- decode ----
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }; // colorType -> 每像素字节数（8-bit）

export function decodePng(buf) {
	if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE))
		throw new Error("不是 PNG（签名不对）");
	let off = 8;
	let w = 0;
	let h = 0;
	let bitDepth = 0;
	let colorType = 0;
	let interlace = 0;
	const idat = [];
	while (off + 8 <= buf.length) {
		const len = buf.readUInt32BE(off);
		const type = buf.toString("ascii", off + 4, off + 8);
		const data = buf.subarray(off + 8, off + 8 + len);
		if (type === "IHDR") {
			w = data.readUInt32BE(0);
			h = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
			interlace = data[12];
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "IEND") {
			break;
		}
		off += 12 + len; // 4 len + 4 type + data + 4 crc
	}
	const ch = CHANNELS[colorType];
	if (!ch) throw new Error(`不支持的 PNG colorType=${colorType}（只处理 0/2/4/6）`);
	if (bitDepth !== 8) throw new Error(`不支持的 PNG bitDepth=${bitDepth}（只处理 8）`);
	if (interlace !== 0) throw new Error("不支持隔行 PNG（interlace=1）");

	const raw = inflateSync(Buffer.concat(idat));
	const stride = w * ch;
	if (raw.length !== (stride + 1) * h)
		throw new Error(`PNG 数据长度不对：${raw.length} != ${(stride + 1) * h}`);

	// 反扫描线 filter（0 none / 1 sub / 2 up / 3 average / 4 paeth）
	const lines = Buffer.alloc(stride * h);
	for (let y = 0; y < h; y++) {
		const filter = raw[y * (stride + 1)];
		const src = y * (stride + 1) + 1;
		const dst = y * stride;
		for (let i = 0; i < stride; i++) {
			const x = raw[src + i];
			const a = i >= ch ? lines[dst + i - ch] : 0;
			const b = y > 0 ? lines[dst - stride + i] : 0;
			const c = i >= ch && y > 0 ? lines[dst - stride + i - ch] : 0;
			let v;
			switch (filter) {
				case 0:
					v = x;
					break;
				case 1:
					v = x + a;
					break;
				case 2:
					v = x + b;
					break;
				case 3:
					v = x + ((a + b) >> 1);
					break;
				case 4: {
					const p = a + b - c;
					const pa = Math.abs(p - a);
					const pb = Math.abs(p - b);
					const pc = Math.abs(p - c);
					v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
					break;
				}
				default:
					throw new Error(`PNG filter=${filter} 不认识`);
			}
			lines[dst + i] = v & 0xff;
		}
	}

	// -> RGBA8
	const rgba = Buffer.alloc(w * h * 4);
	for (let i = 0; i < w * h; i++) {
		const s = i * ch;
		const d = i * 4;
		if (colorType === 6) {
			rgba[d] = lines[s];
			rgba[d + 1] = lines[s + 1];
			rgba[d + 2] = lines[s + 2];
			rgba[d + 3] = lines[s + 3];
		} else if (colorType === 2) {
			rgba[d] = lines[s];
			rgba[d + 1] = lines[s + 1];
			rgba[d + 2] = lines[s + 2];
			rgba[d + 3] = 255;
		} else if (colorType === 0) {
			rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s];
			rgba[d + 3] = 255;
		} else {
			// colorType 4: 灰度 + alpha
			rgba[d] = rgba[d + 1] = rgba[d + 2] = lines[s];
			rgba[d + 3] = lines[s + 1];
		}
	}
	return { width: w, height: h, data: rgba };
}

// ---- encode（RGBA8, filter 0） ----
function chunk(type, data) {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, "ascii");
	data.copy(out, 8);
	out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
}

export function encodePng({ width, height, data }) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bitDepth
	ihdr[9] = 6; // colorType RGBA
	ihdr[10] = 0; // compression
	ihdr[11] = 0; // filter method
	ihdr[12] = 0; // no interlace

	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0; // filter none
		data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}
	return Buffer.concat([
		SIGNATURE,
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// ---- canvas helpers（背景已填白，这里做 alpha 合成贴图） ----
export function whiteCanvas(width, height) {
	const data = Buffer.alloc(width * height * 4, 255);
	return { width, height, data };
}

// 把 src 贴到 dst 的 (x, y)（alpha over，目标非透明时按 src alpha 混合）
export function composite(dst, src, x, y) {
	for (let sy = 0; sy < src.height; sy++) {
		const ty = y + sy;
		if (ty < 0 || ty >= dst.height) continue;
		for (let sx = 0; sx < src.width; sx++) {
			const tx = x + sx;
			if (tx < 0 || tx >= dst.width) continue;
			const s = (sy * src.width + sx) * 4;
			const d = (ty * dst.width + tx) * 4;
			const a = src.data[s + 3];
			if (a === 255) {
				dst.data[d] = src.data[s];
				dst.data[d + 1] = src.data[s + 1];
				dst.data[d + 2] = src.data[s + 2];
				dst.data[d + 3] = 255;
			} else if (a > 0) {
				const inv = 255 - a;
				dst.data[d] = (src.data[s] * a + dst.data[d] * inv) / 255;
				dst.data[d + 1] = (src.data[s + 1] * a + dst.data[d + 1] * inv) / 255;
				dst.data[d + 2] = (src.data[s + 2] * a + dst.data[d + 2] * inv) / 255;
				dst.data[d + 3] = 255;
			}
		}
	}
}

// 竖线（左右两图的分隔线）
export function vline(dst, x, rgb = 192) {
	for (let y = 0; y < dst.height; y++) {
		const d = (y * dst.width + x) * 4;
		dst.data[d] = rgb;
		dst.data[d + 1] = rgb;
		dst.data[d + 2] = rgb;
		dst.data[d + 3] = 255;
	}
}
