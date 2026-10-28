import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {},
  // 沙箱化的 preload 不能是 ESM。
  preload: { build: { rolldownOptions: { output: { format: "cjs" } } } },
  renderer: {},
});
