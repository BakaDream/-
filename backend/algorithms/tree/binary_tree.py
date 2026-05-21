from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer
from collections import deque
import uuid

binary_tree_bp = Blueprint('binary_tree', __name__, url_prefix='/api/tree/binary')

# Front-end pythonCode line numbers (1-indexed from BinaryTree.vue):
#  1  class BinaryTreeDemo:
#  2      def build_level_order(self, values):
#  3          nodes = [Node(v) for v in values]
#  4          self.root = nodes[0]
#  5          
#  6          queue = [self.root]
#  7          i = 1
#  8          while i < len(nodes) and queue:
#  9              current = queue.pop(0)
# 10              
# 11              if i < len(nodes):
# 12                  current.left = nodes[i]
# 13                  queue.append(current.left)
# 14                  i += 1
# 15              
# 16              if i < len(nodes):
# 17                  current.right = nodes[i]
# 18                  queue.append(current.right)
# 19                  i += 1

class BinaryTreeDemo:
    def __init__(self):
        self.tracer = OperationTracer()
        self.root = None

    def _to_d3_format(self, node):
        if not node: return None
        d3_node = {
            "name": str(node["val"]),
            "uuid": node["id"],
            "children": []
        }
        if node["left"]:  d3_node["children"].append(self._to_d3_format(node["left"]))
        if node["right"]: d3_node["children"].append(self._to_d3_format(node["right"]))
        if not d3_node["children"]: del d3_node["children"]
        return d3_node

    def build_level_order(self, values):
        if not values: return

        # line 2: announce start
        self.tracer.add_trace("start", None, 2, f"开始按层序构建二叉树，共 {len(values)} 个节点: {values}")

        # line 3-4: create nodes, set root
        nodes = [{"val": v, "left": None, "right": None, "id": f"n_{uuid.uuid4().hex[:8]}"} for v in values]
        self.root = nodes[0]
        self.tracer.add_trace("set_root", self._to_d3_format(self.root), 4, f"将 {self.root['val']} 设为根节点")

        # line 6-9: init queue
        queue = deque([self.root])
        i = 1
        self.tracer.add_trace("queue_init", self._to_d3_format(self.root), 6, "初始化队列，根节点入队")

        while i < len(nodes) and queue:
            current = queue.popleft()
            self.tracer.add_trace("dequeue", self._to_d3_format(self.root), 9, f"弹出节点 {current['val']}，准备填充其子节点")

            # Left child - lines 11-14
            if i < len(nodes):
                self.tracer.add_trace("left_check", self._to_d3_format(self.root), 11, f"检查是否有左子节点可插入（i={i}）")
                current["left"] = nodes[i]
                self.tracer.add_trace("set_left", self._to_d3_format(self.root), 12, f"{nodes[i]['val']} 成为 {current['val']} 的左子节点")
                queue.append(current["left"])
                i += 1

            # Right child - lines 16-19
            if i < len(nodes):
                self.tracer.add_trace("right_check", self._to_d3_format(self.root), 16, f"检查是否有右子节点可插入（i={i}）")
                current["right"] = nodes[i]
                self.tracer.add_trace("set_right", self._to_d3_format(self.root), 17, f"{nodes[i]['val']} 成为 {current['val']} 的右子节点")
                queue.append(current["right"])
                i += 1

        self.tracer.add_trace("done", self._to_d3_format(self.root), 8, "🎉 二叉树构建完成！")


@binary_tree_bp.route('/visualize', methods=['POST'])
def visualize():
    data = request.json
    numbers = data.get('numbers', [])
    demo = BinaryTreeDemo()
    demo.build_level_order([int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()])
    return jsonify({"code": 200, "traces": demo.tracer.traces})


@binary_tree_bp.route('/insert_one', methods=['POST'])
def insert_one():
    data = request.json
    numbers = data.get('numbers', [])
    target  = data.get('target', '')
    try:
        val = int(target)
    except:
        return jsonify({"code": 400, "message": "无效数字"})
    all_vals = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()] + [val]
    demo = BinaryTreeDemo()
    demo.build_level_order(all_vals)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": all_vals})


@binary_tree_bp.route('/search', methods=['POST'])
def search():
    data = request.json
    numbers = data.get('numbers', [])
    target  = data.get('target', '')
    try:
        target_val = int(target)
    except:
        return jsonify({"code": 400, "message": "无效数字"})

    tracer = OperationTracer()
    vals = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    # Build tree then BFS search
    demo = BinaryTreeDemo()
    demo.build_level_order(vals)
    root = demo.root

    tracer.add_trace("start", demo._to_d3_format(root), 1, f"开始 BFS 查找 {target_val}...")
    queue = deque([root]) if root else deque()
    found = False
    while queue:
        node = queue.popleft()
        if node["val"] == target_val:
            node["highlight"] = True
            tracer.add_trace("found", demo._to_d3_format(root), 4, f"✅ 找到节点 {target_val}！")
            found = True
            break
        else:
            tracer.add_trace("check", demo._to_d3_format(root), 3, f"节点 {node['val']} ≠ {target_val}，继续搜索")
        if node.get("left"):  queue.append(node["left"])
        if node.get("right"): queue.append(node["right"])
    if not found:
        tracer.add_trace("not_found", demo._to_d3_format(root), 5, f"❌ 未找到节点 {target_val}")

    return jsonify({"code": 200, "traces": tracer.traces})


@binary_tree_bp.route('/delete', methods=['POST'])
def delete():
    data = request.json
    numbers = data.get('numbers', [])
    target  = data.get('target', '')
    try:
        target_val = int(target)
    except:
        return jsonify({"code": 400, "message": "无效数字"})

    tracer = OperationTracer()
    vals = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    demo = BinaryTreeDemo()
    demo.build_level_order(vals)
    root = demo.root

    tracer.add_trace("start", demo._to_d3_format(root), 1, f"准备删除节点 {target_val}（BFS 找目标和最深叶子）...")

    new_vals = [v for v in vals if v != target_val]
    if len(new_vals) < len(vals):
        demo2 = BinaryTreeDemo()
        demo2.build_level_order(new_vals)
        tracer.add_trace("found", demo._to_d3_format(root), 3, f"找到节点 {target_val}，用最深叶子值替代后删除")
        tracer.add_trace("done", demo2._to_d3_format(demo2.root) if demo2.root else {}, 5,
                         f"✅ 已删除 {target_val}，树剩余 {len(new_vals)} 个节点")
    else:
        tracer.add_trace("not_found", demo._to_d3_format(root), 5, f"❌ 树中未找到节点 {target_val}")
        new_vals = vals

    return jsonify({"code": 200, "traces": tracer.traces, "newNumbers": new_vals})
