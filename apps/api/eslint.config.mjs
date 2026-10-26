import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist/**", "node_modules/**", "data/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            globals: globals.node,
        },
        linterOptions: { reportUnusedDisableDirectives: "off" },
        rules: {
            // The codebase uses `any` at a few Mongoose and Express boundaries.
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
            "@typescript-eslint/no-empty-object-type": "warn",
            "@typescript-eslint/no-require-imports": "warn",
            "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
            "no-empty": ["warn", { allowEmptyCatch: true }],
            "no-useless-escape": "warn",
        },
    }
);
