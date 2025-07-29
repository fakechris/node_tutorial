#!/bin/bash

# 数据库迁移和种子数据测试脚本
echo "🧪 开始测试数据库迁移和种子数据系统..."
echo "================================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0

# 测试函数
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_exit_code="${3:-0}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "[$TOTAL_TESTS] $test_name: "
    
    if eval "$command" >/dev/null 2>&1; then
        local exit_code=$?
        if [ $exit_code -eq $expected_exit_code ]; then
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ FAILED (exit code: $exit_code, expected: $expected_exit_code)${NC}"
        fi
    else
        echo -e "${RED}❌ FAILED${NC}"
    fi
}

# 测试API响应
test_api() {
    local endpoint="$1"
    local description="$2"
    local expected_status="${3:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "[$TOTAL_TESTS] $description: "
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "http://localhost:3000$endpoint" 2>/dev/null)
    local status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED (HTTP $status_code, expected: $expected_status)${NC}"
    fi
}

echo -e "${YELLOW}第一步：重置数据库并重新设置${NC}"
echo "清理现有数据库..."
rm -f database/tutorial.db

echo "运行迁移..."
run_test "数据库迁移执行" "npm run migrate:up"

echo "运行种子数据..."
run_test "种子数据执行" "npm run seed"

echo ""
echo -e "${YELLOW}第二步：验证迁移状态${NC}"
run_test "检查迁移状态" "npm run migrate:status | grep -q '4.*4.*0'"
run_test "检查种子状态" "npm run seed:status | grep -q '5.*5.*0'"

echo ""
echo -e "${YELLOW}第三步：启动服务器并测试数据${NC}"
echo "启动后台服务器..."
NODE_ENV=development node src/index.js &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 测试数据是否正确载入
test_api "/api/users" "测试用户数据载入"
test_api "/api/posts" "测试文章数据载入"
test_api "/api/categories" "测试分类数据载入"

# 测试具体数据内容
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -n "[$TOTAL_TESTS] 验证管理员用户存在: "
if curl -s "http://localhost:3000/api/users" | grep -q "admin"; then
    echo -e "${GREEN}✅ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -n "[$TOTAL_TESTS] 验证默认分类存在: "
if curl -s "http://localhost:3000/api/categories" | grep -q "Node.js"; then
    echo -e "${GREEN}✅ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -n "[$TOTAL_TESTS] 验证示例文章存在: "
if curl -s "http://localhost:3000/api/posts" | grep -q "Node.js 后端开发入门指南"; then
    echo -e "${GREEN}✅ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# 停止服务器
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo -e "${YELLOW}第四步：测试迁移回滚功能${NC}"
run_test "回滚一个迁移" "npm run migrate:down -- --steps 1"
run_test "验证回滚成功" "npm run migrate:status | grep -q '3.*3.*1'"
run_test "重新应用迁移" "npm run migrate:up"

echo ""
echo -e "${YELLOW}第五步：测试种子数据刷新${NC}"
run_test "刷新种子数据" "npm run seed:refresh -- --force"

echo ""
echo "================================================="
echo -e "${YELLOW}📊 测试结果汇总${NC}"
echo "==============="
echo "总测试数: $TOTAL_TESTS"
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "通过: ${GREEN}$PASSED_TESTS ✅${NC}"
    echo -e "失败: ${GREEN}0 ✅${NC}"
    echo -e "成功率: ${GREEN}100%${NC}"
    echo ""
    echo -e "${GREEN}🎉 数据库迁移和种子数据系统测试全部通过！${NC}"
    exit 0
else
    FAILED_TESTS=$((TOTAL_TESTS - PASSED_TESTS))
    echo -e "通过: ${GREEN}$PASSED_TESTS ✅${NC}"
    echo -e "失败: ${RED}$FAILED_TESTS ❌${NC}"
    echo -e "成功率: ${YELLOW}$((PASSED_TESTS * 100 / TOTAL_TESTS))%${NC}"
    echo ""
    echo -e "${RED}❌ 部分测试失败，请检查上述错误信息${NC}"
    exit 1
fi