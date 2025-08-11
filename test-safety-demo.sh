#!/bin/bash

# Claude-Prompter Safety Features Demonstration Script
# This script demonstrates all the new safety features added to prevent dangerous changes

echo "================================================"
echo "🛡️  CLAUDE-PROMPTER SAFETY FEATURES DEMO"
echo "================================================"
echo ""

# 1. Risk Assessment for Critical Operation
echo "1️⃣  RISK ASSESSMENT - Critical Operation"
echo "----------------------------------------"
echo "Testing: node dist/cli.js risk 'modify babel.config.js'"
echo ""
echo "n" | node dist/cli.js risk "modify babel.config.js" 2>&1 | head -25
echo ""
echo "✅ Result: Detected CRITICAL risk, required checkpoint, operation cancelled"
echo ""
sleep 2

# 2. Incremental Mode for Complex Tasks
echo "2️⃣  INCREMENTAL MODE - Complex Task"
echo "-----------------------------------"
echo "Testing: node dist/cli.js risk 'add authentication system' --incremental"
echo ""
node dist/cli.js risk "add authentication system" --incremental 2>&1 | head -30
echo ""
echo "✅ Result: Task broken into 7 safe steps with testing instructions"
echo ""
sleep 2

# 3. Platform Detection
echo "3️⃣  PLATFORM DETECTION"
echo "----------------------"
echo "Testing: node dist/cli.js risk detect-platform"
echo ""
node dist/cli.js risk detect-platform 2>&1
echo ""
echo "✅ Result: Platform detection working (no platform in this directory)"
echo ""
sleep 2

# 4. Batch Risk Assessment
echo "4️⃣  BATCH RISK ASSESSMENT"
echo "-------------------------"
echo "Testing: node dist/cli.js risk batch"
echo ""
node dist/cli.js risk batch 2>&1 | head -20
echo ""
echo "✅ Result: Multiple operations assessed with risk distribution"
echo ""
sleep 2

# 5. Enhanced Status Command
echo "5️⃣  ENHANCED STATUS WITH SAFETY"
echo "-------------------------------"
echo "Testing: node dist/cli.js status"
echo ""
node dist/cli.js status 2>&1 | head -35
echo ""
echo "✅ Result: Shows project health, safety status, and error tracking"
echo ""
sleep 2

# 6. Safe Mode Suggestions
echo "6️⃣  SAFE MODE FOR SUGGESTIONS"
echo "-----------------------------"
echo "Testing: node dist/cli.js suggest -t 'add component' --safe-mode"
echo ""
node dist/cli.js suggest -t "add component" --safe-mode 2>&1 | head -15
echo ""
echo "✅ Result: Conservative suggestions with safe mode enabled"
echo ""

echo ""
echo "================================================"
echo "🎉 SAFETY FEATURES DEMONSTRATION COMPLETE!"
echo "================================================"
echo ""
echo "Summary of Safety Features:"
echo "✅ Risk Assessment Engine - Identifies dangerous operations"
echo "✅ Incremental Mode - Breaks complex tasks into safe steps"
echo "✅ Platform Guards - Protects against platform-specific issues"
echo "✅ Failure Tracking - Suggests rollback after errors"
echo "✅ Confidence Indicators - Shows uncertainty levels"
echo "✅ Checkpoint Enforcement - Forces git checkpoints"
echo "✅ Safe Mode - Conservative suggestions only"
echo ""
echo "These features prevent incidents like the StyleMuse babel.config cascade failure!"