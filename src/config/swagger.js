// Swagger API 文档配置
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

// Swagger 定义
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Node.js 后端教程 API',
    version: '1.0.0',
    description: `
      这是一个完整的 Node.js 后端开发教程项目的 API 文档。
      
      ## 功能特性
      - 用户认证和授权 (JWT)
      - 用户管理系统
      - 文章和分类管理
      - 评论系统
      - 文件上传
      - 实时日志和调试
      
      ## 认证方式
      该 API 使用 JWT (JSON Web Token) 进行认证。在需要认证的端点中，
      请在请求头中包含: \`Authorization: Bearer <token>\`
      
      ## 响应格式
      所有 API 响应都遵循统一格式：
      \`\`\`json
      {
        "success": true,
        "data": {...},
        "message": "操作成功",
        "timestamp": "2023-12-01T10:00:00.000Z"
      }
      \`\`\`
      
      错误响应格式：
      \`\`\`json
      {
        "success": false,
        "error": "错误类型",  
        "message": "详细错误信息",
        "timestamp": "2023-12-01T10:00:00.000Z"
      }
      \`\`\`
    `,
    contact: {
      name: 'Back Tutor',
      email: 'support@backtutor.com',
      url: 'https://github.com/your-repo/back_tutor'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: '开发环境'
    },
    {
      url: 'https://api.backtutor.com',
      description: '生产环境'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT 认证令牌'
      }
    },
    schemas: {
      // 通用响应结构
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            description: '响应数据'
          },
          message: {
            type: 'string',
            example: '操作成功'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            example: 'ValidationError'
          },
          message: {
            type: 'string',
            example: '输入数据验证失败'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z'
          }
        }
      },
      // 分页响应结构
      PaginatedResponse: {
        allOf: [
          { $ref: '#/components/schemas/SuccessResponse' },
          {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    description: '数据项列表'
                  },
                  pagination: {
                    $ref: '#/components/schemas/PaginationInfo'
                  }
                }
              }
            }
          }
        ]
      },
      PaginationInfo: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            minimum: 1,
            example: 1,
            description: '当前页码'
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            example: 10,
            description: '每页条数'
          },
          total: {
            type: 'integer',
            minimum: 0,
            example: 100,
            description: '总记录数'
          },
          totalPages: {
            type: 'integer',
            minimum: 0,
            example: 10,
            description: '总页数'
          }
        }
      },
      // 用户相关模型
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
            description: '用户唯一标识符'
          },
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            example: 'johndoe',
            description: '用户名'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com',
            description: '电子邮箱'
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            example: 'John',
            description: '名字'
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            example: 'Doe',
            description: '姓氏'
          },
          bio: {
            type: 'string',
            maxLength: 500,
            example: '这是我的个人简介',
            description: '个人简介'
          },
          avatar: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/avatar.jpg',
            description: '头像URL'
          },
          isActive: {
            type: 'boolean',
            example: true,
            description: '账户是否激活'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '创建时间'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '更新时间'
          }
        },
        required: ['id', 'username', 'email', 'createdAt', 'updatedAt']
      },
      UserInput: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 30,
            example: 'johndoe',
            description: '用户名'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'john@example.com',
            description: '电子邮箱'
          },
          password: {
            type: 'string',
            minLength: 8,
            example: 'SecurePassword123!',
            description: '密码（至少8位，包含大小写字母和数字）'
          },
          firstName: {
            type: 'string',
            maxLength: 50,
            example: 'John',
            description: '名字'
          },
          lastName: {
            type: 'string',
            maxLength: 50,
            example: 'Doe',
            description: '姓氏'
          },
          bio: {
            type: 'string',
            maxLength: 500,
            example: '这是我的个人简介',
            description: '个人简介'
          }
        },
        required: ['username', 'email', 'password']
      },
      // 分类相关模型
      Category: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
            description: '分类唯一标识符'
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            example: '技术',
            description: '分类名称'
          },
          description: {
            type: 'string',
            maxLength: 500,
            example: '技术相关的文章分类',
            description: '分类描述'
          },
          slug: {
            type: 'string',
            example: 'technology',
            description: 'URL友好的分类标识'
          },
          color: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            example: '#3498db',
            description: '分类颜色（十六进制）'
          },
          isActive: {
            type: 'boolean',
            example: true,
            description: '分类是否激活'
          },
          postCount: {
            type: 'integer',
            minimum: 0,
            example: 25,
            description: '该分类下的文章数量'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '创建时间'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '更新时间'
          }
        },
        required: ['id', 'name', 'createdAt', 'updatedAt']
      },
      CategoryInput: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            example: '技术',
            description: '分类名称'
          },
          description: {
            type: 'string',
            maxLength: 500,
            example: '技术相关的文章分类',
            description: '分类描述'
          },
          color: {
            type: 'string',
            pattern: '^#[0-9A-Fa-f]{6}$',
            example: '#3498db',
            description: '分类颜色（十六进制）'
          },
          isActive: {
            type: 'boolean',
            example: true,
            description: '分类是否激活'
          }
        },
        required: ['name']
      },
      // 文章相关模型
      Post: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
            description: '文章唯一标识符'
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            example: 'Node.js 后端开发指南',
            description: '文章标题'
          },
          content: {
            type: 'string',
            example: '这是一篇关于 Node.js 后端开发的详细指南...',
            description: '文章内容'
          },
          excerpt: {
            type: 'string',
            maxLength: 500,
            example: '本文介绍了 Node.js 后端开发的基础知识...',
            description: '文章摘要'
          },
          slug: {
            type: 'string',
            example: 'nodejs-backend-guide',
            description: 'URL友好的文章标识'
          },
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived'],
            example: 'published',
            description: '文章状态'
          },
          featured: {
            type: 'boolean',
            example: false,
            description: '是否为精选文章'
          },
          viewCount: {
            type: 'integer',
            minimum: 0,
            example: 150,
            description: '阅读次数'
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
            example: 25,
            description: '点赞次数'
          },
          commentCount: {
            type: 'integer',
            minimum: 0,
            example: 10,
            description: '评论数量'
          },
          authorId: {
            type: 'integer',
            example: 1,
            description: '作者ID'
          },
          categoryId: {
            type: 'integer',
            example: 1,
            description: '分类ID'
          },
          author: {
            $ref: '#/components/schemas/User',
            description: '文章作者信息'
          },
          category: {
            $ref: '#/components/schemas/Category',
            description: '文章分类信息'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['nodejs', 'backend', 'tutorial'],
            description: '文章标签'
          },
          publishedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '发布时间'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '创建时间'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '更新时间'
          }
        },
        required: ['id', 'title', 'content', 'status', 'authorId', 'createdAt', 'updatedAt']
      },
      PostInput: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            example: 'Node.js 后端开发指南',
            description: '文章标题'
          },
          content: {
            type: 'string',
            minLength: 1,
            example: '这是一篇关于 Node.js 后端开发的详细指南...',
            description: '文章内容'
          },
          excerpt: {
            type: 'string',
            maxLength: 500,
            example: '本文介绍了 Node.js 后端开发的基础知识...',
            description: '文章摘要'
          },
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived'],
            example: 'published',
            description: '文章状态'
          },
          featured: {
            type: 'boolean',
            example: false,
            description: '是否为精选文章'
          },
          categoryId: {
            type: 'integer',
            example: 1,
            description: '分类ID'
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['nodejs', 'backend', 'tutorial'],
            description: '文章标签'
          }
        },
        required: ['title', 'content', 'status']
      },
      // 评论相关模型
      Comment: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
            description: '评论唯一标识符'
          },
          content: {
            type: 'string',
            minLength: 1,
            maxLength: 1000,
            example: '这篇文章写得很好，学到了很多！',
            description: '评论内容'
          },
          authorId: {
            type: 'integer',
            example: 1,
            description: '评论者ID'
          },
          postId: {
            type: 'integer',
            example: 1,
            description: '文章ID'
          },
          parentId: {
            type: 'integer',
            nullable: true,
            example: null,
            description: '父评论ID（用于回复）'
          },
          author: {
            $ref: '#/components/schemas/User',
            description: '评论者信息'
          },
          replies: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Comment'
            },
            description: '回复列表'
          },
          replyCount: {
            type: 'integer',
            minimum: 0,
            example: 2,
            description: '回复数量'
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
            example: 5,
            description: '点赞次数'
          },
          isEdited: {
            type: 'boolean',
            example: false,
            description: '是否已编辑'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '创建时间'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2023-12-01T10:00:00.000Z',
            description: '更新时间'
          }
        },
        required: ['id', 'content', 'authorId', 'postId', 'createdAt', 'updatedAt']
      },
      CommentInput: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            minLength: 1,
            maxLength: 1000,
            example: '这篇文章写得很好，学到了很多！',
            description: '评论内容'
          },
          parentId: {
            type: 'integer',
            nullable: true,
            example: null,
            description: '父评论ID（用于回复）'
          }
        },
        required: ['content']
      }
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: '页码',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: '每页条数',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10
        }
      },
      SearchParam: {
        name: 'search',
        in: 'query',
        description: '搜索关键词',
        required: false,
        schema: {
          type: 'string'
        }
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: '排序字段',
        required: false,
        schema: {
          type: 'string',
          enum: ['createdAt', 'updatedAt', 'title', 'viewCount', 'likeCount']
        }
      },
      OrderParam: {
        name: 'order',
        in: 'query',
        description: '排序方向',
        required: false,
        schema: {
          type: 'string',
          enum: ['asc', 'desc'],
          default: 'desc'
        }
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ],
  tags: [
    {
      name: 'Authentication',
      description: '用户认证相关接口'
    },
    {
      name: 'Users',
      description: '用户管理接口'
    },
    {
      name: 'Categories',
      description: '分类管理接口'
    },
    {
      name: 'Posts',
      description: '文章管理接口'
    },
    {
      name: 'Comments',
      description: '评论管理接口'
    },
    {
      name: 'Debug',
      description: '调试和系统信息接口'
    }
  ]
};

// Swagger 配置选项
const options = {
  definition: swaggerDefinition,
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js'),
    path.join(__dirname, '../models/*.js')
  ]
};

// 生成 Swagger 规范
const swaggerSpec = swaggerJSDoc(options);

// 自定义 Swagger UI 配置
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #3498db }
    .swagger-ui .scheme-container { background: #f8f9fa; padding: 10px; border-radius: 5px }
  `,
  customSiteTitle: 'Node.js 后端教程 API 文档',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 3,
    docExpansion: 'list',
    supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
  }
};

module.exports = {
  swaggerSpec,
  swaggerUi,
  swaggerUiOptions
};