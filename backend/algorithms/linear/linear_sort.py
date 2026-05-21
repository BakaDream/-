from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer

linear_sort_bp = Blueprint('linear_sort', __name__, url_prefix='/api/linear/sort')

class LinearSortDemo:
    def __init__(self):
        self.tracer = OperationTracer()

    def _pointer(self, name, color):
        return {"name": name, "color": color}

    def _to_view_data(self, arr, hl1=-1, hl2=-1, sorted_idx=-1, pointer_map=None):
        # hl1, hl2 for comparing elements. sorted_idx for elements correctly placed
        pointer_map = pointer_map or {}
        return [{"val": v, "id": f"n_{i}_{v}", 
                 "highlight": (i == hl1 or i == hl2), 
                 "done": (i >= sorted_idx if sorted_idx != -1 else False),
                 "pointers": pointer_map.get(i, []),
                 "index": i} 
                for i, v in enumerate(arr)]

    def bubble_sort(self, arr):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, "开始冒泡排序，比较相邻两个元素，将大的往后移")
        n = len(arr)
        if n <= 1:
            self.tracer.add_trace("done", self._to_view_data(arr, sorted_idx=0), 2, "数组长度<=1，无需排序")
            return arr

        new_arr = arr[:]
        for i in range(n):
            swapped = False
            for j in range(0, n - i - 1):
                pointers = {
                    j: [self._pointer("j", "#f8fafc")],
                    j + 1: [self._pointer("j+1", "#fde68a")]
                }
                self.tracer.add_trace("compare", self._to_view_data(new_arr, j, j+1, n-i, pointers), 3, f"比较元素 {new_arr[j]} 和 {new_arr[j+1]}")
                if new_arr[j] > new_arr[j+1]:
                    new_arr[j], new_arr[j+1] = new_arr[j+1], new_arr[j]
                    swapped = True
                    self.tracer.add_trace("swap", self._to_view_data(new_arr, j, j+1, n-i, pointers), 4, f"因为 {new_arr[j+1]} > {new_arr[j]}，交换它们")
            
            self.tracer.add_trace("round_done", self._to_view_data(new_arr, sorted_idx=n-i-1), 5, f"第 {i+1} 轮结束，最大值已归位，如果在这一轮没发生交换说明已经排好序完成。")
            
            if not swapped:
                break
                
        self.tracer.add_trace("done", self._to_view_data(new_arr, sorted_idx=0), 6, "🎉 冒泡排序完成！")
        return new_arr

    def insertion_sort(self, arr):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, "开始插入排序，把后面的元素一个个插入到前面已经排好的部分中")
        n = len(arr)
        if n <= 1:
            self.tracer.add_trace("done", self._to_view_data(arr, sorted_idx=0), 2, "数组长度<=1，无需排序")
            return arr

        new_arr = arr[:]
        for i in range(1, n):
            key = new_arr[i]
            j = i - 1
            self.tracer.add_trace(
                "pick",
                self._to_view_data(new_arr, hl1=i, pointer_map={i: [self._pointer("key", "#fef08a"), self._pointer("i", "#f8fafc")]}),
                3,
                f"选取当前要插入的元素: {key}"
            )
            
            while j >= 0 and key < new_arr[j]:
                pointers = {
                    j: [self._pointer("j", "#f8fafc")],
                    j + 1: [self._pointer("j+1", "#fca5a5")],
                    i: [self._pointer("key", "#fef08a"), self._pointer("i", "#c4b5fd")] if i == j or i == j + 1 else [self._pointer("i", "#c4b5fd")]
                }
                self.tracer.add_trace("shift", self._to_view_data(new_arr, hl1=j, hl2=j+1, pointer_map=pointers), 4, f"{key} 小于 {new_arr[j]}，将 {new_arr[j]} 后移")
                new_arr[j + 1] = new_arr[j]
                j -= 1
                
            new_arr[j + 1] = key
            self.tracer.add_trace(
                "insert",
                self._to_view_data(new_arr, hl1=j+1, pointer_map={j + 1: [self._pointer("insert", "#86efac")], i: [self._pointer("i", "#c4b5fd")] if i != j + 1 else [self._pointer("insert", "#86efac"), self._pointer("i", "#c4b5fd")]}),
                5,
                f"将 {key} 插入到正确位置"
            )
            
        self.tracer.add_trace("done", self._to_view_data(new_arr, sorted_idx=0), 6, "🎉 插入排序完成！")
        return new_arr

def _parse_input(data):
    numbers = data.get('numbers', [])
    arr = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    return arr

@linear_sort_bp.route('/bubble', methods=['POST'])
def handle_bubble():
    data = request.json
    arr = _parse_input(data)
    demo = LinearSortDemo()
    new_arr = demo.bubble_sort(arr)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": new_arr})

@linear_sort_bp.route('/insertion', methods=['POST'])
def handle_insertion():
    data = request.json
    arr = _parse_input(data)
    demo = LinearSortDemo()
    new_arr = demo.insertion_sort(arr)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": new_arr})
