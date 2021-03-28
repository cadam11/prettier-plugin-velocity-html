module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  parserOptions: {
    "ecmaVersion": 2017,
    "sourceType": "module",
    "project": "./tsconfig.*json"
  },
  ignorePatterns: ["**/generated/**"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",      
    "prettier",
  ],
  rules: {
    "no-console": 1, // Means warning
    "prettier/prettier": 2, // Means error  
    "@typescript-eslint/strict-boolean-expressions": ["error", {"allowString": false, "allowNumber": false, "allowNullableObject": false}]
  },
  // overrides: [{
  //   files: ["src/**/*.ts"],
  //   extends: [
      
  //   ],
  //   parserOptions: {}
  // }]
};
