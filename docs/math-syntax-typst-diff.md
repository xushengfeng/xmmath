# Typst 数学语法差异分析：本库 (lan 0.11.1) vs Typst v0.15.1

> 本文档对比 **数学语法/语言层面** 的差异，不含符号位图/字形增删（符号数据已单独同步到 codex v0.3.0 / typst 0.15.1）。
>
> - 本库语言基线：`src/main.ts` 的 `version.lan = "0.11.1"`
> - Typst 最新稳定版：**v0.15.1 (2026-07-17)**
> - 覆盖区间：0.12.0 → 0.15.1 各版本 changelog 的 "Math" 及影响 math-mode 的 "Syntax" 条目
>
> 状态标记：🟢 已支持 · 🟡 部分/被动支持（解析得到但渲染忽略） · 🔴 未支持 · ⚠️ 破坏性变更（需改解析器/渲染器）

---

## 0. 一句话结论

- **语法主干未变**：`$…$`/`$$…$$`、`^`/`_` 附着、`limits`/`scripts`、`/` 分数、`f(...)` 调用、素数 `'`、阶乘 `!`、点号 `.`、shorthand（`->` 等）——0.12→0.15 **文法本身都没改**，本库的解析流水线（`ast → ast2 → ast3`）结构仍然成立。
- **真正的 gap** 集中在：0.12 的分隔符/`~`/可调用符号变更，0.13 的调用参数扩展 + 重复修饰符报错，0.14 的 `frac.style`/`scr`/`accent.dotless`/优先级微调，0.15 的 `lr`/`stretch` 尺寸语义、分隔符即函数、`class` 非递归、以及 cramped 与 MathML Core 对齐。
- 另有**一批本库自身的历史缺口**（与版本无关）在第 6 节列出，其中最紧要的是行注释吞 token 的解析 bug。

---

## 1. 各版本数学语法变更清单

### v0.12.0 (2024-10)
| 项 | 类型 | 说明 / 解析器·渲染器要做的事 | 本库 |
|---|---|---|---|
| 块级公式可跨页 `show math.equation: set block(breakable:true)` | 🆕 新特性（多行/`&` 对齐前提） | 单个 `$…$` 视作多行序列 + 跨行 `&` 对齐 | 🟡 有多行 `\` + `&` → `x_table`，无 breakable 概念 |
| `stretch` 函数（`stretch("|", size:150%)`） | 🆕 | 显式字形拉伸 | 🔴 无 `stretch` |
| `floor`/`ceil` 成为可调用符号（`floor(x) = lr(floor.l x floor.r)`） | 🆕/行为 | `floor.l`/`ceil.r` 等带 `(...)` 时生成 `lr` 组 | 🟡 有 `floor`/`ceil`（`lr_f`）但无 `.l`/`.r` 可调用变体 |
| ⚠️ 移除 `mat`/`vec`/`cases` 的 `delim:"||"`（改 `bar.double`）；`delim` 现接受任意 Unicode fence 单字符 | 🗑 移除（minor breaking） | 停止支持多字符 delim 串；接受任意单围栏字符 | ⚠️ `delimPair` 仍把 `"||"`→`‖ ‖`（`src/main.ts:42-49`），与新版相悖 |
| `mat.align` / `vec.align` 参数 | 🆕 | 按列内容对齐 | 🔴 未实现 |
| `underparen/overparen/undershell/overshell` | 🆕 | 新增 under/over 元素 | 🔴 未实现 |
| ⚠️ `~` 在数学内重绑为 `tilde.op`（`a ~ b` → `∼`，且为可调用 accent） | 🔄 行为（breaking） | shorthand `~` 目标名要改 | ⚠️ 本库 `~` → `space.nobreak`（`src/normalize.ts` shorthand），**与 0.12+ 不同** |
| `lt.curly`/`gt.curly` → `prec`/`succ` 等 `sym` 标识符改名 | 🗑/🔄（标识符级） | 解析名字表更新 | 🟢 已随符号同步刷新（数据层，非文法） |

### v0.13.0 (2025-02)
| 项 | 类型 | 说明 | 本库 |
|---|---|---|---|
| 数学内单字母串 `$"a"$` 由斜体改正体（与多字母一致） | 🆕 修复（影响 `$"…"$` 语义） | 数学里的 string 原子按文本处理，非标识符 | 🟡 有 `str` 类型→`ms`，但字体处理与 typst 文本整形未必一致 |
| 数学函数调用支持 **连字符命名参数** 和 **参数展开** `f(my-arg:1)`、`g(..args)` | 🆕 语法 | 参数表与代码模式统一 | 🔴 `f_attr` 不认 `-` 命名参数与 `..` 展开 |
| `lcm` 文本算子 | 🆕 | 加入 `op` 家族 | 🔴 `opl` 无 `lcm`（`src/normalize.ts`） |
| ⚠️ 重复符号修饰符变硬错误（`arrow.r.r` 类） | 🔄 行为（breaking） | 解析期校验，不再静默回落到默认 | 🔴 无校验 |
| `degree.c/degree.f/kelvin/ohm` 移除、`ohm.inv`→`Omega.inv`、`sect`→`inter`、`diff`→`partial` 等 | 🗑/🔄（标识符级） | 名字表更新 | 🟢 已随符号同步（数据层） |
| 顶层不配对 `]` 变硬错误；set 规则里标识符与 `(` 之间不得有空格；`0b…pt` 非法 | 🔄 行为（minor breaking） | 影响数学嵌入内容的解析 | 🔴 未做这些校验 |

### v0.14.0 (2025-10)
| 项 | 类型 | 说明 | 本库 |
|---|---|---|---|
| `frac.style`：`vertical/skewed/horizontal`（`#set math.frac(style:"skewed")`），且不同 style 对 `(a+b)/c` 括号的取舍不同 | 🆕 行为 | 需建模分数样式与结合/括号规则 | 🔴 `/`→`frac` 固定样式（`src/normalize.ts:797-841`） |
| `scr` 函数（圆手体 `scr(R)`） | 🆕 | 加入字体族 | 🔴 `font()`/`f` 无 `scr` |
| `accent` 新增 `dotless` 参数（`accent(i, dotless:true)` 去掉 i/j 上点） | 🆕 | 基底去点 | 🟡 `accent` 接受 dict 但忽略选项（见第 6 节） |
| 数学文本处理重写（真整形、一公式可多字体、生成字形变可 show 的 `text` 元素、缩减尺寸优先用 script 字形） | 🔄 行为（渲染内部） | 渲染层文本整形/多字体 | 🔴 本库用 `font()` 手工码点映射（仅 ASCII，希腊字母不映射） |
| `mat.augment` 扩展：增线可在首/尾、负偏移、`hline`/`vline` 接受整数或数组 | 🆕 行为 | augment 语义扩展 | 🟡 解析支持 `hline/vline` 及负数（`src/main.ts:220-252`），但 `stroke` 被忽略 |
| ⚠️ shorthand 与多位数不再比 `/` 绑定更紧（`x>=(y)/z` 解析改变） | 🔄 行为（minor breaking，优先级） | 影响 `/` 结合逻辑 | ⚠️ 本库 ast3 的 `/` pass 需复核优先级 |
| ⚠️ 把命名参数传给"作为函数的符号"由静默忽略变硬错误（`arrow.r(x, y:1)`） | 🔄 行为（minor breaking） | 需报错 | 🔴 无 |
| `mid` 不再强制 math class `"large"`，默认 `"relation"`（`lr(a mid b)` 间距改变） | 🔄 行为 | 影响 `<mo>` 间距/class | 🟡 有 `mid`（`stretchy`）但 class 逻辑不同 |
| `<>` 空标签非法 | 🔄 行为（minor breaking） | 解析校验 | 🔴 无 |
| ⚠️ 标识符改名：`angle.l/r`→`chevron.l/r`、`quote.angle`→`quote.chevron`、`*.circle`→`*.o`、`paren/bracket/shell.double`→`.stroked`、`diff`→`partial`、Hebrew 改名等（本版本仍可用，0.15 移除） | 🔄/⚠️（标识符级） | 名字表更新 | 🟢 已随符号同步到 0.15 终态（本库已用 `bracket.l.stroked`） |

### v0.14.1 / v0.14.2 (2025-12)
- 0.14.1：修复 `arrow.l.r` 不能作 accent；单字母串随周围空格反应；`mat`/`vec` 围栏与空格无关的间距。
- 0.14.2：**无**数学条目（纯安全修复）。

### v0.15.0 (2026-06)
| 项 | 类型 | 说明 | 本库 |
|---|---|---|---|
| ⚠️ `lr`/`stretch` 尺寸比相对**基础字形**解析，绝不对已 display 缩放的字形再算（`#math.stretch(size)`、`lr(size)`） | 🔄 行为（minor breaking，迁移指南项） | `size` 解析语义变更 | 🔴 `lr(size)` 仅给首尾子元素设 `maxsize/minsize`（`src/main.ts:188-198`） |
| ⚠️ `lr` 的 `size` 对 `mid` 分隔符同等生效，且只按**内部内容高度**解析 | 🔄 行为（minor breaking） | 分隔符不再计入高度 | 🔴 |
| ⚠️ 更多分隔符符号可调用即生成 `lr`（`chevron.l(x)` 变为配对围栏，而非 `chevron.l` + `(x)` 组） | 🆕/🔄 行为（minor breaking） | 解析需按符号类别决定 `sym(…)` 是否塌缩成 `lr` | 🔴 未实现 |
| ⚠️ `math.class` 只作用于直接 body、不再递归（`#class("bin",$a+b$)`） | 🔄 行为（minor breaking） | class 传播范围改变 | 🟡 `class` 本库未实现（`class(...)` 会被静默丢弃，见第 6 节） |
| Cramped 样式与 **TeX / MathML Core** 完全一致（`class:"display"` 上下文） | 🔄 行为 | 直接利好 MathML 转换器：上下标/分数/根式间距对齐 MathML Core  crampedness | 🟡 有 `cramped` 参数位但被忽略（`display/inline/script/sscript` 只渲染 `attr[0]`） |
| 多字符符号处理改进；accent 恒叠在重叠基底前；分数/根式/under-over 线遵循 `text.stroke` | 🆕/🔄 | 渲染细节 | 🔴 |
| 修复：看似函数调用但非调用者不再当调用渲染（`$pi(1,2)$`）；素数与嵌套附着顺序（`$f'_0$`）；`cases` 对齐；`lr` 内对齐点 | 🛠 修复（解析相关） | 需按非调用符号处理 | ⚠️ 本库 ast3 会把 `pi(...)` 当带参函数（`pi` 在 `ss`/`f` 命中才成立，否则丢弃） |
| 布局类（非文法）：`underbrace` 下/上标布局、`math.op` 间距、`binom` OpenType 常量、`math.cancel` 默认长度/笔画改 `em`、box/block 内基线保留 | 🔄 行为 | 渲染层 | 🟡 |
| Symbols（codex 0.3.0 标识符级）：弃用 `gt.tri`→`gt.closed`、`lt.tri`→`lt.closed`、`join`→`bowtie.big`、`tack.*.double`→`tack.rr/ll/tt/bb`；移除 0.14 弃用的全部（`angle.l/r`、`*.double`、`sect.*`、`diff`、`*.circle`、`quote.angle.*`、`kai`、`franc`、Hebrew、`plus.small/eq.small/...`） | ⚠️/🗑（标识符级） | 名字表更新 | 🟢 已随符号同步（数据层）；但 `gt.tri`/`lt.tri` 若曾用于 shorthand 需复核 |
| （项目相关）Typst HTML 导出现已输出**原生 MathML** | 🆕 外部 | Typst 编译器自带 Typst-AST→MathML 参考实现，可对照验证本库 | — |

### v0.15.1 (2026-07)
- 仅修复（`lr`/配对分隔符内 `&` 对齐点回归；`op` 竖直错位）。**无语法变更。**

---

## 2. 破坏性变更汇总（对 v0.11.1 解析器）

按"需要动代码"的优先级：

1. **0.12**：移除 `delim:"||"`；`~` shorthand 重绑为 `tilde.op`（本库现为 `space.nobreak`，⚠️ 需决策）。
2. **0.13**：重复修饰符硬错误；单字母串改正体；新增 `f(my-arg:)` / `g(..args)` 参数语法。
3. **0.14**：shorthand/多位数 vs `/` 的结合优先级改变；命名参数传给符号函数报错；空标签非法；`mid` class 默认变 relation。
4. **0.15**：`lr`/`stretch` 尺寸解析语义；分隔符即函数（`sym(…)`→`lr`）；`class` 非递归；大规模 `sym.*` 移除（已在符号同步中落到终态）。

> 注：`^ _`、`limits/scripts`、`/` 文法、`f(...)` 调用、素数/阶乘/点号在 0.12–0.15 **均无文法级改动**，故本库 `ast3` 的主干逻辑不需要为它们改写；改动主要是"新函数/新参数/新校验/优先级细节"。

---

## 3. 各关注域裁决（明确 yes/no）

| 关注域 | 0.12–0.15 是否有文法改动 | 备注 |
|---|---|---|
| `^`/`_` 附着、`limits`/`scripts` | **否**（仅布局 + 0.15 cramped 对齐） | |
| `/` 分数 | 部分：0.14 结合优先级 + `frac.style`；0.15 cramped | |
| `mat`/`vec`/`det`/`lr`/`mid` | **是**：0.12 delim 移除/新增 + align；0.14 augment/mid；0.15 lr 尺寸/分隔符即函数 | 最活跃区域 |
| accent / under-over | **是**：0.12 underparen 等 + `~`；0.13 flac/dtls；0.14 dotless；0.15 叠放/stroke/floor-ceil-分隔符可调用 | |
| `#` 内插 | 文法基本不变（0.15 一元算子提示、0.13 lr/context 修复） | 本库算术求值仍是 TODO |
| `$…$` vs `$$…$$`、label/ref | sigil 不变；0.14 `<>` 非法；0.12 块级可断页 | |
| 数学内函数调用语法 | **是**：0.13 连字符命名参数 + `..` 展开；0.14 符号函数命名参数报错 | 本库主要缺口 |
| 新算子 | 0.13 `lcm`；0.14 math class 默认修正；0.15 `op` 间距 | |
| 多字母标识符/素数/`!`/`.`/shorthand | 文法不变（仅布局、0.15 素数顺序、0.12 `~` 例外） | |
| 数学内文本/字符串 | **是**：0.13 单字母正体、0.14 文本整形重写/多字体、0.14.1 空格反应 | 本库用码点映射近似 |
| 数学字体选择语法 | 无新语法；0.14 加 `scr` 函数 | |

---

## 4. 本库需新增/修改的清单（可执行 TODO）

**新增函数/参数（`src/main.ts` 的 `f` 注册表 + `src/normalize.ts`）**
- 🔴 `stretch`（0.12）、`mat.align`/`vec.align`（0.12）
- 🔴 `underparen/overparen/undershell/overshell`（0.12）
- 🔴 `scr` 字体函数（0.14）、`accent(dotless:)`（0.14）
- 🔴 `frac.style`（0.14）
- 🔴 `lcm` 算子（0.13）
- 🔴 调用参数：连字符命名参数 + `..` 展开（0.13）→ 改 `f_attr`
- 🔴 分隔符即函数 → `lr` 塌缩（0.15）；`lr`/`stretch` `size` 新语义（0.15）

**行为/校验调整**
- ⚠️ `~` shorthand 目标：`space.nobreak` → 对齐 typst `tilde.op`（需确认期望）
- ⚠️ `delimPair`：移除/弃用多字符 `"||"`，接受任意单 Unicode fence（0.12）
- ⚠️ shorthand/多位数 vs `/` 的绑定优先级（0.14）
- 🟡 渲染忽略的参数补齐：`cancel(angle/length/stroke)`、`accent(size)`、`script/... (cramped)`、`mat(augment.stroke)`、`class`（0.15 非递归语义）
- 🟡 cramped 与 MathML Core 对齐（0.15）——本库若用 `<mo form>`/`scriptlevel` 需复核间距

**低优先（校验类）**
- 🔴 重复修饰符报错（0.13）、不配对 `]` 报错、set 规则空格、空标签 `<>` 报错（0.13/0.14）——本库目前宽容，通常无害

---

## 5. 与"符号同步"的边界

符号名/码点的增删改（`angle→chevron`、`*.circle→*.o`、`*.double→*.stroked`、`sect→inter`、`diff→partial`、`gt.tri→gt.closed`、`tack.*.double→tack.*r/l/t/b` 等）**属于数据层**，已随 codex v0.3.0 同步进 `src/symbols.json`/`src/emoji.json`，不在本文档语法 gap 计数内；仅当 shorthand 表或 `opl` 引用到被改名/移除的标识符时才需连带改代码（本次已把 `bracket.l/r.double → .stroked` 更正）。

---

## 6. 本库自身的已知缺口（与 Typst 版本无关）

1. 🔴 **行注释吞 token 的解析 bug**（`src/ast.ts`）：`// … \n` 与 `/* … */` 的终止处 `i++` 与 `for` 的 `i++` 叠加，**跳过注释结束符后的第一个字符**（`// x\nb` 丢 `b`、`/*c*/b` 丢 `b`），仅当其后是空白时无害。字符扫描 pass 同样写法会影响紧随注释的括号配对计数。
2. 🔴 **未知函数名静默丢弃**：`render` 的 `f`/`ss`/`ff` 三查无最终 `else`（`src/main.ts:812-860`），全 miss 则什么都不输出（无报错、无文本）——影响 `text/class/hide/link/box/rect/table/context/here/star/compose/...` 等 Typst 测试名。
3. 🔴 **`#` 求值是 TODO**：`src/normalize.ts:638` `x.value = v; // todo 数学运算`，`#(…)`/`#1+2` 仅存原始串，不求值。
4. 🟡 生产路径残留调试 `console.log`：`src/main.ts`（`ast1`/`ast3` dump）、`src/normalize.ts`（`+1`/`1` dump）。
5. 🟡 `esc` 标志对 `!`/shorthand 的尊重不完全；`upright/italic` 只作用 `mi/ms`；`bold` 是 CSS `fontWeight` 非 `mathvariant`；`font()` 仅覆盖 ASCII 字母+部分数字，希腊字母不映射。

---

## 7. 参考来源
- Typst releases：`https://github.com/typst/typst/releases/tag/v0.12.0 … v0.15.1`
- Changelog 源文件：`docs/content/changelog/0.{12,13,14,15}.0.typ` @ v0.15.1；0.15 migration guide 于 `changelog/0.15.0.typ`
- Math 实现源码（校验取值）：`crates/typst-library/src/math/{frac,matrix,lr}.rs`、`crates/typst/src/symbols/sym.rs` @ 各 tag
- codex 符号数据：`https://github.com/typst/codex/blob/v0.3.0/{CHANGELOG.md,src/modules/sym.txt,src/modules/emoji.txt}`

> 唯一未证实项（据实说明）：v0.11.1 下单个 `~` 的确切输出未在 changelog 与可定位源码中找到，故 0.12 的 `~` 重绑以"绑定发生变化"表述，其余均有来源佐证。

---

## 8. 版本升级操作：`_`/`^` 上下位置（`rel_names`）的规则同步

> 适用：任何把 `version.lan` 从 0.11.1 上调的**版本升级任务**。平时只 `sync:symbols`（数据层）**不用**动本节。
> 关联代码：`src/normalize.ts` → `rel_names` + `is_limit`；该集合上方注释记录了 2026-10-05 的核对结论与本节 8.4 的漂移清单。
> 判定链：**符号名 → 字符 → 官方数学类 → `limits`（正上正下）还是 `scripts`（右上右下）**。运行时真源只有 `rel_names` 一份，Unicode 类表只在核对时临时用，不进 `src`。

### 8.1 规则写在哪（源码坐标随版本搬家）

| | v0.11.1（现基线） | v0.15.1 |
|---|---|---|
| 规则本体 | `crates/typst/src/math/attach.rs :: Limits::for_char` (:202) · `for_class` (:217) | `crates/typst-library/src/math/attach.rs :: Limits::for_char` (:160) → `for_char_with_class` (:165) |
| class 输入 | **直接查底表** `unicode_math_class::class(c)` | `crates/typst-utils/src/lib.rs:385 :: default_math_class(c)`：typst 自己的逐字符 override 表（`':'`→Relation、`'⋯⋱⋰⋮'`→Normal、`'⊥'`→Normal、`'⟇'`→Binary、`'⎰⟅'`→Opening、`'⎱⟆'`→Closing、`'⅋'`→Binary…，每条挂 issue/PR 链接），末尾才 fallback 底表 |
| 调用点 | `crates/typst/src/math/fragment.rs :: Glyph::with_id:269`（`limits: Limits::for_char(c)`）；同函数 :249-255 的 `':'`/`'⋯⋮⋱⋰'` 特例**只进间距 class，不进 limits** | `crates/typst-layout/src/math/ir/item.rs:957-958`（`class = default_math_class(c); limits = for_char_with_class(c, class)`）——特例**同时进了 limits** |
| 底表 | `Cargo.lock → unicode-math-class 0.1.0`（MathClass-15.txt, rev 15） | 同版本、同 checksum（**底表没变**） |
| 手动强制入口 | `crates/typst/src/math/class.rs:42` `set_limits(Limits::for_class(class))` | `crates/typst-library/src/math/ir/resolve.rs:1198` 同式 |

**规则形状两版一致**：`Relation → Always`（上下，与 display 无关）/ `Large → Display`（积分特例 `Never`）/ 其余 `Never`。
→ 会漂移的从来不是这条 `match`，而是**喂给它的 class**：0.11 只把 typst 的字符特例写在间距路径上，0.15 把它们并进了 `default_math_class`，于是 limits 跟着变。

### 8.2 升级流程（读 diff → 导出名单 → 改 `rel_names`）

```bash
OLD=v0.11.1 NEW=v0.15.1
git diff $OLD..$NEW -- '**/math/attach.rs'                       # ① 规则形状
git diff $OLD..$NEW -- crates/typst-utils/src/lib.rs              # ② class 输入（0.15 起；0.11 看 fragment.rs::Glyph::with_id）
git diff $OLD..$NEW -- Cargo.lock | grep -A2 unicode-math-class   # ③ 底表版本
pnpm sync:symbols                                                 # ④ 新符号名 → 决定 rel_names 候选集合
TYPST_BIN=~/.cache/xmmath/typst/$NEW/typst node <探针>            # ⑤ 导出实测表（见 8.3）
```

⑤ 的输出与 ①②③ 对齐后，改 `src/normalize.ts` 的 `rel_names` 及其注释（版本、日期、漂移清单），再走 AGENTS.md 的快照流程：`pnpm test` 变红 → `pnpm snap:update` → `pnpm review:changes` → `pnpm review` 逐例看图。

### 8.3 为什么非重跑实测不可（要重跑，不用重新设计）

1. **typst 没暴露 class/limits 查询**：`query` 只能取 `metadata`、`eval` 读不到内部属性，「哪些字符落在哪一档」只能靠一次实测导出成名单。
2. **漂移可能是行为级而非档位级**：0.15.1 把 `⟅`/`⎰` 归 `Opening` 后 `$⟅_1^2$` 直接 `error: unexpected underscore`（附着被语法禁止），读表看不出来，只有编译一次才知道。
3. **探针要自校准**：判据依赖布局的宽度公式（0.15 把布局搬到 `typst-layout`），每次都要带控制组，控制组翻了就是公式变了、判据得重写。

判据来自同一份源码，是**帧宽差**而非尺寸比例：

| 模式 | 附着后的帧宽 | 源码 |
|---|---|---|
| `limits` | `max(底座宽, 附着宽)`（上下附着居中叠放） | `attach_top_and_bottom` |
| `scripts` | `底座宽 + 附着宽 + space_after_script` | `layout_attachments` |

自包含探针（脚注用 20 位数字保证 `附着宽 ≫ 底座宽`；`wref` 基准取 `+`，官方 class=Vary ⇒ 必走 scripts）：

```js
// 存成 rel-probe.mjs：TYPST_BIN=~/.cache/xmmath/typst/v0.15.1/typst node rel-probe.mjs '<' '≈' ':' …
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const BIN = process.env.TYPST_BIN;
const S = "01234567890123456789";
const chars = process.argv.slice(2); // 由 rel_names ∪ 官方 Relation 名展开；关系符号里没有 \ $ # _ ^ { } 等需转义字符
writeFileSync(
	"/tmp/rel-probe.typ",
	"#set page(width: auto, height: auto, margin: 5pt)\n" +
		chars
			.map(
				(c) => `#context {
  let wref = measure($ +_${S}^${S} $).width - measure($ + $).width
  let w = measure($ ${c} $).width
  let a = measure($ ${c}_${S}^${S} $).width
  [#metadata((w: w, d: a - w - wref)) <p>]
}`,
			)
			.join("\n"),
);
const r = spawnSync(BIN, ["query", "/tmp/rel-probe.typ", "<p>", "--field", "value"], {
	encoding: "utf8",
});
if (r.status !== 0) {
	console.error(r.stderr);
	process.exit(1);
}
JSON.parse(r.stdout).forEach((x, i) => {
	const w = parseFloat(x.w);
	const d = parseFloat(x.d);
	console.log(chars[i], d < -w / 2 ? "limits" : "scripts", `w=${w} d=${d}`);
});
```

判定 `d < -w/2` ⇒ `limits`（limits 下 `d ≈ -(w+space)`，scripts 下 `d ≈ 0`）。**2026-10-05 实测裕度：limits 组 `d/(-w/2) ≥ 2.07`、scripts 组 `0.00`，两组中间是空的**，无临界样本。控制组：`<`、`≈` 必须 limits；`+`、`:`（0.11.1 下）必须 scripts。

### 8.4 0.11.1 → 0.15.1 实测漂移清单（11 个字符，升级时的核对起点）

| 字符 | 0.11.1 | 0.15.1 | 0.15 起因（`default_math_class`） |
|---|---|---|---|
| `:` | scripts | **limits** | `':' → Relation`（commit 2e039cb；0.11 只在间距路径有此特例） |
| `⋯ ⋱ ⋰ ⋮` | limits | scripts | `→ Normal`（PR 1726） |
| `⊥` | limits | scripts | `→ Normal`（PR 5714，与 `⟂` 区分） |
| `⟇` | limits | scripts | `→ Binary`（issue 5764） |
| `⎱ ⟆` | limits | scripts | `→ Closing`（issue 5764） |
| `⟅ ⎰` | limits | ❌ `error: unexpected underscore` | `→ Opening`，Opening 底座不可附着 |

对 `rel_names` 的落点（真升级时）：`colon` 要**加回**；`bag` `bag.l` `bag.r` `mustache` `mustache.l` `mustache.r` `bot` `tack.t` `dots` `dots.h.c` `dots.v` `dots.down` `dots.up` `or.dot` 共 **14 项**需删/改判（前 4 项还牵涉"是否允许附着"的裁决）；`bowtie` `harpoon` `harpoons` `parallel.slanted` `prec.curly` `succ.curly` `tack` `tilde` **8 项**跨版本稳定。

### 8.5 现状与待办

- 8.3 的探针是**一次性脚本，不入库**；判据、源码坐标、漂移清单都在本文档，升级时照 8.3 现场重建（几分钟的事）。
