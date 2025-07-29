#!/bin/bash

# 阶段八：综合性能测试套件
# 完整测试所有已实现的功能模块

echo "🚀 Node.js 后端开发教程 - 综合测试套件"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果记录函数
record_test() {
    local test_name="$1"
    local status="$2"
    local response="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo "✅ $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo "❌ $test_name"
        echo "   响应: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# 等待服务器启动
wait_for_server() {
    echo "⏳ 等待服务器启动..."
    for i in {1..30}; do
        if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
            echo "✅ 服务器已启动"
            return 0
        fi
        echo "   第 $i 次尝试连接..."
        sleep 1
    done
    echo "❌ 服务器启动超时"
    exit 1
}

# 初始化数据库
initialize_database() {
    echo ""
    echo "🗄️  初始化数据库"
    echo "================"
    
    local init_response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{"withSampleData":true}' \
        "$BASE_URL/api/db/init-dev")
    
    if echo "$init_response" | grep -q "success"; then
        record_test "数据库初始化" "PASS" "$init_response"
    else
        record_test "数据库初始化" "FAIL" "$init_response"
        return 1
    fi
}

# 测试认证系统
test_authentication() {
    echo ""
    echo "🔐 测试认证系统"
    echo "==============="
    
    # 测试用户注册
    local register_response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{
            "username": "testuser", 
            "email": "test@example.com", 
            "password": "Test123!@#",
            "firstName": "Test",
            "lastName": "User"
        }' \
        "$BASE_URL/api/auth/register")
    
    if echo "$register_response" | grep -q "success"; then
        record_test "用户注册" "PASS"
    else
        record_test "用户注册" "FAIL" "$register_response"
    fi
    
    # 测试用户登录
    local login_response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{
            "username": "testuser", 
            "password": "Test123!@#"
        }' \
        "$BASE_URL/api/auth/login")
    
    if echo "$login_response" | grep -q "token"; then
        record_test "用户登录" "PASS"
        # 提取token
        TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        echo "   Token已获取: ${TOKEN:0:20}..."
    else
        record_test "用户登录" "FAIL" "$login_response"
        TOKEN=""
    fi
    
    # 测试需要认证的端点
    if [ -n "$TOKEN" ]; then
        local profile_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$BASE_URL/api/auth/profile")
        
        if echo "$profile_response" | grep -q "testuser"; then
            record_test "认证保护端点访问" "PASS"
        else
            record_test "认证保护端点访问" "FAIL" "$profile_response"
        fi
    fi
    
    # 创建管理员用户用于测试需要管理员权限的功能
    local admin_register_response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{
            "username": "adminuser", 
            "email": "admin@example.com", 
            "password": "Admin123!@#",
            "firstName": "Admin",
            "lastName": "User"
        }' \
        "$BASE_URL/api/auth/register")
    
    if echo "$admin_register_response" | grep -q "success"; then
        # 使用系统默认管理员账户（如果存在示例数据）
        local admin_login_response=$(curl -s -X POST -H "Content-Type: application/json" \
            -d '{
                "username": "admin", 
                "password": "admin123"
            }' \
            "$BASE_URL/api/auth/login")
        
        if echo "$admin_login_response" | grep -q "token"; then
            ADMIN_TOKEN=$(echo "$admin_login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            record_test "管理员登录" "PASS"
            echo "   管理员Token已获取: ${ADMIN_TOKEN:0:20}..."
        else
            record_test "管理员登录" "FAIL" "$admin_login_response"
            ADMIN_TOKEN=""
        fi
    fi
}

# 测试CRUD操作
test_crud_operations() {
    echo ""
    echo "📊 测试CRUD操作"
    echo "==============="
    
    if [ -z "$TOKEN" ]; then
        echo "⚠️  跳过CRUD测试（缺少认证token）"
        return
    fi
    
    # 测试创建用户（需要管理员权限）
    if [ -n "$ADMIN_TOKEN" ]; then
        local create_user_response=$(curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "username": "crudtest", 
                "email": "crud@test.com", 
                "password": "Test123!@#",
                "firstName": "CRUD",
                "lastName": "Test"
            }' \
            "$BASE_URL/api/users")
        
        if echo "$create_user_response" | grep -q "success"; then
            record_test "创建用户（管理员）" "PASS"
            USER_ID=$(echo "$create_user_response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
        else
            record_test "创建用户（管理员）" "FAIL" "$create_user_response"
            USER_ID=""
        fi
        
        # 测试查询用户列表（需要管理员或版主权限）
        local get_users_response=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
            "$BASE_URL/api/users?page=1&limit=10")
        
        if echo "$get_users_response" | grep -q "users"; then
            record_test "查询用户列表（管理员）" "PASS"
        else
            record_test "查询用户列表（管理员）" "FAIL" "$get_users_response"
        fi
    else
        record_test "创建用户（管理员）" "SKIP" "缺少管理员token"
        record_test "查询用户列表（管理员）" "SKIP" "缺少管理员token"
    fi
    
    # 测试创建文章
    local create_post_response=$(curl -s -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "测试文章标题", 
            "content": "这是一篇用于测试的文章内容。", 
            "status": "published"
        }' \
        "$BASE_URL/api/posts")
    
    if echo "$create_post_response" | grep -q "success"; then
        record_test "创建文章" "PASS"
        POST_ID=$(echo "$create_post_response" | grep -o '"id":[0-9]*' | cut -d':' -f2)
    else
        record_test "创建文章" "FAIL" "$create_post_response"
        POST_ID=""
    fi
    
    # 测试查询文章列表
    local get_posts_response=$(curl -s "$BASE_URL/api/posts?page=1&limit=5")
    
    if echo "$get_posts_response" | grep -q "posts"; then
        record_test "查询文章列表" "PASS"
    else
        record_test "查询文章列表" "FAIL" "$get_posts_response"
    fi
    
    # 测试创建评论
    if [ -n "$POST_ID" ]; then
        local create_comment_response=$(curl -s -X POST \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "content": "这是一条测试评论。"
            }' \
            "$BASE_URL/api/posts/$POST_ID/comments")
        
        if echo "$create_comment_response" | grep -q "success"; then
            record_test "创建文章评论" "PASS"
        else
            record_test "创建文章评论" "FAIL" "$create_comment_response"
        fi
    fi
    
    # 测试分类管理（需要管理员或版主权限）
    if [ -n "$ADMIN_TOKEN" ]; then
        local create_category_response=$(curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "测试分类", 
                "description": "用于测试的分类"
            }' \
            "$BASE_URL/api/categories")
        
        if echo "$create_category_response" | grep -q "success"; then
            record_test "创建分类（管理员）" "PASS"
        else
            record_test "创建分类（管理员）" "FAIL" "$create_category_response"
        fi
    else
        record_test "创建分类（管理员）" "SKIP" "缺少管理员token"
    fi
    
    # 测试分类查询
    local get_categories_response=$(curl -s "$BASE_URL/api/categories")
    
    if echo "$get_categories_response" | grep -q "categories"; then
        record_test "查询分类列表" "PASS"
    else
        record_test "查询分类列表" "FAIL" "$get_categories_response"
    fi
}

# 测试调试和监控系统
test_debug_monitoring() {
    echo ""
    echo "🔍 测试调试和监控系统"
    echo "===================="
    
    # 测试健康检查
    local health_response=$(curl -s "$BASE_URL/api/debug/health")
    
    if echo "$health_response" | grep -q "healthy"; then
        record_test "系统健康检查" "PASS"
    else
        record_test "系统健康检查" "FAIL" "$health_response"
    fi
    
    # 测试调试面板
    local dashboard_response=$(curl -s "$BASE_URL/api/debug/dashboard")
    
    if echo "$dashboard_response" | grep -q "调试面板"; then
        record_test "调试面板访问" "PASS"
    else
        record_test "调试面板访问" "FAIL" "面板大小: $(echo "$dashboard_response" | wc -c)"
    fi
    
    # 测试需要认证的调试端点
    if [ -n "$TOKEN" ]; then
        local overview_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$BASE_URL/api/debug/overview")
        
        if echo "$overview_response" | grep -q "status"; then
            record_test "系统概览查询（认证）" "PASS"
        else
            record_test "系统概览查询（认证）" "FAIL" "$overview_response"
        fi
        
        local performance_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$BASE_URL/api/debug/performance")
        
        if echo "$performance_response" | grep -q "requests"; then
            record_test "性能指标查询（认证）" "PASS"
        else
            record_test "性能指标查询（认证）" "FAIL" "$performance_response"
        fi
    fi
}

# 测试错误处理
test_error_handling() {
    echo ""
    echo "🚨 测试错误处理"
    echo "==============="
    
    # 测试404错误
    local not_found_response=$(curl -s -w "%{http_code}" "$BASE_URL/nonexistent-endpoint")
    
    if echo "$not_found_response" | grep -q "404"; then
        record_test "404错误处理" "PASS"
    else
        record_test "404错误处理" "FAIL" "$not_found_response"
    fi
    
    # 测试应用错误
    local error_response=$(curl -s "$BASE_URL/api/test/error")
    
    if echo "$error_response" | grep -q "error"; then
        record_test "应用错误处理" "PASS"
    else
        record_test "应用错误处理" "FAIL" "$error_response"
    fi
    
    # 测试认证错误
    local auth_error_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer invalid_token" \
        "$BASE_URL/api/auth/profile")
    
    if echo "$auth_error_response" | grep -q "401"; then
        record_test "认证错误处理" "PASS"
    else
        record_test "认证错误处理" "FAIL" "$auth_error_response"
    fi
}

# 性能压力测试
test_performance() {
    echo ""
    echo "⚡ 性能压力测试"
    echo "==============="
    
    echo "   发送并发请求..."
    
    # 并发发送多个请求
    for i in {1..20}; do
        curl -s "$BASE_URL/" >/dev/null &
        curl -s "$BASE_URL/api" >/dev/null &
        curl -s "$BASE_URL/health" >/dev/null &
    done
    
    wait
    
    # 检查性能指标
    if [ -n "$TOKEN" ]; then
        local perf_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$BASE_URL/api/debug/performance")
        
        if echo "$perf_response" | grep -q "requests"; then
            record_test "性能压力测试" "PASS"
            
            # 提取性能数据
            local total_requests=$(echo "$perf_response" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2)
            local avg_response_time=$(echo "$perf_response" | grep -o '"avgResponseTime":[0-9]*' | cut -d':' -f2)
            
            echo "   总请求数: $total_requests"
            echo "   平均响应时间: ${avg_response_time}ms"
        else
            record_test "性能压力测试" "FAIL" "$perf_response"
        fi
    else
        record_test "性能压力测试" "SKIP" "缺少认证token"
    fi
}

# 测试日志系统
test_logging_system() {
    echo ""
    echo "📝 测试日志系统"
    echo "==============="
    
    # 检查日志文件
    if [ -d "./logs" ]; then
        record_test "日志目录存在" "PASS"
        
        local log_files=("combined.log" "app.log" "error.log")
        for log_file in "${log_files[@]}"; do
            if [ -f "./logs/$log_file" ]; then
                local size=$(stat -f%z "./logs/$log_file" 2>/dev/null || stat -c%s "./logs/$log_file" 2>/dev/null || echo "0")
                if [ "$size" -gt "0" ]; then
                    record_test "日志文件 $log_file" "PASS"
                else
                    record_test "日志文件 $log_file" "FAIL" "文件为空"
                fi
            else
                record_test "日志文件 $log_file" "FAIL" "文件不存在"
            fi
        done
    else
        record_test "日志目录存在" "FAIL" "目录不存在"
    fi
    
    # 测试日志查看API
    if [ -n "$TOKEN" ]; then
        local logs_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$BASE_URL/api/debug/logs?limit=5")
        
        if echo "$logs_response" | grep -q "logs"; then
            record_test "日志查看API" "PASS"
        else
            record_test "日志查看API" "FAIL" "$logs_response"
        fi
    fi
}

# 主测试流程
main() {
    echo "开始时间: $(date)"
    echo ""
    
    wait_for_server
    initialize_database
    test_authentication
    test_crud_operations
    test_debug_monitoring
    test_error_handling
    test_performance
    test_logging_system
    
    echo ""
    echo "📈 测试结果汇总"
    echo "==============="
    echo "总测试数: $TOTAL_TESTS"
    echo "通过: $PASSED_TESTS ✅"
    echo "失败: $FAILED_TESTS ❌"
    echo "成功率: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo "🎉 所有测试通过！Node.js后端服务运行完美！"
        echo ""
        echo "📋 系统功能验证："
        echo "✅ Express.js框架和中间件系统"
        echo "✅ JWT认证和权限控制"
        echo "✅ 数据库ORM和CRUD操作"
        echo "✅ 请求跟踪和性能监控"
        echo "✅ 错误处理和日志系统"
        echo "✅ 实时调试和监控面板"
        echo ""
        echo "🚀 系统已准备好生产部署！"
        exit 0
    else
        echo "⚠️  发现 $FAILED_TESTS 个测试失败，请检查相关功能。"
        exit 1
    fi
}

# 执行主函数
main "$@"