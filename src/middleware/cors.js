// 阶段二：CORS跨域中间件
const cors = (options = {}) => {
  // 默认CORS配置
  const defaultOptions = {
    origin: process.env.NODE_ENV === 'development' ? '*' : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
    maxAge: 86400, // 24小时
  };

  const config = { ...defaultOptions, ...options };

  return (req, res, next) => {
    // 设置Access-Control-Allow-Origin
    if (config.origin === '*') {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (config.origin) {
      res.header('Access-Control-Allow-Origin', config.origin);
    }

    // 设置允许的HTTP方法
    res.header('Access-Control-Allow-Methods', config.methods.join(', '));

    // 设置允许的请求头
    if (config.allowedHeaders === true || config.allowedHeaders === '*') {
      res.header('Access-Control-Allow-Headers', '*');
    } else if (Array.isArray(config.allowedHeaders)) {
      res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    }

    // 设置是否允许发送Cookie
    if (config.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    // 设置预检请求缓存时间
    res.header('Access-Control-Max-Age', config.maxAge);

    // 处理预检请求(OPTIONS)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  };
};

module.exports = cors;
