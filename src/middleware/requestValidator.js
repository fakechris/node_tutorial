// 阶段二：请求验证中间件
const validateRequest = (validationRules) => {
  return (req, res, next) => {
    const errors = [];
    
    // 验证请求体
    if (validationRules.body) {
      for (const [field, rules] of Object.entries(validationRules.body)) {
        const value = req.body[field];
        
        // 必填字段检查
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`字段 '${field}' 是必填的`);
          continue;
        }
        
        // 如果字段不存在且非必填，跳过后续检查
        if (value === undefined || value === null) {
          continue;
        }
        
        // 类型检查
        if (rules.type && typeof value !== rules.type) {
          errors.push(`字段 '${field}' 必须是 ${rules.type} 类型`);
        }
        
        // 字符串长度检查
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`字段 '${field}' 长度不能少于 ${rules.minLength} 个字符`);
        }
        
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`字段 '${field}' 长度不能超过 ${rules.maxLength} 个字符`);
        }
        
        // 正则表达式验证
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`字段 '${field}' 格式不正确`);
        }
      }
    }
    
    // 验证路径参数
    if (validationRules.params) {
      for (const [param, rules] of Object.entries(validationRules.params)) {
        const value = req.params[param];
        
        if (rules.type === 'number' && isNaN(Number(value))) {
          errors.push(`路径参数 '${param}' 必须是数字`);
        }
      }
    }
    
    // 如果有验证错误，返回400状态码
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: '请求参数验证失败',
        errors: errors,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

module.exports = validateRequest;