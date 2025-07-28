// 阶段二：自定义日志中间件
const logger = (req, res, next) => {
  // 记录请求开始时间
  const startTime = Date.now();
  
  // 获取客户端IP地址
  const clientIP = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.ip || 
                   'unknown';
  
  // 构建基础日志信息
  const logInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: clientIP,
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString()
  };
  
  console.log(`📥 [${logInfo.timestamp}] ${logInfo.method} ${logInfo.url} - IP: ${logInfo.ip}`);
  
  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // 根据状态码选择不同的图标
    let statusIcon = '✅';
    if (statusCode >= 400 && statusCode < 500) {
      statusIcon = '⚠️ ';
    } else if (statusCode >= 500) {
      statusIcon = '❌';
    }
    
    console.log(`📤 [${new Date().toISOString()}] ${statusIcon} ${logInfo.method} ${logInfo.url} - ${statusCode} - ${duration}ms`);
  });
  
  // 调用下一个中间件
  next();
};

module.exports = logger;