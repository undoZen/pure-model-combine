const preset = require('scripts/eslint-preset')
module.exports = {
  ...preset,
  env: {
    browser: true
  }
}
