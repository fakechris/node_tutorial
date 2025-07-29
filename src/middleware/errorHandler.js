// 阶段七：增强的统一错误处理中间件
const statusCode = require('./statusCode');
const logger = require('../config/logger');

// 错误类型映射
const errorTypeMap = {
  ValidationError: 400,
  SequelizeValidationError: 400,
  SequelizeUniqueConstraintError: 409,
  SequelizeForeignKeyConstraintError: 400,
  JsonWebTokenError: 401,
  TokenExpiredError: 401,
  NotBeforeError: 401,
  SyntaxError: 400,
  TypeError: 500,
  ReferenceError: 500,
  CastError: 400,
  UnauthorizedError: 401,
  NotFoundError: 404,
};

// 错误统计
const errorStats = {
  total: 0,
  byType: new Map(),
  byStatusCode: new Map(),
  byEndpoint: new Map(),
  recentErrors: [],

  addError(error, req, statusCode) {
    this.total++;

    // 按类型统计
    const errorType = error.name || 'Unknown';
    this.byType.set(errorType, (this.byType.get(errorType) || 0) + 1);

    // 按状态码统计
    this.byStatusCode.set(statusCode, (this.byStatusCode.get(statusCode) || 0) + 1);

    // 按端点统计
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    this.byEndpoint.set(endpoint, (this.byEndpoint.get(endpoint) || 0) + 1);

    // 保存最近的错误（最多保存100个）
    this.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      message: error.message,
      type: errorType,
      statusCode,
      endpoint,
      traceId: req.traceId,
      userId: req.user?.userId,
      stack: error.stack,
    });

    if (this.recentErrors.length > 100) {
      this.recentErrors = this.recentErrors.slice(0, 100);
    }
  },

  getStats() {
    return {
      total: this.total,
      byType: Object.fromEntries(this.byType),
      byStatusCode: Object.fromEntries(this.byStatusCode),
      byEndpoint: Object.fromEntries(this.byEndpoint),
      recentErrorsCount: this.recentErrors.length,
    };
  },

  getRecentErrors(limit = 20) {
    return this.recentErrors.slice(0, limit);
  },
};

// 开发环境和生产环境的错误信息处理
const getErrorResponse = (error, env) => {
  const isDevelopment = env === 'development';

  // 基础错误信息
  const errorResponse = {
    status: 'error',
    message: error.message || '服务器内部错误',
    timestamp: new Date().toISOString(),
  };

  // 开发环境提供更详细的错误信息
  if (isDevelopment) {
    errorResponse.stack = error.stack;
    errorResponse.details = error.details || error.original?.message;

    // Sequelize 错误的详细信息
    if (error.errors && Array.isArray(error.errors)) {
      errorResponse.validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));
    }
  }

  return errorResponse;
};

// 错误严重性分类
const getErrorSeverity = (statusCode, error) => {
  if (statusCode >= 500) {
    return 'critical';
  } else if (statusCode >= 400 && statusCode < 500) {
    return 'warning';
  } else {
    return 'info';
  }
};

// 主要错误处理中间件
const errorHandler = (error, req, res, next) => {
  // 确保错误对象存在
  if (!error) {
    return next();
  }

  // 获取环境变量
  const env = process.env.NODE_ENV || 'development';

  // 确定HTTP状态码
  let statusCodeNum = error.statusCode || error.status || errorTypeMap[error.name] || 500;

  // 特殊处理某些错误
  if (error.code === 'ENOENT') {
    statusCodeNum = 404;
    error.message = '请求的资源不存在';
  } else if (error.code === 'ECONNREFUSED') {
    statusCodeNum = 503;
    error.message = '服务暂时不可用';
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    statusCodeNum = 413;
    error.message = '上传文件过大';
  }

  // 添加错误事件到请求上下文
  if (req.addEvent) {
    req.addEvent('error_occurred', {
      errorType: error.name,
      statusCode: statusCodeNum,
      message: error.message,
    });
  }

  // 统计错误
  errorStats.addError(error, req, statusCodeNum);

  // 获取错误严重性
  const severity = getErrorSeverity(statusCodeNum, error);

  // 记录错误日志
  const logData = {
    traceId: req.traceId,
    method: req.method,
    url: req.originalUrl,
    statusCode: statusCodeNum,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.userId,
    errorType: error.name,
    severity,
    stack: error.stack,
  };

  if (statusCodeNum >= 500) {
    logger.error(error.message, logData);
  } else if (statusCodeNum >= 400) {
    logger.warn(error.message, logData);
  } else {
    logger.info(error.message, logData);
  }

  // 安全告警
  if (statusCodeNum === 401 || statusCodeNum === 403) {
    logger.security('Authentication/Authorization failure', {
      traceId: req.traceId,
      ip: req.ip,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
    });
  }

  // 生成错误响应
  const errorResponse = getErrorResponse(error, env);

  // 设置安全头部
  res.removeHeader('X-Powered-By');

  // 返回错误响应
  res.status(statusCodeNum).json(errorResponse);
};

// 404处理中间件
const notFoundHandler = (req, res) => {
  const error = {
    status: 'error',
    message: `路由 ${req.originalUrl} 未找到`,
    suggestion: '请检查URL是否正确，或查看API文档了解可用的端点',
    timestamp: new Date().toISOString(),
  };

  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    traceId: req.traceId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    type: 'not_found',
  });

  // 添加事件到请求上下文
  if (req.addEvent) {
    req.addEvent('route_not_found', {
      method: req.method,
      url: req.originalUrl,
    });
  }

  res.status(404).json(error);
};

// 异步错误捕获包装器
const asyncHandler = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 全局未捕获异常处理
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    type: 'uncaught_exception',
  });

  // 优雅关闭
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// 全局未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    stack: reason.stack,
    type: 'unhandled_rejection',
  });
});

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  errorStats,
};
