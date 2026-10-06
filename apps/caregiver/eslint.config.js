// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    // React Compiler rules shipped with eslint-config-expo 57. The pre-SDK-57 screens and hooks
    // trip them in ways that need the C2 screen rewrites (state set in effects, refs read in
    // render), so they report as warnings until those screens are reworked.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]);
