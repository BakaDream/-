from flask import Blueprint, request, jsonify

stack_bp = Blueprint('stack', __name__)

# ─── Helper ────────────────────────────────────────────────────────────
CAPACITY = 8

def make_snapshot(stack, highlight_idx=None):
    cells = []
    for i in range(CAPACITY):
        val = stack[i] if i < len(stack) else None
        cells.append({
            'val': val,
            'idx': i,
            'filled': i < len(stack),
            'highlight': i == highlight_idx,
            'top': i == len(stack) - 1 and i < len(stack),
        })
    return cells

def parse_stack(body):
    """
    AlgoLayout sends either:
      {numbers: [...], target: "val"}  (CRUD op mode)
      {numbers: [...]}                 (init mode, used as stack state)
    We also accept {stack: [...], val: ...} for direct calls.
    """
    if 'stack' in body:
        stack = [int(x) for x in body['stack']]
    elif 'numbers' in body:
        stack = [int(x) for x in body['numbers'] if str(x).strip()]
    else:
        stack = []

    if 'val' in body:
        val = int(body['val'])
    elif 'target' in body and body['target'] != '':
        try:
            val = int(body['target'])
        except:
            val = 0
    else:
        val = None

    return stack, val


# ══════════════════════════════════════════════════════════
#  入栈 Push
# ══════════════════════════════════════════════════════════
@stack_bp.route('/api/stack/array/push', methods=['POST'])
def stack_push():
    body = request.json
    stack, val = parse_stack(body)
    if val is None:
        return jsonify({'code': 400, 'msg': '请输入入栈的值'})

    traces = []
    step   = 0

    def snap(msg, line, highlight=None):
        nonlocal step
        step += 1
        traces.append({'step': step, 'message': msg, 'line': line,
                        'data': make_snapshot(stack, highlight)})

    snap(f'检查栈是否已满（当前大小 {len(stack)}/{CAPACITY}）', 2)
    if len(stack) >= CAPACITY:
        snap('栈已满，无法入栈（Stack Full）', 3)
        return jsonify({'code': 200, 'traces': traces, 'newNumbers': stack})

    snap(f'栈未满，准备将 {val} 压入栈顶', 4)
    stack.append(val)
    snap(f'将 {val} 压栈，top 指针 +1 → top = {len(stack)-1}', 5, len(stack)-1)

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': stack})


# ══════════════════════════════════════════════════════════
#  出栈 Pop
# ══════════════════════════════════════════════════════════
@stack_bp.route('/api/stack/array/pop', methods=['POST'])
def stack_pop():
    body  = request.json
    stack, _ = parse_stack(body)

    traces = []
    step   = 0

    def snap(msg, line, highlight=None, s=None):
        nonlocal step
        step += 1
        traces.append({'step': step, 'message': msg, 'line': line,
                        'data': make_snapshot(s if s is not None else stack, highlight)})

    snap(f'检查栈是否为空（当前大小 {len(stack)}）', 2)
    if not stack:
        snap('栈已空，无法出栈（Stack Empty）', 3)
        return jsonify({'code': 200, 'traces': traces, 'newNumbers': stack})

    snap(f'栈不为空，取出栈顶元素 {stack[-1]}，top = {len(stack)-1}', 4, len(stack)-1)
    val = stack.pop()
    snap(f'出栈完成，返回值 {val}，新 top = {len(stack)-1 if stack else -1}', 5)

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': stack, 'popped': val})


# ══════════════════════════════════════════════════════════
#  取栈顶 Peek
# ══════════════════════════════════════════════════════════
@stack_bp.route('/api/stack/array/peek', methods=['POST'])
def stack_peek():
    body  = request.json
    stack, _ = parse_stack(body)

    traces = []
    step   = 0

    def snap(msg, line, highlight=None):
        nonlocal step
        step += 1
        traces.append({'step': step, 'message': msg, 'line': line,
                        'data': make_snapshot(stack, highlight)})

    snap('检查栈是否为空', 2)
    if not stack:
        snap('栈为空，无栈顶元素', 3)
    else:
        snap(f'取栈顶元素 {stack[-1]}（不出栈）top = {len(stack)-1}', 4, len(stack)-1)
        snap(f'返回值 = {stack[-1]}，top 指针不变', 5, len(stack)-1)

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': stack})


# ══════════════════════════════════════════════════════════
#  清空 Clear
# ══════════════════════════════════════════════════════════
@stack_bp.route('/api/stack/array/clear', methods=['POST'])
def stack_clear():
    body  = request.json
    stack, _ = parse_stack(body)

    traces = []
    step   = 0

    def snap(msg, line, s):
        nonlocal step
        step += 1
        traces.append({'step': step, 'message': msg, 'line': line,
                        'data': make_snapshot(s)})

    snap(f'开始清空栈（当前元素数 {len(stack)}）', 2, list(stack))
    while stack:
        val = stack.pop()
        snap(f'弹出 {val}，剩余 {len(stack)} 个元素', 3, list(stack))
    snap('栈已清空，top = -1', 4, [])

    return jsonify({'code': 200, 'traces': traces, 'newNumbers': []})
