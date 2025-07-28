#!/bin/bash

# 阶段六：数据库CRUD操作测试脚本
# 测试所有数据库相关的API端点

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 服务器配置
BASE_URL="http://localhost:3000"
ADMIN_TOKEN=""
USER_TOKEN=""

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果记录
declare -a FAILED_TEST_NAMES=()

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED_TESTS++))
    FAILED_TEST_NAMES+=("$2")
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_header() {
    echo -e "\n${PURPLE}======================================${NC}"
    echo -e "${WHITE}$1${NC}"
    echo -e "${PURPLE}======================================${NC}\n"
}

# HTTP请求函数
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    local expected_status=$5
    
    ((TOTAL_TESTS++))
    
    local curl_cmd="curl -s -w \"%{http_code}\" -X $method"
    
    if [ ! -z "$token" ]; then
        curl_cmd="$curl_cmd -H \"Authorization: Bearer $token\""
    fi
    
    curl_cmd="$curl_cmd -H \"Content-Type: application/json\""
    
    if [ ! -z "$data" ]; then
        curl_cmd="$curl_cmd -d '$data'"
    fi
    
    curl_cmd="$curl_cmd \"$BASE_URL$endpoint\""
    
    local response=$(eval $curl_cmd)
    local status_code="${response: -3}"
    local body="${response%???}"
    
    if [ "$status_code" -eq "$expected_status" ]; then
        log_success "✓ $method $endpoint (状态码: $status_code)"
        echo "$body"
        return 0
    else
        log_error "✗ $method $endpoint (期望: $expected_status, 实际: $status_code)" "$method $endpoint"
        echo "响应内容: $body"
        return 1
    fi
}

# 数据库初始化函数（在认证前进行）- 确保完全幂等
initialize_database() {
    log_header "数据库完全重建初始化"
    
    log_info "完全重建数据库和创建示例数据..."
    # 使用开发模式端点，无需认证，完全重建确保幂等性
    local init_response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"withSampleData":true}' \
        "$BASE_URL/api/db/init-dev")
    
    local status_code="${init_response: -3}"
    local response_body="${init_response%???}"
    
    if [ "$status_code" -eq "200" ]; then
        local sample_data_created=$(echo "$response_body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('data', {}).get('sampleDataCreated', 'false'))
except:
    print('false')
" 2>/dev/null)
        
        if [ "$sample_data_created" = "True" ] || [ "$sample_data_created" = "true" ]; then
            log_success "数据库重建和示例数据创建成功"
        else
            log_error "示例数据创建失败" "sample data creation"
            echo "响应内容: $response_body"
            exit 1
        fi
    else
        log_error "数据库初始化失败，状态码: $status_code" "database initialization"
        echo "响应内容: $response_body"
        exit 1
    fi
    
    # 等待数据库初始化完成
    sleep 1
    log_success "数据库幂等初始化完成"
}

# 用户认证函数
authenticate() {
    log_header "用户认证测试"
    
    # 管理员登录
    log_info "管理员登录..."
    local admin_response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' "$BASE_URL/api/auth/login")
    if [ $? -eq 0 ]; then
        ADMIN_TOKEN=$(echo "$admin_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('status') == 'success':
        print(data['data']['token'])
except:
    pass
" 2>/dev/null)
        if [ ! -z "$ADMIN_TOKEN" ]; then
            log_success "管理员令牌获取成功"
            ((TOTAL_TESTS++))
            ((PASSED_TESTS++))
        else
            log_error "管理员令牌提取失败" "admin token extraction"
            ((TOTAL_TESTS++))
            echo "Admin response: $admin_response"
        fi
    fi
    
    # 普通用户登录（使用示例数据中的用户johndoe）
    log_info "普通用户登录..."
    local user_response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"username":"johndoe","password":"password123"}' "$BASE_URL/api/auth/login")
    USER_TOKEN=$(echo "$user_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('status') == 'success':
        print(data['data']['token'])
except:
    pass
" 2>/dev/null)
    
    if [ ! -z "$USER_TOKEN" ]; then
        log_success "普通用户令牌获取成功"
        ((TOTAL_TESTS++))
        ((PASSED_TESTS++))
    else
        # 如果登录失败，尝试注册新用户
        log_info "普通用户登录失败，尝试注册新的测试用户..."
        local timestamp=$(date +%s)
        local new_user_response=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"username\":\"testuser_$timestamp\",\"email\":\"testuser_$timestamp@example.com\",\"password\":\"password123\",\"firstName\":\"Test\",\"lastName\":\"User\"}" "$BASE_URL/api/auth/register")
        USER_TOKEN=$(echo "$new_user_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('status') == 'success':
        print(data['data']['token'])
except:
    pass
" 2>/dev/null)
        if [ ! -z "$USER_TOKEN" ]; then
            log_success "新用户注册并获取令牌成功"
            ((TOTAL_TESTS++))
            ((PASSED_TESTS++))
        else
            log_error "用户认证完全失败" "user authentication"
            ((TOTAL_TESTS++))
        fi
    fi
}

# 数据库初始化和基础功能测试
test_database_basic() {
    log_header "数据库初始化和基础功能测试"
    
    # 数据库健康检查
    log_info "数据库健康检查..."
    make_request "GET" "/api/db/health" "" "" 200 > /dev/null
    
    # 数据库信息
    log_info "获取数据库信息..."
    make_request "GET" "/api/db/info" "" "" 200 > /dev/null
    
    # 首先尝试不需要认证的方式初始化数据库
    log_info "初始化数据库和创建示例数据..."
    local init_response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"force":true,"withSampleData":true}' \
        "$BASE_URL/api/db/init")
    
    local status_code="${init_response: -3}"
    if [ "$status_code" -eq "200" ] || [ "$status_code" -eq "401" ]; then
        log_success "数据库初始化请求发送成功"
    else
        log_warning "数据库初始化可能失败，状态码: $status_code"
    fi
}

# 分类CRUD测试
test_categories_crud() {
    log_header "分类CRUD操作测试"
    
    # 获取分类列表
    log_info "获取分类列表..."
    make_request "GET" "/api/categories" "" "" 200 > /dev/null
    
    # 获取分类树
    log_info "获取分类树..."
    make_request "GET" "/api/categories/tree" "" "" 200 > /dev/null
    
    # 获取热门分类
    log_info "获取热门分类..."
    make_request "GET" "/api/categories/popular" "" "" 200 > /dev/null
    
    # 搜索分类
    log_info "搜索分类..."
    make_request "GET" "/api/categories/search?keyword=技术" "" "" 200 > /dev/null
    
    # 创建分类（需要版主权限）
    log_info "创建新分类..."
    local category_response=$(make_request "POST" "/api/categories" '{"name":"测试分类","description":"这是一个测试分类","color":"#FF5722"}' "$ADMIN_TOKEN" 201)
    local category_id=""
    if [ $? -eq 0 ]; then
        category_id=$(echo "$category_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_success "分类创建成功，ID: $category_id"
    fi
    
    # 获取单个分类详情
    if [ ! -z "$category_id" ]; then
        log_info "获取分类详情..."
        make_request "GET" "/api/categories/$category_id?includeStats=true" "" "" 200 > /dev/null
        
        # 更新分类
        log_info "更新分类..."
        make_request "PUT" "/api/categories/$category_id" '{"description":"更新后的分类描述","color":"#2196F3"}' "$ADMIN_TOKEN" 200 > /dev/null
        
        # 删除分类
        log_info "删除分类..."
        make_request "DELETE" "/api/categories/$category_id" "" "$ADMIN_TOKEN" 200 > /dev/null
    fi
    
    # 分类统计
    log_info "获取分类统计..."
    make_request "GET" "/api/categories/stats" "" "$ADMIN_TOKEN" 200 > /dev/null
}

# 用户CRUD测试
test_users_crud() {
    log_header "用户CRUD操作测试"
    
    # 获取用户列表（管理员权限）
    log_info "获取用户列表..."
    make_request "GET" "/api/users?page=1&limit=10" "" "$ADMIN_TOKEN" 200 > /dev/null
    
    # 创建用户（管理员权限）
    log_info "创建新用户..."
    local user_response=$(make_request "POST" "/api/users" '{"username":"testuser2","email":"testuser2@example.com","password":"password123","firstName":"Test","lastName":"User2","role":"user"}' "$ADMIN_TOKEN" 201)
    local user_id=""
    if [ $? -eq 0 ]; then
        user_id=$(echo "$user_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_success "用户创建成功，ID: $user_id"
    fi
    
    # 获取单个用户详情
    if [ ! -z "$user_id" ]; then
        log_info "获取用户详情..."
        make_request "GET" "/api/users/$user_id?includeStats=true" "" "$ADMIN_TOKEN" 200 > /dev/null
        
        # 更新用户
        log_info "更新用户..."
        make_request "PUT" "/api/users/$user_id" '{"firstName":"Updated","bio":"更新后的用户简介"}' "$ADMIN_TOKEN" 200 > /dev/null
        
        # 获取用户统计
        log_info "获取用户统计..."
        make_request "GET" "/api/users/$user_id/stats" "" "$ADMIN_TOKEN" 200 > /dev/null
        
        # 重置密码
        log_info "重置用户密码..."
        make_request "POST" "/api/users/$user_id/reset-password" '{"newPassword":"newpassword123"}' "$ADMIN_TOKEN" 200 > /dev/null
        
        # 删除用户
        log_info "删除用户..."
        make_request "DELETE" "/api/users/$user_id" "" "$ADMIN_TOKEN" 200 > /dev/null
    fi
}

# 文章CRUD测试
test_posts_crud() {
    log_header "文章CRUD操作测试"
    
    # 获取文章列表
    log_info "获取文章列表..."
    make_request "GET" "/api/posts?page=1&limit=10" "" "" 200 > /dev/null
    
    # 创建文章（需要认证）
    log_info "创建新文章..."
    local post_response=$(make_request "POST" "/api/posts" '{"title":"测试文章","content":"这是一篇测试文章的内容，用于验证文章CRUD功能。","summary":"测试文章摘要","tags":["测试","API","Node.js"],"status":"draft"}' "$USER_TOKEN" 201)
    local post_id=""
    if [ $? -eq 0 ]; then
        post_id=$(echo "$post_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_success "文章创建成功，ID: $post_id"
    fi
    
    # 文章相关操作
    if [ ! -z "$post_id" ]; then
        # 获取文章详情
        log_info "获取文章详情..."
        make_request "GET" "/api/posts/$post_id" "" "" 200 > /dev/null
        
        # 更新文章
        log_info "更新文章..."
        make_request "PUT" "/api/posts/$post_id" '{"title":"更新后的测试文章","content":"更新后的文章内容"}' "$USER_TOKEN" 200 > /dev/null
        
        # 发布文章
        log_info "发布文章..."
        make_request "POST" "/api/posts/$post_id/publish" "" "$USER_TOKEN" 200 > /dev/null
        
        # 点赞文章
        log_info "点赞文章..."
        make_request "POST" "/api/posts/$post_id/like" "" "" 200 > /dev/null
        
        # 获取文章统计
        log_info "获取文章统计..."
        make_request "GET" "/api/posts/$post_id/stats" "" "$ADMIN_TOKEN" 200 > /dev/null
        
        # 取消发布
        log_info "取消发布文章..."
        make_request "POST" "/api/posts/$post_id/unpublish" "" "$USER_TOKEN" 200 > /dev/null
        
        # 删除文章
        log_info "删除文章..."
        make_request "DELETE" "/api/posts/$post_id" "" "$USER_TOKEN" 200 > /dev/null
    fi
}

# 评论CRUD测试
test_comments_crud() {
    log_header "评论CRUD操作测试"
    
    # 首先创建一篇文章用于测试评论
    log_info "创建测试文章用于评论测试..."
    local post_response=$(make_request "POST" "/api/posts" '{"title":"评论测试文章","content":"这是用于测试评论功能的文章","status":"published","allowComments":true}' "$USER_TOKEN" 201)
    local post_id=""
    if [ $? -eq 0 ]; then
        post_id=$(echo "$post_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        log_success "测试文章创建成功，ID: $post_id"
    fi
    
    if [ ! -z "$post_id" ]; then
        # 获取文章评论
        log_info "获取文章评论列表..."
        make_request "GET" "/api/posts/$post_id/comments" "" "" 200 > /dev/null
        
        # 创建评论
        log_info "创建评论..."
        local comment_response=$(make_request "POST" "/api/posts/$post_id/comments" '{"content":"这是一个测试评论"}' "$USER_TOKEN" 201)
        local comment_id=""
        if [ $? -eq 0 ]; then
            comment_id=$(echo "$comment_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
            log_success "评论创建成功，ID: $comment_id"
        fi
        
        # 评论相关操作
        if [ ! -z "$comment_id" ]; then
            # 获取评论详情
            log_info "获取评论详情..."
            make_request "GET" "/api/posts/$post_id/comments/$comment_id" "" "" 200 > /dev/null
            
            # 更新评论
            log_info "更新评论..."
            make_request "PUT" "/api/posts/$post_id/comments/$comment_id" '{"content":"更新后的评论内容"}' "$USER_TOKEN" 200 > /dev/null
            
            # 创建回复评论
            log_info "创建回复评论..."
            local reply_response=$(make_request "POST" "/api/posts/$post_id/comments" '{"content":"这是一个回复评论","parentId":'$comment_id'}' "$ADMIN_TOKEN" 201)
            local reply_id=""
            if [ $? -eq 0 ]; then
                reply_id=$(echo "$reply_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
                log_success "回复评论创建成功，ID: $reply_id"
            fi
            
            # 删除回复评论
            if [ ! -z "$reply_id" ]; then
                log_info "删除回复评论..."
                make_request "DELETE" "/api/posts/$post_id/comments/$reply_id" "" "$ADMIN_TOKEN" 200 > /dev/null
            fi
            
            # 删除原评论
            log_info "删除评论..."
            make_request "DELETE" "/api/posts/$post_id/comments/$comment_id" "" "$USER_TOKEN" 200 > /dev/null
        fi
        
        # 删除测试文章
        log_info "删除测试文章..."
        make_request "DELETE" "/api/posts/$post_id" "" "$USER_TOKEN" 200 > /dev/null
    fi
}

# 权限控制测试
test_permissions() {
    log_header "权限控制测试"
    
    # 未认证用户访问需要认证的端点
    log_info "测试未认证访问..."
    make_request "GET" "/api/users" "" "" 401 > /dev/null
    
    # 普通用户访问管理员端点
    log_info "测试权限不足访问..."
    make_request "POST" "/api/users" '{"username":"test","email":"test@test.com","password":"123456"}' "$USER_TOKEN" 403 > /dev/null
    
    # 测试用户只能访问自己的信息
    log_info "测试用户访问权限..."
    make_request "GET" "/api/users/1" "" "$USER_TOKEN" 403 > /dev/null
}

# 批量操作测试
test_batch_operations() {
    log_header "批量操作测试"
    
    # 创建多个测试用户用于批量操作
    log_info "创建测试用户用于批量操作..."
    local user1_response=$(make_request "POST" "/api/users" '{"username":"batchuser1","email":"batchuser1@example.com","password":"password123"}' "$ADMIN_TOKEN" 201)
    local user2_response=$(make_request "POST" "/api/users" '{"username":"batchuser2","email":"batchuser2@example.com","password":"password123"}' "$ADMIN_TOKEN" 201)
    
    local user1_id=""
    local user2_id=""
    if [ $? -eq 0 ]; then
        user1_id=$(echo "$user1_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
        user2_id=$(echo "$user2_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    fi
    
    if [ ! -z "$user1_id" ] && [ ! -z "$user2_id" ]; then
        # 批量激活用户
        log_info "批量激活用户..."
        make_request "POST" "/api/users/batch" '{"operation":"activate","userIds":['$user1_id','$user2_id']}' "$ADMIN_TOKEN" 200 > /dev/null
        
        # 批量删除用户
        log_info "批量删除用户..."
        make_request "POST" "/api/users/batch" '{"operation":"delete","userIds":['$user1_id','$user2_id']}' "$ADMIN_TOKEN" 200 > /dev/null
    fi
}

# 数据验证测试
test_data_validation() {
    log_header "数据验证测试"
    
    # 测试无效数据
    log_info "测试无效用户名..."
    make_request "POST" "/api/users" '{"username":"ab","email":"invalid-email","password":"123"}' "$ADMIN_TOKEN" 400 > /dev/null
    
    # 测试重复数据
    log_info "测试重复用户名..."
    make_request "POST" "/api/users" '{"username":"admin","email":"admin2@example.com","password":"password123"}' "$ADMIN_TOKEN" 409 > /dev/null
    
    # 测试空标题文章
    log_info "测试空标题文章..."
    make_request "POST" "/api/posts" '{"title":"","content":"内容"}' "$USER_TOKEN" 400 > /dev/null
}

# 搜索和过滤测试
test_search_and_filtering() {
    log_header "搜索和过滤测试"
    
    # 用户搜索
    log_info "测试用户搜索..."
    make_request "GET" "/api/users?search=admin&page=1&limit=5" "" "$ADMIN_TOKEN" 200 > /dev/null
    
    # 文章过滤
    log_info "测试文章状态过滤..."
    make_request "GET" "/api/posts?status=published&page=1&limit=5" "" "" 200 > /dev/null
    
    # 分类搜索
    log_info "测试分类搜索..."
    make_request "GET" "/api/categories/search?keyword=技术&limit=5" "" "" 200 > /dev/null
}

# 显示测试总结
show_summary() {
    log_header "测试总结"
    
    echo -e "${WHITE}总测试数: $TOTAL_TESTS${NC}"
    echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "${RED}失败: $FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        echo -e "\n${RED}失败的测试:${NC}"
        for test_name in "${FAILED_TEST_NAMES[@]}"; do
            echo -e "${RED}  ✗ $test_name${NC}"
        done
    fi
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "\n${WHITE}成功率: ${success_rate}%${NC}"
    
    if [ $success_rate -ge 90 ]; then
        echo -e "${GREEN}🎉 测试结果优秀！${NC}"
    elif [ $success_rate -ge 80 ]; then
        echo -e "${YELLOW}⚠️  测试结果良好，但仍需改进${NC}"
    else
        echo -e "${RED}❌ 测试结果需要改进${NC}"
    fi
}

# 主测试函数
main() {
    log_header "Node.js后端数据库CRUD操作测试"
    
    echo -e "${CYAN}测试服务器: $BASE_URL${NC}"
    echo -e "${CYAN}开始时间: $(date)${NC}\n"
    
    # 检查服务器是否运行
    log_info "检查服务器连接..."
    if ! curl -s "$BASE_URL/health" > /dev/null; then
        log_error "无法连接到服务器，请确保服务器在 $BASE_URL 上运行" "server connection"
        exit 1
    fi
    log_success "服务器连接正常"
    
    # 执行所有测试
    initialize_database  # 先初始化数据库
    authenticate         # 然后进行认证
    test_database_basic
    test_categories_crud
    test_users_crud
    test_posts_crud
    test_comments_crud
    test_permissions
    test_batch_operations
    test_data_validation
    test_search_and_filtering
    
    # 显示测试总结
    show_summary
    echo -e "\n${CYAN}测试完成时间: $(date)${NC}"
}

# 检查依赖
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 需要安装 python3 来解析JSON响应${NC}"
    exit 1
fi

# 运行主函数
main "$@"