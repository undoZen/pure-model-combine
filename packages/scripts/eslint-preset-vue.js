module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: [
    'prettier',
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    'standard'
  ],
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: [
    'vue',
    '@typescript-eslint',
    'simple-import-sort'
  ],
  rules: {
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": "warn"
  }
}
