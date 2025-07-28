// 阶段四：HTTP头部处理中间件
const headers = {
  // 安全头部中间件
  security: (req, res, next) => {
    // 防止点击劫持攻击
    res.header('X-Frame-Options', 'DENY');
    
    // 防止MIME类型嗅探
    res.header('X-Content-Type-Options', 'nosniff');
    
    // 启用XSS保护
    res.header('X-XSS-Protection', '1; mode=block');
    
    // 严格传输安全（HTTPS）
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // 内容安全策略
    res.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    
    // 引用者策略
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // 权限策略
    res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    next();
  },

  // 缓存控制中间件
  cache: (options = {}) => {
    const defaultOptions = {
      maxAge: 0, // 默认不缓存
      mustRevalidate: true,
      noCache: false,
      noStore: false,
      private: false
    };
    
    const config = { ...defaultOptions, ...options };
    
    return (req, res, next) => {
      if (config.noStore) {
        res.header('Cache-Control', 'no-store');
      } else if (config.noCache) {
        res.header('Cache-Control', 'no-cache, must-revalidate');
      } else {
        let cacheControl = [];
        
        if (config.private) {
          cacheControl.push('private');
        } else {
          cacheControl.push('public');
        }
        
        cacheControl.push(`max-age=${config.maxAge}`);
        
        if (config.mustRevalidate) {
          cacheControl.push('must-revalidate');
        }
        
        res.header('Cache-Control', cacheControl.join(', '));
      }
      
      // 设置ETag用于条件请求
      res.header('ETag', `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`);
      
      next();
    };
  },

  // API版本控制中间件
  apiVersion: (version = 'v1') => {
    return (req, res, next) => {
      // 设置API版本头
      res.header('API-Version', version);
      
      // 支持的版本列表
      res.header('API-Supported-Versions', 'v1');
      
      // 从请求头获取客户端期望的版本
      const requestedVersion = req.headers['api-version'] || req.headers['accept-version'];
      
      if (requestedVersion && requestedVersion !== version) {
        return res.status(406).json({
          status: 'error',
          message: `不支持的API版本: ${requestedVersion}`,
          supportedVersions: ['v1'],
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  },

  // 内容协商中间件
  contentNegotiation: (req, res, next) => {
    // 检查Accept头
    const acceptHeader = req.headers.accept || '*/*';
    
    // 支持的内容类型
    const supportedTypes = ['application/json', 'text/plain'];
    
    // 简单的内容类型匹配
    let contentType = 'application/json'; // 默认
    
    if (acceptHeader.includes('text/plain')) {
      contentType = 'text/plain';
    } else if (acceptHeader.includes('application/json') || acceptHeader.includes('*/*')) {
      contentType = 'application/json';
    } else {
      return res.status(406).json({
        status: 'error',
        message: '不支持的内容类型',
        supportedTypes: supportedTypes,
        requested: acceptHeader,
        timestamp: new Date().toISOString()
      });
    }
    
    // 设置响应内容类型
    res.header('Content-Type', contentType + '; charset=utf-8');
    
    // 告知客户端服务器支持的内容类型
    res.header('Accept', supportedTypes.join(', '));
    
    // 保存协商结果供后续使用
    req.negotiatedContentType = contentType;
    
    next();
  },

  // 请求追踪中间件
  requestTracking: (req, res, next) => {
    // 生成请求ID
    const requestId = req.headers['x-request-id'] || 
                     `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 设置响应头
    res.header('X-Request-ID', requestId);
    
    // 保存到请求对象中
    req.requestId = requestId;
    
    // 计算响应时间
    const startTime = Date.now();
    
    // 重写响应方法来设置响应时间
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;
    
    const setResponseTime = () => {
      const duration = Date.now() - startTime;
      if (!res.headersSent) {
        res.header('X-Response-Time', `${duration}ms`);
      }
    };
    
    res.send = function(data) {
      setResponseTime();
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      setResponseTime();
      return originalJson.call(this, data);
    };
    
    res.end = function(data) {
      setResponseTime();
      return originalEnd.call(this, data);
    };
    
    next();
  },

  // 速率限制信息头
  rateLimitInfo: (limit = 100, windowMs = 60000) => {
    const requests = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // 清理过期记录
      if (requests.has(ip)) {
        const timestamps = requests.get(ip).filter(time => time > windowStart);
        requests.set(ip, timestamps);
      }
      
      const currentRequests = requests.get(ip) || [];
      const remaining = Math.max(0, limit - currentRequests.length);
      const resetTime = Math.ceil((windowStart + windowMs) / 1000);
      
      // 设置速率限制头
      res.header('X-RateLimit-Limit', limit.toString());
      res.header('X-RateLimit-Remaining', remaining.toString());
      res.header('X-RateLimit-Reset', resetTime.toString());
      res.header('X-RateLimit-Window', (windowMs / 1000).toString());
      
      // 检查是否超限
      if (currentRequests.length >= limit) {
        res.header('Retry-After', Math.ceil(windowMs / 1000).toString());
        return res.status(429).json({
          status: 'error',
          message: '请求过于频繁',
          retryAfter: Math.ceil(windowMs / 1000),
          timestamp: new Date().toISOString()
        });
      }
      
      // 记录当前请求
      currentRequests.push(now);
      requests.set(ip, currentRequests);
      
      next();
    };
  },

  // 条件请求处理中间件
  conditionalRequests: (req, res, next) => {
    // 处理If-None-Match头（ETag）
    const ifNoneMatch = req.headers['if-none-match'];
    const etag = res.get('ETag');
    
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      return res.status(304).end(); // Not Modified
    }
    
    // 处理If-Modified-Since头
    const ifModifiedSince = req.headers['if-modified-since'];
    const lastModified = res.get('Last-Modified');
    
    if (ifModifiedSince && lastModified) {
      const ifModifiedSinceDate = new Date(ifModifiedSince);
      const lastModifiedDate = new Date(lastModified);
      
      if (ifModifiedSinceDate >= lastModifiedDate) {
        return res.status(304).end(); // Not Modified
      }
    }
    
    next();
  }
};

module.exports = headers;