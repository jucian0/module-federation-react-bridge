import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
    },
    tsconfigPath: "./tsconfig.json",
  },
  output: {
    cleanDistPath: true,
    sourceMap: true,
    target: "web",
  },
  lib: [
    {
      format: "cjs",
      syntax: "es2019",
      dts: true,
      autoExtension: false,
      output: {
        externals: ["react", "react-dom", "react-router-dom"],
        filename: {
          js: "[name].js",
        },
      },
    },
    {
      format: "esm",
      syntax: "es2019",
      dts: false,
      output: {
        externals: ["react", "react-dom", "react-router-dom"],
        filename: {
          js: "[name].mjs",
        },
      },
    },
  ],
});
