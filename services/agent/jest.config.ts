import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: { module: "CommonJS" },
      // Skip type-checking during test runs — tsc --noEmit handles that.
      // Needed because LangChain's tool() generics cause TS2589 in ts-jest.
      diagnostics: false,
      isolatedModules: true,
    }],
  },
  setupFiles: ["<rootDir>/tests/setup.ts"],
  clearMocks: true,
  testTimeout: 30000,
};

export default config;
