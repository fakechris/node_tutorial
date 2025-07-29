// 阶段四：HTTP状态码处理中间件
const statusCode = {
  // 成功响应辅助函数
  success: {
    // 200 OK - 请求成功
    ok: (res, data, message = '请求成功') => {
      return res.status(200).json({
        status: 'success',
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    },

    // 201 Created - 资源创建成功
    created: (res, data, message = '资源创建成功') => {
      return res.status(201).json({
        status: 'success',
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    },

    // 202 Accepted - 请求已接受，但未完成处理
    accepted: (res, data, message = '请求已接受，正在处理') => {
      return res.status(202).json({
        status: 'accepted',
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    },

    // 204 No Content - 请求成功，但无内容返回
    noContent: res => {
      return res.status(204).end();
    },
  },

  // 客户端错误响应辅助函数
  clientError: {
    // 400 Bad Request - 请求参数错误
    badRequest: (res, message = '请求参数错误', details = null) => {
      return res.status(400).json({
        status: 'error',
        message,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
      });
    },

    // 401 Unauthorized - 未授权
    unauthorized: (res, message = '未授权访问') => {
      return res.status(401).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    },

    // 403 Forbidden - 禁止访问
    forbidden: (res, message = '禁止访问') => {
      return res.status(403).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    },

    // 404 Not Found - 资源不存在
    notFound: (res, message = '请求的资源不存在') => {
      return res.status(404).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    },

    // 405 Method Not Allowed - 方法不被允许
    methodNotAllowed: (res, allowedMethods = []) => {
      res.header('Allow', allowedMethods.join(', '));
      return res.status(405).json({
        status: 'error',
        message: '请求方法不被允许',
        allowedMethods,
        timestamp: new Date().toISOString(),
      });
    },

    // 406 Not Acceptable - 不可接受的内容类型
    notAcceptable: (res, supportedTypes = []) => {
      return res.status(406).json({
        status: 'error',
        message: '不支持的内容类型',
        supportedTypes,
        timestamp: new Date().toISOString(),
      });
    },

    // 409 Conflict - 资源冲突
    conflict: (res, message = '资源冲突') => {
      return res.status(409).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    },

    // 422 Unprocessable Entity - 无法处理的实体
    unprocessableEntity: (res, message = '无法处理的实体', errors = []) => {
      return res.status(422).json({
        status: 'error',
        message,
        errors,
        timestamp: new Date().toISOString(),
      });
    },

    // 429 Too Many Requests - 请求过多
    tooManyRequests: (res, retryAfter = 60) => {
      res.header('Retry-After', retryAfter.toString());
      return res.status(429).json({
        status: 'error',
        message: '请求过于频繁，请稍后再试',
        retryAfter,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // 服务器错误响应辅助函数
  serverError: {
    // 500 Internal Server Error - 服务器内部错误
    internalError: (res, message = '服务器内部错误', error = null) => {
      return res.status(500).json({
        status: 'error',
        message,
        ...(process.env.NODE_ENV === 'development' &&
          error && {
            stack: error.stack,
            details: error.message,
          }),
        timestamp: new Date().toISOString(),
      });
    },

    // 501 Not Implemented - 功能未实现
    notImplemented: (res, message = '功能尚未实现') => {
      return res.status(501).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    },

    // 502 Bad Gateway - 网关错误
    badGateway: (res, message = '网关错误') => {
      return res.status(502).json({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      });
    },

    // 503 Service Unavailable - 服务不可用
    serviceUnavailable: (res, retryAfter = 60) => {
      res.header('Retry-After', retryAfter.toString());
      return res.status(503).json({
        status: 'error',
        message: '服务暂时不可用',
        retryAfter,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // 状态码检查中间件
  middleware: {
    // 检查方法是否被允许
    checkMethodAllowed: allowedMethods => {
      return (req, res, next) => {
        if (!allowedMethods.includes(req.method)) {
          return statusCode.clientError.methodNotAllowed(res, allowedMethods);
        }
        next();
      };
    },

    // 资源存在性检查
    checkResourceExists: resourceFinder => {
      return async (req, res, next) => {
        try {
          const resource = await resourceFinder(req);
          if (!resource) {
            return statusCode.clientError.notFound(res);
          }
          req.resource = resource;
          next();
        } catch (error) {
          statusCode.serverError.internalError(res, '检查资源时发生错误', error);
        }
      };
    },

    // 条件状态码处理
    conditionalResponse: (req, res, next) => {
      // 保存原始的 json 方法
      const originalJson = res.json;

      // 重写 json 方法以添加条件处理
      res.json = function (data) {
        // 检查是否是空结果
        if (data && typeof data === 'object') {
          // 如果是列表且为空
          if (Array.isArray(data) && data.length === 0) {
            this.status(200); // 保持200状态，但可以考虑204
          }
          // 如果是对象且没有实际数据
          else if (data.data && Array.isArray(data.data) && data.data.length === 0) {
            this.status(200); // 空列表仍然是成功的请求
          }
        }

        // 调用原始方法
        return originalJson.call(this, data);
      };

      next();
    },
  },
};

module.exports = statusCode;
