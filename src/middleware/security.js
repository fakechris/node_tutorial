// 阶段八：安全强化中间件
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeConfig } = require('../config/environment');
const logger = require('../config/logger');

const config = initializeConfig();

// 安全头部配置
const securityHeaders = () => {
  const helmetConfig = {
    // 内容安全策略
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // 开发环境允许内联脚本
          config.isDevelopment ? "'unsafe-eval'" : null
        ].filter(Boolean),
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    
    // HTTP严格传输安全
    hsts: {
      maxAge: 31536000, // 1年
      includeSubDomains: true,
      preload: true
    },
    
    // 防止点击劫持
    frameguard: {
      action: 'deny'
    },
    
    // 防止MIME类型嗅探
    noSniff: true,
    
    // XSS过滤器
    xssFilter: true,
    
    // 隐藏X-Powered-By头
    hidePoweredBy: true,
    
    // 引用策略
    referrerPolicy: {
      policy: ["no-referrer", "strict-origin-when-cross-origin"]
    },
    
    // 权限策略
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: []
      }
    }
  };
  
  // 生产环境更严格的策略
  if (config.isProduction) {
    helmetConfig.contentSecurityPolicy.directives.scriptSrc = ["'self'"];
    helmetConfig.hsts.preload = true;
  }
  
  return helmet(helmetConfig);
};

// 基础速率限制
const basicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: config.isProduction ? 100 : 1000, // 生产环境更严格
  message: {
    status: 'error',
    message: '请求频率过高，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60,
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method,
      traceId: req.traceId
    });
    
    res.status(429).json({
      status: 'error',
      message: '请求频率过高，请稍后再试',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(15 * 60),
      timestamp: new Date().toISOString()
    });
  }
});

// 严格的API速率限制
const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: config.isProduction ? 60 : 300, // 每分钟60次（生产）或300次（开发）
  message: {
    status: 'error',
    message: 'API调用频率过高',
    code: 'API_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  keyGenerator: (req) => {
    // 对认证用户使用用户ID，未认证用户使用IP
    return req.user?.userId || req.ip;
  },
  skip: (req) => {
    // 跳过健康检查端点
    return req.path === '/health' || req.path === '/api/debug/health';
  }
});

// 登录尝试速率限制
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次登录尝试
  skipSuccessfulRequests: true,
  message: {
    status: 'error',
    message: '登录尝试次数过多，请15分钟后再试',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  },
  keyGenerator: (req) => {
    return `${req.ip}:${req.body?.username || 'unknown'}`;
  },
  handler: (req, res) => {
    logger.security('Login rate limit exceeded', {
      ip: req.ip,
      username: req.body?.username,
      userAgent: req.headers['user-agent'],
      traceId: req.traceId
    });
    
    res.status(429).json({
      status: 'error',
      message: '登录尝试次数过多，请15分钟后再试',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      retryAfter: 15 * 60,
      timestamp: new Date().toISOString()
    });
  }
});

// 创建用户速率限制
const createUserRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 每小时最多创建3个用户
  message: {
    status: 'error',
    message: '用户创建频率过高，请稍后再试',
    code: 'USER_CREATION_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// 输入验证和清理
const inputSanitization = (req, res, next) => {
  // 清理请求体中的危险字符
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // 清理查询参数
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // 清理路径参数
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// 递归清理对象
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanKey = sanitizeString(key);
    sanitized[cleanKey] = sanitizeObject(value);
  }
  
  return sanitized;
};

// 清理字符串
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }
  
  // 移除潜在的XSS攻击字符
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// SQL注入防护
const sqlInjectionProtection = (req, res, next) => {
  const checkForSQLInjection = (value) => {
    if (typeof value !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|;|\/\*|\*\/|'|")/gi,
      /(\b(OR|AND)\b.*=.*)/gi
    ];
    
    return sqlPatterns.some(pattern => pattern.test(value));
  };
  
  const checkObject = (obj, path = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string' && checkForSQLInjection(value)) {
        logger.security('Potential SQL injection attempt detected', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          field: currentPath,
          value: value.substring(0, 100),
          userAgent: req.headers['user-agent'],
          traceId: req.traceId
        });
        
        return res.status(400).json({
          status: 'error',
          message: '输入包含非法字符',
          code: 'INVALID_INPUT',
          timestamp: new Date().toISOString()
        });
      }
      
      if (typeof value === 'object' && value !== null) {
        const result = checkObject(value, currentPath);
        if (result) return result;
      }
    }
  };
  
  // 检查请求体
  if (req.body && typeof req.body === 'object') {
    const result = checkObject(req.body);
    if (result) return result;
  }
  
  // 检查查询参数
  if (req.query && typeof req.query === 'object') {
    const result = checkObject(req.query);
    if (result) return result;
  }
  
  next();
};

// IP白名单中间件
const createIPWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // 没有配置白名单则跳过
    }
    
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.security('Access denied - IP not in whitelist', {
        ip: clientIP,
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        traceId: req.traceId
      });
      
      return res.status(403).json({
        status: 'error',
        message: '访问被拒绝',
        code: 'ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// 请求大小限制
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSizeBytes = parseSize(maxSize);
    
    if (contentLength > maxSizeBytes) {
      logger.security('Request size limit exceeded', {
        ip: req.ip,
        contentLength,
        maxSize: maxSizeBytes,
        path: req.path,
        method: req.method,
        traceId: req.traceId
      });
      
      return res.status(413).json({
        status: 'error',
        message: '请求体过大',
        code: 'PAYLOAD_TOO_LARGE',
        maxSize: maxSize,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// 解析大小字符串（如"10mb"）
const parseSize = (size) => {
  if (typeof size === 'number') return size;
  
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
};

// 安全事件监控
const securityEventMonitor = (req, res, next) => {
  // 检测可疑的用户代理
  const suspiciousUserAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scanner/i,
    /hack/i,
    /exploit/i
  ];
  
  const userAgent = req.headers['user-agent'] || '';
  const isSuspicious = suspiciousUserAgents.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logger.security('Suspicious user agent detected', {
      ip: req.ip,
      userAgent,
      path: req.path,
      method: req.method,
      traceId: req.traceId
    });
  }
  
  // 检测可疑的路径访问
  const suspiciousPaths = [
    /\/admin/i,
    /\/config/i,
    /\/\.env/i,
    /\/wp-admin/i,
    /\/phpmyadmin/i,
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i
  ];
  
  const isSuspiciousPath = suspiciousPaths.some(pattern => pattern.test(req.path));
  
  if (isSuspiciousPath) {
    logger.security('Suspicious path access attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent,
      traceId: req.traceId
    });
  }
  
  next();
};

module.exports = {
  securityHeaders,
  basicRateLimit,
  apiRateLimit,
  loginRateLimit,
  createUserRateLimit,
  inputSanitization,
  sqlInjectionProtection,
  createIPWhitelist,
  requestSizeLimit,
  securityEventMonitor
};