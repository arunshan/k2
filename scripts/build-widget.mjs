import { build } from "esbuild";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Read CopilotKit CSS so we can inline it as a string
const copilotCssPath = resolve(
  root,
  "node_modules/@copilotkit/react-ui/dist/index.css"
);
const copilotCss = readFileSync(copilotCssPath, "utf-8")
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$/g, "\\$");

await build({
  entryPoints: [resolve(root, "src/widget/index.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: resolve(root, "public/widget.js"),
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  jsx: "automatic",
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
    ".css": "text",
  },
  // Resolve the CSS import to a virtual module that returns the inlined string
  plugins: [
    {
      name: "inline-copilot-css",
      setup(build) {
        build.onResolve(
          { filter: /@copilotkit\/react-ui\/(styles|dist\/index)\.css$/ },
          () => ({
            path: "copilot-styles-virtual",
            namespace: "copilot-css",
          })
        );
        build.onLoad(
          { filter: /.*/, namespace: "copilot-css" },
          () => ({
            contents: `export default \`${copilotCss}\`;`,
            loader: "js",
          })
        );
      },
    },
  ],
  // Don't try to bundle node built-ins
  platform: "browser",
  logLevel: "info",
});

console.log("Widget built -> public/widget.js");
