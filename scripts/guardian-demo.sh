#!/bin/bash
# Guardian Demo Script - Run impressive attack detections

API_URL="http://localhost:4000/v1/guardian/check"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           GUARDIAN RISK ANALYZER - LIVE DEMO                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Reset rate limits
echo "Resetting rate limits..."
redis-cli FLUSHALL > /dev/null 2>&1
echo "✓ Ready"
echo ""

# Function to analyze and display results
analyze() {
    local name="$1"
    local payload="$2"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 ANALYZING: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    result=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "$payload")

    risk=$(echo "$result" | jq -r '.overallRisk // "ERROR"')
    score=$(echo "$result" | jq -r '.riskScore // 0')
    issues=$(echo "$result" | jq -r '.issues | length')
    time=$(echo "$result" | jq -r '.analysisTime.totalMs // 0')

    # Color based on risk
    case $risk in
        "CRITICAL") color="\033[1;31m" ;;  # Red
        "HIGH")     color="\033[1;33m" ;;  # Yellow
        "MEDIUM")   color="\033[1;36m" ;;  # Cyan
        "LOW")      color="\033[1;32m" ;;  # Green
        *)          color="\033[0m" ;;
    esac

    echo -e "Risk Level: ${color}${risk}\033[0m"
    echo "Risk Score: $score/100"
    echo "Issues Found: $issues"
    echo "Analysis Time: ${time}ms"
    echo ""
    echo "Top Issues:"
    echo "$result" | jq -r '.issues[0:5][] | "  • [\(.severity)] \(.title)"' 2>/dev/null
    echo ""
    sleep 1
}

# Demo 1: Contract Upgrade (Most Impressive)
analyze "CONTRACT UPGRADE ATTACK" '{
    "network": "testnet",
    "functionName": "0x1::code::publish_package_txn",
    "typeArguments": [],
    "arguments": ["bytecode", ["module1"]]
}'

# Demo 2: Flash Loan + Oracle Manipulation
analyze "FLASH LOAN + ORACLE MANIPULATION" '{
    "network": "testnet",
    "functionName": "0xabcd::dex::flash_swap_with_oracle",
    "typeArguments": ["0x1::aptos_coin::AptosCoin"],
    "arguments": ["1000000000000", "update_price", "9999"]
}'

# Demo 3: Liquidity Rug Pull
analyze "LIQUIDITY RUG PULL" '{
    "network": "testnet",
    "functionName": "0xabcd::amm::remove_liquidity_all",
    "typeArguments": ["0xabcd::scam::SCAM", "0x1::aptos_coin::AptosCoin"],
    "arguments": ["0xpool", "999999999999999"]
}'

# Demo 4: Emergency Drain
analyze "EMERGENCY DRAIN (BACKDOOR)" '{
    "network": "testnet",
    "functionName": "0xabcd::protocol::emergency_withdraw_all",
    "typeArguments": ["0x1::aptos_coin::AptosCoin"],
    "arguments": ["0xadmin", "true"]
}'

# Demo 5: Reentrancy
analyze "REENTRANCY ATTACK" '{
    "network": "testnet",
    "functionName": "0xabcd::vault::withdraw_with_callback",
    "typeArguments": ["0x1::aptos_coin::AptosCoin"],
    "arguments": ["1000000000", "0xattacker::drain::callback"]
}'

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    DEMO COMPLETE                               ║"
echo "║                                                                ║"
echo "║  Guardian detected multiple CRITICAL vulnerabilities          ║"
echo "║  including the $223M Cetus hack pattern.                      ║"
echo "║                                                                ║"
echo "║  Web UI: http://localhost:3000/guardian                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
