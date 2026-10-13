import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    // Os testes de integração partilham a mesma BD: correm em série.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
