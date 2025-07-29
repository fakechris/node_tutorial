// 阶段七：性能监控中间件
const logger = require('../config/logger');

// 性能指标存储
const performanceMetrics = {
  requests: {
    total: 0,
    byEndpoint: new Map(),
    byMethod: new Map(),
    responseTimeStats: []
  },
  
  memory: {
    samples: [],
    maxSamples: 100
  },
  
  database: {
    queries: [],
    totalQueries: 0,
    slowQueries: 0,
    maxQueries: 1000
  },
  
  errors: {
    total: 0,
    rate: 0
  },
  
  uptime: {
    startTime: Date.now(),
    restarts: 0
  }
};

// 内存监控
const collectMemoryStats = () => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const stats = {
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  };
  
  performanceMetrics.memory.samples.push(stats);
  
  // 保持最新的100个样本
  if (performanceMetrics.memory.samples.length > performanceMetrics.memory.maxSamples) {
    performanceMetrics.memory.samples.shift();
  }
  
  // 内存告警
  const heapUsedMB = stats.memory.heapUsed;
  if (heapUsedMB > 512) { // 512MB告警阈值
    logger.performance('High memory usage detected', {
      heapUsed: heapUsedMB,
      heapTotal: stats.memory.heapTotal,
      type: 'memory_alert'
    });
  }
  
  return stats;
};

// 定时收集内存统计（每30秒）
setInterval(collectMemoryStats, 30000);

// 响应时间分类
const categorizeResponseTime = (responseTime) => {
  if (responseTime < 100) return 'fast';
  if (responseTime < 500) return 'medium';
  if (responseTime < 2000) return 'slow';
  return 'very_slow';
};

// 性能监控中间件
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  // 覆盖原始的json方法来监控响应大小
  const originalJson = res.json;
  let responseSize = 0;
  
  res.json = function(data) {
    responseSize = JSON.stringify(data).length;
    return originalJson.call(this, data);
  };
  
  // 监听响应结束
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    // 更新请求统计
    performanceMetrics.requests.total++;
    
    // 按端点统计
    const endpoint = req.route ? req.route.path : req.path;
    const endpointKey = `${req.method} ${endpoint}`;
    const endpointStats = performanceMetrics.requests.byEndpoint.get(endpointKey) || {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0
    };
    
    endpointStats.count++;
    endpointStats.totalTime += responseTime;
    endpointStats.minTime = Math.min(endpointStats.minTime, responseTime);
    endpointStats.maxTime = Math.max(endpointStats.maxTime, responseTime);
    
    if (res.statusCode >= 400) {
      endpointStats.errorCount++;
    }
    
    performanceMetrics.requests.byEndpoint.set(endpointKey, endpointStats);
    
    // 按方法统计
    const methodStats = performanceMetrics.requests.byMethod.get(req.method) || { count: 0, totalTime: 0 };
    methodStats.count++;
    methodStats.totalTime += responseTime;
    performanceMetrics.requests.byMethod.set(req.method, methodStats);
    
    // 响应时间统计
    const timeCategory = categorizeResponseTime(responseTime);
    performanceMetrics.requests.responseTimeStats.push({
      timestamp: new Date().toISOString(),
      method: req.method,
      endpoint,
      responseTime,
      category: timeCategory,
      statusCode: res.statusCode,
      responseSize,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      traceId: req.traceId
    });
    
    // 保持最新的1000个响应时间记录
    if (performanceMetrics.requests.responseTimeStats.length > 1000) {
      performanceMetrics.requests.responseTimeStats.shift();
    }
    
    // 性能告警
    if (responseTime > 5000) {
      logger.performance('Slow response detected', {
        traceId: req.traceId,
        method: req.method,
        endpoint,
        responseTime,
        statusCode: res.statusCode,
        type: 'slow_response'
      });
    }
    
    // 添加性能事件到请求上下文
    if (req.addEvent) {
      req.addEvent('performance_metrics', {
        responseTime,
        category: timeCategory,
        responseSize,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed
      });
    }
    
    // 记录性能日志
    logger.performance('Request performance', {
      traceId: req.traceId,
      method: req.method,
      endpoint,
      responseTime,
      statusCode: res.statusCode,
      responseSize,
      category: timeCategory
    });
  });
  
  next();
};

// 数据库查询性能监控
const monitorDbQuery = (query, startTime, endTime, result = {}) => {
  const duration = endTime - startTime;
  
  performanceMetrics.database.totalQueries++;
  
  if (duration > 1000) { // 慢查询阈值：1秒
    performanceMetrics.database.slowQueries++;
  }
  
  const queryStats = {
    timestamp: new Date().toISOString(),
    query: query.substring(0, 200), // 截取前200个字符
    duration,
    resultCount: result.rows || result.length || 0,
    isSlow: duration > 1000
  };
  
  performanceMetrics.database.queries.push(queryStats);
  
  // 保持最新的1000个查询记录
  if (performanceMetrics.database.queries.length > performanceMetrics.database.maxQueries) {
    performanceMetrics.database.queries.shift();
  }
  
  // 慢查询告警
  if (duration > 2000) {
    logger.performance('Slow database query detected', {
      query: queryStats.query,
      duration,
      resultCount: queryStats.resultCount,
      type: 'slow_query'
    });
  }
  
  return queryStats;
};

// 获取性能统计信息
const getPerformanceStats = () => {
  const now = Date.now();
  const uptime = now - performanceMetrics.uptime.startTime;
  
  // 响应时间分析
  const recentResponses = performanceMetrics.requests.responseTimeStats.slice(-100);
  const avgResponseTime = recentResponses.length > 0 
    ? recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / recentResponses.length 
    : 0;
  
  const responseCategoryCounts = recentResponses.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});
  
  // 端点性能排序
  const endpointPerformance = Array.from(performanceMetrics.requests.byEndpoint.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      count: stats.count,
      avgTime: Math.round(stats.totalTime / stats.count),
      minTime: stats.minTime === Infinity ? 0 : stats.minTime,
      maxTime: stats.maxTime,
      errorRate: ((stats.errorCount / stats.count) * 100).toFixed(2)
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);
  
  // 内存统计
  const latestMemory = performanceMetrics.memory.samples[performanceMetrics.memory.samples.length - 1];
  const memoryTrend = performanceMetrics.memory.samples.length > 1 
    ? performanceMetrics.memory.samples[performanceMetrics.memory.samples.length - 1].memory.heapUsed - 
      performanceMetrics.memory.samples[0].memory.heapUsed 
    : 0;
  
  // 数据库统计
  const recentQueries = performanceMetrics.database.queries.slice(-100);
  const avgQueryTime = recentQueries.length > 0 
    ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length 
    : 0;
  
  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime / 1000), // 秒
    requests: {
      total: performanceMetrics.requests.total,
      perMinute: Math.round((performanceMetrics.requests.total / uptime) * 60000),
      avgResponseTime: Math.round(avgResponseTime),
      responseCategories: responseCategoryCounts
    },
    endpoints: {
      performance: endpointPerformance
    },
    memory: {
      current: latestMemory?.memory || {},
      trend: memoryTrend > 0 ? 'increasing' : memoryTrend < 0 ? 'decreasing' : 'stable',
      samples: performanceMetrics.memory.samples.length
    },
    database: {
      totalQueries: performanceMetrics.database.totalQueries,
      slowQueries: performanceMetrics.database.slowQueries,
      slowQueryRate: performanceMetrics.database.totalQueries > 0 
        ? ((performanceMetrics.database.slowQueries / performanceMetrics.database.totalQueries) * 100).toFixed(2)
        : 0,
      avgQueryTime: Math.round(avgQueryTime)
    }
  };
};

// 重置统计信息
const resetStats = () => {
  performanceMetrics.requests = {
    total: 0,
    byEndpoint: new Map(),
    byMethod: new Map(),
    responseTimeStats: []
  };
  
  performanceMetrics.database.queries = [];
  performanceMetrics.database.totalQueries = 0;
  performanceMetrics.database.slowQueries = 0;
  
  logger.info('Performance metrics reset');
};

// 导出
module.exports = {
  performanceMonitor,
  monitorDbQuery,
  getPerformanceStats,
  resetStats,
  collectMemoryStats
};