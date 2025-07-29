module.exports = {
  // 基础格式化规则
  printWidth: 90,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',

  // 数组和对象
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,

  // 箭头函数
  arrowParens: 'avoid',

  // 换行符
  endOfLine: 'lf',

  // JSX (虽然我们是后端项目，但为了完整性)
  jsxSingleQuote: true,
  jsxBracketSameLine: false,

  // 嵌入语言格式化
  embeddedLanguageFormatting: 'auto',

  // HTML 空白敏感性
  htmlWhitespaceSensitivity: 'css',

  // 插件
  plugins: [],

  // 文件覆盖
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 120,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: '*.yml',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
  ],
};
