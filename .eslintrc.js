module.exports = {
  extends: '../../.eslintrc.yml',
  ignorePatterns: ['/.eslintrc.js', '/index.ts'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  }
}