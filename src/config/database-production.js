// 阶段八：生产环境数据库配置
const { Sequelize } = require('sequelize');
const { initializeConfig } = require('./environment');

const config = initializeConfig();

// 生产环境数据库连接配置
const createProductionSequelize = () => {
  const dbConfig = config.database;

  // 优先使用PostgreSQL或MySQL，SQLite仅用于演示
  if (dbConfig.url) {
    // 使用数据库URL（推荐用于生产环境）
    return new Sequelize(dbConfig.url, {
      dialect: detectDialectFromUrl(dbConfig.url),
      logging: config.isProduction ? false : console.log,
      pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle,
      },
      define: {
        timestamps: true,
        paranoid: true,
        underscored: true,
        freezeTableName: true,
      },
      dialectOptions: getDialectOptions(),
      retry: {
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /ESOCKETTIMEDOUT/,
          /EHOSTUNREACH/,
          /EPIPE/,
          /EAI_AGAIN/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/,
        ],
        max: 5,
      },
    });
  } else {
    // 回退到SQLite（仅用于开发和演示）
    console.warn('⚠️  使用SQLite数据库，生产环境建议使用PostgreSQL或MySQL');
    return new Sequelize({
      dialect: 'sqlite',
      storage: dbConfig.sqlite.storage,
      logging: dbConfig.sqlite.logging ? console.log : false,
      pool: {
        max: 5, // SQLite并发连接限制
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        paranoid: true,
        underscored: true,
        freezeTableName: true,
      },
    });
  }
};

// 从URL检测数据库类型
const detectDialectFromUrl = url => {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgres';
  } else if (url.startsWith('mysql://')) {
    return 'mysql';
  } else if (url.startsWith('mariadb://')) {
    return 'mariadb';
  } else if (url.startsWith('sqlite://')) {
    return 'sqlite';
  }
  throw new Error(`不支持的数据库URL: ${url}`);
};

// 获取数据库特定选项
const getDialectOptions = () => {
  if (config.isProduction) {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: false, // 在生产环境中可能需要调整
      },
      // PostgreSQL特定选项
      native: false,
      // MySQL特定选项
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    };
  }
  return {};
};

// 生产环境数据库健康检查
const productionHealthCheck = async sequelize => {
  try {
    await sequelize.authenticate();

    // 执行简单查询测试
    const [results] = await sequelize.query('SELECT 1 as test', {
      type: Sequelize.QueryTypes.SELECT,
    });

    // 检查连接池状态
    const poolStatus = sequelize.connectionManager.pool;

    return {
      status: 'healthy',
      connection: 'active',
      test_query: results[0]?.test === 1,
      pool: {
        size: poolStatus?.size || 0,
        available: poolStatus?.available || 0,
        borrowed: poolStatus?.borrowed || 0,
        pending: poolStatus?.pending || 0,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connection: 'failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// 数据库迁移和同步（生产环境安全版本）
const safeSync = async (sequelize, options = {}) => {
  try {
    const defaultOptions = {
      force: false, // 生产环境永远不使用force
      alter: false, // 生产环境谨慎使用alter
    };

    const syncOptions = { ...defaultOptions, ...options };

    // 生产环境安全检查
    if (config.isProduction && (syncOptions.force || syncOptions.alter)) {
      console.warn('⚠️  生产环境不建议使用force或alter同步，请使用迁移脚本');
      return false;
    }

    console.log('🔄 开始数据库同步...');
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
    throw error;
  }
};

// 优雅关闭数据库连接
const gracefulShutdown = async sequelize => {
  try {
    console.log('🔒 正在关闭数据库连接...');
    await sequelize.close();
    console.log('✅ 数据库连接已安全关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接时出错:', error.message);
    throw error;
  }
};

// 数据库性能监控
const monitorDatabasePerformance = sequelize => {
  const originalQuery = sequelize.query;

  sequelize.query = function (sql, options = {}) {
    const startTime = Date.now();

    return originalQuery
      .call(this, sql, options)
      .then(result => {
        const duration = Date.now() - startTime;

        // 记录慢查询
        if (duration > 1000) {
          console.warn(`🐌 慢查询检测 (${duration}ms):`, {
            sql: sql.substring(0, 100),
            duration,
            timestamp: new Date().toISOString(),
          });
        }

        return result;
      })
      .catch(error => {
        console.error('❌ 数据库查询错误:', {
          sql: sql.substring(0, 100),
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        throw error;
      });
  };
};

// 创建生产环境数据库实例
const sequelize = createProductionSequelize();

// 启用性能监控
if (config.monitoring.enabled) {
  monitorDatabasePerformance(sequelize);
}

module.exports = {
  sequelize,
  productionHealthCheck,
  safeSync,
  gracefulShutdown,
  monitorDatabasePerformance,
  Sequelize,
};
