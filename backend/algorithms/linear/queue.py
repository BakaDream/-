from flask import Blueprint, request, jsonify

queue_bp = Blueprint('queue', __name__)

CAPACITY = 8

# ─── Helper ────────────────────────────────────────────────────────────
def make_queue_snap(queue, front_idx=None, rear_idx=None, highlight=None):
    cells = []
    for i in range(CAPACITY):
        filled = i < len(queue)
        val    = queue[i] if filled else None
        cells.append({
            'val': val,
            'idx': i,
            'filled': filled,
            'isFront': i == front_idx,
            'isRear': i == rear_idx,
            'highlight': i == highlight,
        })
    return cells

def parse_queue(body):
    if 'queue' in body:
        queue = [int(x) for x in body['queue']]
    elif 'numbers' in body:
        queue = [int(x) for x in body['numbers'] if str(x).strip()]
    else:
        queue = []

    if 'val' in body:
        val = int(body['val'])
    elif 'target' in body and body['target'] != '':
        try:
            val = int(body['target'])
        except:
            val = 0
    else:
        val = None

    return queue, val

def snap_helper(traces, step_ref, queue, msg, line, highlight=None):
    step_ref[0] += 1
    f = 0 if queue else None
    r = len(queue) - 1 if queue else None
    traces.append({
        'step': step_ref[0], 'message': msg, 'line': line,
        'data': make_queue_snap(queue, f, r, highlight)
    })


# ══════════════════════════════════════════════════════════
#  入队 Enqueue
# ══════════════════════════════════════════════════════════
@queue_bp.route('/api/queue/array/enqueue', methods=['POST'])
def queue_enqueue():
    body = request.json
    queue, val = parse_queue(body)
    if val is None:
        return jsonify({'code': 400, 'msg': '请输入入队的值'})

    traces = []
    step   = [0]

    def snap(msg, line, q=None, highlight=None):
        q_ = q if q is not None else queue
        snap_helper(traces, step, q_, msg, line, highlight)

    snap(f'检查队列是否已满（当前 {len(queue)}/{CAPACITY}）', 2)
    if len(queue) >= CAPACITY:
        snap('队列已满，入队失败（Queue Full）', 3)
        return jsonify({'code': 200, 'traces': traces, 'newNumbers': queue})

    snap(f'队列未满，将 {val} 加入队尾', 4)
    queue.append(val)
    snap(f'{val} 入队成功，rear = {len(queue)-1}', 5, highlight=len(queue)-1)

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': queue})


# ══════════════════════════════════════════════════════════
#  出队 Dequeue
# ══════════════════════════════════════════════════════════
@queue_bp.route('/api/queue/array/dequeue', methods=['POST'])
def queue_dequeue():
    body = request.json
    queue, _ = parse_queue(body)

    traces = []
    step   = [0]

    def snap(msg, line, q=None, highlight=None):
        q_ = q if q is not None else queue
        snap_helper(traces, step, q_, msg, line, highlight)

    snap(f'检查队列是否为空（当前 {len(queue)} 个元素）', 2)
    if not queue:
        snap('队列为空，出队失败（Queue Empty）', 3)
        return jsonify({'code': 200, 'traces': traces, 'newNumbers': queue})

    snap(f'取出队首元素 {queue[0]}，front = 0', 4, highlight=0)
    val = queue.pop(0)
    snap(f'{val} 出队，所有元素前移，rear = {len(queue)-1 if queue else -1}', 5, list(queue))

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': queue, 'dequeued': val})


# ══════════════════════════════════════════════════════════
#  清空 Clear
# ══════════════════════════════════════════════════════════
@queue_bp.route('/api/queue/array/clear', methods=['POST'])
def queue_clear():
    body = request.json
    queue, _ = parse_queue(body)

    traces = []
    step   = [0]

    def snap(msg, line, q):
        step[0] += 1
        traces.append({
            'step': step[0], 'message': msg, 'line': line,
            'data': make_queue_snap(q)
        })

    snap(f'开始清空队列（共 {len(queue)} 个元素）', 2, list(queue))
    while queue:
        val = queue.pop(0)
        snap(f'移除队首 {val}，剩余 {len(queue)} 个', 3, list(queue))
    snap('队列已清空，front = rear = -1', 4, [])

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': []})


# ══════════════════════════════════════════════════════════
#  优先队列 Priority Queue (min-heap)
# ══════════════════════════════════════════════════════════
import heapq

@queue_bp.route('/api/queue/priority/enqueue', methods=['POST'])
def pq_enqueue():
    body = request.json
    queue, val = parse_queue(body)
    if val is None:
        return jsonify({'code': 400, 'msg': '请输入值'})
    heap = list(queue)
    heapq.heapify(heap)

    traces = []
    step   = [0]

    def snap(msg, line, h, hi=None):
        step[0] += 1
        cell = [{'val': v, 'idx': i, 'highlight': i == hi} for i, v in enumerate(h)]
        traces.append({'step': step[0], 'message': msg, 'line': line, 'data': cell})

    snap(f'当前优先队列（最小堆）有 {len(heap)} 个元素', 2, list(heap))
    heap.append(val)
    snap(f'将 {val} 追加至末尾，触发上浮调整', 3, list(heap), len(heap)-1)
    heapq.heapify(heap)
    snap(f'堆调整完成，堆顶（最小值）= {heap[0]}', 4, list(heap), 0)

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': heap})


@queue_bp.route('/api/queue/priority/dequeue', methods=['POST'])
def pq_dequeue():
    body = request.json
    queue, _ = parse_queue(body)
    heap = list(queue)
    heapq.heapify(heap)

    traces = []
    step   = [0]

    def snap(msg, line, h, hi=None):
        step[0] += 1
        cell = [{'val': v, 'idx': i, 'highlight': i == hi} for i, v in enumerate(h)]
        traces.append({'step': step[0], 'message': msg, 'line': line, 'data': cell})

    snap(f'优先队列有 {len(heap)} 个元素，堆顶 = {heap[0] if heap else "空"}', 2, list(heap))
    if not heap:
        snap('优先队列为空', 3, [])
        return jsonify({'code': 200, 'traces': traces, 'newNumbers': []})

    snap(f'取出堆顶（最小值）{heap[0]}', 3, list(heap), 0)
    val = heapq.heappop(heap)
    snap(f'{val} 已出队，重新调整堆结构', 4, list(heap))
    if heap:
        snap(f'调整完成，新堆顶 = {heap[0]}', 5, list(heap), 0)

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': heap, 'dequeued': val})
