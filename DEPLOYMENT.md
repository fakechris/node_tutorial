# 部署和发布指南

本指南详细介绍了如何将Node.js后端教程项目部署到各种环境。

## 📋 目录

- [快速开始](#快速开始)
- [本地开发](#本地开发)
- [Docker部署](#docker部署)
- [云平台部署](#云平台部署)
- [生产环境优化](#生产环境优化)
- [监控和维护](#监控和维护)
- [故障排除](#故障排除)

## 🚀 快速开始

### 环境要求
- Node.js 18.0+
- npm 8.0+
- Docker 20.0+ (可选)
- Git

### 最简部署
```bash
# 1. 克隆项目
git clone https://github.com/your-repo/back_tutor.git
cd back_tutor

# 2. 安装依赖
npm install

# 3. 设置数据库
npm run db:setup

# 4. 启动应用
npm start
```

访问 `http://localhost:3000` 查看应用。

## 💻 本地开发

### 开发环境设置
```bash
# 1. 复制环境配置
cp .env.development .env

# 2. 启动开发服务器
npm run dev

# 3. 在另一个终端中初始化数据库
npm run db:setup
```

### 开发工具
```bash
# 语法验证
npm run validate

# 运行测试
npm run test:comprehensive

# 数据库管理
npm run migrate:status
npm run seed:status
```

## 🐳 Docker部署

### 单容器部署
```bash
# 构建镜像
docker build -t back-tutor .

# 运行容器
docker run -d \
  --name back-tutor-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secure-secret \
  back-tutor
```

### Docker Compose (推荐)

#### 生产环境
```bash
# 启动完整栈
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f app
```

#### 开发环境
```bash
# 启动开发环境
docker-compose -f docker-compose.dev.yml up -d

# 使用PostgreSQL
docker-compose -f docker-compose.dev.yml --profile with-postgres up -d
```

### Docker 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| app | 3000 | Node.js应用 |
| db | 5432 | PostgreSQL数据库 |
| redis | 6379 | Redis缓存 |
| nginx | 80/443 | 反向代理 |

## ☁️ 云平台部署

### AWS 部署

#### 使用 Elastic Beanstalk
```bash
# 1. 安装 EB CLI
pip install awsebcli

# 2. 初始化项目
eb init

# 3. 创建环境
eb create production

# 4. 部署
eb deploy
```

#### 使用 ECS + Fargate
```yaml
# task-definition.json
{
  "family": "back-tutor",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "back-tutor-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/back-tutor:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/back-tutor",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Google Cloud Platform

#### 使用 Cloud Run
```bash
# 1. 构建并推送镜像
gcloud builds submit --tag gcr.io/PROJECT-ID/back-tutor

# 2. 部署到 Cloud Run
gcloud run deploy back-tutor \
  --image gcr.io/PROJECT-ID/back-tutor \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### 使用 GKE
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: back-tutor
spec:
  replicas: 3
  selector:
    matchLabels:
      app: back-tutor
  template:
    metadata:
      labels:
        app: back-tutor
    spec:
      containers:
      - name: back-tutor
        image: gcr.io/PROJECT-ID/back-tutor:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
```

### Azure 部署

#### 使用 Container Instances
```bash
# 创建资源组
az group create --name back-tutor-rg --location eastus

# 创建容器实例
az container create \
  --resource-group back-tutor-rg \
  --name back-tutor-app \
  --image back-tutor:latest \
  --dns-name-label back-tutor \
  --ports 3000
```

### 数字海洋 (DigitalOcean)

#### 使用 App Platform
```yaml
# .do/app.yaml
name: back-tutor
services:
- name: api
  source_dir: /
  github:
    repo: your-username/back_tutor
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
databases:
- name: db
  engine: PG
  version: "13"
```

## 🔧 生产环境优化

### 环境变量配置
```bash
# 必需的生产环境变量
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-chars
SESSION_SECRET=your-super-secure-session-secret-minimum-32-chars

# 可选的优化配置
LOG_LEVEL=warn
COMPRESSION_ENABLED=true
CACHE_ENABLED=true
RATE_LIMIT_ENABLED=true

# 外部服务
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.example.com
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
```

### 性能优化

#### 1. 启用压缩
```javascript
// 在生产环境中自动启用
const compression = require('compression');
if (process.env.NODE_ENV === 'production') {
  app.use(compression());
}
```

#### 2. 设置缓存
```javascript
// Redis缓存配置
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);
```

#### 3. 数据库连接池
```javascript
// 生产环境连接池设置
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  }
});
```

### 安全配置

#### 1. SSL/TLS 配置
```nginx
# Nginx SSL配置
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

#### 2. 防火墙规则
```bash
# UFW 防火墙配置
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 📊 监控和维护

### 应用监控

#### 健康检查端点
```bash
# 基础健康检查
curl http://localhost:3000/health

# 详细系统状态
curl http://localhost:3000/api/debug/health
```

#### 日志管理
```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 使用 Docker 查看日志
docker-compose logs -f app
```

### 数据库维护

#### 备份策略
```bash
# PostgreSQL 备份
pg_dump -h localhost -U username dbname > backup.sql

# 恢复备份
psql -h localhost -U username dbname < backup.sql
```

#### 定期任务
```bash
# crontab 示例
# 每天凌晨2点备份数据库
0 2 * * * /path/to/backup-script.sh

# 每小时清理临时文件
0 * * * * find /app/temp -type f -mtime +1 -delete
```

### 性能监控

#### 使用 PM2 (生产推荐)
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start src/index.js --name back-tutor

# 监控状态
pm2 status
pm2 logs
pm2 monit
```

#### PM2 配置文件
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'back-tutor',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

## 🔄 CI/CD 流程

### GitHub Actions
项目包含完整的 CI/CD 配置文件 `.github/workflows/ci-cd.yml`，支持：

- 自动化测试
- 代码质量检查
- Docker 镜像构建
- 安全扫描
- 自动部署

### 部署流程
1. **开发分支** → 推送到 `develop` → 部署到测试环境
2. **主分支** → 推送到 `main` → 部署到生产环境
3. **Pull Request** → 触发测试和代码检查

## 🚨 故障排除

### 常见问题

#### 1. 应用无法启动
```bash
# 检查端口占用
lsof -i :3000

# 检查环境变量
echo $NODE_ENV

# 查看错误日志
npm start 2>&1 | tee startup.log
```

#### 2. 数据库连接失败
```bash
# 测试数据库连接
npm run migrate:status

# 检查数据库服务
systemctl status postgresql
```

#### 3. 内存泄漏
```bash
# 监控内存使用
top -p $(pgrep node)

# 使用 PM2 监控
pm2 monit
```

#### 4. 性能问题
```bash
# 分析慢查询
npm run db:slow-queries

# 检查响应时间
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health
```

### 日志分析

#### 应用日志位置
- 开发环境：`logs/app.log`
- 生产环境：`/var/log/back-tutor/`
- Docker：`docker logs container_name`

#### 常用日志命令
```bash
# 实时查看日志
tail -f logs/app.log

# 查找错误
grep -i error logs/app.log

# 分析访问模式
awk '{print $1}' access.log | sort | uniq -c | sort -nr
```

## 📞 技术支持

### 获取帮助
1. 查看项目文档：`DOCUMENTATION.md`
2. 检查API文档：`API.md`
3. 查看问题跟踪：GitHub Issues
4. 联系维护团队：support@example.com

### 报告问题
创建问题时请包含：
- 错误消息和堆栈跟踪
- 环境信息（OS、Node.js版本）
- 重现步骤
- 相关日志文件

---

**版本**: 1.0.0  
**最后更新**: 2025-07-29  
**维护状态**: ✅ 积极维护