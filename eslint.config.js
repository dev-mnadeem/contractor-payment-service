"use strict";

const js = require("@eslint/js");
const globals = require("globals");
const jest = require("eslint-plugin-jest");
const prettier = require("eslint-config-prettier");

/** Nesting deeper than this, or more than this many positional parameters,
 *  is a sign a function is doing more than one thing. */
const MAX_BLOCK_DEPTH = 3;
const MAX_FUNCTION_PARAMS = 4;

module.exports = [
  { ignores: ["node_modules/", "coverage/"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-console": ["warn", { allow: ["log", "warn", "error"] }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-return-await": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
      curly: ["error", "multi-line"],
      // Money and status codes get names. Small structural integers do not.
      "no-magic-numbers": [
        "warn",
        { ignore: [-1, 0, 1, 2, 10, 100], ignoreArrayIndexes: true, enforceConst: true },
      ],
      "max-depth": ["error", MAX_BLOCK_DEPTH],
      "max-params": ["error", MAX_FUNCTION_PARAMS],
    },
  },
  {
    files: ["src/__tests__/**/*.js", "scripts/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    plugins: { jest },
    rules: {
      "no-magic-numbers": "off",
      "no-console": "off",
    },
  },
  prettier,
];
