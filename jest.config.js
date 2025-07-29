module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/logs/',
    '/backups/',
    '/coverage/',
    '\\.sqlite$',
    '\\.log$'
  ],
  
  // 覆盖率收集
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // 覆盖率收集的文件
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/config/database-mock.js',
    '!src/models-mock/**',
    '!coverage/**',
    '!node_modules/**'
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './src/controllers/': {
      branches: 60,
      functions: 70,
      lines: 75,
      statements: 75
    },
    './src/middleware/': {
      branches: 65,
      functions: 70,
      lines: 75,
      statements: 75
    },
    './src/models/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 全局设置
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 测试超时
  testTimeout: 10000,
  
  // 详细输出
  verbose: true,
  
  // 清除模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 错误报告
  errorOnDeprecated: true,
  
  // 监听模式配置
  watchman: false,
  
  // 最大并发数
  maxConcurrency: 5,
  
  // 转换配置（如果需要）
  transform: {},
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],
  
  // 运行前脚本
  globalSetup: '<rootDir>/tests/globalSetup.js',
  
  // 运行后脚本
  globalTeardown: '<rootDir>/tests/globalTeardown.js'
};