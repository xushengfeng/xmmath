test={
  "accent": [
    {
      "text": "grave(a), acute(b), hat(f), tilde(§), macron(ä), diaer(a), ä \\\n breve(\\&), dot(!), circle(a), caron(@), arrow(Z), arrow.l(Z)",
      "block": false
    },
    {
      "text": "x &= p \\ dot(x) &= v \\ dot.double(x) &= a \\ dot.triple(x) &= j \\ dot.quad(x) &= s",
      "block": true
    },
    {
      "text": "accent(ö, .), accent(v, <-), accent(ZZ, \\u{0303})",
      "block": false
    },
    {
      "text": "sqrt(tilde(T)) + hat(f)/hat(g)",
      "block": false
    },
    {
      "text": "arrow(\"ABC\" + d), tilde(sum)",
      "block": false
    },
    {
      "text": "A^x != hat(A)^x != hat(hat(A))^x",
      "block": false
    },
    {
      "text": "tilde(integral), tilde(integral)_a^b, tilde(integral_a^b)",
      "block": true
    },
    {
      "text": "tilde(sum), tilde(sum, size: #50%), accent(H, hat, size: #200%)",
      "block": false
    }
  ],
  "alignment": [
    {
      "text": "\"a\" &= c \\\n&= c + 1 & \"By definition\" \\\n&= d + 100 + 1000 \\\n&= x && \"Even longer\" \\",
      "block": true
    },
    {
      "text": "& \"right\" \\\n\"a very long line\" \\\n\"left\" \\",
      "block": true
    },
    {
      "text": "\"right\" \\\n\"a very long line\" \\\n\"left\" \\",
      "block": true
    },
    {
      "text": "a &=b & quad c&=d \\\ne &=f & g&=h",
      "block": true
    },
    {
      "text": "a + b &= c \\\n      e &= f + g + h",
      "block": true
    },
    {
      "text": "a &= b + c \\\n  e + f + g &= h",
      "block": true
    }
  ],
  "attach": [
    {
      "text": "f_x + t^b + V_1^2 + attach(A, t: alpha, b: beta)",
      "block": false
    },
    {
      "text": "attach(upright(O), bl: 8, tl: 16, br: 2, tr: 2-),\nattach(\"Pb\", bl: 82, tl: 207) + attach(upright(e), bl: -1, tl: 0) + macron(v)_e \\",
      "block": true
    },
    {
      "text": "attach(a, tl: u),   attach(a, tr: v),   attach(a, bl: x),\nattach(a, br: y),   limits(a)^t,        limits(a)_b \\\n\nattach(a, tr: v, t: t),\nattach(a, tr: v, br: y),\nattach(a, br: y, b: b),\nattach(limits(a), b: b, bl: x),\nattach(a, tl: u, bl: x),\nattach(limits(a), t: t, tl: u) \\\n\nattach(a, tl: u, tr: v),\nattach(limits(a), t: t, br: y),\nattach(limits(a), b: b, tr: v),\nattach(a, bl: x, br: y),\nattach(limits(a), b: b, tl: u),\nattach(limits(a), t: t, bl: u),\nlimits(a)^t_b \\\n\nattach(a, tl: u, tr: v, bl: x, br: y),\nattach(limits(a), t: t, bl: x, br: y, b: b),\nattach(limits(a), t: t, tl: u, tr: v, b: b),\nattach(limits(a), tl: u, bl: x, t: t, b: b),\nattach(limits(a), t: t, b: b, tr: v, br: y),\nattach(a, tl: u, t: t, tr: v, bl: x, b: b, br: y)",
      "block": true
    },
    {
      "text": "pi_1(Y), a_f(x), a^zeta (x), a^abs(b)_sqrt(c) \\\n a^subset.eq (x), a_(zeta(x)), pi_(1(Y)), a^(abs(b))_(sqrt(c))",
      "block": false
    },
    {
      "text": "1/(V^2^3^4^5),\n  frac(\n    attach(\n      limits(V), br: attach(2, br: 3), b: attach(limits(2), b: 3)),\n    attach(\n      limits(V), tl: attach(2, tl: 3), t: attach(limits(2), t: 3))),\n  attach(Omega,\n    tl: attach(2, tl: attach(3, tl: attach(4, tl: 5))),\n    tr: attach(2, tr: attach(3, tr: attach(4, tr: 5))),\n    bl: attach(2, bl: attach(3, bl: attach(4, bl: 5))),\n    br: attach(2, br: attach(3, br: attach(4, br: 5))),\n  )",
      "block": true
    },
    {
      "text": "sqrt(a_(1/2)^zeta), sqrt(a_alpha^(1/2)), sqrt(a_(1/2)^(3/4)) \\\n  sqrt(attach(a, tl: 1/2, bl: 3/4)),\n  sqrt(attach(a, tl: 1/2, bl: 3/4, tr: 1/2, br: 3/4))",
      "block": true
    },
    {
      "text": "sup_(x in P_i) quad inf_(x in P_i)",
      "block": true
    },
    {
      "text": "op(\"fff\",limits: #true)^(y) quad op(\"yyy\", limits:#true)_(f)",
      "block": true
    },
    {
      "text": "(-1)^n + (1/2 + 3)^(-1/2)",
      "block": true
    },
    {
      "text": "x_1 p_1 frak(p)_1 2_1 dot_1 lg_1 !_1 \\\\_1 ]_1 \"ip\"_1 op(\"iq\")_1 \\\n  x^1 b^1 frak(b)^1 2^1 dot^1 lg^1 !^1 \\\\^1 ]^1 \"ib\"^1 op(\"id\")^1 \\\n  x_1 y_1 \"_\"_1 x^1 l^1 \"`\"^1 attach(I,tl:1,bl:1,tr:1,br:1)\n  scripts(sum)_1^1 integral_1^1 abs(1/2)_1^1 \\\n  x^1_1, \"(\"b y\")\"^1_1 != (b y)^1_1, \"[∫]\"_1 [integral]_1",
      "block": true
    },
    {
      "text": "lim_(n->oo \\ n \"grows\") sum_(k=0 \\ k in NN)^n k",
      "block": true
    },
    {
      "text": "limits(A)_1^2 != A_1^2",
      "block": true
    },
    {
      "text": "scripts(sum)_1^2 != sum_1^2",
      "block": true
    },
    {
      "text": "limits(integral)_a^b != integral_a^b",
      "block": true
    },
    {
      "text": "attach(A, t: #context oops)",
      "block": true
    },
    {
      "text": "∫_a^b iota_a^b",
      "block": true
    },
    {
      "text": "iota_a^b",
      "block": false
    },
    {
      "text": "a =^\"def\" b quad a lt.eq_\"really\" b quad  a arrow.r.long.squiggly^\"slowly\" b",
      "block": true
    },
    {
      "text": "a =^\"def\" b quad a lt.eq_\"really\" b quad a arrow.r.long.squiggly^\"slowly\" b",
      "block": false
    },
    {
      "text": "a scripts(=)^\"def\" b quad a scripts(lt.eq)_\"really\" b quad a scripts(arrow.r.long.squiggly)^\"slowly\" b",
      "block": false
    },
    {
      "text": "integral.sect_a^b  quad \\u{2a1b}_a^b quad limits(\\u{2a1b})_a^b",
      "block": true
    },
    {
      "text": "integral.sect_a^b quad \\u{2a1b}_a^b quad limits(\\u{2a1b})_a^b",
      "block": false
    },
    {
      "text": "tack.t.big_0^1 quad \\u{02A0A}_0^1 quad join_0^1",
      "block": true
    },
    {
      "text": "tack.t.big_0^1 quad \\u{02A0A}_0^1 quad join_0^1",
      "block": false
    }
  ],
  "call": [
    {
      "text": "pi(a)",
      "block": true
    },
    {
      "text": "pi(a,)",
      "block": true
    },
    {
      "text": "pi(a,b)",
      "block": true
    },
    {
      "text": "pi(a,b,)",
      "block": true
    },
    {
      "text": "args(a)",
      "block": false
    },
    {
      "text": "args(a,)",
      "block": false
    },
    {
      "text": "args(a,b)",
      "block": false
    },
    {
      "text": "args(a,b,)",
      "block": false
    },
    {
      "text": "args(,a,b,,,)",
      "block": false
    },
    {
      "text": "pi(a;b)",
      "block": true
    },
    {
      "text": "mat(#\"math\" ; \"wins\")",
      "block": true
    },
    {
      "text": "mat(#\"code\"; \"wins\")",
      "block": true
    },
    {
      "text": "args(a;b)",
      "block": false
    },
    {
      "text": "args(a,b;c)",
      "block": false
    },
    {
      "text": "args(a,b;c,d;e,f)",
      "block": false
    },
    {
      "text": "args( a; b; )",
      "block": false
    },
    {
      "text": "args(a;  ; c)",
      "block": false
    },
    {
      "text": "args(a b,/**/; b)",
      "block": false
    },
    {
      "text": "args(a/**/b, ; b)",
      "block": false
    },
    {
      "text": "args( ;/**/a/**/b/**/; )",
      "block": false
    },
    {
      "text": "args( ; , ; )",
      "block": false
    },
    {
      "text": "args(/**/; // funky whitespace/trivia\n    ,   /**/  ;/**/)",
      "block": false
    },
    {
      "text": "sin(,x,y,,,)",
      "block": true
    },
    {
      "text": "sin( ,/**/x/**/, , /**/y, ,/**/, )",
      "block": true
    },
    {
      "text": "args(,x,,y,,)",
      "block": false
    },
    {
      "text": "args( ,/**/x/**/, , /**/y, ,/**/, )",
      "block": false
    },
    {
      "text": "sin(1)",
      "block": true
    },
    {
      "text": "sin(#1)",
      "block": true
    },
    {
      "text": "x y   &&quad     x (y z)   &quad     x y^z  \\\n  id(x y)  &&quad  id(x (y z))  &quad  id(x y^z) \\\n  eq(x y)  &&quad  eq(x (y z))  &quad  eq(x y^z) \\\n  bx(x y)  &&quad  bx(x (y z))  &quad  bx(x y^z) \\",
      "block": true
    },
    {
      "text": "mat(;,)",
      "block": true
    },
    {
      "text": "mat(; ,)",
      "block": true
    },
    {
      "text": "mat(;/**/,)",
      "block": true
    },
    {
      "text": "mat(;\n,)",
      "block": true
    },
    {
      "text": "mat(;// line comment\n,)",
      "block": true
    },
    {
      "text": "mat(\n  1, , ;\n   ,1, ;\n   , ,1;\n)",
      "block": true
    }
  ],
  "cancel": [
    {
      "text": "a + 5 + cancel(x) + b - cancel(x)",
      "block": false
    },
    {
      "text": "c + (a dot.c cancel(b dot.c c))/(cancel(b dot.c c))",
      "block": false
    },
    {
      "text": "a + b + cancel(b + c) - cancel(b) - cancel(c) - 5 + cancel(6) - cancel(6)",
      "block": true
    },
    {
      "text": "e + (a dot.c cancel((b + c + d)))/(cancel(b + c + d))",
      "block": true
    },
    {
      "text": "a + cancel(x, inverted: #true) - cancel(x, inverted: #true) + 10 + cancel(y) - cancel(y)",
      "block": false
    },
    {
      "text": "x + cancel(\"abcdefg\", inverted: #true)",
      "block": true
    },
    {
      "text": "a + cancel(b + c + d, cross: #true, stroke: #red) + e",
      "block": false
    },
    {
      "text": "a + cancel(b + c + d, cross: #true) + e",
      "block": true
    },
    {
      "text": "a + cancel(x, length: #200%) - cancel(x, length: #50%, stroke: #(red + 1.1pt))",
      "block": false
    },
    {
      "text": "b + cancel(x, length: #150%) - cancel(a + b + c, length: #50%, stroke: #(blue + 1.2pt))",
      "block": true
    },
    {
      "text": "cancel(x, angle: #0deg) + cancel(x, angle: #45deg) + cancel(x, angle: #90deg) + cancel(x, angle: #135deg)",
      "block": false
    },
    {
      "text": "x + cancel(y, angle: #{angle => angle + 90deg}) - cancel(z, angle: #(angle => angle + 135deg))",
      "block": false
    },
    {
      "text": "e + cancel((j + e)/(f + e)) - cancel((j + e)/(f + e), angle: #(angle => angle + 30deg))",
      "block": true
    }
  ],
  "cases": [
    {
      "text": "f(x, y) := cases(\n  1 quad &\"if\" (x dot y)/2 <= 0,\n  2 &\"if\" x divides 2,\n  3 &\"if\" x in NN,\n  4 &\"else\",\n)",
      "block": true
    },
    {
      "text": "x = cases(1, 2)",
      "block": true
    }
  ],
  "class": [
    {
      "text": "a class(\"normal\", +) b \\\n  a class(\"binary\", .) b \\\n  lr(class(\"opening\", \\/) a/b class(\"closing\", \\\\)) \\\n  { x class(\"fence\", \\;) x > 0} \\\n  a class(\"large\", \\/) b \\\n  a class(\"punctuation\", :) b \\\n  a class(\"relation\", ~) b \\\n  a + class(\"unary\", times) b \\\n  class(\"vary\", :) a class(\"vary\", :) b",
      "block": true
    },
    {
      "text": "a dotsq b \\\n  a class(\"normal\", dotsq) b \\\n  a class(\"vary\", dotsq) b \\\n  a + class(\"vary\", dotsq) b \\\n  a class(\"punctuation\", dotsq) b",
      "block": true
    },
    {
      "text": "class(\"binary\", normal(+) normal(=))",
      "block": false
    },
    {
      "text": "a pluseq 5",
      "block": true
    },
    {
      "text": "sqrt(3)\\/2 quad d_0.d_1d_2 dots",
      "block": true
    },
    {
      "text": "class(\"normal\", ->)_a",
      "block": true
    },
    {
      "text": "class(\"relation\", x)_a",
      "block": false
    },
    {
      "text": "class(\"large\", x)_a",
      "block": true
    },
    {
      "text": "class(\"large\", ->)_a",
      "block": false
    },
    {
      "text": "limits(class(\"normal\", ->))_a",
      "block": false
    },
    {
      "text": "scripts(class(\"relation\", x))_a",
      "block": true
    }
  ],
  "delimited": [
    {
      "text": "(a) + {b/2} + abs(a)/2 + (b)",
      "block": true
    },
    {
      "text": "f(x/2) < zeta(c^2 + abs(a + b/2))",
      "block": false
    },
    {
      "text": "[1,2[ = [1,2) != zeta\\(x/2\\)",
      "block": false
    },
    {
      "text": "[|a/b|] != lr(|]a/b|]) != [a/b)",
      "block": true
    },
    {
      "text": "lr(| ]1,2\\[ + 1/2|)",
      "block": true
    },
    {
      "text": "|x + |y| + z/a| \\\n  lr(|x + |y| + z/a|)",
      "block": true
    },
    {
      "text": "bracket.l a/b bracket.r\n  = lr(bracket.l a/b bracket.r)",
      "block": true
    },
    {
      "text": "lr(a/b\\]) = a = lr(\\{a/b)",
      "block": true
    },
    {
      "text": "lr(]sum_(x=1)^n x], size: #70%)\n  < lr((1, 2), size: #200%)",
      "block": true
    },
    {
      "text": "floor(x/2), ceil(x/2), abs(x), norm(x)",
      "block": false
    },
    {
      "text": "lr(\n    text(\"(\", fill: #green) a/b\n    text(\")\", fill: #blue)\n  )",
      "block": true
    },
    {
      "text": "{ x mid(|) sum_(i=1)^oo phi_i (x) < 1 } \\\n  { integral |dot|\n      mid(bar.v.double)\n    floor(hat(I) mid(slash) { dot mid(|) dot } mid(|) I/n) }",
      "block": true
    },
    {
      "text": "1/(2 (x)",
      "block": true
    },
    {
      "text": "1_(2 y (x) ()",
      "block": true
    },
    {
      "text": "1/(2 y (x) (2(3))",
      "block": true
    },
    {
      "text": "[#h(1em, weak: true)A(dif x, f(x) dif x)sum#h(1em, weak: true)]",
      "block": true
    }
  ],
  "equation": [
    {
      "text": "x",
      "block": false
    },
    {
      "text": "phi.alt := (1 + sqrt(5)) / 2",
      "block": true
    },
    {
      "text": "F_n = round(1 / sqrt(5) phi.alt^n)",
      "block": true
    },
    {
      "text": "v := vec(1 + 2, 2 - 4, sqrt(3), arrow(x)) + 1",
      "block": true
    },
    {
      "text": "sum_(i=0)^n",
      "block": false
    },
    {
      "text": "sum_(i=0)^n",
      "block": false
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "a + b = c",
      "block": true
    },
    {
      "text": "p &= ln a b \\\n    &= ln a + ln b",
      "block": true
    },
    {
      "text": "p &= ln a b \\\n    &= ln a + ln b",
      "block": true
    },
    {
      "text": "q &= ln sqrt(a b) \\\n    &= 1/2 (ln a + ln b)",
      "block": true
    },
    {
      "text": "- &- - \\\n  a &= b",
      "block": true
    },
    {
      "text": "- - -",
      "block": true
    },
    {
      "text": "a &= b \\\n  - &- -",
      "block": true
    },
    {
      "text": "Delta = b^2 - 4 a c",
      "block": true
    },
    {
      "text": "a_n",
      "block": false
    },
    {
      "text": "[a_n: 1, 1/2, 1/3, dots]",
      "block": false
    }
  ],
  "frac": [
    {
      "text": "x = 1/2 = a/(a h) = a/a = a/(1/2)",
      "block": true
    },
    {
      "text": "(|x| + |y|)/2 < [1+2]/3",
      "block": true
    },
    {
      "text": "x = (-b plus.minus sqrt(b^2 - 4a c))/(2a)",
      "block": true
    },
    {
      "text": "binom(circle, square)",
      "block": true
    },
    {
      "text": "binom(n, k_1, k_2, k_3)",
      "block": true
    },
    {
      "text": "binom(x^2)",
      "block": true
    },
    {
      "text": "(dif y)/(dif x), dif/x, x/dif, dif/dif \\\n  frac(dif y, dif x), frac(dif, x), frac(x, dif), frac(dif, dif)",
      "block": true
    },
    {
      "text": "1/2/3 = (1/2)/3 = 1/(2/3)",
      "block": true
    },
    {
      "text": "a_1/b_2, 1/f(x), zeta(x)/2, \"foo\"[|x|]/2 \\\n  1.2/3.7, 2.3^3.4 \\\n  🏳️‍🌈[x]/2, f [x]/2, phi [x]/2, 🏳️‍🌈 [x]/2 \\\n  +[x]/2, 1(x)/2, 2[x]/2 \\\n  (a)b/2, b(a)[b]/2 \\\n  n!/2, 5!/2, n !/2, 1/n!, 1/5!",
      "block": true
    }
  ],
  "interactions": [
    {
      "text": "sum_(i=#emoji.apple)^#emoji.apple.red i + monkey/2",
      "block": true
    },
    {
      "text": "x := #table(columns: 2)[x][y]/mat(1, 2, 3)\n     = #table[A][B][C]",
      "block": true
    },
    {
      "text": "a",
      "block": false
    },
    {
      "text": "#here[f] := #here[Hi there]",
      "block": false
    },
    {
      "text": "a #box(stroke: 0.2pt,",
      "block": false
    },
    {
      "text": ")",
      "block": false
    },
    {
      "text": "a #box(stroke: 0.2pt,",
      "block": false
    },
    {
      "text": ")",
      "block": false
    },
    {
      "text": "g #box(stroke: 0.2pt,",
      "block": false
    },
    {
      "text": ")",
      "block": false
    },
    {
      "text": "a #box(baseline:0.5em, stroke: 0.2pt,",
      "block": false
    },
    {
      "text": ")",
      "block": false
    },
    {
      "text": "x",
      "block": false
    },
    {
      "text": "1",
      "block": false
    },
    {
      "text": "1",
      "block": false
    },
    {
      "text": "1",
      "block": false
    },
    {
      "text": "x",
      "block": false
    },
    {
      "text": "y",
      "block": false
    },
    {
      "text": "#h(1em) it #h(1em)",
      "block": false
    },
    {
      "text": "a tack b",
      "block": true
    },
    {
      "text": "pi",
      "block": false
    },
    {
      "text": "pi a",
      "block": true
    },
    {
      "text": "my a",
      "block": true
    },
    {
      "text": "1 + sqrt(x/2) + sqrt(#hide(",
      "block": true
    },
    {
      "text": "))",
      "block": false
    },
    {
      "text": "a x #link(\"url\",",
      "block": true
    },
    {
      "text": ")",
      "block": false
    },
    {
      "text": "f f1 f2",
      "block": true
    },
    {
      "text": "vec(1,2) * 2",
      "block": true
    },
    {
      "text": "x^2 #hide[",
      "block": true
    },
    {
      "text": "] z^2",
      "block": false
    },
    {
      "text": "x",
      "block": false
    },
    {
      "text": "f(x) := x^2",
      "block": true
    },
    {
      "text": "v1 v2^2",
      "block": false
    },
    {
      "text": "v1 v2^2",
      "block": true
    },
    {
      "text": "hat(#x)",
      "block": false
    },
    {
      "text": "2 foo(alpha, (M+foo(a, b)))",
      "block": false
    },
    {
      "text": "2 bar(alpha, (M+foo(a, b)))",
      "block": false
    },
    {
      "text": "2 baz(x,y,baz(u, v))",
      "block": false
    },
    {
      "text": "2 foo(alpha, (M+foo(a, b)))",
      "block": true
    },
    {
      "text": "2 bar(alpha, (M+foo(a, b)))",
      "block": true
    },
    {
      "text": "2 baz(x,y,baz(u, v))",
      "block": true
    }
  ],
  "mat": [
    {
      "text": "mat() dot\n mat(;) dot\n mat(1, 2) dot\n mat(1, 2;) \\\n mat(1; 2) dot\n mat(1, 2; 3, 4) dot\n mat(1 + &2, 1/2; &3, 4)",
      "block": false
    },
    {
      "text": "mat(\n  1, 2, ..., 10;\n  2, 2, ..., 10;\n  dots.v, dots.v, dots.down, dots.v;\n  10, 10, ..., 10;\n)",
      "block": true
    },
    {
      "text": "mat(\n  a, b^2;\n  sum_(x \\ y) x, a^(1/2);\n  zeta, alpha;\n)",
      "block": true
    },
    {
      "text": "mat(1, 2; 3, 4)",
      "block": true
    },
    {
      "text": "a + mat(delim: #none, 1, 2; 3, 4) + b",
      "block": true
    },
    {
      "text": "mat(1, 2, delim: \"[\")",
      "block": true
    },
    {
      "text": "mat(1, 2; delim: \"[\")",
      "block": true
    },
    {
      "text": "mat(delim: \"[\", 1, 2)",
      "block": true
    },
    {
      "text": "mat(1; 2; delim: \"[\")",
      "block": true
    },
    {
      "text": "mat(1; delim: \"[\", 2)",
      "block": true
    },
    {
      "text": "mat(delim: \"[\", 1; 2)",
      "block": true
    },
    {
      "text": "mat(1, 2; delim: \"[\", 3, 4)",
      "block": true
    },
    {
      "text": "mat(delim: \"[\", 1, 2; 3, 4)",
      "block": true
    },
    {
      "text": "mat(1, 2; 3, 4; delim: \"[\")",
      "block": true
    },
    {
      "text": "mat(1, 2; 3, 4)",
      "block": true
    },
    {
      "text": "mat(1, 2; 3, 4)",
      "block": true
    },
    {
      "text": "mat(10, 2, 3, 4; 5, 6, 7, 8; augment: #3)",
      "block": true
    },
    {
      "text": "mat(10, 2, 3, 4; 5, 6, 7, 8; augment: #(-1))",
      "block": true
    },
    {
      "text": "mat(100, 2, 3; 4, 5, 6; 7, 8, 9; augment: #(hline: 2))",
      "block": true
    },
    {
      "text": "mat(100, 2, 3; 4, 5, 6; 7, 8, 9; augment: #(hline: -1))",
      "block": true
    },
    {
      "text": "mat(100, 2, 3; 4, 5, 6; 7, 8, 9; augment: #(hline: 1, vline: 1))",
      "block": true
    },
    {
      "text": "mat(100, 2, 3; 4, 5, 6; 7, 8, 9; augment: #(hline: -2, vline: -2))",
      "block": true
    },
    {
      "text": "mat(100, 2, 3; 4, 5, 6; 7, 8, 9; augment: #(vline: 2, stroke: 1pt + blue))",
      "block": true
    },
    {
      "text": "mat(100, 2, 3; 4, 5, 6; 7, 8, 9; augment: #(vline: -1, stroke: 1pt + blue))",
      "block": true
    },
    {
      "text": "mat(1, 0, 0, 0; 0, 1, 0, 0; 0, 0, 1, 1)",
      "block": true
    },
    {
      "text": "mat(1, 0, 0, 0; 0, 1, 0, 0; 0, 0, 1, 1)",
      "block": true
    },
    {
      "text": "mat(1, 0, 0; 0, 1, 1; augment: #3)",
      "block": true
    },
    {
      "text": "mat(\n  \"a\" & \"a a a\" & \"a a\";\n  \"a a\" & \"a a\" & \"a\";\n  \"a a a\" & \"a\" & \"a a a\";\n)",
      "block": true
    },
    {
      "text": "mat(\n  \"a\", \"a a a\", \"a a\";\n  \"a a\", \"a a\", \"a\";\n  \"a a a\", \"a\", \"a a a\";\n)",
      "block": true
    },
    {
      "text": "mat(\n  &\"a\", &\"a a a\", &\"a a\";\n  &\"a a\", &\"a a\", &\"a\";\n  &\"a a a\", &\"a\", &\"a a a\";\n)",
      "block": true
    },
    {
      "text": "mat(\n  \"a\"&, \"a a a\"&, \"a a\"&;\n  \"a a\"&, \"a a\"&, \"a\"&;\n  \"a a a\"&, \"a\"&, \"a a a\"&;\n)",
      "block": true
    },
    {
      "text": ".",
      "block": false
    },
    {
      "text": "mat(&a+b,c;&d, e)",
      "block": true
    },
    {
      "text": "mat(&a+b&,c;&d&, e)",
      "block": true
    },
    {
      "text": "mat(&&&a+b,c;&&&d, e)",
      "block": true
    },
    {
      "text": "mat(stop &a+b&stop,c;...stop stop&d&...stop stop, e)",
      "block": true
    },
    {
      "text": "mat(-1, 1, 1; 1, -1, 1; 1, 1, -1)",
      "block": true
    },
    {
      "text": "mat(-1&, 1&, 1&; 1&, -1&, 1&; 1&, 1&, -1&)",
      "block": true
    },
    {
      "text": "mat(-1&, 1&, 1&; 1, -1, 1; 1, 1, -1)",
      "block": true
    },
    {
      "text": "mat(&-1, &1, &1; 1, -1, 1; 1, 1, -1)",
      "block": true
    },
    {
      "text": "mat(1, 2; 3, 4, delim: \"[\")",
      "block": true
    },
    {
      "text": "mat(B, A B)",
      "block": true
    },
    {
      "text": "mat(B, A B, dots)",
      "block": true
    },
    {
      "text": "mat(B, A B, dots;)",
      "block": true
    },
    {
      "text": "mat(#1, #(foo: \"bar\"))",
      "block": true
    },
    {
      "text": "mat(augment: #1, M, v) arrow.r.squiggly mat(augment: #1, R, b)",
      "block": false
    }
  ],
  "multiline": [
    {
      "text": "x &= x + y \\\n    &= x + 2z \\\n    &= sum x dot 2z",
      "block": true
    },
    {
      "text": "x + 1 &= a^2 + b^2 \\\n      y &= a + b^2 \\\n      z &= alpha dot beta",
      "block": true
    },
    {
      "text": "a + b &= 2 + 3 &= 5 \\\n      b &= c     &= 3",
      "block": true
    },
    {
      "text": "f := cases(\n  1 + 2 &\"iff\" &x,\n  3     &\"if\"  &y,\n)",
      "block": true
    },
    {
      "text": "\"abc\" &= c \\\n   &= d + 1 \\\n   = x",
      "block": true
    },
    {
      "text": "sum_(n in NN \\ n <= 5) n = (5(5+1))/2 = 15",
      "block": true
    },
    {
      "text": "\"abc\" &= c",
      "block": true
    },
    {
      "text": "\"abc\" &= c \\",
      "block": true
    },
    {
      "text": "\"abc\" &= c \\ \\ \\",
      "block": true
    },
    {
      "text": "e^(pi i)+1 = 0",
      "block": false
    },
    {
      "text": "e^(pi i)+1 = 0",
      "block": false
    },
    {
      "text": "e^(pi i)+1 = 0",
      "block": false
    },
    {
      "text": "a+b",
      "block": false
    },
    {
      "text": "(a+b)",
      "block": false
    },
    {
      "text": "paren.l a+b paren.r",
      "block": false
    },
    {
      "text": "a + b \\ c + d",
      "block": false
    },
    {
      "text": "e^(pi i)+1 = 0\\",
      "block": false
    },
    {
      "text": "a+b",
      "block": false
    },
    {
      "text": "a < = b",
      "block": false
    },
    {
      "text": "a < = b",
      "block": false
    },
    {
      "text": "<;",
      "block": false
    },
    {
      "text": "<;",
      "block": false
    },
    {
      "text": "<)",
      "block": false
    },
    {
      "text": "<)",
      "block": false
    },
    {
      "text": "",
      "block": true
    },
    {
      "text": "",
      "block": true
    },
    {
      "text": "x := \"a\\nb\\nc\\nd\\ne\"",
      "block": true
    }
  ],
  "op": [
    {
      "text": "max_(1<=n<=m) n",
      "block": true
    },
    {
      "text": "&sin x + log_2 x \\\n = &sin(x) + log_2(x)",
      "block": true
    },
    {
      "text": "lim_(n->oo) 1/n",
      "block": false
    },
    {
      "text": "lim_(n->infinity) 1/n = 0",
      "block": true
    },
    {
      "text": "op(\"myop\", limits: #false)_(x:=1) x \\\n  op(\"myop\", limits: #true)_(x:=1) x",
      "block": true
    },
    {
      "text": "bold(op(\"bold\", limits: #true))_x y",
      "block": true
    },
    {
      "text": "op(#underline[ul]) a",
      "block": true
    }
  ],
  "primes": [
    {
      "text": "a'",
      "block": false
    },
    {
      "text": "a'''_b",
      "block": false
    },
    {
      "text": "'",
      "block": false
    },
    {
      "text": "'''''''",
      "block": false
    },
    {
      "text": "a' ' '",
      "block": false
    },
    {
      "text": "' ' '",
      "block": false
    },
    {
      "text": "a' '/b",
      "block": false
    },
    {
      "text": "a'_b^c",
      "block": false
    },
    {
      "text": "a_b'^c",
      "block": false
    },
    {
      "text": "a_b^c'",
      "block": false
    },
    {
      "text": "a_b'^c'^d'",
      "block": false
    },
    {
      "text": "(a'_b')^(c'_d')",
      "block": false
    },
    {
      "text": "a'/b'",
      "block": false
    },
    {
      "text": "a_b'/c_d'",
      "block": false
    },
    {
      "text": "∫'",
      "block": false
    },
    {
      "text": "∑'",
      "block": false
    },
    {
      "text": "∑'_S'",
      "block": true
    },
    {
      "text": "a' = a^', a_', a_'''^''^'",
      "block": false
    },
    {
      "text": "x'",
      "block": true
    },
    {
      "text": "x^'",
      "block": true
    },
    {
      "text": "attach(x, t: ')",
      "block": true
    },
    {
      "text": "<'",
      "block": true
    },
    {
      "text": "attach(<, br: ')",
      "block": true
    },
    {
      "text": "op(<, limits: #true)'",
      "block": true
    },
    {
      "text": "limits(<)'",
      "block": true
    },
    {
      "text": "attach(<, t: ')",
      "block": true
    },
    {
      "text": "<^'",
      "block": true
    },
    {
      "text": "attach(<, b: ')",
      "block": true
    },
    {
      "text": "<_'",
      "block": true
    },
    {
      "text": "limits(x)^'",
      "block": true
    },
    {
      "text": "attach(limits(x), t: ')",
      "block": true
    },
    {
      "text": "f",
      "block": false
    },
    {
      "text": "f",
      "block": false
    },
    {
      "text": "#(g)' #g' #g ' \\\n  #g''''''''''''''''' \\\n  gg'",
      "block": true
    }
  ],
  "root": [
    {
      "text": "A = sqrt(x + y) = c",
      "block": false
    },
    {
      "text": "sqrt(a) quad\n  sqrt(f) quad\n  sqrt(q) quad\n  sqrt(a^2) \\\n  sqrt(n_0) quad\n  sqrt(b^()) quad\n  sqrt(b^2) quad\n  sqrt(q_1^2)",
      "block": true
    },
    {
      "text": "sqrt(x)",
      "block": false
    },
    {
      "text": "root(2, x)",
      "block": false
    },
    {
      "text": "root(3, x)",
      "block": false
    },
    {
      "text": "root(4, x)",
      "block": false
    },
    {
      "text": "root(5, x)",
      "block": false
    },
    {
      "text": "sqrt([|x|]^2 + [|y|]^2) < [|z|]",
      "block": true
    },
    {
      "text": "v = sqrt((1/2) / (4/5))\n   = root(3, (1/2/3) / (4/5/6))\n   = root(4, ((1/2) / (3/4)) / ((1/2) / (3/4)))",
      "block": true
    },
    {
      "text": "root(2, x) quad\n  root(3/(2/1), x) quad\n  root(1/11, x) quad\n  root(1/2/3, 1)",
      "block": true
    },
    {
      "text": "√2^3 = sqrt(2^3)",
      "block": true
    },
    {
      "text": "√(x+y) quad ∛x quad ∜x",
      "block": true
    },
    {
      "text": "(√2+3) = (sqrt(2)+3)",
      "block": true
    }
  ],
  "size": [
    {
      "text": "a/b, display(a/b), display(a)/display(b), inline(a/b), script(a/b), sscript(a/b) \\\n mono(script(a/b)), script(mono(a/b))\\\n script(a^b, cramped: #true), script(a^b, cramped: #false)",
      "block": false
    },
    {
      "text": "#rect[",
      "block": true
    },
    {
      "text": "]",
      "block": false
    },
    {
      "text": "#rect[",
      "block": false
    },
    {
      "text": "]",
      "block": false
    }
  ],
  "spacing": [
    {
      "text": "ä, +, c, (, )",
      "block": false
    },
    {
      "text": "=), (+), {times}",
      "block": false
    },
    {
      "text": "⟧<⟦, abs(-), [=",
      "block": false
    },
    {
      "text": "a=b, a==b",
      "block": false
    },
    {
      "text": "-a, +a",
      "block": false
    },
    {
      "text": "a not b",
      "block": false
    },
    {
      "text": "a+b, a*b",
      "block": false
    },
    {
      "text": "sum x, sum(x)",
      "block": false
    },
    {
      "text": "sum product x",
      "block": false
    },
    {
      "text": "f(x), zeta(x), \"frac\"(x)",
      "block": false
    },
    {
      "text": "a+dots.c+b",
      "block": false
    },
    {
      "text": "f(x) sin(y)",
      "block": false
    },
    {
      "text": "f (x), f(x)",
      "block": false
    },
    {
      "text": "[a|b], [a | b]",
      "block": false
    },
    {
      "text": "a\"is\"b, a \"is\" b",
      "block": false
    },
    {
      "text": "a thin b, a med b, a thick b, a quad b",
      "block": false
    },
    {
      "text": "a = thin b",
      "block": false
    },
    {
      "text": "a - b equiv c quad (mod 2)",
      "block": false
    },
    {
      "text": "{ x in RR | x \"is natural\" and x < 10 }",
      "block": true
    },
    {
      "text": "a equiv b + c - d => e log 5 op(\"ln\") 6",
      "block": false
    },
    {
      "text": "a cancel(equiv) b overline(+) c arrow(-) d hat(=>) e cancel(log) 5 dot(op(\"ln\")) 6",
      "block": false
    },
    {
      "text": "a overbrace(equiv) b underline(+) c grave(-) d underbracket(=>) e circle(log) 5 caron(op(\"ln\")) 6",
      "block": false
    },
    {
      "text": "a attach(equiv, tl: a, tr: b) b attach(limits(+), t: a, b: b) c tilde(-) d breve(=>) e attach(limits(log), t: a, b: b) 5 attach(op(\"ln\"), tr: a, bl: b) 6",
      "block": false
    },
    {
      "text": "integral f(x) dif x",
      "block": false
    },
    {
      "text": "integral f(x) thin dif x",
      "block": false
    },
    {
      "text": "integral f(x) #h(0.166em, weak: true)dif x",
      "block": false
    },
    {
      "text": "10degree \\\n10 degree \\\n10.1degree \\\n10.1 degree",
      "block": true
    }
  ],
  "style": [
    {
      "text": "a, A, delta, ϵ, diff, Delta, ϴ",
      "block": false
    },
    {
      "text": "A, italic(A), upright(A), bold(A), bold(upright(A)), \\\n serif(A), sans(A), cal(A), frak(A), mono(A), bb(A), \\\n italic(diff), upright(diff), \\\n bb(\"hello\") + bold(cal(\"world\")), \\\n mono(\"SQRT\")(x) wreath mono(123 + 456)",
      "block": false
    },
    {
      "text": "h, bb(N), cal(R), Theta, italic(Theta), sans(Theta), sans(italic(Theta)) \\\n bb(d), bb(italic(d)), italic(bb(d)), bb(e), bb(italic(e)), italic(bb(e)) \\\n bb(i), bb(italic(i)), italic(bb(i)), bb(j), bb(italic(j)), italic(bb(j)) \\\n bb(D), bb(italic(D)), italic(bb(D))",
      "block": false
    },
    {
      "text": "bb(Gamma) , bb(gamma), bb(Pi), bb(pi), bb(sum)",
      "block": false
    },
    {
      "text": "aleph, beth, gimel, daleth",
      "block": false
    },
    {
      "text": "sin(x) \"abc\"",
      "block": false
    },
    {
      "text": "italic(sin(x) \"abc\" #box[abc])",
      "block": false
    },
    {
      "text": "sin(x) \"abc\"",
      "block": false
    },
    {
      "text": "bold(sin(x) \"abc\" #box[abc])",
      "block": false
    }
  ],
  "syntax": [
    {
      "text": "∑_(i=0)^ℕ a ∘ b = \\u{2211}_(i=0)^NN a compose b",
      "block": true
    },
    {
      "text": "underline(f' : NN -> RR) \\\n  n |-> cases(\n    [|1|] &\"if\" n >>> 10,\n    2 * 3 &\"if\" n != 5,\n    1 - 0 thick &...,\n  )",
      "block": true
    },
    {
      "text": "dot \\ dots \\ ast \\ tilde \\ star",
      "block": true
    },
    {
      "text": "floor(phi.alt.)",
      "block": false
    },
    {
      "text": "floor(phi.alt. )",
      "block": false
    },
    {
      "text": "a",
      "block": false
    }
  ],
  "text": [
    {
      "text": "よ and 🏳️‍🌈",
      "block": true
    },
    {
      "text": "text(#red, \"time\"^2) + sqrt(\"place\")",
      "block": false
    },
    {
      "text": "nothing",
      "block": true
    },
    {
      "text": "\"hi ∅ hey\"",
      "block": true
    },
    {
      "text": "sum_(i in NN) 1 + i",
      "block": true
    },
    {
      "text": "nothing",
      "block": true
    },
    {
      "text": "\"hi ∅ hey\"",
      "block": true
    },
    {
      "text": "sum_(i in NN) 1 + i",
      "block": true
    },
    {
      "text": "e^(e^(e^(e)))",
      "block": true
    },
    {
      "text": "e^(e^(e^(e)))",
      "block": false
    },
    {
      "text": "y^dprime-2y^prime + y = 0",
      "block": true
    },
    {
      "text": "y^dprime-2y^prime + y = 0",
      "block": false
    },
    {
      "text": "y^tprime_3 + g^(prime 2)",
      "block": true
    },
    {
      "text": "scripts(sum_(k in NN))^prime 1/k^2",
      "block": true
    },
    {
      "text": "sum_(k in NN)^prime 1/k^2",
      "block": false
    },
    {
      "text": "1/(x^A)",
      "block": true
    },
    {
      "text": "1/(x^A)",
      "block": false
    },
    {
      "text": "x^A",
      "block": false
    }
  ],
  "underover": [
    {
      "text": "x = underbrace(\n  1 + 2 + ... + 5,\n  underbrace(\"numbers\", x + y)\n)",
      "block": true
    },
    {
      "text": "x = overbracket(\n  overline(underline(x + y)),\n  1 + 2 + ... + 5,\n)",
      "block": true
    },
    {
      "text": "underbracket([1, 2/3], \"relevant stuff\")\n          arrow.l.r.double.long\n  overbracket([4/5,6], \"irrelevant stuff\")",
      "block": true
    }
  ],
  "vec": [
    {
      "text": "vec(1, 2)",
      "block": true
    },
    {
      "text": "vec(\n  \"a\" & \"a a a\" & \"a a\",\n  \"a a\" & \"a a\" & \"a\",\n  \"a a a\" & \"a\" & \"a a a\",\n)",
      "block": true
    },
    {
      "text": "v = vec(1, 2+3, 4)",
      "block": true
    },
    {
      "text": "vec(1, 2)",
      "block": true
    }
  ]
}