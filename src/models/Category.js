// 阶段六：分类数据模型
const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: {
        name: 'unique_category_name',
        msg: '分类名称已存在',
      },
      validate: {
        len: {
          args: [1, 100],
          msg: '分类名称长度必须在1-100个字符之间',
        },
      },
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: {
        name: 'unique_category_slug',
        msg: '分类别名已存在',
      },
      validate: {
        is: {
          args: /^[a-z0-9-]+$/,
          msg: '分类别名只能包含小写字母、数字和连字符',
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: '分类描述不能超过1000个字符',
        },
      },
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id',
      },
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    postCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    color: {
      type: DataTypes.STRING(7), // #FFFFFF 格式
      allowNull: true,
      validate: {
        is: {
          args: /^#[0-9A-Fa-f]{6}$/,
          msg: '颜色必须是有效的十六进制颜色值',
        },
      },
    },
    iconUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: {
          msg: '图标URL格式不正确',
        },
      },
    },
  },
  {
    tableName: 'categories',
    indexes: [
      {
        unique: true,
        fields: ['name'],
      },
      {
        unique: true,
        fields: ['slug'],
      },
      {
        fields: ['parent_id'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['sort_order'],
      },
    ],
    hooks: {
      // 创建分类前生成slug
      beforeCreate: async (category, options) => {
        if (!category.slug && category.name) {
          category.slug = category.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
        }
      },

      // 更新分类前生成slug
      beforeUpdate: async (category, options) => {
        if (category.changed('name') && !category.changed('slug')) {
          category.slug = category.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
        }
      },
    },
  }
);

// 实例方法：获取子分类
Category.prototype.getChildren = function (options = {}) {
  return Category.findAll({
    where: { parentId: this.id },
    order: [
      ['sort_order', 'ASC'],
      ['name', 'ASC'],
    ],
    ...options,
  });
};

// 实例方法：获取所有后代分类
Category.prototype.getDescendants = async function () {
  const descendants = [];
  const children = await this.getChildren();

  for (const child of children) {
    descendants.push(child);
    const grandChildren = await child.getDescendants();
    descendants.push(...grandChildren);
  }

  return descendants;
};

// 实例方法：获取父分类
Category.prototype.getParent = function () {
  if (!this.parentId) {
    return null;
  }
  return Category.findByPk(this.parentId);
};

// 实例方法：获取所有祖先分类
Category.prototype.getAncestors = async function () {
  const ancestors = [];
  let current = this;

  while (current.parentId) {
    const parent = await current.getParent();
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
};

// 实例方法：获取面包屑路径
Category.prototype.getBreadcrumb = async function () {
  const ancestors = await this.getAncestors();
  return [...ancestors, this];
};

// 实例方法：是否为根分类
Category.prototype.isRoot = function () {
  return this.parentId === null;
};

// 实例方法：是否为叶子分类
Category.prototype.isLeaf = async function () {
  const childCount = await Category.count({ where: { parentId: this.id } });
  return childCount === 0;
};

// 实例方法：获取层级深度
Category.prototype.getDepth = async function () {
  const ancestors = await this.getAncestors();
  return ancestors.length;
};

// 实例方法：更新文章数量
Category.prototype.updatePostCount = async function () {
  const Post = require('./Post');
  const count = await Post.count({ where: { categoryId: this.id } });
  this.postCount = count;
  await this.save({ fields: ['postCount'], silent: true });
};

// 类方法：获取根分类
Category.findRoots = function (options = {}) {
  return this.findAll({
    where: { parentId: null },
    order: [
      ['sort_order', 'ASC'],
      ['name', 'ASC'],
    ],
    ...options,
  });
};

// 类方法：构建分类树
Category.buildTree = async function (parentId = null, maxDepth = null, currentDepth = 0) {
  if (maxDepth !== null && currentDepth >= maxDepth) {
    return [];
  }

  const categories = await this.findAll({
    where: { parentId, isActive: true },
    order: [
      ['sort_order', 'ASC'],
      ['name', 'ASC'],
    ],
  });

  const tree = [];
  for (const category of categories) {
    const children = await this.buildTree(category.id, maxDepth, currentDepth + 1);
    tree.push({
      ...category.toJSON(),
      children,
      hasChildren: children.length > 0,
      depth: currentDepth,
    });
  }

  return tree;
};

// 类方法：按别名查找分类
Category.findBySlug = function (slug) {
  return this.findOne({ where: { slug, isActive: true } });
};

// 类方法：获取热门分类
Category.findPopular = function (limit = 10) {
  return this.findAll({
    where: { isActive: true },
    order: [
      ['post_count', 'DESC'],
      ['name', 'ASC'],
    ],
    limit,
  });
};

// 类方法：搜索分类
Category.search = function (keyword, options = {}) {
  const { Op } = require('sequelize');
  return this.findAll({
    where: {
      [Op.and]: [
        { isActive: true },
        {
          [Op.or]: [
            {
              name: {
                [Op.like]: `%${keyword}%`,
              },
            },
            {
              description: {
                [Op.like]: `%${keyword}%`,
              },
            },
          ],
        },
      ],
    },
    order: [['post_count', 'DESC']],
    ...options,
  });
};

// 类方法：获取扁平化的分类列表（带层级信息）
Category.getFlatList = async function () {
  const tree = await this.buildTree();
  const flatList = [];

  const flatten = (categories, prefix = '') => {
    for (const category of categories) {
      flatList.push({
        ...category,
        displayName: prefix + category.name,
        level: category.depth,
      });

      if (category.children && category.children.length > 0) {
        flatten(category.children, prefix + '├─ ');
      }
    }
  };

  flatten(tree);
  return flatList;
};

// 类方法：获取统计信息
Category.getStats = async function () {
  const totalCategories = await this.count();
  const activeCategories = await this.count({ where: { is_active: true } });
  const rootCategories = await this.count({ where: { parent_id: null } });
  const leafCategories = await this.count({
    where: {
      id: {
        [Op.notIn]: sequelize.literal(
          '(SELECT DISTINCT parent_id FROM categories WHERE parent_id IS NOT NULL)'
        ),
      },
    },
  });

  const totalPosts = (await this.sum('post_count')) || 0;

  const topCategories = await this.findAll({
    where: { is_active: true },
    order: [['post_count', 'DESC']],
    limit: 5,
    attributes: ['id', 'name', 'post_count'],
  });

  // Calculate max depth using a simpler approach
  const maxDepthResult = await sequelize.query(
    'SELECT MAX(depth) as max_depth FROM (SELECT COUNT(*) as depth FROM categories c1 JOIN categories c2 ON c1.id = c2.parent_id GROUP BY c1.id)',
    { type: sequelize.QueryTypes.SELECT }
  );
  const maxDepth = maxDepthResult[0]?.max_depth || 0;

  return {
    total: totalCategories,
    active: activeCategories,
    inactive: totalCategories - activeCategories,
    roots: rootCategories,
    leaves: leafCategories,
    totalPosts,
    topCategories: topCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      postCount: cat.post_count,
    })),
    maxDepth: maxDepth,
  };
};

module.exports = Category;
