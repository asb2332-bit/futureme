import { build } from "esbuild";

await build({
  entryPoints: ["src/poster-island.jsx"],
  bundle: true,
  format: "iife",
  globalName: "PosterIsland",
  outfile: "public/create-poster.js",
  minify: true,
  jsx: "automatic"
});
