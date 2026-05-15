#!/bin/bash
# ABF公司情报自动化流水线 - 智能调度脚本
# 功能：防重叠、记录耗时、自动续跑

set -e
cd /root/agents/chip-roadmap-website

STATE_FILE="agent-inbox/company-intel/state/pipeline-state.json"
TIMING_FILE="agent-inbox/company-intel/state/pipeline-timing.json"

# 读取当前状态
STATUS=$(python3 -c "import json; print(json.load(open('$STATE_FILE')).get('status','unknown'))" 2>/dev/null || echo "unknown")

echo "[$(date -Iseconds)] Pipeline status: $STATUS"

# 如果正在运行，跳过
if [ "$STATUS" = "running" ]; then
    echo "[$(date -Iseconds)] 上一轮仍在运行，本轮跳过"
    exit 0
fi

# 记录开始时间
START_TIME=$(date +%s)
START_ISO=$(date -Iseconds)

# 更新状态为running
python3 -c "
import json
state = {
    'status': 'running',
    'started_at': '$START_ISO',
    'last_pipeline_run_at': '',
    'last_pipeline_run_id': '',
    'last_run_date': '',
    'raw_count': 0,
    'import_ready_count': 0,
    'needs_human_check_count': 0,
    'rejected_count': 0,
    'unverified_count': 0,
    'errors': []
}
with open('$STATE_FILE', 'w') as f:
    json.dump(state, f, indent=2)
"

# 运行pipeline（通过openclaw触发）
echo "[$(date -Iseconds)] 触发新一轮pipeline..."
# 这里由cron job的openclaw run来执行实际工作
# 脚本只负责状态管理和防重叠

echo "[$(date -Iseconds)] Pipeline triggered"
