// 阶段八：环境配置管理
const path = require('path');
const fs = require('fs');

// 根据NODE_ENV加载对应的环境配置文件
const loadEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  const envFile = `.env.${env}`;
  const envPath = path.join(process.cwd(), envFile);

  // 检查环境配置文件是否存在
  if (fs.existsSync(envPath)) {
    console.log(`📋 加载环境配置: ${envFile}`);
    require('dotenv').config({ path: envPath });
  } else {
    console.log(`⚠️  环境配置文件 ${envFile} 不存在，使用默认 .env`);
    require('dotenv').config();
  }
};

// 环境配置验证
const validateEnvironmentConfig = () => {
  const required = ['NODE_ENV', 'PORT'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ 缺少必需的环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }

  // 生产环境额外验证
  if (process.env.NODE_ENV === 'production') {
    const productionRequired = ['JWT_SECRET', 'SESSION_SECRET'];
    const productionMissing = productionRequired.filter(
      key => !process.env[key] || process.env[key].includes('change-in-production')
    );

    if (productionMissing.length > 0) {
      console.error(`❌ 生产环境必须设置安全的密钥: ${productionMissing.join(', ')}`);
      process.exit(1);
    }
  }
};

// 配置管理器
class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.isProduction = this.env === 'production';
    this.isDevelopment = this.env === 'development';
    this.isTest = this.env === 'test';
  }

  // 服务器配置
  get server() {
    return {
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || 'localhost',
      timeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
      bodyLimit: process.env.BODY_LIMIT || '10mb',
      compression: process.env.COMPRESSION_ENABLED === 'true',
    };
  }

  // 数据库配置
  get database() {
    return {
      url: process.env.DATABASE_URL,
      sqlite: {
        storage: process.env.SQLITE_DATABASE_PATH || './database/tutorial.db',
        logging: this.isDevelopment,
      },
      pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        min: parseInt(process.env.DB_POOL_MIN) || 0,
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
        idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
      },
      forceSync: process.env.TEST_DATABASE_FORCE_SYNC === 'true',
    };
  }

  // JWT配置
  get jwt() {
    return {
      secret: process.env.JWT_SECRET || 'fallback-secret-key',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'node-backend-tutorial',
      audience: 'api-users',
    };
  }

  // 日志配置
  get logging() {
    return {
      level: process.env.LOG_LEVEL || (this.isProduction ? 'warn' : 'debug'),
      dir: process.env.LOG_DIR || './logs',
      maxSize: process.env.LOG_MAX_SIZE || '10MB',
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      console: !this.isProduction,
    };
  }

  // 安全配置
  get security() {
    return {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || (this.isProduction ? 12 : 8),
      sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
      cors: {
        origin: this.parseCorsOrigin(),
        methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(','),
        allowedHeaders: this.parseCorsHeaders(),
      },
    };
  }

  // 监控配置
  get monitoring() {
    return {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000,
      performanceSamplingRate: parseFloat(process.env.PERFORMANCE_SAMPLING_RATE) || 1.0,
    };
  }

  // 缓存配置
  get cache() {
    return {
      enabled: process.env.CACHE_ENABLED === 'true',
      ttl: parseInt(process.env.CACHE_TTL) || 3600,
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    };
  }

  // 功能开关
  get features() {
    return {
      debugPanel: process.env.FEATURES_DEBUG_PANEL === 'true',
      detailedErrors: process.env.FEATURES_DETAILED_ERRORS === 'true',
      swaggerUI: process.env.FEATURES_SWAGGER_UI === 'true',
      hotReload: process.env.FEATURES_HOT_RELOAD === 'true',
    };
  }

  // 第三方服务配置
  get services() {
    return {
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-west-2',
      },
    };
  }

  // 辅助方法：解析CORS源
  parseCorsOrigin() {
    const origins = process.env.CORS_ORIGIN;
    if (!origins || origins === '*') return true;
    return origins.split(',').map(origin => origin.trim());
  }

  // 辅助方法：解析CORS头部
  parseCorsHeaders() {
    const headers = process.env.CORS_ALLOWED_HEADERS;
    if (!headers || headers === '*') return true;
    return headers.split(',').map(header => header.trim());
  }

  // 获取完整配置对象
  getConfig() {
    return {
      env: this.env,
      isProduction: this.isProduction,
      isDevelopment: this.isDevelopment,
      isTest: this.isTest,
      server: this.server,
      database: this.database,
      jwt: this.jwt,
      logging: this.logging,
      security: this.security,
      monitoring: this.monitoring,
      cache: this.cache,
      features: this.features,
      services: this.services,
    };
  }

  // 打印配置信息（隐藏敏感信息）
  printConfig() {
    const config = this.getConfig();
    const safeConfig = this.sanitizeConfig(config);

    console.log('📋 当前配置:');
    console.log('==============');
    console.log(`环境: ${config.env}`);
    console.log(`端口: ${config.server.port}`);
    console.log(`数据库: ${config.database.sqlite.storage}`);
    console.log(`日志级别: ${config.logging.level}`);
    console.log(`压缩: ${config.server.compression ? '启用' : '禁用'}`);
    console.log(`监控: ${config.monitoring.enabled ? '启用' : '禁用'}`);
    console.log(`缓存: ${config.cache.enabled ? '启用' : '禁用'}`);
    console.log(`调试面板: ${config.features.debugPanel ? '启用' : '禁用'}`);
    console.log('==============');
  }

  // 清理敏感信息
  sanitizeConfig(config) {
    const sensitive = ['secret', 'password', 'key', 'token'];
    const cleaned = JSON.parse(JSON.stringify(config));

    const sanitize = obj => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        } else if (typeof obj[key] === 'string') {
          const lowerKey = key.toLowerCase();
          if (sensitive.some(s => lowerKey.includes(s))) {
            obj[key] = '[REDACTED]';
          }
        }
      }
    };

    sanitize(cleaned);
    return cleaned;
  }
}

// 初始化配置
const initializeConfig = () => {
  loadEnvironmentConfig();
  validateEnvironmentConfig();

  const configManager = new ConfigManager();

  // 开发环境打印配置信息
  if (configManager.isDevelopment) {
    configManager.printConfig();
  }

  return configManager;
};

module.exports = {
  ConfigManager,
  initializeConfig,
  loadEnvironmentConfig,
  validateEnvironmentConfig,
};
