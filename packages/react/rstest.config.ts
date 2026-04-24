import { withRslibConfig } from "@rstest/adapter-rslib";
import { defineConfig } from "@rstest/core";

export default defineConfig({
  extends: withRslibConfig(),
  include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  testEnvironment: "happy-dom",
});
