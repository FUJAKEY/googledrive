const globals = require('globals');

const commonRules = {
  'no-console': 'off',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
};

module.exports = [
  {
    ignores: ['node_modules', 'uploads', 'public/js/vendor']
  },
  {
    files: ['server/**/*.js', 'server/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.node
      }
    },
    rules: commonRules
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser
      }
    },
    rules: commonRules
  }
];
