// 阶段七：统一日志系统配置
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 开发环境的彩色控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS'
  }),
  winston.format.printf(({ timestamp, level, message, service, traceId, ...meta }) => {
    let logLine = `${timestamp} [${level}]`;
    
    if (service) {
      logLine += ` [${service}]`;
    }
    
    if (traceId) {
      logLine += ` [${traceId.substring(0, 8)}...]`;
    }
    
    logLine += ` ${message}`;
    
    // 添加额外的元数据
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      const metaStr = metaKeys
        .map(key => `${key}=${JSON.stringify(meta[key])}`)
        .join(' ');
      logLine += ` | ${metaStr}`;
    }
    
    return logLine;
  })
);

// 敏感信息过滤器
const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'cookie'];
const sanitizeData = (data) => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// 创建winston logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: {
    service: 'back-tutor',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // 组合日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // 应用日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      level: 'info',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 7,
      tailable: true
    })
  ],
  
  // 未捕获异常处理
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    })
  ],
  
  // 未处理的Promise拒绝
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    })
  ]
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// 扩展logger方法
logger.request = (message, meta = {}) => {
  logger.info(message, { ...sanitizeData(meta), type: 'request' });
};

logger.response = (message, meta = {}) => {
  logger.info(message, { ...sanitizeData(meta), type: 'response' });
};

logger.db = (message, meta = {}) => {
  logger.debug(message, { ...sanitizeData(meta), type: 'database' });
};

logger.auth = (message, meta = {}) => {
  logger.info(message, { ...sanitizeData(meta), type: 'auth' });
};

logger.security = (message, meta = {}) => {
  logger.warn(message, { ...sanitizeData(meta), type: 'security' });
};

logger.performance = (message, meta = {}) => {
  logger.info(message, { ...sanitizeData(meta), type: 'performance' });
};

// 日志性能统计
logger.stats = {
  requests: 0,
  errors: 0,
  warnings: 0,
  startTime: Date.now(),
  
  increment(type) {
    if (this[type] !== undefined) {
      this[type]++;
    }
  },
  
  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime: Math.floor(uptime / 1000),
      requests: this.requests,
      errors: this.errors,
      warnings: this.warnings,
      requestsPerMinute: Math.round((this.requests / uptime) * 60000),
      errorRate: this.requests > 0 ? (this.errors / this.requests * 100).toFixed(2) : 0
    };
  }
};

// 监听日志事件进行统计
logger.on('data', (info) => {
  if (info.type === 'request') {
    logger.stats.increment('requests');
  } else if (info.level === 'error') {
    logger.stats.increment('errors');
  } else if (info.level === 'warn') {
    logger.stats.increment('warnings');
  }
});

module.exports = logger;