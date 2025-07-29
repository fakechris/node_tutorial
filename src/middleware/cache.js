// 阶段八：缓存中间件
const { initializeConfig } = require('../config/environment');
const logger = require('../config/logger');

const config = initializeConfig();

// 内存缓存实现（生产环境建议使用Redis）
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.maxSize = 1000; // 最大缓存条目数
    this.defaultTTL = config.cache.ttl || 3600; // 默认1小时
    
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60000); // 每分钟清理
  }
  
  // 设置缓存
  set(key, value, ttl = this.defaultTTL) {
    // 如果达到最大容量，删除最老的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl * 1000 // 转换为毫秒
    });
    
    // 设置过期定时器
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);
    
    this.timers.set(key, timer);
    
    logger.debug('Cache set', { key, ttl });
  }
  
  // 获取缓存
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug('Cache miss', { key });
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      logger.debug('Cache expired', { key });
      return null;
    }
    
    logger.debug('Cache hit', { key });
    return item.value;
  }
  
  // 删除缓存
  delete(key) {
    this.cache.delete(key);
    
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    
    logger.debug('Cache deleted', { key });
  }
  
  // 清空所有缓存
  clear() {
    this.cache.clear();
    
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    
    logger.debug('Cache cleared');
  }
  
  // 清理过期缓存
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { cleaned, remaining: this.cache.size });
    }
  }
  
  // 获取缓存统计信息
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitRate || 0, // 需要在实际使用中计算
      memoryUsage: this.getMemoryUsage()
    };
  }
  
  // 估算内存使用量
  getMemoryUsage() {
    let size = 0;
    for (const [key, item] of this.cache.entries()) {
      size += key.length + JSON.stringify(item.value).length + 100; // 估算开销
    }
    return Math.round(size / 1024); // KB
  }
}

// 全局缓存实例
const memoryCache = new MemoryCache();

// 缓存中间件生成器
const createCacheMiddleware = (options = {}) => {
  const {
    ttl = config.cache.ttl,
    keyGenerator = (req) => `${req.method}:${req.originalUrl}`,
    condition = () => true,
    skipMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
  } = options;
  
  return (req, res, next) => {
    // 检查是否启用缓存
    if (!config.cache.enabled) {
      return next();
    }
    
    // 跳过不适合缓存的方法
    if (skipMethods.includes(req.method)) {
      return next();
    }
    
    // 检查自定义条件
    if (!condition(req)) {
      return next();
    }
    
    const cacheKey = keyGenerator(req);
    
    // 尝试从缓存获取
    const cachedResponse = memoryCache.get(cacheKey);
    
    if (cachedResponse) {
      // 缓存命中
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Key', cacheKey);
      
      // 发送缓存的响应
      return res.status(cachedResponse.statusCode).json(cachedResponse.data);
    }
    
    // 缓存未命中，拦截响应
    const originalJson = res.json;
    
    res.json = function(data) {
      // 只缓存成功响应
      if (res.statusCode >= 200 && res.statusCode < 300) {
        memoryCache.set(cacheKey, {
          statusCode: res.statusCode,
          data: data
        }, ttl);
        
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
      } else {
        res.setHeader('X-Cache', 'SKIP');
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// 常用缓存中间件预设
const cacheMiddleware = {
  // 短期缓存（5分钟）
  short: createCacheMiddleware({ ttl: 300 }),
  
  // 中期缓存（1小时）
  medium: createCacheMiddleware({ ttl: 3600 }),
  
  // 长期缓存（24小时）
  long: createCacheMiddleware({ ttl: 86400 }),
  
  // 自定义缓存
  custom: (options) => createCacheMiddleware(options),
  
  // API响应缓存（只缓存GET请求）
  api: createCacheMiddleware({
    ttl: 1800, // 30分钟
    keyGenerator: (req) => {
      const params = new URLSearchParams(req.query).toString();
      return `api:${req.path}${params ? '?' + params : ''}`;
    },
    condition: (req) => req.method === 'GET' && req.path.startsWith('/api/')
  }),
  
  // 静态资源缓存
  static: createCacheMiddleware({
    ttl: 86400, // 24小时
    keyGenerator: (req) => `static:${req.path}`,
    condition: (req) => {
      const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];
      return staticExtensions.some(ext => req.path.endsWith(ext));
    }
  })
};

// 缓存失效工具
const cacheInvalidation = {
  // 删除单个缓存
  delete: (key) => memoryCache.delete(key),
  
  // 按模式删除缓存
  deleteByPattern: (pattern) => {
    const regex = new RegExp(pattern);
    const keysToDelete = [];
    
    for (const key of memoryCache.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => memoryCache.delete(key));
    logger.debug('Cache invalidated by pattern', { pattern, count: keysToDelete.length });
    
    return keysToDelete.length;
  },
  
  // 清空所有缓存
  clear: () => memoryCache.clear(),
  
  // 删除用户相关缓存
  deleteUserCache: (userId) => {
    return cacheInvalidation.deleteByPattern(`.*user.*${userId}.*`);
  },
  
  // 删除API缓存
  deleteApiCache: (path) => {
    return cacheInvalidation.deleteByPattern(`api:${path}.*`);
  }
};

// 缓存统计和监控
const cacheStats = {
  getStats: () => memoryCache.getStats(),
  
  getDetailedStats: () => {
    const stats = memoryCache.getStats();
    return {
      ...stats,
      enabled: config.cache.enabled,
      defaultTTL: config.cache.ttl,
      uptime: process.uptime(),
      entries: Array.from(memoryCache.cache.entries()).map(([key, item]) => ({
        key,
        size: JSON.stringify(item.value).length,
        age: Date.now() - item.timestamp,
        ttl: item.ttl,
        expires: new Date(item.timestamp + item.ttl).toISOString()
      })).slice(0, 10) // 只显示前10个条目
    };
  }
};

// 缓存性能监控中间件
const cacheMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  // 记录请求
  req.cacheMetrics = {
    startTime,
    cacheChecked: false,
    cacheHit: false
  };
  
  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const cacheHeader = res.getHeader('X-Cache');
    
    if (cacheHeader) {
      req.cacheMetrics.cacheChecked = true;
      req.cacheMetrics.cacheHit = cacheHeader === 'HIT';
      
      // 记录缓存性能
      logger.performance('Cache performance', {
        traceId: req.traceId,
        path: req.path,
        method: req.method,
        cacheResult: cacheHeader,
        duration,
        statusCode: res.statusCode
      });
    }
  });
  
  next();
};

module.exports = {
  memoryCache,
  cacheMiddleware,
  cacheInvalidation,
  cacheStats,
  cacheMonitor,
  createCacheMiddleware
};