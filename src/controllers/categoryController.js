// 阶段六：分类管理CRUD控制器
const { Category, Post } = require('../models');
const { Op } = require('sequelize');
const statusCode = require('../middleware/statusCode');

const categoryController = {
  // 获取分类列表（支持分页、搜索、层级显示）
  getCategories: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        parentId,
        isActive,
        flat = false,
        sortBy = 'sortOrder',
        sortOrder = 'ASC'
      } = req.query;

      if (flat === 'true') {
        // 获取扁平化列表（带层级信息）
        const flatList = await Category.getFlatList();
        let filteredList = flatList;

        // 搜索过滤
        if (search) {
          filteredList = flatList.filter(cat => 
            cat.name.toLowerCase().includes(search.toLowerCase()) ||
            (cat.description && cat.description.toLowerCase().includes(search.toLowerCase()))
          );
        }

        // 状态过滤
        if (isActive !== undefined) {
          filteredList = filteredList.filter(cat => cat.isActive === (isActive === 'true'));
        }

        return statusCode.success.ok(res, {
          categories: filteredList,
          total: filteredList.length,
          displayType: 'flat'
        }, '获取分类扁平列表成功');
      }

      // 构建查询条件
      const whereConditions = {};

      if (search) {
        whereConditions[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      if (parentId !== undefined) {
        whereConditions.parentId = parentId === 'null' ? null : parseInt(parentId);
      }

      if (isActive !== undefined) {
        whereConditions.isActive = isActive === 'true';
      }

      // 验证排序字段
      const validSortFields = ['sortOrder', 'name', 'createdAt', 'postCount'];
      const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'sortOrder';
      const actualSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) 
        ? sortOrder.toUpperCase() 
        : 'ASC';

      // 分页参数
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // 查询分类
      const { count, rows: categories } = await Category.findAndCountAll({
        where: whereConditions,
        limit: limitNum,
        offset: offset,
        order: [[actualSortBy, actualSortOrder], ['name', 'ASC']],
        include: [
          {
            model: Category,
            as: 'parent',
            attributes: ['id', 'name', 'slug']
          },
          {
            model: Category,
            as: 'children',
            attributes: ['id', 'name', 'slug', 'postCount'],
            where: { isActive: true },
            required: false
          }
        ]
      });

      statusCode.success.ok(res, {
        categories,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
          hasNext: pageNum < Math.ceil(count / limitNum),
          hasPrev: pageNum > 1
        },
        filters: { search, parentId, isActive },
        sorting: { sortBy: actualSortBy, sortOrder: actualSortOrder },
        displayType: 'paginated'
      }, '获取分类列表成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取分类列表失败', error);
    }
  },

  // 获取分类树（层级结构）
  getCategoryTree: async (req, res) => {
    try {
      const { maxDepth = 5 } = req.query;

      const tree = await Category.buildTree(null, parseInt(maxDepth));

      statusCode.success.ok(res, {
        tree,
        maxDepth: parseInt(maxDepth),
        displayType: 'tree'
      }, '获取分类树成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取分类树失败', error);
    }
  },

  // 获取单个分类详情
  getCategoryById: async (req, res) => {
    try {
      const { id } = req.params;
      const { includePosts = false, includeStats = false } = req.query;

      const includeArray = [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name', 'slug', 'postCount', 'isActive'],
          order: [['sortOrder', 'ASC'], ['name', 'ASC']]
        }
      ];

      // 如果需要包含文章信息
      if (includePosts === 'true') {
        includeArray.push({
          model: Post,
          as: 'posts',
          attributes: ['id', 'title', 'status', 'createdAt', 'viewCount'],
          where: { status: 'published' },
          required: false,
          limit: 10,
          order: [['createdAt', 'DESC']]
        });
      }

      const category = await Category.findByPk(id, {
        include: includeArray
      });

      if (!category) {
        return statusCode.clientError.notFound(res, '分类不存在');
      }

      let responseData = category.toJSON();

      // 如果需要统计信息
      if (includeStats === 'true') {
        const ancestors = await category.getAncestors();
        const descendants = await category.getDescendants();
        const depth = await category.getDepth();
        const isLeaf = await category.isLeaf();

        responseData.stats = {
          depth,
          isRoot: category.isRoot(),
          isLeaf,
          ancestorsCount: ancestors.length,
          descendantsCount: descendants.length,
          directChildrenCount: category.children ? category.children.length : 0
        };

        responseData.breadcrumb = await category.getBreadcrumb();
      }

      statusCode.success.ok(res, responseData, '获取分类详情成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取分类详情失败', error);
    }
  },

  // 创建分类
  createCategory: async (req, res) => {
    try {
      const {
        name,
        slug,
        description,
        parentId,
        sortOrder = 0,
        isActive = true,
        color,
        iconUrl
      } = req.body;

      // 检查分类名称唯一性
      const existingCategory = await Category.findOne({
        where: { name }
      });

      if (existingCategory) {
        return statusCode.clientError.conflict(res, '分类名称已存在');
      }

      // 如果有父分类，验证其存在性
      if (parentId) {
        const parentCategory = await Category.findByPk(parentId);
        if (!parentCategory) {
          return statusCode.clientError.badRequest(res, '指定的父分类不存在');
        }

        // 检查层级深度（防止过深嵌套）
        const parentDepth = await parentCategory.getDepth();
        if (parentDepth >= 4) { // 最多5层
          return statusCode.clientError.badRequest(res, '分类层级不能超过5层');
        }
      }

      // 创建分类
      const newCategory = await Category.create({
        name,
        slug: slug || undefined, // 如果未提供slug，会在模型钩子中自动生成
        description: description || null,
        parentId: parentId || null,
        sortOrder: parseInt(sortOrder),
        isActive,
        color: color || null,
        iconUrl: iconUrl || null
      });

      // 重新获取完整的分类信息
      const completeCategory = await Category.findByPk(newCategory.id, {
        include: [{
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        }]
      });

      statusCode.success.created(res, completeCategory, '分类创建成功');

    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(res, `数据验证失败: ${validationErrors.join(', ')}`);
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return statusCode.clientError.conflict(res, '分类名称或别名已存在');
      }

      statusCode.serverError.internalError(res, '创建分类失败', error);
    }
  },

  // 更新分类
  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        slug,
        description,
        parentId,
        sortOrder,
        isActive,
        color,
        iconUrl
      } = req.body;

      const category = await Category.findByPk(id);
      if (!category) {
        return statusCode.clientError.notFound(res, '分类不存在');
      }

      // 检查分类名称唯一性（排除当前分类）
      if (name && name !== category.name) {
        const existingCategory = await Category.findOne({
          where: {
            [Op.and]: [
              { name },
              { id: { [Op.ne]: id } }
            ]
          }
        });

        if (existingCategory) {
          return statusCode.clientError.conflict(res, '分类名称已存在');
        }
      }

      // 如果要更改父分类
      if (parentId !== undefined && parentId !== category.parentId) {
        if (parentId) {
          // 验证父分类存在性
          const parentCategory = await Category.findByPk(parentId);
          if (!parentCategory) {
            return statusCode.clientError.badRequest(res, '指定的父分类不存在');
          }

          // 防止循环引用
          if (parseInt(parentId) === parseInt(id)) {
            return statusCode.clientError.badRequest(res, '不能将分类设置为自己的父分类');
          }

          // 检查是否会创建循环引用
          const descendants = await category.getDescendants();
          const descendantIds = descendants.map(d => d.id);
          if (descendantIds.includes(parseInt(parentId))) {
            return statusCode.clientError.badRequest(res, '不能将分类设置为其子分类的父分类');
          }

          // 检查层级深度
          const parentDepth = await parentCategory.getDepth();
          if (parentDepth >= 4) {
            return statusCode.clientError.badRequest(res, '分类层级不能超过5层');
          }
        }
      }

      // 准备更新数据
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (description !== undefined) updateData.description = description;
      if (parentId !== undefined) updateData.parentId = parentId;
      if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
      if (isActive !== undefined) updateData.isActive = isActive;
      if (color !== undefined) updateData.color = color;
      if (iconUrl !== undefined) updateData.iconUrl = iconUrl;

      // 更新分类
      await category.update(updateData);

      // 重新获取更新后的分类信息
      await category.reload();
      const completeCategory = await Category.findByPk(category.id, {
        include: [{
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        }]
      });

      statusCode.success.ok(res, completeCategory, '分类更新成功');

    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(res, `数据验证失败: ${validationErrors.join(', ')}`);
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return statusCode.clientError.conflict(res, '分类名称或别名已存在');
      }

      statusCode.serverError.internalError(res, '更新分类失败', error);
    }
  },

  // 删除分类（软删除）
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent = false, movePostsTo } = req.query;

      const category = await Category.findByPk(id, {
        include: [
          {
            model: Category,
            as: 'children'
          },
          {
            model: Post,
            as: 'posts'
          }
        ]
      });

      if (!category) {
        return statusCode.clientError.notFound(res, '分类不存在');
      }

      // 检查是否有子分类
      if (category.children && category.children.length > 0) {
        return statusCode.clientError.badRequest(res, '该分类有子分类，请先删除所有子分类');
      }

      // 处理分类下的文章
      if (category.posts && category.posts.length > 0) {
        if (movePostsTo) {
          // 验证目标分类存在性
          const targetCategory = await Category.findByPk(movePostsTo);
          if (!targetCategory) {
            return statusCode.clientError.badRequest(res, '指定的目标分类不存在');
          }

          // 将文章移动到目标分类
          await Post.update(
            { categoryId: parseInt(movePostsTo) },
            { where: { categoryId: id } }
          );

          // 更新目标分类的文章数量
          await targetCategory.updatePostCount();
        } else {
          // 将文章的分类设置为null
          await Post.update(
            { categoryId: null },
            { where: { categoryId: id } }
          );
        }
      }

      if (permanent === 'true') {
        // 永久删除（物理删除）
        await category.destroy({ force: true });
        statusCode.success.ok(res, null, '分类已永久删除');
      } else {
        // 软删除
        await category.destroy();
        statusCode.success.ok(res, null, '分类已删除');
      }

    } catch (error) {
      statusCode.serverError.internalError(res, '删除分类失败', error);
    }
  },

  // 获取分类统计信息
  getCategoryStats: async (req, res) => {
    try {
      const stats = await Category.getStats();
      statusCode.success.ok(res, stats, '获取分类统计信息成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取分类统计信息失败', error);
    }
  },

  // 获取热门分类
  getPopularCategories: async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const popularCategories = await Category.findPopular(parseInt(limit));

      statusCode.success.ok(res, {
        categories: popularCategories,
        total: popularCategories.length
      }, '获取热门分类成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取热门分类失败', error);
    }
  },

  // 搜索分类
  searchCategories: async (req, res) => {
    try {
      const { keyword, limit = 20 } = req.query;

      if (!keyword) {
        return statusCode.clientError.badRequest(res, '搜索关键词不能为空');
      }

      const categories = await Category.search(keyword, {
        limit: parseInt(limit)
      });

      statusCode.success.ok(res, {
        categories,
        keyword,
        total: categories.length
      }, '搜索分类成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '搜索分类失败', error);
    }
  },

  // 批量操作分类
  batchOperation: async (req, res) => {
    try {
      const { operation, categoryIds, data = {} } = req.body;

      if (!operation || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        return statusCode.clientError.badRequest(res, '操作类型和分类ID列表不能为空');
      }

      const validOperations = ['activate', 'deactivate', 'delete', 'updateSortOrder'];
      if (!validOperations.includes(operation)) {
        return statusCode.clientError.badRequest(res, `操作类型必须是以下之一: ${validOperations.join(', ')}`);
      }

      const results = [];

      for (const categoryId of categoryIds) {
        try {
          const category = await Category.findByPk(categoryId);
          if (!category) {
            results.push({ categoryId, success: false, message: '分类不存在' });
            continue;
          }

          switch (operation) {
            case 'activate':
              await category.update({ isActive: true });
              results.push({ categoryId, success: true, message: '分类已激活' });
              break;

            case 'deactivate':
              await category.update({ isActive: false });
              results.push({ categoryId, success: true, message: '分类已禁用' });
              break;

            case 'delete':
              // 检查是否有子分类或文章
              const children = await category.getChildren();
              const postCount = await Post.count({ where: { categoryId } });
              
              if (children.length > 0 || postCount > 0) {
                results.push({ categoryId, success: false, message: '分类有子分类或文章，无法删除' });
                continue;
              }
              
              await category.destroy();
              results.push({ categoryId, success: true, message: '分类已删除' });
              break;

            case 'updateSortOrder':
              if (!data.sortOrder && data.sortOrder !== 0) {
                results.push({ categoryId, success: false, message: '排序值参数缺失' });
                continue;
              }
              await category.update({ sortOrder: data.sortOrder });
              results.push({ categoryId, success: true, message: '排序值更新成功' });
              break;
          }
        } catch (error) {
          results.push({ categoryId, success: false, message: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      statusCode.success.ok(res, {
        operation,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      }, `批量操作完成：成功 ${successCount} 个，失败 ${failCount} 个`);

    } catch (error) {
      statusCode.serverError.internalError(res, '批量操作失败', error);
    }
  }
};

module.exports = categoryController;