vitest作为测试 pnpm安装

这是一个库，传入typst数学语法，解析为mathml

symbols和emoji与上游同步到0.15.1，src语法解析渲染与上游同步到0.11.1

任何语法解析严格参照0.11.1，除非进行版本升级任务

语法解析后用vdom渲染，最后才是mathml，可能需要css实现更多装饰

火狐浏览器渲染的mathml不错，其他浏览器多少有细节问题

测试分层：语料 test/fixtures/math.json（412 例）由各阶段单测 test/{ast,normalize,vdom,render}.test.ts 跑（含全语料跑通断言，会抛错的用例在其条目上标 `knownBroken: true`，_shared.ts 从字段派生豁免清单，修好后测试反过来变红逼你摘标记）；test/custom.test.ts 是手工维护的针对性断言（已知缺陷用 it.fails 占位）。渲染结果不存快照——回归靠 review 页「变更」标签现场跑 HEAD 版与工作区版对比（见下）。

math.json 手工维护，不再有生成脚本（get.mjs 已删）：新增调试用例直接往里加，`id`/`cat` 都可自定义（id 可以写长描述，撞 id 由 review 页顶部警告）；需要跟上游同步时，去 typst 官方 git 看 tests/suite/math 的变更记录，手动把新式子摘进来（test/typst/math/ 里留着上次抽取的上游 .typ 原文，可作比对参考，该目录已 gitignore）。

pnpm review 打开 test/review/index.html，只做对照不记录反馈：每例并排显示本库渲染与 typst 官方 PNG；「自定义」标签是临时输入对照，要长期钉住就写进 test/custom.test.ts；「变更」标签现场 import git HEAD 版 src 与工作区版，同一语料各渲染一遍逐例比输出（结果不入库，每次进页现算，服务端 /__review/base 负责把 HEAD 的 src/ 导出到 cache/base/<sha>/）。typst 图按 hash+typst版本缓存在 test/review/cache/（不进 git），版本固定在 test/review/config.json，默认 0.11.1（与 src 的 version.lan 一致；改版本会让缓存全部失效重渲染）

加 `?oldtypst=<版本>`（如 0.15.1）后每例会多渲一张该版本的 typst 图，浏览器用 canvas 比两图像素：整图 hash 判有无差异，有差异再给差异像素占比与尺寸差；侧栏「仅 typst 版本差异」可过滤，「预生成本列表 typst 图」会把两个版本都预渲染

改动语法与渲染，怕影响其他用例 → pnpm review 的「变更」标签（HEAD vs 工作区，现场算）逐例看旧渲染/新渲染/typst 官方图；发现其他受影响的用例劣化就回去改代码，下一轮循环会覆盖。测出的行为差异要长期钉住就写进 test/custom.test.ts 的断言

语料里有一批 typst 自己也拒绝编译的用例（..args 展开、未定义变量、故意不配对的分隔符、旧符号名），不同版本失败集合不同，对照时按「官方无输出」处理

旧的人类测试 test/typst/more_test.html 保留作历史参考，现改为读 math.json，需经 pnpm dev 打开（/test/typst/more_test.html）

sync:symbols脚本用于同步emoji和symbols

render:typst可以自定typst版本，查看官方标准渲染结果的图片，如 `pnpm run render:typst --typst v0.11.1 --expr '1+1'` 注意inline和block——`--expr` 默认包成 `$ … $`（块级 display），加 `--inline` 才是 `$…$`（行内）。ai可以通过视觉读取来判断官方渲染结果

render:xmmath用本库渲染同一表达式做对照：`pnpm render:xmmath --expr 'sum_(i=1)^n i' [--inline]`，默认出 PNG（`--out` 扩展名或 `--format` 可换 html，html 只写 MathML+CSS 不需要浏览器）；PNG 默认走无头 firefox（`--bin`/`$XMMATH_BROWSER` 可换）

版本升级任务（动 version.lan 之前）先读 docs/math-syntax-typst-diff.md 第 8 节：`_`/`^` 上下位置规则的源码坐标（0.11.1 vs 0.15.1）、帧宽差探针脚本与判据、0.11→0.15 的 11 个字符漂移清单；升级后先重跑探针、再改 src/normalize.ts 的 rel_names 及其注释