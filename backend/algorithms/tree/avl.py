from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer
import uuid

avl_bp = Blueprint('avl', __name__, url_prefix='/api/tree/avl')

# Front-end pythonCode line numbers (1-indexed from AVL.vue):
#  1  class AVLTreeDemo:
#  2      def insert(self, root, val):
#  3          if not root:
#  4              return Node(val)
#  5          
#  6          if val < root.val:
#  7              root.left = self.insert(root.left, val)
#  8          elif val > root.val:
#  9              root.right = self.insert(root.right, val)
# 10          else:
# 11              return root
# 12          
# 13          root.height = 1 + max(height(root.left), height(root.right))
# 14          balance = get_balance(root)
# 15          
# 16          if balance > 1 and val < root.left.val:
# 17              return self._right_rotate(root)
# 18          if balance < -1 and val > root.right.val:
# 19              return self._left_rotate(root)
# 20          if balance > 1 and val > root.left.val:
# 21              root.left = self._left_rotate(root.left)
# 22              return self._right_rotate(root)
# 23          if balance < -1 and val < root.right.val:
# 24              root.right = self._right_rotate(root.right)
# 25              return self._left_rotate(root)
# 26          
# 27          return root
# 28      
# 29      def _right_rotate(self, y):     (line 29 in VUE = line-index 29)
# 30          x = y.left
# 31          T2 = x.right
# 32          x.right = y
# 33          y.left = T2
# 34          update_heights(y, x)
# 35          return x
# 36      
# 37      def _left_rotate(self, x):
# 38          y = x.right
# 39          T2 = y.left
# 40          y.left = x
# 41          x.right = T2
# 42          update_heights(x, y)
# 43          return y

class AVLTreeDemo:
    def __init__(self):
        self.tracer = OperationTracer()
        self.root = None

    def _to_d3_format(self, node):
        if not node: return None
        d3_node = {
            "name": f"{node['val']}(h:{self._height(node)})",
            "uuid": node["id"],
            "children": []
        }
        if node["left"] or node["right"]:
            d3_node["children"].append(self._to_d3_format(node["left"]) if node["left"] else {"name": "", "uuid": uuid.uuid4().hex})
            d3_node["children"].append(self._to_d3_format(node["right"]) if node["right"] else {"name": "", "uuid": uuid.uuid4().hex})
        if not node["left"] and not node["right"]:
            d3_node.pop("children", None)
        return d3_node

    def _height(self, node):
        return 0 if not node else node["height"]

    def _get_balance(self, node):
        return 0 if not node else self._height(node["left"]) - self._height(node["right"])

    def _right_rotate(self, y):
        # Lines 29-35 in frontend pythonCode
        self.tracer.add_trace("rotate", self._to_d3_format(self.root), 29, f"执行右旋：对节点 {y['val']} 进行右旋操作")
        x = y["left"]       # line 30
        T2 = x["right"]     # line 31
        x["right"] = y      # line 32
        y["left"] = T2      # line 33
        y["height"] = 1 + max(self._height(y["left"]), self._height(y["right"]))
        x["height"] = 1 + max(self._height(x["left"]), self._height(x["right"]))
        self.tracer.add_trace("rotate_done", self._to_d3_format(x), 35, f"右旋完成，{x['val']} 成为新的子树根节点，返回 x")
        return x

    def _left_rotate(self, x):
        # Lines 37-43 in frontend pythonCode
        self.tracer.add_trace("rotate", self._to_d3_format(self.root), 37, f"执行左旋：对节点 {x['val']} 进行左旋操作")
        y = x["right"]      # line 38
        T2 = y["left"]      # line 39
        y["left"] = x       # line 40
        x["right"] = T2     # line 41
        x["height"] = 1 + max(self._height(x["left"]), self._height(x["right"]))
        y["height"] = 1 + max(self._height(y["left"]), self._height(y["right"]))
        self.tracer.add_trace("rotate_done", self._to_d3_format(y), 43, f"左旋完成，{y['val']} 成为新的子树根节点，返回 y")
        return y

    def insert(self, root, val):
        if not root:
            # line 3-4: base case
            new_node = {"val": val, "left": None, "right": None, "height": 1, "id": f"n_{val}_{uuid.uuid4().hex[:4]}"}
            self.tracer.add_trace("insert_leaf", self._to_d3_format(self.root or new_node), 4, f"找到空位，创建新节点 {val}")
            return new_node

        # line 6: comparison
        self.tracer.add_trace("compare", self._to_d3_format(self.root), 2, f"比较 {val} 与当前节点 {root['val']}")

        if val < root["val"]:
            self.tracer.add_trace("move_left", self._to_d3_format(self.root), 6, f"{val} < {root['val']}，向左子树递归插入")
            root["left"] = self.insert(root["left"], val)
        elif val > root["val"]:
            self.tracer.add_trace("move_right", self._to_d3_format(self.root), 8, f"{val} > {root['val']}，向右子树递归插入")
            root["right"] = self.insert(root["right"], val)
        else:
            self.tracer.add_trace("dup", self._to_d3_format(self.root), 11, f"{val} 已存在，跳过")
            return root

        # Update height
        root["height"] = 1 + max(self._height(root["left"]), self._height(root["right"]))
        balance = self._get_balance(root)
        self.tracer.add_trace("balance_check", self._to_d3_format(self.root), 14, f"节点 {root['val']} 的平衡因子 = {balance}")

        # Left Left Case → Right Rotate
        if balance > 1 and val < root["left"]["val"]:
            self.tracer.add_trace("LL", self._to_d3_format(self.root), 16, f"平衡因子 {balance} > 1，LL 失衡，执行单次右旋")
            return self._right_rotate(root)

        # Right Right Case → Left Rotate
        if balance < -1 and val > root["right"]["val"]:
            self.tracer.add_trace("RR", self._to_d3_format(self.root), 18, f"平衡因子 {balance} < -1，RR 失衡，执行单次左旋")
            return self._left_rotate(root)

        # Left Right Case → Left Rotate on left child, then Right Rotate
        if balance > 1 and val > root["left"]["val"]:
            self.tracer.add_trace("LR_start", self._to_d3_format(self.root), 20, f"LR 失衡，先对左子节点 {root['left']['val']} 执行左旋")
            root["left"] = self._left_rotate(root["left"])
            self.tracer.add_trace("LR_mid", self._to_d3_format(self.root), 22, "LR：再对当前节点执行右旋")
            return self._right_rotate(root)

        # Right Left Case → Right Rotate on right child, then Left Rotate
        if balance < -1 and val < root["right"]["val"]:
            self.tracer.add_trace("RL_start", self._to_d3_format(self.root), 23, f"RL 失衡，先对右子节点 {root['right']['val']} 执行右旋")
            root["right"] = self._right_rotate(root["right"])
            self.tracer.add_trace("RL_mid", self._to_d3_format(self.root), 25, "RL：再对当前节点执行左旋")
            return self._left_rotate(root)

        self.tracer.add_trace("balanced", self._to_d3_format(self.root), 27, f"节点 {root['val']} 子树已平衡，返回")
        return root

    def do_insert(self, val):
        self.tracer.add_trace("start", self._to_d3_format(self.root), 1, f"======= 开始插入 {val} =======")
        self.root = self.insert(self.root, val)
        self.tracer.add_trace("done", self._to_d3_format(self.root), 27, f"✅ {val} 插入完成，树高 = {self._height(self.root)}")


@avl_bp.route('/visualize', methods=['POST'])
def visualize():
    data = request.json
    numbers = data.get('numbers', [])

    demo = AVLTreeDemo()
    for n in numbers:
        demo.do_insert(int(n))

    return jsonify({"code": 200, "traces": demo.tracer.traces})
