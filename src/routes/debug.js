// 阶段七：调试和监控路由
const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');
const auth = require('../middleware/auth');

// 调试路由只在开发环境启用
if (process.env.NODE_ENV !== 'production') {
  console.log('🔍 Debug routes enabled in development mode');
  
  // 健康检查 - 公开端点
  router.get('/health', debugController.getHealthCheck);
  
  // 系统概览 - 需要认证
  router.get('/overview', auth.authenticate, debugController.getSystemOverview);
  
  // 性能指标
  router.get('/performance', auth.authenticate, debugController.getPerformanceMetrics);
  
  // 活跃请求监控
  router.get('/requests', auth.authenticate, debugController.getActiveRequests);
  
  // 请求详情
  router.get('/requests/:traceId', auth.authenticate, debugController.getRequestDetails);
  
  // 错误统计
  router.get('/errors', auth.authenticate, debugController.getErrorMetrics);
  
  // 日志查看
  router.get('/logs', auth.authenticate, debugController.getLogs);
  
  // 系统配置信息
  router.get('/config', auth.authenticate, debugController.getSystemConfig);
  
  // 重置统计信息
  router.post('/reset', auth.authenticate, debugController.resetMetrics);
  
  // 调试面板HTML界面
  router.get('/dashboard', debugController.getDebugDashboard);
  
} else {
  // 生产环境只提供健康检查
  router.get('/health', debugController.getHealthCheck);
  
  // 其他调试端点返回403
  router.use('*', (req, res) => {
    res.status(403).json({
      status: 'error',
      message: '生产环境不允许访问调试端点',
      suggestion: '调试功能仅在开发环境可用'
    });
  });
}

module.exports = router;