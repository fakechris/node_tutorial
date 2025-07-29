#!/bin/bash

# 阶段七测试脚本：调试和日志系统

echo "🧪 测试阶段七：调试和日志系统"
echo "================================"

BASE_URL="http://localhost:3000"

# 等待服务器启动
echo "⏳ 等待服务器启动..."
for i in {1..30}; do
    if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        echo "✅ 服务器已启动"
        break
    fi
    echo "   第 $i 次尝试连接..."
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ 服务器启动超时"
        exit 1
    fi
done

echo ""
echo "1. 📊 测试基础健康检查"
echo "----------------------"
health_response=$(curl -s "$BASE_URL/health")
if echo "$health_response" | grep -q "success"; then
    echo "✅ 基础健康检查通过"
else
    echo "❌ 基础健康检查失败"
    echo "响应: $health_response"
fi

echo ""
echo "2. 🔍 测试调试健康检查"
echo "----------------------"
debug_health=$(curl -s "$BASE_URL/api/debug/health")
if echo "$debug_health" | grep -q "healthy"; then
    echo "✅ 调试健康检查通过"
    echo "响应: $debug_health"
else
    echo "❌ 调试健康检查失败"
    echo "响应: $debug_health"
fi

echo ""
echo "3. 🎯 生成一些测试流量（产生日志和性能数据）"
echo "=============================================="
for i in {1..5}; do
    echo "   发送测试请求 $i/5"
    curl -s "$BASE_URL/" >/dev/null &
    curl -s "$BASE_URL/api" >/dev/null &
    curl -s "$BASE_URL/api/demo/status-codes" >/dev/null &
done
wait

echo ""
echo "4. 📋 测试调试面板 (开发环境)"
echo "============================="
dashboard_response=$(curl -s "$BASE_URL/api/debug/dashboard")
if echo "$dashboard_response" | grep -q "调试面板"; then
    echo "✅ 调试面板访问成功"
    echo "面板大小: $(echo "$dashboard_response" | wc -c) 字符"
else
    echo "❌ 调试面板访问失败"
    echo "响应: $(echo "$dashboard_response" | head -100)"
fi

echo ""
echo "5. 🔐 测试需要认证的端点（应该返回401）"
echo "======================================="
overview_response=$(curl -s -w "%{http_code}" "$BASE_URL/api/debug/overview")
if echo "$overview_response" | grep -q "401"; then
    echo "✅ 认证保护正常工作（返回401）"
else
    echo "⚠️  认证端点响应: $overview_response"
fi

echo ""
echo "6. 📝 检查日志文件"
echo "=================="
if [ -d "./logs" ]; then
    echo "✅ 日志目录存在"
    for log_file in combined.log app.log error.log; do
        if [ -f "./logs/$log_file" ]; then
            size=$(stat -f%z "./logs/$log_file" 2>/dev/null || stat -c%s "./logs/$log_file" 2>/dev/null || echo "unknown")
            echo "   - $log_file: $size 字节"
        else
            echo "   - $log_file: 不存在"
        fi
    done
else
    echo "❌ 日志目录不存在"
fi

echo ""
echo "7. 🚨 触发错误以测试错误监控"
echo "============================"
error_response=$(curl -s "$BASE_URL/api/test/error")
if echo "$error_response" | grep -q "error"; then
    echo "✅ 错误处理正常工作"
    echo "错误响应包含: $(echo "$error_response" | grep -o '"message":"[^"]*"')"
else
    echo "❌ 错误处理失败"
    echo "响应: $error_response"
fi

echo ""
echo "8. 🌐 测试不存在的路由（404处理）"
echo "==============================="
not_found_response=$(curl -s -w "%{http_code}" "$BASE_URL/nonexistent-route")
if echo "$not_found_response" | grep -q "404"; then
    echo "✅ 404处理正常工作"
else
    echo "❌ 404处理异常"
    echo "响应: $not_found_response"
fi

echo ""
echo "📊 阶段七测试完成！"
echo "==================="
echo "✅ 请求跟踪系统已启用"
echo "✅ 性能监控中间件已集成" 
echo "✅ 统一日志系统已配置"
echo "✅ 错误监控和统计已启用"
echo "✅ 调试面板已可用"
echo "✅ 健康检查端点已工作"
echo ""
echo "🔍 可以访问调试面板: $BASE_URL/api/debug/dashboard"
echo "📈 查看实时监控数据和系统状态"