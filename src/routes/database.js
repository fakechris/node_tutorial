// 阶段六：数据库管理路由
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const statusCode = require('../middleware/statusCode');
const { healthCheck, getStats, sequelize } = require('../config/database');
const models = require('../models');

// 数据库健康检查 - 公开端点
router.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();

    if (health.status === 'healthy') {
      statusCode.success.ok(res, health, '数据库连接正常');
    } else {
      statusCode.serverError.serviceUnavailable(res, 30);
    }
  } catch (error) {
    statusCode.serverError.internalError(res, '健康检查失败', error);
  }
});

// 数据库统计信息 - 需要认证
router.get('/stats', auth.authenticate, async (req, res) => {
  try {
    const dbStats = await getStats();
    const modelStats = await models.getAllStats();

    const combinedStats = {
      database: dbStats,
      models: modelStats,
      timestamp: new Date().toISOString(),
    };

    statusCode.success.ok(res, combinedStats, '数据库统计信息获取成功');
  } catch (error) {
    statusCode.serverError.internalError(res, '获取统计信息失败', error);
  }
});

// 开发模式下的数据库初始化 - 无需认证（仅用于开发和测试）
router.post('/init-dev', async (req, res) => {
  try {
    // 只在开发环境下允许
    if (process.env.NODE_ENV === 'production') {
      return statusCode.clientError.forbidden(res, '生产环境不允许此操作');
    }

    const { withSampleData = false } = req.body;

    console.log('🔄 开发模式：完全重建数据库...');

    // 使用强制同步重建数据库，确保幂等性
    const success = await models.initDatabase({ force: true });

    if (!success) {
      return statusCode.serverError.internalError(res, '数据库重建失败');
    }

    let sampleDataResult = false;
    if (withSampleData) {
      console.log('🌱 创建示例数据...');
      try {
        sampleDataResult = await models.createSampleData();
      } catch (sampleError) {
        console.error('❌ 示例数据创建异常:', sampleError.message);
        return statusCode.serverError.internalError(res, '示例数据创建失败', sampleError);
      }
    }

    statusCode.success.ok(
      res,
      {
        initialized: true,
        rebuilt: true,
        sampleDataCreated: sampleDataResult === true,
        mode: 'development',
        timestamp: new Date().toISOString(),
      },
      '数据库初始化成功'
    );
  } catch (error) {
    statusCode.serverError.internalError(res, '数据库初始化失败', error);
  }
});

// 数据库初始化 - 仅管理员
router.post('/init', auth.authenticate, auth.authorize(['admin']), async (req, res) => {
  try {
    const { force = false, withSampleData = false } = req.body;

    console.log('🔄 管理员请求初始化数据库...');

    const initOptions = {
      force: force === true, // 是否强制重建表
    };

    const success = await models.initDatabase(initOptions);

    if (!success) {
      return statusCode.serverError.internalError(res, '数据库初始化失败');
    }

    let sampleDataResult = null;
    if (withSampleData) {
      console.log('🌱 创建示例数据...');
      sampleDataResult = await models.createSampleData();
    }

    statusCode.success.ok(
      res,
      {
        initialized: true,
        force: force,
        sampleDataCreated: sampleDataResult,
        timestamp: new Date().toISOString(),
      },
      '数据库初始化成功'
    );
  } catch (error) {
    statusCode.serverError.internalError(res, '数据库初始化失败', error);
  }
});

// 创建示例数据 - 仅管理员
router.post(
  '/sample-data',
  auth.authenticate,
  auth.authorize(['admin']),
  async (req, res) => {
    try {
      console.log('🌱 管理员请求创建示例数据...');

      const success = await models.createSampleData();

      if (!success) {
        return statusCode.serverError.internalError(res, '创建示例数据失败');
      }

      const stats = await models.getAllStats();

      statusCode.success.created(
        res,
        {
          created: true,
          stats: stats,
          timestamp: new Date().toISOString(),
        },
        '示例数据创建成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '创建示例数据失败', error);
    }
  }
);

// 清空所有数据 - 仅管理员
router.delete(
  '/clear-all',
  auth.authenticate,
  auth.authorize(['admin']),
  async (req, res) => {
    try {
      const confirmation = req.body.confirm;

      if (confirmation !== 'DELETE_ALL_DATA') {
        return statusCode.clientError.badRequest(
          res,
          '请在请求体中提供确认字符串: {"confirm": "DELETE_ALL_DATA"}'
        );
      }

      console.log('🗑️  管理员请求清空所有数据...');

      const success = await models.clearAllData();

      if (!success) {
        return statusCode.serverError.internalError(res, '清空数据失败');
      }

      statusCode.success.ok(
        res,
        {
          cleared: true,
          timestamp: new Date().toISOString(),
        },
        '所有数据已清空'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '清空数据失败', error);
    }
  }
);

// 执行原生SQL查询 - 仅管理员（谨慎使用）
router.post('/query', auth.authenticate, auth.authorize(['admin']), async (req, res) => {
  try {
    const { sql, type = 'SELECT' } = req.body;

    if (!sql) {
      return statusCode.clientError.badRequest(res, 'SQL查询语句不能为空');
    }

    // 安全检查：只允许SELECT语句（在生产环境中应该更严格）
    if (
      process.env.NODE_ENV === 'production' &&
      !sql.trim().toUpperCase().startsWith('SELECT')
    ) {
      return statusCode.clientError.forbidden(res, '生产环境只允许SELECT查询');
    }

    console.log('🔍 管理员执行SQL查询:', sql);

    const queryType =
      sequelize.QueryTypes[type.toUpperCase()] || sequelize.QueryTypes.SELECT;
    const results = await sequelize.query(sql, { type: queryType });

    statusCode.success.ok(
      res,
      {
        sql: sql,
        type: type,
        results: results,
        count: Array.isArray(results) ? results.length : 1,
        timestamp: new Date().toISOString(),
      },
      'SQL查询执行成功'
    );
  } catch (error) {
    statusCode.serverError.internalError(res, 'SQL查询执行失败', error);
  }
});

// 数据库备份信息 - 仅管理员
router.get(
  '/backup-info',
  auth.authenticate,
  auth.authorize(['admin']),
  async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');

      const dbPath = './database/tutorial.db';
      const dbExists = fs.existsSync(dbPath);

      let fileInfo = null;
      if (dbExists) {
        const stats = fs.statSync(dbPath);
        fileInfo = {
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
          created: stats.birthtime,
          modified: stats.mtime,
          path: path.resolve(dbPath),
        };
      }

      statusCode.success.ok(
        res,
        {
          exists: dbExists,
          file: fileInfo,
          recommendations: {
            backup: '建议定期备份数据库文件',
            monitoring: '监控数据库文件大小和性能',
            maintenance: '定期进行数据库维护和清理',
          },
          timestamp: new Date().toISOString(),
        },
        '数据库备份信息获取成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '获取备份信息失败', error);
    }
  }
);

// 数据库信息总览
router.get('/info', async (req, res) => {
  try {
    const info = {
      name: 'Node.js Tutorial Database',
      type: 'SQLite',
      version: 'SQLite 3.x',
      location: './database/tutorial.db',
      features: {
        orm: 'Sequelize ORM',
        models: ['User', 'Post', 'Comment', 'Category'],
        associations: {
          'User -> Posts': '一对多关系',
          'User -> Comments': '一对多关系',
          'Post -> Comments': '一对多关系',
          'Category -> Posts': '一对多关系',
          'Comment -> Replies': '自关联一对多',
          'Category -> Children': '自关联一对多',
        },
        capabilities: [
          'CRUD操作',
          '数据验证',
          '索引优化',
          '软删除',
          '时间戳',
          '模型钩子',
          '数据统计',
        ],
      },
      endpoints: {
        'GET /api/db/health': '数据库健康检查',
        'GET /api/db/stats': '数据库统计信息（需认证）',
        'POST /api/db/init': '初始化数据库（管理员）',
        'POST /api/db/sample-data': '创建示例数据（管理员）',
        'DELETE /api/db/clear-all': '清空所有数据（管理员）',
        'GET /api/db/backup-info': '备份信息（管理员）',
      },
      timestamp: new Date().toISOString(),
    };

    statusCode.success.ok(res, info, '数据库信息获取成功');
  } catch (error) {
    statusCode.serverError.internalError(res, '获取数据库信息失败', error);
  }
});

// 临时调试路由 - 仅用于开发环境
if (process.env.NODE_ENV !== 'production') {
  router.post('/debug-sample-data', async (req, res) => {
    try {
      console.log('🔍 开始调试示例数据创建...');

      // 先清空所有数据
      await models.clearAllData();
      console.log('🗑️  数据已清空');

      // 然后创建示例数据
      const result = await models.createSampleData();
      console.log('📝 示例数据创建结果:', result);

      statusCode.success.ok(
        res,
        {
          cleared: true,
          sampleDataCreated: result,
          timestamp: new Date().toISOString(),
        },
        '调试完成'
      );
    } catch (error) {
      console.error('❌ 调试失败:', error);
      statusCode.serverError.internalError(res, '调试失败', error);
    }
  });
}

module.exports = router;
