import { build, transform } from "esbuild";
import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
await import("./vendor.mjs");
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await build({
  entryPoints: ["src/vendor/peer-entry.js"],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: "src/vendor/peer.js",
});
let html = await readFile("index.html", "utf8");
const files = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="(\/src\/[^"?]+\.(?:js|css))"/g)].map(
      (m) => m[1],
    ),
  ),
];
for (const url of files) {
  const file = url.slice(1),
    source = await readFile(file, "utf8");
  const result = await transform(source, {
    loader: file.endsWith(".css") ? "css" : "js",
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    legalComments: "eof",
    target: "es2020",
  });
  if (file.endsWith(".css"))
    result.code = result.code.replaceAll("/assets/", "../assets/");
  const hash = createHash("sha256")
    .update(result.code)
    .digest("hex")
    .slice(0, 10);
  const output = `static/${path.basename(file).replace(/\.(js|css)$/, `.${hash}.$1`)}`;
  await mkdir(path.dirname("dist/" + output), { recursive: true });
  await writeFile("dist/" + output, result.code);
  html = html.replaceAll(url, "./" + output);
}
// Relative asset paths keep GitHub Pages project subpaths working.
html = html.replaceAll('"/assets/', '"./assets/');
await writeFile("dist/index.html", html);
console.log(
  `Built ${files.length} cacheable scripts/styles and public assets into dist/`,
);
