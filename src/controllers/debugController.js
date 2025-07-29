// 阶段七：调试面板控制器
const logger = require('../config/logger');
const requestTracker = require('../middleware/requestTracker');
const { errorStats } = require('../middleware/errorHandler');
const { getPerformanceStats, resetStats } = require('../middleware/performanceMonitor');
const statusCode = require('../middleware/statusCode');
const fs = require('fs');
const path = require('path');

const debugController = {
  // 系统总览
  getSystemOverview: async (req, res) => {
    try {
      const performanceStats = getPerformanceStats();
      const errorStatistics = errorStats.getStats();
      const requestStats = requestTracker.getStats();
      const loggerStats = logger.stats.getStats();

      const overview = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        uptime: performanceStats.uptime,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',

        // 请求统计
        requests: {
          total: performanceStats.requests.total,
          perMinute: performanceStats.requests.perMinute,
          active: requestStats.activeRequests,
          avgResponseTime: performanceStats.requests.avgResponseTime,
        },

        // 错误统计
        errors: {
          total: errorStatistics.total,
          rate: requestStats.errorRate,
          recent: errorStatistics.recentErrorsCount,
        },

        // 性能指标
        performance: {
          memoryUsage: performanceStats.memory.current,
          memoryTrend: performanceStats.memory.trend,
          slowQueries: performanceStats.database.slowQueries,
          slowQueryRate: performanceStats.database.slowQueryRate,
        },

        // 日志统计
        logs: loggerStats,
      };

      // 健康状态评估
      if (performanceStats.requests.avgResponseTime > 2000) {
        overview.status = 'degraded';
      }

      if (requestStats.errorRate > 10 || performanceStats.memory.current.heapUsed > 512) {
        overview.status = 'unhealthy';
      }

      statusCode.success.ok(res, overview, '系统概览获取成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取系统概览失败', error);
    }
  },

  // 实时请求监控
  getActiveRequests: async (req, res) => {
    try {
      const activeRequests = requestTracker.getActiveRequests();
      const stats = requestTracker.getStats();

      statusCode.success.ok(
        res,
        {
          activeRequests,
          stats,
          timestamp: new Date().toISOString(),
        },
        '活跃请求信息获取成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '获取活跃请求信息失败', error);
    }
  },

  // 请求详情
  getRequestDetails: async (req, res) => {
    try {
      const { traceId } = req.params;
      const requestDetails = requestTracker.getRequestDetails(traceId);

      if (!requestDetails) {
        return statusCode.clientError.notFound(res, '请求跟踪信息不存在');
      }

      statusCode.success.ok(res, requestDetails, '请求详情获取成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取请求详情失败', error);
    }
  },

  // 性能监控
  getPerformanceMetrics: async (req, res) => {
    try {
      const performanceMetrics = getPerformanceStats();

      statusCode.success.ok(res, performanceMetrics, '性能指标获取成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取性能指标失败', error);
    }
  },

  // 错误监控
  getErrorMetrics: async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const errorMetrics = {
        stats: errorStats.getStats(),
        recentErrors: errorStats.getRecentErrors(parseInt(limit)),
        timestamp: new Date().toISOString(),
      };

      statusCode.success.ok(res, errorMetrics, '错误统计信息获取成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取错误统计信息失败', error);
    }
  },

  // 日志查看
  getLogs: async (req, res) => {
    try {
      const { level = 'all', limit = 100, offset = 0 } = req.query;
      const logDir = './logs';

      // 根据级别选择日志文件
      let logFile;
      switch (level) {
        case 'error':
          logFile = 'error.log';
          break;
        case 'app':
          logFile = 'app.log';
          break;
        default:
          logFile = 'combined.log';
      }

      const logPath = path.join(logDir, logFile);

      if (!fs.existsSync(logPath)) {
        return statusCode.clientError.notFound(res, '日志文件不存在');
      }

      // 读取日志文件（简单实现，生产环境建议使用流式读取）
      const logContent = fs.readFileSync(logPath, 'utf8');
      const logLines = logContent.split('\n').filter(line => line.trim());

      // 解析JSON日志行
      const logs = logLines
        .slice(-limit - offset, -offset || undefined)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        })
        .reverse();

      statusCode.success.ok(
        res,
        {
          logs,
          total: logLines.length,
          level,
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
        '日志信息获取成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '获取日志信息失败', error);
    }
  },

  // 系统配置信息
  getSystemConfig: async (req, res) => {
    try {
      const config = {
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,

        // 环境变量（过滤敏感信息）
        envVars: Object.fromEntries(
          Object.entries(process.env)
            .filter(
              ([key]) =>
                !key.toLowerCase().includes('password') &&
                !key.toLowerCase().includes('secret') &&
                !key.toLowerCase().includes('key')
            )
            .slice(0, 20) // 只显示前20个
        ),

        // 内存使用
        memoryUsage: process.memoryUsage(),

        // CPU使用
        cpuUsage: process.cpuUsage(),

        // 运行时间
        uptime: process.uptime(),

        // 包信息
        packageInfo: {
          name: process.env.npm_package_name,
          version: process.env.npm_package_version,
          description: process.env.npm_package_description,
        },
      };

      statusCode.success.ok(res, config, '系统配置信息获取成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取系统配置信息失败', error);
    }
  },

  // 健康检查
  getHealthCheck: async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),

        // 检查各个组件
        checks: {
          memory: checkMemoryHealth(),
          database: await checkDatabaseHealth(),
          logs: checkLogHealth(),
          disk: checkDiskHealth(),
        },
      };

      // 判断整体健康状态
      const hasUnhealthy = Object.values(health.checks).some(
        check => check.status !== 'healthy'
      );
      if (hasUnhealthy) {
        health.status = 'degraded';
      }

      const statusCodeToUse = health.status === 'healthy' ? 200 : 503;
      res.status(statusCodeToUse).json({
        status: 'success',
        data: health,
        message: `系统状态: ${health.status}`,
      });
    } catch (error) {
      statusCode.serverError.internalError(res, '健康检查失败', error);
    }
  },

  // 重置统计信息
  resetMetrics: async (req, res) => {
    try {
      resetStats();

      logger.info('Metrics reset by user', {
        traceId: req.traceId,
        userId: req.user?.userId,
        ip: req.ip,
      });

      statusCode.success.ok(
        res,
        {
          message: '统计信息已重置',
          timestamp: new Date().toISOString(),
        },
        '统计信息重置成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '重置统计信息失败', error);
    }
  },

  // 调试面板HTML (开发环境)
  getDebugDashboard: async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return statusCode.clientError.forbidden(res, '生产环境不允许访问调试面板');
    }

    const html = generateDebugDashboardHTML();
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  },
};

// 辅助函数：检查内存健康状态
function checkMemoryHealth() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

  return {
    status: heapUsedMB > 512 ? 'unhealthy' : 'healthy',
    details: {
      heapUsed: heapUsedMB,
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    },
  };
}

// 辅助函数：检查数据库健康状态
async function checkDatabaseHealth() {
  try {
    const { healthCheck } = require('../config/database');
    const health = await healthCheck();
    return {
      status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
      details: health,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message },
    };
  }
}

// 辅助函数：检查日志健康状态
function checkLogHealth() {
  const logDir = './logs';
  const logFiles = ['error.log', 'combined.log', 'app.log'];

  try {
    const stats = logFiles.map(file => {
      const filePath = path.join(logDir, file);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        return {
          file,
          size: Math.round(stat.size / 1024), // KB
          modified: stat.mtime,
        };
      }
      return { file, exists: false };
    });

    return {
      status: 'healthy',
      details: { files: stats },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message },
    };
  }
}

// 辅助函数：检查磁盘健康状态
function checkDiskHealth() {
  try {
    const stats = fs.statSync('./');
    return {
      status: 'healthy',
      details: {
        accessible: true,
        timestamp: stats.mtime,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message },
    };
  }
}

// 生成调试面板HTML
function generateDebugDashboardHTML() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Node.js 后端调试面板</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .status-healthy { color: #4CAF50; font-weight: bold; }
        .status-degraded { color: #FF9800; font-weight: bold; }
        .status-unhealthy { color: #F44336; font-weight: bold; }
        .btn { background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #1976D2; }
        .logs { background: #000; color: #0f0; padding: 15px; border-radius: 4px; font-family: monospace; max-height: 300px; overflow-y: auto; }
        .refresh { margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Node.js 后端调试面板</h1>
            <p>实时监控系统状态、性能指标和错误信息</p>
        </div>
        
        <div class="refresh">
            <button class="btn" onclick="location.reload()">🔄 刷新</button>
            <button class="btn" onclick="resetMetrics()">📊 重置统计</button>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📈 系统概览</h3>
                <div id="system-overview">加载中...</div>
            </div>
            
            <div class="card">
                <h3>🚀 性能指标</h3>
                <div id="performance-metrics">加载中...</div>
            </div>
            
            <div class="card">
                <h3>🔄 活跃请求</h3>
                <div id="active-requests">加载中...</div>
            </div>
            
            <div class="card">
                <h3>❌ 错误统计</h3>
                <div id="error-stats">加载中...</div>
            </div>
            
            <div class="card">
                <h3>📋 最近日志</h3>
                <div id="recent-logs">加载中...</div>
            </div>
            
            <div class="card">
                <h3>💾 内存使用</h3>
                <div id="memory-usage">加载中...</div>
            </div>
        </div>
    </div>
    
    <script>
        async function loadData() {
            try {
                // 系统概览
                const overview = await fetch('/api/debug/overview').then(r => r.json());
                document.getElementById('system-overview').innerHTML = formatOverview(overview.data);
                
                // 性能指标
                const performance = await fetch('/api/debug/performance').then(r => r.json());
                document.getElementById('performance-metrics').innerHTML = formatPerformance(performance.data);
                
                // 活跃请求
                const requests = await fetch('/api/debug/requests').then(r => r.json());
                document.getElementById('active-requests').innerHTML = formatRequests(requests.data);
                
                // 错误统计
                const errors = await fetch('/api/debug/errors').then(r => r.json());
                document.getElementById('error-stats').innerHTML = formatErrors(errors.data);
                
                // 最近日志
                const logs = await fetch('/api/debug/logs?limit=10').then(r => r.json());
                document.getElementById('recent-logs').innerHTML = formatLogs(logs.data);
                
                // 内存使用
                document.getElementById('memory-usage').innerHTML = formatMemory(performance.data);
                
            } catch (error) {
                console.error('加载数据失败:', error);
            }
        }
        
        function formatOverview(data) {
            const statusClass = 'status-' + data.status;
            return \`
                <div class="metric"><span>状态:</span> <span class="\${statusClass}">\${data.status}</span></div>
                <div class="metric"><span>运行时间:</span> <span>\${data.uptime}秒</span></div>
                <div class="metric"><span>总请求:</span> <span>\${data.requests.total}</span></div>
                <div class="metric"><span>每分钟请求:</span> <span>\${data.requests.perMinute}</span></div>
                <div class="metric"><span>平均响应时间:</span> <span>\${data.requests.avgResponseTime}ms</span></div>
                <div class="metric"><span>错误率:</span> <span>\${data.errors.rate}%</span></div>
            \`;
        }
        
        function formatPerformance(data) {
            return \`
                <div class="metric"><span>平均响应时间:</span> <span>\${data.requests.avgResponseTime}ms</span></div>
                <div class="metric"><span>慢查询:</span> <span>\${data.database.slowQueries}</span></div>
                <div class="metric"><span>慢查询率:</span> <span>\${data.database.slowQueryRate}%</span></div>
                <div class="metric"><span>内存趋势:</span> <span>\${data.memory.trend}</span></div>
            \`;
        }
        
        function formatRequests(data) {
            return \`
                <div class="metric"><span>活跃请求:</span> <span>\${data.stats.activeRequests}</span></div>
                <div class="metric"><span>总请求:</span> <span>\${data.stats.totalRequests}</span></div>
                <div class="metric"><span>平均响应时间:</span> <span>\${data.stats.averageResponseTime}ms</span></div>
                <div class="metric"><span>错误率:</span> <span>\${data.stats.errorRate}%</span></div>
            \`;
        }
        
        function formatErrors(data) {
            return \`
                <div class="metric"><span>总错误:</span> <span>\${data.stats.total}</span></div>
                <div class="metric"><span>最近错误:</span> <span>\${data.stats.recentErrorsCount}</span></div>
                <div style="margin-top: 10px;">
                    <strong>最近错误:</strong>
                    \${data.recentErrors.slice(0, 3).map(e => \`
                        <div style="font-size: 12px; margin: 5px 0; padding: 5px; background: #fee;">
                            [\${e.timestamp.substring(11, 19)}] \${e.message}
                        </div>
                    \`).join('')}
                </div>
            \`;
        }
        
        function formatLogs(data) {
            return \`
                <div class="logs">
                    \${data.logs.slice(0, 5).map(log => 
                        \`[\${log.timestamp?.substring(11, 19) || ''}] \${log.message || JSON.stringify(log)}\`
                    ).join('\\n')}
                </div>
            \`;
        }
        
        function formatMemory(data) {
            const mem = data.memory.current;
            return \`
                <div class="metric"><span>堆内存使用:</span> <span>\${mem.heapUsed}MB</span></div>
                <div class="metric"><span>堆内存总量:</span> <span>\${mem.heapTotal}MB</span></div>
                <div class="metric"><span>RSS:</span> <span>\${mem.rss}MB</span></div>
                <div class="metric"><span>趋势:</span> <span>\${data.memory.trend}</span></div>
            \`;
        }
        
        async function resetMetrics() {
            try {
                await fetch('/api/debug/reset', { method: 'POST' });
                alert('统计信息已重置');
                location.reload();
            } catch (error) {
                alert('重置失败: ' + error.message);
            }
        }
        
        // 初始加载
        loadData();
        
        // 自动刷新
        setInterval(loadData, 10000);
    </script>
</body>
</html>
  `;
}

module.exports = debugController;
