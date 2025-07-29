#!/bin/bash

# 服务器初始化设置脚本
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
USER_NAME="deploy"
PROJECT_NAME="back-tutor"
PROJECT_DIR="/opt/$PROJECT_NAME"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# 函数定义
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "此脚本需要root权限运行"
    fi
}

# 更新系统
update_system() {
    log "更新系统包..."
    apt-get update
    apt-get upgrade -y
    success "系统更新完成"
}

# 安装基础软件
install_basic_packages() {
    log "安装基础软件包..."
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        htop \
        vim \
        tree
    success "基础软件包安装完成"
}

# 安装Node.js
install_nodejs() {
    log "安装Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # 验证安装
    node_version=$(node --version)
    npm_version=$(npm --version)
    success "Node.js安装完成: $node_version, npm: $npm_version"
}

# 安装Docker
install_docker() {
    log "安装Docker..."
    
    # 添加Docker官方GPG密钥
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # 添加Docker APT仓库
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # 启动Docker服务
    systemctl start docker
    systemctl enable docker
    
    success "Docker安装完成: $(docker --version)"
}

# 安装Docker Compose
install_docker_compose() {
    log "安装Docker Compose..."
    
    # 下载最新版本的Docker Compose
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # 设置执行权限
    chmod +x /usr/local/bin/docker-compose
    
    # 创建软链接
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    success "Docker Compose安装完成: $(docker-compose --version)"
}

# 安装Nginx
install_nginx() {
    log "安装Nginx..."
    apt-get install -y nginx
    
    # 启动Nginx服务
    systemctl start nginx
    systemctl enable nginx
    
    success "Nginx安装完成: $(nginx -v 2>&1)"
}

# 安装PostgreSQL客户端
install_postgresql_client() {
    log "安装PostgreSQL客户端..."
    apt-get install -y postgresql-client-13
    success "PostgreSQL客户端安装完成"
}

# 创建部署用户
create_deploy_user() {
    log "创建部署用户: $USER_NAME"
    
    # 创建用户
    if ! id "$USER_NAME" &>/dev/null; then
        useradd -m -s /bin/bash "$USER_NAME"
        success "用户 $USER_NAME 创建完成"
    else
        warning "用户 $USER_NAME 已存在"
    fi
    
    # 添加到docker组
    usermod -aG docker "$USER_NAME"
    
    # 设置SSH密钥（如果提供）
    if [ -n "$SSH_PUBLIC_KEY" ]; then
        USER_HOME="/home/$USER_NAME"
        mkdir -p "$USER_HOME/.ssh"
        echo "$SSH_PUBLIC_KEY" > "$USER_HOME/.ssh/authorized_keys"
        chmod 700 "$USER_HOME/.ssh"
        chmod 600 "$USER_HOME/.ssh/authorized_keys"
        chown -R "$USER_NAME:$USER_NAME" "$USER_HOME/.ssh"
        success "SSH密钥配置完成"
    fi
}

# 创建项目目录
create_project_directory() {
    log "创建项目目录: $PROJECT_DIR"
    mkdir -p "$PROJECT_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/backups"
    mkdir -p "$PROJECT_DIR/uploads"
    chown -R "$USER_NAME:$USER_NAME" "$PROJECT_DIR"
    success "项目目录创建完成"
}

# 配置防火墙
configure_firewall() {
    log "配置防火墙..."
    
    # 重置UFW规则
    ufw --force reset
    
    # 设置默认策略
    ufw default deny incoming
    ufw default allow outgoing
    
    # 允许SSH
    ufw allow 22/tcp
    
    # 允许HTTP和HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # 允许应用端口（内网）
    ufw allow from 10.0.0.0/8 to any port 3000
    ufw allow from 172.16.0.0/12 to any port 3000
    ufw allow from 192.168.0.0/16 to any port 3000
    
    # 启用防火墙
    ufw --force enable
    
    success "防火墙配置完成"
}

# 配置Nginx
configure_nginx() {
    log "配置Nginx..."
    
    # 创建项目Nginx配置
    cat > "$NGINX_AVAILABLE/$PROJECT_NAME" << 'EOF'
server {
    listen 80;
    server_name _;
    
    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # 代理到应用
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
}
EOF
    
    # 启用站点配置
    ln -sf "$NGINX_AVAILABLE/$PROJECT_NAME" "$NGINX_ENABLED/"
    
    # 删除默认配置
    rm -f "$NGINX_ENABLED/default"
    
    # 测试配置
    nginx -t
    
    # 重新加载Nginx
    systemctl reload nginx
    
    success "Nginx配置完成"
}

# 设置日志轮转
setup_log_rotation() {
    log "设置日志轮转..."
    
    cat > "/etc/logrotate.d/$PROJECT_NAME" << EOF
$PROJECT_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        systemctl reload nginx
    endscript
}
EOF
    
    success "日志轮转配置完成"
}

# 设置定时任务
setup_cron_jobs() {
    log "设置定时任务..."
    
    # 创建备份脚本
    cat > "$PROJECT_DIR/backup.sh" << 'EOF'
#!/bin/bash
cd /opt/back-tutor
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
docker-compose exec -T db pg_dump -U postgres back_tutor > "$BACKUP_DIR/db_backup_$DATE.sql"

# 删除7天前的备份
find "$BACKUP_DIR" -name "db_backup_*.sql" -mtime +7 -delete

# 备份应用数据
tar -czf "$BACKUP_DIR/app_data_$DATE.tar.gz" logs uploads
find "$BACKUP_DIR" -name "app_data_*.tar.gz" -mtime +7 -delete
EOF
    
    chmod +x "$PROJECT_DIR/backup.sh"
    chown "$USER_NAME:$USER_NAME" "$PROJECT_DIR/backup.sh"
    
    # 添加到部署用户的crontab
    sudo -u "$USER_NAME" crontab -l > /tmp/crontab_temp 2>/dev/null || true
    echo "0 2 * * * $PROJECT_DIR/backup.sh" >> /tmp/crontab_temp
    sudo -u "$USER_NAME" crontab /tmp/crontab_temp
    rm -f /tmp/crontab_temp
    
    success "定时任务设置完成"
}

# 优化系统性能
optimize_system() {
    log "优化系统性能..."
    
    # 调整内核参数
    cat >> /etc/sysctl.conf << EOF

# Back Tutor优化参数
net.core.somaxconn = 1024
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
vm.swappiness = 10
fs.file-max = 65536
EOF
    
    # 应用内核参数
    sysctl -p
    
    # 设置文件描述符限制
    cat >> /etc/security/limits.conf << EOF
$USER_NAME soft nofile 65536
$USER_NAME hard nofile 65536
EOF
    
    success "系统性能优化完成"
}

# 安装监控工具
install_monitoring() {
    log "安装监控工具..."
    
    # 安装htop和iotop
    apt-get install -y htop iotop
    
    # 安装Docker监控工具
    docker run -d \
        --name=cadvisor \
        --restart=always \
        --volume=/:/rootfs:ro \
        --volume=/var/run:/var/run:ro \
        --volume=/sys:/sys:ro \
        --volume=/var/lib/docker/:/var/lib/docker:ro \
        --volume=/dev/disk/:/dev/disk:ro \
        --publish=8080:8080 \
        --detach=true \
        gcr.io/cadvisor/cadvisor:latest
    
    success "监控工具安装完成 (cAdvisor运行在端口8080)"
}

# 创建部署脚本
create_deployment_script() {
    log "创建部署脚本..."
    
    # 复制部署脚本到项目目录
    if [ -f "./scripts/deploy.sh" ]; then
        cp "./scripts/deploy.sh" "$PROJECT_DIR/"
        chmod +x "$PROJECT_DIR/deploy.sh"
        chown "$USER_NAME:$USER_NAME" "$PROJECT_DIR/deploy.sh"
        success "部署脚本复制完成"
    else
        warning "部署脚本不存在，请手动复制"
    fi
}

# 显示完成信息
show_completion_info() {
    echo ""
    success "🎉 服务器设置完成！"
    echo ""
    echo -e "${BLUE}📋 设置信息摘要:${NC}"
    echo "  • 部署用户: $USER_NAME"
    echo "  • 项目目录: $PROJECT_DIR"
    echo "  • Node.js版本: $(node --version)"
    echo "  • Docker版本: $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"
    echo "  • Nginx状态: $(systemctl is-active nginx)"
    echo ""
    echo -e "${BLUE}🔧 下一步操作:${NC}"
    echo "  1. 使用部署用户登录: sudo su - $USER_NAME"
    echo "  2. 克隆项目代码到: $PROJECT_DIR"
    echo "  3. 配置环境变量文件"
    echo "  4. 运行部署脚本: ./deploy.sh"
    echo ""
    echo -e "${BLUE}🔗 访问地址:${NC}"
    echo "  • 应用: http://$(curl -s ifconfig.me)"
    echo "  • 监控: http://$(curl -s ifconfig.me):8080"
    echo ""
    echo -e "${YELLOW}⚠️  安全提醒:${NC}"
    echo "  • 请及时修改默认密码"
    echo "  • 配置SSL证书（推荐使用Let's Encrypt）"
    echo "  • 定期更新系统和软件包"
    echo ""
}

# 主函数
main() {
    echo -e "${BLUE}🚀 开始设置 $PROJECT_NAME 服务器环境...${NC}"
    echo ""
    
    check_root
    update_system
    install_basic_packages
    install_nodejs
    install_docker
    install_docker_compose
    install_nginx
    install_postgresql_client
    create_deploy_user
    create_project_directory
    configure_firewall
    configure_nginx
    setup_log_rotation
    setup_cron_jobs
    optimize_system
    install_monitoring
    create_deployment_script
    
    show_completion_info
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h        显示此帮助信息"
    echo "  --user USER       指定部署用户名 (默认: deploy)"
    echo "  --project NAME    指定项目名称 (默认: back-tutor)"
    echo ""
    echo "环境变量:"
    echo "  SSH_PUBLIC_KEY    部署用户的SSH公钥"
    echo ""
}

# 处理命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --user)
            USER_NAME="$2"
            shift 2
            ;;
        --project)
            PROJECT_NAME="$2"
            PROJECT_DIR="/opt/$PROJECT_NAME"
            shift 2
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 运行主函数
main