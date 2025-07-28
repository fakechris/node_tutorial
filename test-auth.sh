#!/bin/bash

echo "🧪 JWT认证系统测试脚本"
echo "========================"

# 服务器地址
BASE_URL="http://localhost:3000"

echo ""
echo "1. 测试认证系统信息API"
echo "------------------------"
curl -s "${BASE_URL}/api/auth/info" | head -c 200
echo ""

echo ""
echo "2. 测试管理员登录"
echo "----------------"
ADMIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo "$ADMIN_RESPONSE" | head -c 300
echo ""

# 提取管理员令牌
ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ 无法获取管理员令牌"
  exit 1
else
  echo "✅ 管理员令牌获取成功"
fi

echo ""
echo "3. 测试用户注册"
echo "---------------"
curl -s -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }' | head -c 300
echo ""

echo ""
echo "4. 测试普通用户登录"
echo "------------------"
USER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"password123"}')

echo "$USER_RESPONSE" | head -c 300
echo ""

USER_TOKEN=$(echo "$USER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo ""
echo "5. 测试受保护的路由（管理员）"
echo "---------------------------"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${BASE_URL}/api/auth/profile" | head -c 300
echo ""

echo ""
echo "6. 测试权限控制（管理员访问管理员端点）"
echo "------------------------------------"
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${BASE_URL}/api/auth/demo/admin-only" | head -c 300
echo ""

echo ""
echo "7. 测试权限控制（普通用户访问管理员端点 - 应该被拒绝）"
echo "------------------------------------------------"
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "${BASE_URL}/api/auth/demo/admin-only" | head -c 300
echo ""

echo ""
echo "8. 测试无效令牌"
echo "---------------"
curl -s -H "Authorization: Bearer invalid_token_here" \
  "${BASE_URL}/api/auth/profile" | head -c 200
echo ""

echo ""
echo "9. 测试缺少授权头"
echo "-----------------"
curl -s "${BASE_URL}/api/auth/profile" | head -c 200
echo ""

echo ""
echo "✅ JWT认证系统测试完成！"