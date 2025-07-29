// Jest 全局设置 - 在所有测试开始前运行一次
const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🚀 Starting test suite setup...');
  
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.SQLITE_DATABASE_PATH = ':memory:';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
  process.env.LOG_LEVEL = 'error';
  
  // 确保测试目录存在
  const testDirs = [
    'tests/fixtures',
    'tests/helpers',
    'tests/unit',
    'tests/integration',
    'tests/e2e',
    'coverage'
  ];
  
  testDirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created test directory: ${dir}`);
    }
  });
  
  // 清理之前的测试数据
  const testDataFiles = [
    'test.sqlite',
    'test.log',
    'test-error.log'
  ];
  
  testDataFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up test file: ${file}`);
    }
  });
  
  // 设置全局测试配置
  global.__TEST_CONFIG__ = {
    baseURL: 'http://localhost:3000',
    timeout: 10000,
    retries: 2,
    setupTime: Date.now()
  };
  
  console.log('✅ Test suite setup completed');
};