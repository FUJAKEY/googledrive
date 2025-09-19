module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      files: ['public/**/*.js'],
      env: {
        browser: true
      },
      parserOptions: {
        sourceType: 'module'
      },
      globals: {
        window: 'readonly',
        document: 'readonly'
      }
    }
  ]
};
