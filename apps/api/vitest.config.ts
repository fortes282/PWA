import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_PATH: ":memory:",
      JWT_SECRET: "test-secret-key-for-vitest",
      NODE_ENV: "test",
    },
  },
});
