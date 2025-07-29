#!/bin/bash

# 生产部署脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_NAME="back-tutor"
BACKUP_DIR="/backup"
LOG_FILE="/var/log/deploy.log"

# 函数定义
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a $LOG_FILE
    exit 1
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a $LOG_FILE
}

# 检查运行权限
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        error "请不要使用root用户运行此脚本"
    fi

    if ! command -v docker &> /dev/null; then
        error "Docker 未安装或不在PATH中"
    fi

    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose 未安装或不在PATH中"
    fi
}

# 备份当前版本
backup_current_version() {
    log "开始备份当前版本..."
    
    if [ -d "$BACKUP_DIR" ]; then
        BACKUP_NAME="${PROJECT_NAME}-$(date +%Y%m%d-%H%M%S)"
        
        # 备份数据库
        if docker-compose exec -T db pg_dump -U postgres back_tutor > "$BACKUP_DIR/${BACKUP_NAME}-db.sql"; then
            success "数据库备份完成: ${BACKUP_NAME}-db.sql"
        else
            warning "数据库备份失败，继续部署..."
        fi
        
        # 备份应用数据
        docker-compose exec -T app tar -czf - /app/logs /app/uploads > "$BACKUP_DIR/${BACKUP_NAME}-data.tar.gz" 2>/dev/null || true
        success "应用数据备份完成: ${BACKUP_NAME}-data.tar.gz"
    else
        warning "备份目录不存在，跳过备份步骤"
    fi
}

# 拉取最新代码
pull_latest_code() {
    log "拉取最新代码..."
    
    # 检查Git状态
    if [ -d ".git" ]; then
        git fetch origin
        git checkout main
        git pull origin main
        success "代码更新完成"
    else
        error "当前目录不是Git仓库"
    fi
}

# 构建新镜像
build_new_image() {
    log "构建新的Docker镜像..."
    
    # 构建生产镜像
    if docker-compose build --no-cache app; then
        success "镜像构建完成"
    else
        error "镜像构建失败"
    fi
}

# 运行迁移
run_migrations() {
    log "运行数据库迁移..."
    
    # 确保数据库服务运行
    docker-compose up -d db
    sleep 10
    
    # 运行迁移
    if docker-compose run --rm app npm run migrate:up; then
        success "数据库迁移完成"
    else
        error "数据库迁移失败"
    fi
}

# 健康检查
health_check() {
    log "执行健康检查..."
    
    # 等待服务启动
    sleep 30
    
    # 检查应用健康状态
    for i in {1..10}; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            success "健康检查通过"
            return 0
        fi
        log "健康检查尝试 $i/10 失败，等待5秒后重试..."
        sleep 5
    done
    
    error "健康检查失败，应用可能未正常启动"
}

# 部署新版本
deploy_new_version() {
    log "部署新版本..."
    
    # 停止当前服务（保留数据库）
    docker-compose stop app nginx redis
    
    # 启动新版本
    if docker-compose up -d; then
        success "新版本部署完成"
    else
        error "新版本部署失败"
    fi
}

# 回滚到上一版本
rollback() {
    warning "检测到部署失败，开始回滚..."
    
    # 停止当前服务
    docker-compose down
    
    # 恢复备份（如果存在）
    if [ -f "$BACKUP_DIR/latest-db.sql" ]; then
        log "恢复数据库备份..."
        docker-compose up -d db
        sleep 10
        docker-compose exec -T db psql -U postgres back_tutor < "$BACKUP_DIR/latest-db.sql"
    fi
    
    # 启动上一版本
    git checkout HEAD~1
    docker-compose up -d
    
    error "已回滚到上一版本"
}

# 清理旧镜像
cleanup_old_images() {
    log "清理旧的Docker镜像..."
    
    # 清理悬挂镜像
    docker image prune -f
    
    # 清理旧版本镜像（保留最近3个）
    docker images | grep "${PROJECT_NAME}" | tail -n +4 | awk '{print $3}' | xargs -r docker rmi
    
    success "镜像清理完成"
}

# 发送通知
send_notification() {
    local status=$1
    local message=$2
    
    # 这里可以集成各种通知方式
    # 例如：Slack、邮件、企业微信等
    
    if [ "$status" = "success" ]; then
        log "✅ 部署成功: $message"
    else
        log "❌ 部署失败: $message"
    fi
    
    # 发送到Slack（如果配置了webhook）
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 $PROJECT_NAME 部署$status : $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# 主部署流程
main() {
    log "开始部署 $PROJECT_NAME..."
    
    # 检查环境
    check_permissions
    
    # 设置错误处理
    trap 'rollback' ERR
    
    # 执行部署步骤
    backup_current_version
    pull_latest_code
    build_new_image
    run_migrations
    deploy_new_version
    health_check
    cleanup_old_images
    
    # 部署成功
    success "部署完成！"
    send_notification "success" "版本 $(git rev-parse --short HEAD) 部署成功"
}

# 显示使用说明
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h     显示此帮助信息"
    echo "  --backup-only  仅执行备份操作"
    echo "  --rollback     回滚到上一版本"
    echo "  --health-check 仅执行健康检查"
    echo ""
    echo "环境变量:"
    echo "  SLACK_WEBHOOK_URL  Slack通知webhook地址"
    echo "  BACKUP_DIR         备份目录（默认: /backup）"
    echo ""
}

# 处理命令行参数
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    --backup-only)
        backup_current_version
        exit 0
        ;;
    --rollback)
        rollback
        exit 0
        ;;
    --health-check)
        health_check
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "未知选项: $1"
        show_help
        exit 1
        ;;
esac