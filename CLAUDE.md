# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the `back_tutor` repository - currently a new project in its initial setup phase.

## Current State

- Express.js 4.19.2 框架已配置
- 完成阶段一：项目初始化与框架搭建
- 完成阶段二：中间件开发与实践
- 自定义中间件已实现：日志记录、错误处理、参数验证、CORS

## Development Workflow

### 开发命令

```bash
# 开发模式启动（自动重启）
npm run dev

# 生产模式启动
npm start

# 安装依赖
npm install
```

### 测试命令

```bash
# 测试根路由
curl http://localhost:3000/

# 测试健康检查
curl http://localhost:3000/health

# 测试参数验证
curl -X POST http://localhost:3000/api/test/validation \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com"}'

# 测试错误处理
curl http://localhost:3000/api/test/error
```

## Notes for Future Development

- Update this file as the project architecture and build system are established
- Document key commands for building, testing, and running the application
- Include information about the chosen technology stack and frameworks
- Add guidance on project structure and coding conventions once established