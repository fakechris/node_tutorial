// 阶段二：错误处理中间件
const errorHandler = (err, req, res, next) => {
  // 记录错误信息到控制台
  console.error('🚨 服务器错误详情:');
  console.error('时间:', new Date().toISOString());
  console.error('路径:', req.originalUrl);
  console.error('方法:', req.method);
  console.error('错误:', err.message);
  console.error('堆栈:', err.stack);
  
  // 区分不同类型的错误
  let status = 500;
  let message = '服务器内部错误';
  
  // 验证错误
  if (err.name === 'ValidationError') {
    status = 400;
    message = '请求参数验证失败';
  }
  // 权限错误
  else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = '未授权访问';
  }
  // 资源未找到错误
  else if (err.name === 'NotFoundError') {
    status = 404;
    message = '请求的资源不存在';
  }
  // 开发环境显示详细错误，生产环境隐藏
  else if (process.env.NODE_ENV === 'development') {
    message = err.message;
  }
  
  // 返回错误响应
  res.status(status).json({
    status: 'error',
    message: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    // 开发环境返回错误堆栈
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;