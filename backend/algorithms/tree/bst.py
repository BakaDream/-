from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer

tree_bp = Blueprint('tree', __name__, url_prefix='/api/tree')

class BSTDemo:
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
        if node["left"]: d3_node["children"].append(self._to_d3_format(node["left"]))
        if node["right"]: d3_node["children"].append(self._to_d3_format(node["right"]))
        if not d3_node["children"]: del d3_node["children"]
        return d3_node

    # Helper to silently build tree without tracing
    def build_silently(self, values):
        for val in values:
            self._insert_silent(val)

    def _insert_silent(self, val):
        new_node = {"val": val, "left": None, "right": None, "id": f"n_{val}"}
        if not self.root:
            self.root = new_node
            return
        current = self.root
        while True:
            if val < current["val"]:
                if current["left"] is None:
                    current["left"] = new_node
                    break
                else: current = current["left"]
            else:
                if current["right"] is None:
                    current["right"] = new_node
                    break
                else: current = current["right"]

    def insert(self, val):
        self.tracer.add_trace("start", self._to_d3_format(self.root), 2, f"准备插入数字 {val}")
        new_node = {"val": val, "left": None, "right": None, "id": f"n_{val}"}

        if not self.root:
            self.root = new_node
            self.tracer.add_trace("insert", self._to_d3_format(self.root), 6, f"树为空，{val} 成为根节点")
            return

        current = self.root
        while True:
            self.tracer.add_trace("compare", self._to_d3_format(self.root), 11, f"{val} 与 {current['val']} 比较")
            if val < current["val"]:
                if current["left"] is None:
                    current["left"] = new_node
                    self.tracer.add_trace("insert", self._to_d3_format(self.root), 13, f"{val} 小于 {current['val']}，放入左子树")
                    break
                else:
                    current = current["left"]
                    self.tracer.add_trace("move", self._to_d3_format(self.root), 16, f"向左移动")
            else:
                if current["right"] is None:
                    current["right"] = new_node
                    self.tracer.add_trace("insert", self._to_d3_format(self.root), 19, f"{val} 大于 {current['val']}，放入右子树")
                    break
                else:
                    current = current["right"]
                    self.tracer.add_trace("move", self._to_d3_format(self.root), 22, f"向右移动")

    def search(self, target):
        self.tracer.add_trace("start", self._to_d3_format(self.root), 25, f"开始查找目标值: {target}")
        current = self.root
        
        while current:
            self.tracer.add_trace("compare", self._to_d3_format(self.root), 28, f"{target} 与 {current['val']} 比较")
            if current["val"] == target:
                self.tracer.add_trace("found", self._to_d3_format(self.root), 30, f"🎉 找到目标值 {target}！")
                return True
            elif target < current["val"]:
                self.tracer.add_trace("move", self._to_d3_format(self.root), 32, f"{target} < {current['val']}，向左查找")
                current = current["left"]
            else:
                self.tracer.add_trace("move", self._to_d3_format(self.root), 35, f"{target} > {current['val']}，向右查找")
                current = current["right"]
                
        self.tracer.add_trace("not_found", self._to_d3_format(self.root), 37, f"❌ 树中不存在目标值 {target}")
        return False

    def delete(self, target):
        self.tracer.add_trace("start", self._to_d3_format(self.root), 40, f"准备删除节点: {target}")
        
        parent = None
        current = self.root
        
        # Search for node to delete
        while current and current["val"] != target:
            parent = current
            self.tracer.add_trace("compare", self._to_d3_format(self.root), 45, f"寻找要删除的节点，当前比较 {current['val']}")
            if target < current["val"]:
                current = current["left"]
            else:
                current = current["right"]

        if not current:
            self.tracer.add_trace("not_found", self._to_d3_format(self.root), 50, f"❌ 找不到节点 {target}，无法删除")
            return False

        self.tracer.add_trace("found_target", self._to_d3_format(self.root), 52, f"📌 找到待删除节点 {current['val']}")

        # Case 1: Leaf node
        if not current["left"] and not current["right"]:
            self.tracer.add_trace("case1", self._to_d3_format(self.root), 55, "情况1: 待删除节点是叶子节点，直接删除")
            if not parent:
                self.root = None # root deletion
            elif parent["left"] == current:
                parent["left"] = None
            else:
                parent["right"] = None
                
        # Case 2: One child
        elif not current["left"] or not current["right"]:
            child = current["left"] if current["left"] else current["right"]
            self.tracer.add_trace("case2", self._to_d3_format(self.root), 63, "情况2: 待删除节点只有1个子节点，用子节点顶替它的位置")
            if not parent:
                self.root = child
            elif parent["left"] == current:
                parent["left"] = child
            else:
                parent["right"] = child
                
        # Case 3: Two children
        else:
            self.tracer.add_trace("case3", self._to_d3_format(self.root), 71, "情况3: 待删除节点有2个子节点，寻找右子树的最小值(后继节点)替代")
            successor_parent = current
            successor = current["right"]
            
            while successor["left"]:
                successor_parent = successor
                successor = successor["left"]
                self.tracer.add_trace("search_succ", self._to_d3_format(self.root), 76, f"寻找后继节点，当前到达 {successor['val']}")
                
            self.tracer.add_trace("found_succ", self._to_d3_format(self.root), 78, f"找到后继节点 {successor['val']}，它的值将覆盖待删除节点")
            current["val"] = successor["val"]
            current["id"] = successor["id"] # Maintain uuid mapping just in case
            
            self.tracer.add_trace("replace", self._to_d3_format(self.root), 80, f"节点值已替换为 {successor['val']}，接下来删除原后继节点")
            
            # Delete successor (which is guaranteed to have at most one right child)
            if successor_parent["left"] == successor:
                successor_parent["left"] = successor["right"]
            else:
                successor_parent["right"] = successor["right"]

        self.tracer.add_trace("deleted", self._to_d3_format(self.root), 86, f"✅ 成功删除节点 {target}")
        return True


@tree_bp.route('/bst/visualize', methods=['POST'])
def visualize():
    data = request.json
    numbers = data.get('numbers', [])
    bst = BSTDemo()
    for n in numbers: bst.insert(int(n))
    return jsonify({"code": 200, "traces": bst.tracer.traces})


# -------------------- NEW CRUD ENDPOINTS --------------------

@tree_bp.route('/bst/search', methods=['POST'])
def bst_search():
    data = request.json
    numbers = data.get('numbers', [])
    target = int(data.get('target', 0))
    
    bst = BSTDemo()
    bst.build_silently(numbers) # Build current state silently
    bst.search(target)          # Run trace-enabled search
    
    return jsonify({"code": 200, "traces": bst.tracer.traces})


@tree_bp.route('/bst/delete', methods=['POST'])
def bst_delete():
    data = request.json
    numbers = data.get('numbers', [])
    target = int(data.get('target', 0))
    
    bst = BSTDemo()
    bst.build_silently(numbers) # Build current state silently
    success = bst.delete(target)
    
    # Calculate new array state
    new_numbers = [n for n in numbers if n != target] if success else numbers
    
    return jsonify({
        "code": 200, 
        "traces": bst.tracer.traces, 
        "newNumbers": new_numbers,
        "success": success
    })


@tree_bp.route('/bst/insert_one', methods=['POST'])
def bst_insert_one():
    data = request.json
    numbers = data.get('numbers', [])
    target = int(data.get('target', 0))
    
    bst = BSTDemo()
    bst.build_silently(numbers) # Build current state silently
    bst.insert(target)          # Trace the insertion of the single new node
    
    # Calculate new array state
    new_numbers = numbers + [target] if target not in numbers else numbers
    
    return jsonify({
        "code": 200, 
        "traces": bst.tracer.traces,
        "newNumbers": new_numbers
    })