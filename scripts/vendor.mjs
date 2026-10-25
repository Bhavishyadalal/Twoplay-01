import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await build({
  entryPoints: ["src/vendor/peer-entry.js"],
  bundle: true,
  format: "iife",
  minify: true,
  outfile: "src/vendor/peer.js",
});
await mkdir("public/assets/fonts", { recursive: true });
for (const name of ["dm-sans", "space-grotesk", "jetbrains-mono"]) {
  await copyFile(
    `node_modules/@fontsource-variable/${name}/files/${name}-latin-wght-normal.woff2`,
    `public/assets/fonts/${name}.woff2`,
  );
  await copyFile(
    `node_modules/@fontsource-variable/${name}/LICENSE`,
    `public/assets/fonts/${name}-LICENSE.txt`,
  );
}
