# 代码质量工具配置指南

本项目使用 ESLint 和 Prettier 来确保代码质量和风格一致性。

## 📋 目录

- [工具概述](#工具概述)
- [ESLint 配置](#eslint-配置)
- [Prettier 配置](#prettier-配置)
- [使用方法](#使用方法)
- [IDE 集成](#ide-集成)
- [规则说明](#规则说明)
- [故障排除](#故障排除)

## 🛠️ 工具概述

### ESLint
- **作用**: 静态代码分析，发现代码中的问题和潜在错误
- **配置文件**: `eslint.config.js`
- **版本**: ESLint 9.x (使用新的扁平配置格式)

### Prettier
- **作用**: 代码格式化，统一代码风格
- **配置文件**: `.prettierrc.js`
- **忽略文件**: `.prettierignore`

## ⚙️ ESLint 配置

### 配置结构

```javascript
// eslint.config.js
module.exports = [
  // 基础推荐配置
  js.configs.recommended,
  
  // 全局配置
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { /* Node.js 全局变量 */ }
    },
    plugins: {
      security: securityPlugin
    },
    rules: {
      // 自定义规则
    }
  },
  
  // 文件特定配置
  {
    files: ['**/*.test.js'],
    rules: { /* 测试文件特殊规则 */ }
  }
];
```

### 规则分类

#### 基础规则
```javascript
'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
'no-var': 'error',
'prefer-const': 'error',
'eqeqeq': ['error', 'always'],
'curly': ['error', 'all']
```

#### 安全规则
```javascript
'security/detect-object-injection': 'warn',
'security/detect-unsafe-regex': 'error',
'security/detect-buffer-noassert': 'error',
'security/detect-eval-with-expression': 'error'
```

#### 代码质量规则
```javascript
'complexity': ['warn', 10],        // 圈复杂度限制
'max-depth': ['warn', 4],          // 最大嵌套深度
'max-len': ['error', { 'code': 100 }], // 行长度限制
'max-lines': ['warn', { 'max': 300 }], // 文件行数限制
'max-params': ['warn', 5]          // 函数参数数量限制
```

### 文件特定配置

#### 测试文件
```javascript
{
  files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
  languageOptions: {
    globals: {
      jest: 'readonly',
      describe: 'readonly',
      test: 'readonly',
      expect: 'readonly'
    }
  },
  rules: {
    'max-lines': 'off',
    'security/detect-non-literal-fs-filename': 'off'
  }
}
```

#### 脚本文件
```javascript
{
  files: ['bin/**/*.js', 'scripts/**/*.js'],
  rules: {
    'no-console': 'off',
    'no-process-exit': 'off'
  }
}
```

## 🎨 Prettier 配置

### 基础设置

```javascript
// .prettierrc.js
module.exports = {
  printWidth: 90,           // 行宽度
  tabWidth: 2,              // 缩进宽度
  useTabs: false,           // 使用空格而非制表符
  semi: true,               // 行尾分号
  singleQuote: true,        // 单引号
  trailingComma: 'es5',     // 尾随逗号
  bracketSpacing: true,     // 大括号内空格
  arrowParens: 'avoid',     // 箭头函数参数括号
  endOfLine: 'lf'           // 换行符类型
};
```

### 文件类型特定配置

```javascript
overrides: [
  {
    files: '*.json',
    options: {
      printWidth: 120,
      tabWidth: 2
    }
  },
  {
    files: '*.md',
    options: {
      printWidth: 80,
      proseWrap: 'always'
    }
  },
  {
    files: '*.yml',
    options: {
      tabWidth: 2,
      singleQuote: false
    }
  }
]
```

## 🚀 使用方法

### NPM 脚本

```bash
# 代码检查
npm run lint                    # 运行 ESLint 检查
npm run lint:fix               # 自动修复可修复的问题

# 代码格式化
npm run format                  # 格式化所有文件
npm run format:check           # 检查格式化状态

# 综合验证
npm run validate               # 运行所有代码质量检查
```

### 命令行使用

#### ESLint
```bash
# 检查特定文件
npx eslint src/index.js

# 检查特定目录
npx eslint src/controllers/

# 自动修复
npx eslint src/ --fix

# 指定配置文件
npx eslint src/ --config eslint.config.js
```

#### Prettier
```bash
# 格式化特定文件
npx prettier --write src/index.js

# 检查格式化状态
npx prettier --check src/

# 格式化特定类型文件
npx prettier --write "**/*.js"
```

## 🔧 IDE 集成

### VS Code 配置

项目包含了 VS Code 配置文件：

#### `.vscode/settings.json`
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["javascript"],
  "eslint.run": "onSave",
  "prettier.requireConfig": true
}
```

#### 推荐扩展
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-node-debug2"
  ]
}
```

### 其他 IDE

#### WebStorm
1. 安装 ESLint 插件
2. 在设置中启用 ESLint：`Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint`
3. 安装 Prettier 插件
4. 配置 Prettier：`Settings > Languages & Frameworks > JavaScript > Prettier`

#### Vim
```vim
" 安装插件
Plug 'dense-analysis/ale'
Plug 'prettier/vim-prettier'

" 配置
let g:ale_linters = {
\   'javascript': ['eslint'],
\}
let g:ale_fixers = {
\   'javascript': ['eslint', 'prettier'],
\}
```

## 📋 规则说明

### 严重程度级别

- **error** (2): 违反规则会导致构建失败
- **warn** (1): 违反规则会显示警告，但不影响构建
- **off** (0): 禁用规则

### 常见规则解释

#### `no-console`
```javascript
// ❌ 生产环境不允许
console.log('Debug info');

// ✅ 使用日志库
logger.info('Debug info');
```

#### `prefer-const`
```javascript
// ❌ 不会重新赋值的变量应使用 const
let name = 'John';

// ✅ 正确
const name = 'John';
```

#### `max-len`
```javascript
// ❌ 行太长（超过100字符）
const veryLongVariableName = 'This is a very long string that exceeds the maximum line length limit';

// ✅ 正确
const veryLongVariableName = 
  'This is a very long string that exceeds the maximum line length limit';
```

#### `complexity`
```javascript
// ❌ 复杂度过高
function processData(data) {
  if (data.type === 'A') {
    if (data.status === 'active') {
      if (data.priority === 'high') {
        // ... 更多嵌套逻辑
      }
    }
  }
}

// ✅ 拆分为更小的函数
function processData(data) {
  if (data.type === 'A') {
    return processTypeA(data);
  }
  // ... 其他类型处理
}

function processTypeA(data) {
  if (data.status === 'active') {
    return processActiveData(data);
  }
  // ... 其他状态处理
}
```

### 安全规则说明

#### `security/detect-object-injection`
```javascript
// ⚠️ 潜在的对象注入漏洞
const userInput = req.body.key;
const result = data[userInput];

// ✅ 更安全的做法
const allowedKeys = ['name', 'email', 'age'];
if (allowedKeys.includes(userInput)) {
  const result = data[userInput];
}
```

#### `security/detect-unsafe-regex`
```javascript
// ❌ 容易导致 ReDoS 攻击的正则
const regex = /^(a+)+$/;

// ✅ 更安全的正则
const regex = /^a+$/;
```

## 🔧 自定义配置

### 添加新规则

```javascript
// eslint.config.js
{
  rules: {
    // 添加自定义规则
    'no-magic-numbers': ['error', { 
      ignore: [0, 1, -1],
      ignoreArrayIndexes: true 
    }],
    'prefer-template': 'error',
    'no-duplicate-imports': 'error'
  }
}
```

### 忽略特定文件

```javascript
// eslint.config.js
{
  ignores: [
    'node_modules/**',
    'build/**',
    'dist/**',
    '*.min.js',
    'public/vendor/**'
  ]
}
```

### Prettier 忽略文件

```bash
# .prettierignore
node_modules/
build/
dist/
*.min.js
package-lock.json
```

## 🚨 故障排除

### 常见问题

#### 1. ESLint 配置文件未找到
```bash
# 错误信息
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.

# 解决方案
确保项目根目录存在 eslint.config.js 文件
```

#### 2. Prettier 与 ESLint 冲突
```bash
# 安装冲突解决插件
npm install --save-dev eslint-config-prettier

# 在配置中使用
module.exports = [
  // ... 其他配置
  require('eslint-config-prettier')
];
```

#### 3. 插件兼容性问题
```bash
# 检查插件版本兼容性
npm ls eslint
npm ls prettier

# 更新到兼容版本
npm update eslint-plugin-security
```

#### 4. 格式化后仍有 ESLint 错误
```bash
# 先运行 Prettier，再运行 ESLint
npm run format
npm run lint:fix
```

### 调试技巧

#### 查看应用的规则
```bash
# 查看特定文件的规则配置
npx eslint --print-config src/index.js
```

#### 详细输出
```bash
# ESLint 详细输出
npx eslint src/ --format=detailed

# Prettier 调试模式
npx prettier --write src/ --loglevel=debug
```

## 📊 质量指标

### 代码质量目标

- **ESLint 错误**: 0 个
- **ESLint 警告**: < 10 个
- **代码覆盖率**: > 80%
- **圈复杂度**: < 10
- **文件行数**: < 300 行

### 监控脚本

```bash
#!/bin/bash
# scripts/quality-check.sh

echo "🔍 Running code quality checks..."

# ESLint 检查
echo "📋 ESLint Results:"
npm run lint > eslint-report.txt 2>&1 || true
cat eslint-report.txt

# Prettier 检查
echo "🎨 Prettier Results:"
npm run format:check

# 生成质量报告
echo "📊 Quality Summary:"
echo "ESLint Errors: $(grep -c 'error' eslint-report.txt || echo 0)"
echo "ESLint Warnings: $(grep -c 'warning' eslint-report.txt || echo 0)"
```

## 📚 进阶配置

### 自动化集成

#### Git Hooks (使用 husky)
```bash
# 安装 husky
npm install --save-dev husky

# 设置 pre-commit hook
npx husky install
npx husky add .husky/pre-commit "npm run validate"
```

#### GitHub Actions 集成
```yaml
# .github/workflows/code-quality.yml
name: Code Quality

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run validate
```

### 团队协作

#### EditorConfig
```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.js]
indent_style = space
indent_size = 2

[*.json]
indent_style = space
indent_size = 2
```

#### 文档同步
```bash
# 生成规则文档
npx eslint --print-config src/index.js > docs/eslint-rules.json
```

---

**提示**: 定期运行 `npm run validate` 确保代码质量，在提交代码前使用 `npm run lint:fix` 和 `npm run format` 自动修复大部分问题。