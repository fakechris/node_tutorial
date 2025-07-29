// 阶段八：性能优化中间件
const { initializeConfig } = require('../config/environment');
const logger = require('../config/logger');

const config = initializeConfig();

// HTTP缓存头设置
const httpCacheHeaders = (options = {}) => {
  const {
    maxAge = 3600, // 1小时
    sMaxAge = maxAge,
    mustRevalidate = false,
    noCache = false,
    noStore = false,
    isPublic = true,
    etag = true,
    lastModified = true
  } = options;
  
  return (req, res, next) => {
    // 设置缓存控制头
    const cacheControl = [];
    
    if (noStore) {
      cacheControl.push('no-store');
    } else if (noCache) {
      cacheControl.push('no-cache');
    } else {
      if (isPublic) {
        cacheControl.push('public');
      } else {
        cacheControl.push('private');
      }
      
      cacheControl.push(`max-age=${maxAge}`);
      
      if (sMaxAge !== maxAge) {
        cacheControl.push(`s-maxage=${sMaxAge}`);
      }
      
      if (mustRevalidate) {
        cacheControl.push('must-revalidate');
      }
    }
    
    res.setHeader('Cache-Control', cacheControl.join(', '));
    
    // 设置ETag（基于内容的弱验证器）
    if (etag) {
      const originalJson = res.json;
      res.json = function(data) {
        const content = JSON.stringify(data);
        const hash = require('crypto').createHash('md5').update(content).digest('hex');
        res.setHeader('ETag', `W/"${hash}"`);
        
        // 检查If-None-Match头
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch.includes(hash)) {
          return res.status(304).end();
        }
        
        return originalJson.call(this, data);
      };
    }
    
    // 设置Last-Modified（基于时间的验证器）
    if (lastModified) {
      const now = new Date();
      res.setHeader('Last-Modified', now.toUTCString());
      
      // 检查If-Modified-Since头
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const modifiedSince = new Date(ifModifiedSince);
        const resourceTime = new Date(now.getTime() - (maxAge * 1000));
        
        if (modifiedSince >= resourceTime) {
          return res.status(304).end();
        }
      }
    }
    
    next();
  };
};

// 响应时间优化
const responseTimeOptimization = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  // 优化JSON响应
  const originalJson = res.json;
  res.json = function(data) {
    // 移除undefined值以减少传输大小
    const cleanData = JSON.parse(JSON.stringify(data));
    
    // 添加响应时间头
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // 转换为毫秒
    
    res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`);
    
    // 性能分类
    let performanceCategory = 'fast';
    if (responseTime > 2000) {
      performanceCategory = 'very_slow';
    } else if (responseTime > 500) {
      performanceCategory = 'slow';
    } else if (responseTime > 100) {
      performanceCategory = 'medium';
    }
    
    res.setHeader('X-Performance-Category', performanceCategory);
    
    // 记录慢响应
    if (responseTime > 1000) {
      logger.performance('Slow response detected', {
        traceId: req.traceId,
        method: req.method,
        path: req.path,
        responseTime,
        category: performanceCategory,
        statusCode: res.statusCode
      });
    }
    
    return originalJson.call(this, cleanData);
  };
  
  next();
};

// 内存使用优化
const memoryOptimization = (req, res, next) => {
  // 监控请求内存使用
  const initialMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const finalMemory = process.memoryUsage();
    const memoryDelta = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss
    };
    
    // 检查内存泄漏风险
    if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
      logger.warn('High memory usage detected for request', {
        traceId: req.traceId,
        method: req.method,
        path: req.path,
        memoryDelta: {
          heapUsed: Math.round(memoryDelta.heapUsed / 1024 / 1024) + 'MB',
          rss: Math.round(memoryDelta.rss / 1024 / 1024) + 'MB'
        }
      });
    }
    
    // 添加内存使用信息到调试模式
    if (config.isDevelopment) {
      res.setHeader('X-Memory-Delta', Math.round(memoryDelta.heapUsed / 1024) + 'KB');
    }
  });
  
  next();
};

// 连接池优化
const connectionPoolOptimization = () => {
  return (req, res, next) => {
    // 设置连接超时
    req.setTimeout(config.server.timeout, () => {
      logger.warn('Request timeout', {
        traceId: req.traceId,
        method: req.method,
        path: req.path,
        timeout: config.server.timeout
      });
      
      if (!res.headersSent) {
        res.status(408).json({
          status: 'error',
          message: '请求超时',
          code: 'REQUEST_TIMEOUT',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 优化keep-alive
    if (config.isProduction) {
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Keep-Alive', 'timeout=65');
    }
    
    next();
  };
};

// 数据库查询优化
const databaseQueryOptimization = (sequelize) => {
  // 监控和优化查询
  const originalQuery = sequelize.query;
  
  sequelize.query = function(sql, options = {}) {
    const startTime = Date.now();
    const queryId = require('crypto').randomBytes(4).toString('hex');
    
    // 添加查询超时
    const timeout = options.timeout || 30000; // 30秒默认超时
    
    return Promise.race([
      originalQuery.call(this, sql, { ...options, timeout }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query timeout after ${timeout}ms`));
        }, timeout);
      })
    ]).then(result => {
      const duration = Date.now() - startTime;
      
      // 记录查询性能
      logger.db('Query executed', {
        queryId,
        sql: sql.substring(0, 200),
        duration,
        resultCount: result.length || result[0]?.length || 0,
        timeout
      });
      
      // 检测慢查询
      if (duration > 5000) {
        logger.warn('Very slow query detected', {
          queryId,
          sql: sql.substring(0, 200),
          duration,
          type: 'slow_query'
        });
      }
      
      return result;
    }).catch(error => {
      const duration = Date.now() - startTime;
      
      logger.error('Query failed', {
        queryId,
        sql: sql.substring(0, 200),
        duration,
        error: error.message
      });
      
      throw error;
    });
  };
};

// 静态资源优化
const staticResourceOptimization = (req, res, next) => {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  const isStatic = staticExtensions.some(ext => req.path.endsWith(ext));
  
  if (isStatic) {
    // 设置长期缓存
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1年
    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
    
    // 启用压缩
    res.setHeader('Vary', 'Accept-Encoding');
    
    // 设置安全头
    if (req.path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (req.path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
  
  next();
};

// CPU使用优化
const cpuOptimization = (req, res, next) => {
  const startCPU = process.cpuUsage();
  
  res.on('finish', () => {
    const endCPU = process.cpuUsage(startCPU);
    const cpuTime = (endCPU.user + endCPU.system) / 1000; // 微秒转毫秒
    
    // 检测CPU密集型请求
    if (cpuTime > 100) { // 100ms CPU时间
      logger.performance('CPU intensive request detected', {
        traceId: req.traceId,
        method: req.method,
        path: req.path,
        cpuTime: cpuTime.toFixed(2) + 'ms',
        userTime: (endCPU.user / 1000).toFixed(2) + 'ms',
        systemTime: (endCPU.system / 1000).toFixed(2) + 'ms'
      });
    }
    
    if (config.isDevelopment) {
      res.setHeader('X-CPU-Time', cpuTime.toFixed(2) + 'ms');
    }
  });
  
  next();
};

// 组合优化中间件
const createOptimizationMiddleware = (options = {}) => {
  const middlewares = [];
  
  // 根据配置添加不同的优化中间件
  if (options.httpCache !== false) {
    middlewares.push(httpCacheHeaders(options.httpCache || {}));
  }
  
  if (options.responseTime !== false) {
    middlewares.push(responseTimeOptimization);
  }
  
  if (options.memory !== false) {
    middlewares.push(memoryOptimization);
  }
  
  if (options.connection !== false) {
    middlewares.push(connectionPoolOptimization());
  }
  
  if (options.staticResources !== false) {
    middlewares.push(staticResourceOptimization);
  }
  
  if (options.cpu !== false) {
    middlewares.push(cpuOptimization);
  }
  
  // 返回组合中间件
  return (req, res, next) => {
    let index = 0;
    
    const runNext = () => {
      if (index >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[index++];
      middleware(req, res, runNext);
    };
    
    runNext();
  };
};

module.exports = {
  httpCacheHeaders,
  responseTimeOptimization,
  memoryOptimization,
  connectionPoolOptimization,
  databaseQueryOptimization,
  staticResourceOptimization,
  cpuOptimization,
  createOptimizationMiddleware
};