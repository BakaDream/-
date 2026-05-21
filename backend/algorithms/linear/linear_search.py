from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer

linear_search_bp = Blueprint('linear_search', __name__, url_prefix='/api/linear/search')

class LinearSearchDemo:
    def __init__(self):
        self.tracer = OperationTracer()

    def _pointer(self, name, color):
        return {"name": name, "color": color}

    def _append_pointer(self, pointer_map, index, name, color):
        pointer_map.setdefault(index, []).append(self._pointer(name, color))

    def _to_view_data(self, arr, hl1=-1, bound_l=-1, bound_r=-1, pointer_map=None):
        pointer_map = pointer_map or {}
        return [{"val": v, "id": f"n_{i}_{v}", 
                 "highlight": (i == hl1), 
                 "searchBounds": (bound_l <= i <= bound_r) if bound_l != -1 else False,
                 "pointers": pointer_map.get(i, []),
                 "index": i} 
                for i, v in enumerate(arr)]

    def sequential_search(self, arr, target):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, f"开始顺序查找目标值 {target}，从前向后逐个遍历")
        
        found = False
        for i in range(len(arr)):
            self.tracer.add_trace(
                "compare",
                self._to_view_data(arr, hl1=i, pointer_map={i: [self._pointer("i", "#f59e0b")]}),
                3,
                f"比较当前元素 {arr[i]} 与目标值 {target}"
            )
            if arr[i] == target:
                self.tracer.add_trace(
                    "found",
                    self._to_view_data(arr, hl1=i, pointer_map={i: [self._pointer("i", "#22c55e")]}),
                    5,
                    f"✅ 找到目标值 {target}！位于索引 {i}"
                )
                found = True
                break
                
        if not found:
            self.tracer.add_trace("not_found", self._to_view_data(arr), 6, f"❌ 遍历完整个数组，未找到目标值 {target}")

    def binary_search(self, arr, target):
        # NOTE: Array must be sorted for binary search. We check and sort if not.
        n = len(arr)
        if arr != sorted(arr):
            arr = sorted(arr)
            self.tracer.add_trace("sort", self._to_view_data(arr), 1, "执行折半查找前，数组必须是有序的，已自动为您排序")
            
        self.tracer.add_trace("start", self._to_view_data(arr, bound_l=0, bound_r=n-1), 2, f"开始折半查找目标值 {target}，维护左右边界 L=0, R={n-1}")
        
        left, right = 0, n - 1
        found = False
        
        while left <= right:
            mid = (left + right) // 2
            pointer_map = {}
            self._append_pointer(pointer_map, left, "L", "#38bdf8")
            self._append_pointer(pointer_map, mid, "M", "#f59e0b")
            self._append_pointer(pointer_map, right, "R", "#f472b6")
            self.tracer.add_trace("mid", self._to_view_data(arr, hl1=mid, bound_l=left, bound_r=right, pointer_map=pointer_map), 3, f"计算中间位置 mid = ({left} + {right}) / 2 = {mid}，当前值为 {arr[mid]}")
            
            if arr[mid] == target:
                self.tracer.add_trace("found", self._to_view_data(arr, hl1=mid, bound_l=left, bound_r=right, pointer_map=pointer_map), 5, f"✅ 找到目标值 {target}！位于索引 {mid}")
                found = True
                break
            elif arr[mid] < target:
                left = mid + 1
                update_map = {}
                if left <= right:
                    self._append_pointer(update_map, left, "L", "#38bdf8")
                    self._append_pointer(update_map, right, "R", "#f472b6")
                self.tracer.add_trace("update_bounds", self._to_view_data(arr, bound_l=left, bound_r=right, pointer_map=update_map), 4, f"当前值 {arr[mid]} < 目标值 {target}，更新左边界 L = {left}")
            else:
                right = mid - 1
                update_map = {}
                if left <= right:
                    self._append_pointer(update_map, left, "L", "#38bdf8")
                    self._append_pointer(update_map, right, "R", "#f472b6")
                self.tracer.add_trace("update_bounds", self._to_view_data(arr, bound_l=left, bound_r=right, pointer_map=update_map), 4, f"当前值 {arr[mid]} > 目标值 {target}，更新右边界 R = {right}")
                
        if not found:
            self.tracer.add_trace("not_found", self._to_view_data(arr), 6, f"❌ 查找范围缩小至空 (L>R)，未找到目标值 {target}")
        
        return arr # Return potentially sorted array


def _parse_input(data):
    numbers = data.get('numbers', [])
    arr = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    return arr

@linear_search_bp.route('/sequential', methods=['POST'])
def handle_sequential():
    data = request.json
    arr = _parse_input(data)
    try:
        target = int(data.get('target', 0))
    except:
        return jsonify({"code": 400, "message": "无效数字"})
        
    demo = LinearSearchDemo()
    demo.sequential_search(arr, target)
    return jsonify({"code": 200, "traces": demo.tracer.traces})

@linear_search_bp.route('/binary', methods=['POST'])
def handle_binary():
    data = request.json
    arr = _parse_input(data)
    try:
        target = int(data.get('target', 0))
    except:
        return jsonify({"code": 400, "message": "无效数字"})
        
    demo = LinearSearchDemo()
    new_arr = demo.binary_search(arr, target)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": new_arr})
