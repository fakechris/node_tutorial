// 阶段六：分类路由模块（集成数据库）
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/requestValidator');

// 路由级中间件：分类ID验证
const validateCategoryId = (req, res, next) => {
  const categoryId = parseInt(req.params.id);
  if (isNaN(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: '分类ID必须是正整数',
      timestamp: new Date().toISOString()
    });
  }
  req.params.id = categoryId;
  next();
};

// GET /api/categories - 获取分类列表（支持分页、搜索、层级显示）
// 公开访问
router.get('/', categoryController.getCategories);

// GET /api/categories/tree - 获取分类树（层级结构）
// 公开访问
router.get('/tree', categoryController.getCategoryTree);

// GET /api/categories/popular - 获取热门分类
// 公开访问
router.get('/popular', categoryController.getPopularCategories);

// GET /api/categories/search - 搜索分类
// 公开访问
router.get('/search', categoryController.searchCategories);

// GET /api/categories/stats - 获取分类统计信息
// 需要认证，管理员和版主可以访问
router.get('/stats', 
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  categoryController.getCategoryStats
);

// GET /api/categories/:id - 获取单个分类详情
// 公开访问
router.get('/:id', 
  validateCategoryId,
  categoryController.getCategoryById
);

// POST /api/categories - 创建新分类（仅管理员和版主）
router.post('/', 
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  validateRequest({
    body: {
      name: { 
        required: true, 
        type: 'string', 
        minLength: 1, 
        maxLength: 100
      },
      slug: {
        required: false,
        type: 'string',
        maxLength: 100,
        pattern: /^[a-z0-9-]+$/
      },
      description: {
        required: false,
        type: 'string',
        maxLength: 1000
      },
      parentId: {
        required: false,
        type: 'number'
      },
      sortOrder: {
        required: false,
        type: 'number'
      },
      isActive: {
        required: false,
        type: 'boolean'
      },
      color: {
        required: false,
        type: 'string',
        pattern: /^#[0-9A-Fa-f]{6}$/
      },
      iconUrl: {
        required: false,
        type: 'string'
      }
    }
  }), 
  categoryController.createCategory
);

// PUT /api/categories/:id - 更新分类（仅管理员和版主）
router.put('/:id', 
  validateCategoryId,
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  validateRequest({
    body: {
      name: { 
        required: false, 
        type: 'string', 
        minLength: 1, 
        maxLength: 100
      },
      slug: {
        required: false,
        type: 'string',
        maxLength: 100,
        pattern: /^[a-z0-9-]+$/
      },
      description: {
        required: false,
        type: 'string',
        maxLength: 1000
      },
      parentId: {
        required: false,
        type: 'number'
      },
      sortOrder: {
        required: false,
        type: 'number'
      },
      isActive: {
        required: false,
        type: 'boolean'
      },
      color: {
        required: false,
        type: 'string',
        pattern: /^#[0-9A-Fa-f]{6}$/
      },
      iconUrl: {
        required: false,
        type: 'string'
      }
    }
  }), 
  categoryController.updateCategory
);

// DELETE /api/categories/:id - 删除分类（仅管理员）
router.delete('/:id', 
  validateCategoryId,
  auth.authenticate,
  auth.authorize(['admin']),
  categoryController.deleteCategory
);

// POST /api/categories/batch - 批量操作分类（仅管理员和版主）
router.post('/batch', 
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  validateRequest({
    body: {
      operation: {
        required: true,
        type: 'string'
      },
      categoryIds: {
        required: true,
        type: 'array',
        minItems: 1
      },
      data: {
        required: false,
        type: 'object'
      }
    }
  }),
  categoryController.batchOperation
);

module.exports = router;