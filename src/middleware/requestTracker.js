// 阶段七：请求跟踪中间件
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// 存储请求上下文信息
const requestContexts = new Map();

// 清理过期的请求上下文（每5分钟）
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [traceId, context] of requestContexts.entries()) {
    if (context.startTime < fiveMinutesAgo) {
      requestContexts.delete(traceId);
    }
  }
}, 5 * 60 * 1000);

// 请求跟踪中间件
const requestTracker = (req, res, next) => {
  // 生成或获取trace ID
  const traceId = req.headers['x-trace-id'] || uuidv4();
  const startTime = Date.now();
  const startTimestamp = new Date().toISOString();
  
  // 将trace ID添加到请求对象
  req.traceId = traceId;
  req.startTime = startTime;
  
  // 将trace ID添加到响应头
  res.setHeader('X-Trace-ID', traceId);
  
  // 创建请求上下文
  const context = {
    traceId,
    startTime,
    startTimestamp,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    userId: null, // 将在认证后设置
    dbQueries: [],
    events: []
  };
  
  requestContexts.set(traceId, context);
  
  // 记录请求开始
  logger.request('Request started', {
    traceId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: context.ip,
    headers: sanitizeHeaders(req.headers)
  });
  
  // 扩展请求对象的方法
  req.addEvent = (event, data = {}) => {
    const context = requestContexts.get(traceId);
    if (context) {
      context.events.push({
        timestamp: new Date().toISOString(),
        event,
        data,
        duration: Date.now() - startTime
      });
    }
    
    logger.debug(`Event: ${event}`, {
      traceId,
      event,
      data,
      duration: Date.now() - startTime
    });
  };
  
  req.addDbQuery = (query, duration, result = {}) => {
    const context = requestContexts.get(traceId);
    if (context) {
      context.dbQueries.push({
        timestamp: new Date().toISOString(),
        query: sanitizeQuery(query),
        duration,
        result: {
          rows: result.rows || result.length || 0,
          fields: result.fields ? result.fields.length : 0
        }
      });
    }
    
    logger.db('Database query executed', {
      traceId,
      query: sanitizeQuery(query),
      duration,
      rows: result.rows || result.length || 0
    });
  };
  
  req.setUserId = (userId) => {
    const context = requestContexts.get(traceId);
    if (context) {
      context.userId = userId;
    }
  };
  
  req.getContext = () => {
    return requestContexts.get(traceId);
  };
  
  // 监听响应结束
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const context = requestContexts.get(traceId);
    
    if (context) {
      context.endTime = endTime;
      context.duration = duration;
      context.statusCode = res.statusCode;
      context.responseSize = res.get('content-length') || 0;
    }
    
    // 记录请求完成
    logger.response('Request completed', {
      traceId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      responseSize: res.get('content-length') || 0,
      userId: context?.userId,
      dbQueriesCount: context?.dbQueries.length || 0,
      eventsCount: context?.events.length || 0
    });
    
    // 性能监控告警
    if (duration > 5000) {
      logger.performance('Slow request detected', {
        traceId,
        method: req.method,
        url: req.url,
        duration,
        userId: context?.userId
      });
    }
    
    if (context?.dbQueries.length > 10) {
      logger.performance('High database query count', {
        traceId,
        method: req.method,
        url: req.url,
        queryCount: context.dbQueries.length,
        userId: context?.userId
      });
    }
    
    // 调用原始的end方法
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// 辅助函数：清理敏感headers
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  for (const header of sensitiveHeaders) {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// 辅助函数：清理数据库查询中的敏感信息
function sanitizeQuery(query) {
  if (typeof query !== 'string') {
    return query;
  }
  
  // 简单的密码字段替换
  return query.replace(
    /(password|secret|token)\s*=\s*['"][^'"]*['"]/gi,
    '$1 = [REDACTED]'
  );
}

// 获取所有活跃的请求上下文
requestTracker.getActiveRequests = () => {
  return Array.from(requestContexts.values()).map(context => ({
    traceId: context.traceId,
    method: context.method,
    url: context.url,
    startTime: context.startTimestamp,
    duration: context.endTime ? context.duration : Date.now() - context.startTime,
    statusCode: context.statusCode,
    userId: context.userId,
    dbQueries: context.dbQueries.length,
    events: context.events.length
  }));
};

// 获取请求详情
requestTracker.getRequestDetails = (traceId) => {
  return requestContexts.get(traceId);
};

// 获取统计信息
requestTracker.getStats = () => {
  const contexts = Array.from(requestContexts.values());
  const completedRequests = contexts.filter(c => c.endTime);
  
  if (completedRequests.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      errorRequests: 0,
      activeRequests: contexts.length
    };
  }
  
  const totalDuration = completedRequests.reduce((sum, c) => sum + c.duration, 0);
  const slowRequests = completedRequests.filter(c => c.duration > 5000).length;
  const errorRequests = completedRequests.filter(c => c.statusCode >= 400).length;
  
  return {
    totalRequests: completedRequests.length,
    averageResponseTime: Math.round(totalDuration / completedRequests.length),
    slowRequests,
    errorRequests,
    activeRequests: contexts.filter(c => !c.endTime).length,
    errorRate: ((errorRequests / completedRequests.length) * 100).toFixed(2)
  };
};

module.exports = requestTracker;