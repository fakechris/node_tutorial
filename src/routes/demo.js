// 阶段四：HTTP头部和状态码演示路由
const express = require('express');
const router = express.Router();
const headers = require('../middleware/headers');
const statusCode = require('../middleware/statusCode');

// 演示不同状态码的路由
router.get('/status-codes', (req, res) => {
  res.json({
    status: 'success',
    message: 'HTTP状态码演示端点',
    availableEndpoints: {
      'GET /demo/status/200': '200 OK - 成功响应',
      'POST /demo/status/201': '201 Created - 创建成功',
      'GET /demo/status/202': '202 Accepted - 请求已接受',
      'GET /demo/status/204': '204 No Content - 无内容',
      'GET /demo/status/304': '304 Not Modified - 未修改（需要ETag）',
      'GET /demo/status/400': '400 Bad Request - 请求错误',
      'GET /demo/status/401': '401 Unauthorized - 未授权',
      'GET /demo/status/403': '403 Forbidden - 禁止访问',
      'GET /demo/status/404': '404 Not Found - 未找到',
      'POST /demo/status/405': '405 Method Not Allowed - 方法不允许',
      'GET /demo/status/406': '406 Not Acceptable - 不可接受',
      'POST /demo/status/409': '409 Conflict - 冲突',
      'POST /demo/status/422': '422 Unprocessable Entity - 无法处理',
      'GET /demo/status/429': '429 Too Many Requests - 请求过多',
      'GET /demo/status/500': '500 Internal Server Error - 服务器错误',
      'GET /demo/status/503': '503 Service Unavailable - 服务不可用',
    },
    timestamp: new Date().toISOString(),
  });
});

// 2xx 成功状态码演示
router.get('/status/200', (req, res) => {
  statusCode.success.ok(res, { message: 'Hello World' }, '获取数据成功');
});

router.post('/status/201', (req, res) => {
  const newResource = { id: 1, name: '新资源', createdAt: new Date().toISOString() };
  statusCode.success.created(res, newResource, '资源创建成功');
});

router.get('/status/202', (req, res) => {
  statusCode.success.accepted(res, { taskId: 'task-123' }, '任务已提交，正在后台处理');
});

router.get('/status/204', (req, res) => {
  statusCode.success.noContent(res);
});

// 3xx 重定向状态码演示
router.get('/status/304', (req, res) => {
  // 模拟ETag检查
  const etag = '"example-etag-123"';
  res.header('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.json({
    status: 'success',
    message: '资源内容（ETag检查演示）',
    data: { content: 'This is cached content' },
  });
});

// 4xx 客户端错误状态码演示
router.get('/status/400', (req, res) => {
  statusCode.clientError.badRequest(res, '缺少必要的请求参数', {
    missingParams: ['name', 'email'],
  });
});

router.get('/status/401', (req, res) => {
  statusCode.clientError.unauthorized(res, '请提供有效的访问令牌');
});

router.get('/status/403', (req, res) => {
  statusCode.clientError.forbidden(res, '您没有权限访问此资源');
});

router.get('/status/404', (req, res) => {
  statusCode.clientError.notFound(res, '请求的用户不存在');
});

// 405 演示 - 只允许GET方法
router.get('/status/405', (req, res) => {
  statusCode.success.ok(res, null, '这个端点只支持GET方法');
});

router.all('/status/405', statusCode.middleware.checkMethodAllowed(['GET']));

router.get('/status/406', (req, res) => {
  const acceptHeader = req.headers.accept;
  if (
    !acceptHeader ||
    (!acceptHeader.includes('application/json') && !acceptHeader.includes('*/*'))
  ) {
    return statusCode.clientError.notAcceptable(res, ['application/json']);
  }

  res.json({
    status: 'success',
    message: '内容协商成功',
    acceptedType: 'application/json',
  });
});

router.post('/status/409', (req, res) => {
  statusCode.clientError.conflict(res, '用户名已存在，请选择其他用户名');
});

router.post('/status/422', (req, res) => {
  const validationErrors = ['邮箱格式不正确', '密码长度必须至少8位', '年龄必须是正整数'];
  statusCode.clientError.unprocessableEntity(res, '数据验证失败', validationErrors);
});

router.get('/status/429', headers.rateLimitInfo(3, 60000), (req, res) => {
  statusCode.success.ok(res, null, '请求成功（有速率限制）');
});

// 5xx 服务器错误状态码演示
router.get('/status/500', (req, res) => {
  const error = new Error('数据库连接失败');
  statusCode.serverError.internalError(res, '服务器遇到意外错误', error);
});

router.get('/status/503', (req, res) => {
  statusCode.serverError.serviceUnavailable(res, 120);
});

// HTTP头部演示路由
router.get('/headers-demo', (req, res) => {
  res.json({
    status: 'success',
    message: 'HTTP头部演示',
    availableEndpoints: {
      'GET /demo/headers/security': '安全头部演示',
      'GET /demo/headers/cache': '缓存控制头部演示',
      'GET /demo/headers/content-negotiation': '内容协商演示',
      'GET /demo/headers/request-tracking': '请求追踪演示',
      'GET /demo/headers/conditional': '条件请求演示',
      'GET /demo/headers/all': '查看当前请求的所有头部',
    },
    currentHeaders: {
      userAgent: req.headers['user-agent'],
      accept: req.headers.accept,
      acceptEncoding: req.headers['accept-encoding'],
      acceptLanguage: req.headers['accept-language'],
      host: req.headers.host,
      connection: req.headers.connection,
    },
    timestamp: new Date().toISOString(),
  });
});

// 安全头部演示
router.get('/headers/security', headers.security, (req, res) => {
  res.json({
    status: 'success',
    message: '安全头部已设置',
    securityHeaders: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    timestamp: new Date().toISOString(),
  });
});

// 缓存控制演示
router.get(
  '/headers/cache',
  headers.cache({ maxAge: 300, private: false }),
  (req, res) => {
    res.json({
      status: 'success',
      message: '缓存头部已设置',
      cacheSettings: {
        'Cache-Control': 'public, max-age=300, must-revalidate',
        ETag: res.get('ETag'),
      },
      timestamp: new Date().toISOString(),
    });
  }
);

// 内容协商演示
router.get('/headers/content-negotiation', headers.contentNegotiation, (req, res) => {
  const data = {
    status: 'success',
    message: '内容协商成功',
    negotiatedType: req.negotiatedContentType,
    clientAccept: req.headers.accept,
    timestamp: new Date().toISOString(),
  };

  if (req.negotiatedContentType === 'text/plain') {
    res.send(`状态: ${data.status}\n消息: ${data.message}\n时间: ${data.timestamp}`);
  } else {
    res.json(data);
  }
});

// 请求追踪演示
router.get('/headers/request-tracking', headers.requestTracking, (req, res) => {
  res.json({
    status: 'success',
    message: '请求追踪信息',
    requestId: req.requestId,
    responseHeaders: {
      'X-Request-ID': res.get('X-Request-ID'),
      'X-Response-Time': res.get('X-Response-Time'),
    },
    timestamp: new Date().toISOString(),
  });
});

// 条件请求演示
router.get('/headers/conditional', (req, res) => {
  const lastModified = new Date('2024-01-01T00:00:00.000Z').toUTCString();
  const etag = '"conditional-demo-123"';

  res.header('Last-Modified', lastModified);
  res.header('ETag', etag);

  // 检查条件请求头
  const ifModifiedSince = req.headers['if-modified-since'];
  const ifNoneMatch = req.headers['if-none-match'];

  if (
    ifNoneMatch === etag ||
    (ifModifiedSince && new Date(ifModifiedSince) >= new Date(lastModified))
  ) {
    return res.status(304).end();
  }

  res.json({
    status: 'success',
    message: '条件请求演示',
    headers: {
      'Last-Modified': lastModified,
      ETag: etag,
    },
    note: '再次请求时，如果设置了 If-None-Match 或 If-Modified-Since 头部，将返回304',
    timestamp: new Date().toISOString(),
  });
});

// 查看所有请求头
router.get('/headers/all', (req, res) => {
  res.json({
    status: 'success',
    message: '当前请求的所有头部信息',
    requestHeaders: req.headers,
    requestInfo: {
      method: req.method,
      url: req.url,
      protocol: req.protocol,
      secure: req.secure,
      ip: req.ip,
      httpVersion: req.httpVersion,
    },
    timestamp: new Date().toISOString(),
  });
});

// API版本控制演示
router.get('/headers/version', headers.apiVersion('v1'), (req, res) => {
  res.json({
    status: 'success',
    message: 'API版本控制演示',
    version: 'v1',
    note: '尝试在请求头中添加 API-Version: v2 来测试版本检查',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
