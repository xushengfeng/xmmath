import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const mathDirPath = "math";
const files = readdirSync(mathDirPath);

const testObj = {};

files.forEach((file) => {
    const filePath = join(mathDirPath, file);
    const content = readFileSync(filePath, "utf8");
    const l = [];
    let s = false;
    for (let t of content) {
        if (t === "$") {
            s = !s;
            if (s) l.push("");
            continue;
        }
        if (s) {
            l[l.length - 1] += t;
        }
    }

    testObj[file.replace('.typ','')] = l.map((t) => {
        return { text: t.trim(), block: t.startsWith(" ") || t.startsWith("\n") };
    });
});


writeFileSync("math.js",'test='+ JSON.stringify(testObj, null, 2));
