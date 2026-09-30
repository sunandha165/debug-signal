import { defineConfig } from "vitest/config";

/*
 * DebugSignal server test configuration.
 *
 * The tests live in src/tests/*.test.ts and run against the real
 * demo-repository on disk (no mocking, no network).
 *
 * `npm run build` (tsc) also emits a compiled copy of the tests into
 * dist/tests.  Those CommonJS copies are not runnable by Vitest
 * ("Vitest cannot be imported in a CommonJS module using require()"),
 * so the include pattern below keeps the test run scoped to the
 * TypeScript sources only.
 *
 * The .mts extension is required because the server package is
 * CommonJS ("type": "commonjs") and this config uses ESM syntax.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
