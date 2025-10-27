const FS = require('fs')
const YAML = require('js-yaml')

module.exports = [
  // Global ignores (applies to all configs)
  {
    ignores: [
      'bin/**',
      'dist/**',
      'node_modules/**',
      'tsconfig.json'
    ]
  },
  
  {
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
    ],

    languageOptions: {
      globals: {
        ...require('globals').browser,
        ...require('globals').es2022,
      },
      
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
        ecmaVersion: 2022,
      }
    },

    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      '@stylistic': require('@stylistic/eslint-plugin'),
      'react-refresh': require('eslint-plugin-react-refresh'),
      'react-hooks': require('eslint-plugin-react-hooks'),
      'unused-imports': require('eslint-plugin-unused-imports'),
      '@mosdev': require('@mosdev/eslint-plugin')
    },

    rules: {
      ...YAML.load(FS.readFileSync('../../eslint.rules.yml')),
      ...YAML.load(FS.readFileSync('../../eslint.rules.react.yml')),
    }
  }
]