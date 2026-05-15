#!/bin/bash
# ABF公司情报流水线 - 智能调度器
# 每次被调用时：检查状态 → 如果空闲则启动新一轮 → 记录耗时

set -e
cd /root/agents/chip-roadmap-website

STATE_FILE="agent-inbox/company-intel/state/pipeline-state.json"
TIMING_FILE="agent-inbox/company-intel/state/pipeline-timing.json"
QUEUE_FILE="agent-inbox/company-intel/queue/company-seeds.jsonl"

# 获取当前状态
get_status() {
    python3 -c "import json; print(json.load(open('$STATE_FILE')).get('status','unknown'))" 2>/dev/null || echo "unknown"
}

# 获取pending公司数量
get_pending_count() {
    python3 -c "
import json
count = 0
with open('$QUEUE_FILE') as f:
    for line in f:
        obj = json.loads(line.strip())
        if obj.get('status') == 'pending':
            count += 1
print(count)
" 2>/dev/null || echo "0"
}

# 记录耗时
record_timing() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local run_id=$2
    
    python3 -c "
import json, os
timing_file = '$TIMING_FILE'
if os.path.exists(timing_file):
    with open(timing_file) as f:
        data = json.load(f)
else:
    data = {'runs': []}

data['runs'].append({
    'run_id': '$run_id',
    'started_at': '$start_time',
    'ended_at': '$end_time',
    'duration_seconds': $duration,
    'duration_minutes': round($duration / 60, 1)
})

# 计算平均耗时
if data['runs']:
    avg = sum(r['duration_seconds'] for r in data['runs']) / len(data['runs'])
    data['average_duration_seconds'] = round(avg)
    data['average_duration_minutes'] = round(avg / 60, 1)
    data['recommended_cron_interval_minutes'] = round(avg / 60 * 1.5)  # 1.5倍余量

with open(timing_file, 'w') as f:
    json.dump(data, f, indent=2)
"
    echo "[$(date -Iseconds)] 耗时记录完成: ${duration}秒 ($((duration / 60))分钟)"
}

# 主逻辑
STATUS=$(get_status)
PENDING=$(get_pending_count)

echo "[$(date -Iseconds)] 状态: $STATUS, 待处理: $PENDING"

if [ "$STATUS" = "running" ]; then
    echo "[$(date -Iseconds)] 上一轮仍在运行，本轮跳过"
    exit 0
fi

if [ "$PENDING" -eq 0 ]; then
    echo "[$(date -Iseconds)] 队列为空，无需运行"
    exit 0
fi

echo "[$(date -Iseconds)] 启动新一轮pipeline (pending: $PENDING)"
echo "[$(date -Iseconds)] 实际工作由openclaw cron job执行"
