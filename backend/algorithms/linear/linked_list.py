from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer

# 1. 定义蓝图
linear_bp = Blueprint('linear', __name__, url_prefix='/api/linear')


class LinkedListDemo:
    def __init__(self):
        self.tracer = OperationTracer()
        self.head = None  # 链表头节点

    # 辅助函数：把链表转成简单的列表格式 [node1, node2, node3...]
    def _to_view_data(self):
        nodes = []
        current = self.head
        while current:
            nodes.append({"val": current["val"], "id": current["id"]})
            current = current["next"]
        return nodes

    def append(self, val):
        # 准备数据
        new_node = {"val": val, "id": f"n_{val}", "next": None}

        # 记录：准备插入
        current_data = self._to_view_data()
        self.tracer.add_trace("start", current_data, 1, f"准备插入数字 {val}")

        if not self.head:
            self.head = new_node
            # 记录：插入头节点
            self.tracer.add_trace("insert_head", self._to_view_data(), 4, f"链表为空，{val} 成为头节点")
            return

        current = self.head
        # 记录：从头开始找
        self.tracer.add_trace("search", self._to_view_data(), 7, f"从头节点 {current['val']} 开始遍历")

        while current["next"]:
            current = current["next"]
            # 记录：遍历中
            self.tracer.add_trace("move", self._to_view_data(), 10, f"向后移动，找到 {current['val']}")

        current["next"] = new_node
        # 记录：连接新节点
        self.tracer.add_trace("insert_tail", self._to_view_data(), 13, f"到达尾部，连接新节点 {val}")


@linear_bp.route('/list/visualize', methods=['POST'])
def visualize():
    data = request.json
    numbers = data.get('numbers', [])
    demo = LinkedListDemo()
    for n in numbers:
        try:
            demo.append(int(n))
        except:
            pass
    return jsonify({"code": 200, "traces": demo.tracer.traces})


@linear_bp.route('/list/insert', methods=['POST'])
def insert():
    data = request.json
    numbers = data.get('numbers', [])
    target = data.get('target', '')
    try:
        val = int(target)
    except:
        return jsonify({"code": 400, "message": "无效数字"})
    all_vals = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    all_vals.append(val)
    demo = LinkedListDemo()
    for n in all_vals:
        demo.append(n)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": all_vals})


@linear_bp.route('/list/search', methods=['POST'])
def search():
    data = request.json
    numbers = data.get('numbers', [])
    target = data.get('target', '')
    try:
        target_val = int(target)
    except:
        return jsonify({"code": 400, "message": "无效数字"})
    
    tracer = OperationTracer()
    vals = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    
    # Build linked list for visualization
    nodes = [{"val": v, "id": f"n_{v}", "next": None} for v in vals]
    for i in range(len(nodes)-1):
        nodes[i]["next"] = nodes[i+1]
    
    def to_view(idx_hl=-1):
        return [{"val": n["val"], "id": n["id"], "highlight": (i == idx_hl)} for i, n in enumerate(nodes)]
    
    tracer.add_trace("start", to_view(), 1, f"开始查找 {target_val}，从头节点遍历...")
    found = False
    for i, node in enumerate(nodes):
        if node["val"] == target_val:
            tracer.add_trace("found", to_view(i), 4, f"✅ 找到 {target_val}！位于第 {i+1} 个节点")
            found = True
            break
        else:
            tracer.add_trace("check", to_view(i), 3, f"当前节点 {node['val']} ≠ {target_val}，继续向后")
    if not found:
        tracer.add_trace("not_found", to_view(), 5, f"❌ 未找到 {target_val}")
    
    return jsonify({"code": 200, "traces": tracer.traces})


@linear_bp.route('/list/delete', methods=['POST'])
def delete():
    data = request.json
    numbers = data.get('numbers', [])
    target = data.get('target', '')
    try:
        target_val = int(target)
    except:
        return jsonify({"code": 400, "message": "无效数字"})
    
    tracer = OperationTracer()
    vals = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    
    nodes = [{"val": v, "id": f"n_{v}", "next": None} for v in vals]
    for i in range(len(nodes)-1):
        nodes[i]["next"] = nodes[i+1]
    
    def to_view(hl=-1, deleted=-1):
        return [{"val": n["val"], "id": n["id"], "highlight": (i == hl), "deleted": (i == deleted)}
                for i, n in enumerate(nodes)]
    
    tracer.add_trace("start", to_view(), 1, f"准备删除节点 {target_val}...")
    new_vals = [v for v in vals]
    if target_val in new_vals:
        idx = new_vals.index(target_val)
        tracer.add_trace("found", to_view(idx), 3, f"找到节点 {target_val}（第 {idx+1} 个），执行删除")
        new_vals.remove(target_val)
        new_nodes = [{"val": v, "id": f"n_{v}", "next": None} for v in new_vals]
        tracer.add_trace("done", [{"val": n["val"], "id": n["id"]} for n in new_nodes], 5,
                         f"✅ 已删除节点 {target_val}，链表剩余 {len(new_vals)} 个节点")
    else:
        tracer.add_trace("not_found", to_view(), 5, f"❌ 链表中未找到 {target_val}")
        new_vals = vals
    
    return jsonify({"code": 200, "traces": tracer.traces, "newNumbers": new_vals})
