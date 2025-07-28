// 阶段六：数据库配置
const { Sequelize } = require('sequelize');

// 数据库连接配置
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database/tutorial.db', // 使用SQLite文件数据库，便于演示
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    // 自动添加时间戳
    timestamps: true,
    // 软删除（不实际删除记录，只标记为删除）
    paranoid: true,
    // 使用下划线命名法
    underscored: true,
    // 表名不自动复数化
    freezeTableName: true
  }
});

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功！');
    
    const dbInfo = {
      dialect: sequelize.getDialect(),
      version: sequelize.getDatabaseVersion ? await sequelize.getDatabaseVersion() : 'Unknown',
      config: {
        host: sequelize.config.host || 'local file',
        database: sequelize.config.database || sequelize.config.storage,
        pool: sequelize.config.pool
      }
    };
    
    console.log('📊 数据库信息:', JSON.stringify(dbInfo, null, 2));
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
};

// 同步数据库模型
const syncDatabase = async (options = {}) => {
  try {
    const defaultOptions = {
      force: false, // 不强制重建表
      alter: false  // 不自动修改表结构
    };
    
    const syncOptions = { ...defaultOptions, ...options };
    
    console.log('🔄 开始同步数据库模型...');
    await sequelize.sync(syncOptions);
    
    if (syncOptions.force) {
      console.log('⚠️  数据库表已重建（所有数据已清空）');
    } else if (syncOptions.alter) {
      console.log('🔧 数据库表结构已更新');
    } else {
      console.log('✅ 数据库模型同步完成');
    }
    
    return true;
  } catch (error) {
    console.error('❌ 数据库同步失败:', error.message);
    return false;
  }
};

// 关闭数据库连接
const closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('🔒 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接失败:', error.message);
  }
};

// 数据库健康检查
const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    const stats = await sequelize.query('SELECT 1 as health_check', {
      type: Sequelize.QueryTypes.SELECT
    });
    
    return {
      status: 'healthy',
      connection: 'active',
      timestamp: new Date().toISOString(),
      test_query: stats[0]?.health_check === 1
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connection: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// 获取数据库统计信息
const getStats = async () => {
  try {
    // 获取所有表名
    const tables = await sequelize.getQueryInterface().showAllTables();
    
    const stats = {
      tables: tables.length,
      tableNames: tables,
      models: Object.keys(sequelize.models),
      connections: {
        max: sequelize.options.pool.max,
        min: sequelize.options.pool.min,
        active: sequelize.connectionManager.pool?.size || 0
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    return stats;
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
  healthCheck,
  getStats,
  Sequelize
};