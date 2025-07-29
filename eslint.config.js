const js = require('@eslint/js');
const securityPlugin = require('eslint-plugin-security');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // 基础推荐配置
  js.configs.recommended,

  // 全局配置
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    plugins: {
      security: securityPlugin,
    },
    rules: {
      // 基础规则
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Node.js 最佳实践
      'no-process-exit': 'warn',
      'no-path-concat': 'error',

      // 安全规则
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',

      // 代码质量
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-len': [
        'error',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      'max-lines': ['warn', { max: 300, skipComments: true }],
      'max-params': ['warn', 5],

      // Promise 处理
      'prefer-promise-reject-errors': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-promise-executor-return': 'error',

      // 错误处理
      'no-throw-literal': 'error',
      'prefer-regex-literals': 'error',
    },
  },

  // 忽略文件配置
  {
    ignores: [
      'node_modules/**',
      'logs/**',
      '*.log',
      '*.sqlite',
      '*.sqlite3',
      '*.db',
      'dist/**',
      'build/**',
      'coverage/**',
      '.env*',
      'tmp/**',
      'temp/**',
      '.cache/**',
      'backups/**',
      'docs/api/**',
      '.nyc_output/**',
      'public/js/vendor/**',
      'public/lib/**',
    ],
  },

  // 测试文件特殊配置
  {
    files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'max-lines': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // 脚本文件特殊配置
  {
    files: ['bin/**/*.js', 'scripts/**/*.js'],
    rules: {
      'no-console': 'off',
      'no-process-exit': 'off',
    },
  },

  // 数据库文件特殊配置
  {
    files: ['migrations/**/*.js', 'seeders/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // Prettier 集成 - 必须放在最后
  prettierConfig,
];
