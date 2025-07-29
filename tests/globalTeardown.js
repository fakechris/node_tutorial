// Jest 全局清理 - 在所有测试完成后运行一次
const path = require('path');
const fs = require('fs');

module.exports = async () => {
  console.log('🧹 Starting test suite cleanup...');
  
  // 清理测试生成的文件
  const testFiles = [
    'test.sqlite',
    'test.log',
    'test-error.log',
    'test-database.sqlite'
  ];
  
  testFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleaned up: ${file}`);
      } catch (error) {
        console.warn(`⚠️  Could not clean up ${file}:`, error.message);
      }
    }
  });
  
  // 清理临时目录
  const tempDirs = [
    'temp',
    'tmp',
    '.cache'
  ];
  
  tempDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`📁 Cleaned up directory: ${dir}`);
      } catch (error) {
        console.warn(`⚠️  Could not clean up directory ${dir}:`, error.message);
      }
    }
  });
  
  // 计算测试运行时间
  if (global.__TEST_CONFIG__) {
    const duration = Date.now() - global.__TEST_CONFIG__.setupTime;
    console.log(`⏱️  Total test suite duration: ${duration}ms`);
  }
  
  // 清理全局变量
  delete global.__TEST_CONFIG__;
  
  console.log('✅ Test suite cleanup completed');
};