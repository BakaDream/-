from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer

linear_basic_bp = Blueprint('linear_basic', __name__, url_prefix='/api/linear/basic')

class LinearBasicDemo:
    def __init__(self):
        self.tracer = OperationTracer()

    def _to_view_data(self, arr, hl=-1, hls=None):
        if hls is None:
            hls = []
        return [{"val": v, "id": f"n_{i}_{v}", "highlight": (i == hl or i in hls), "index": i} for i, v in enumerate(arr)]

    def insert_at(self, arr, index, val):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, f"准备在索引 {index} 处插入值 {val}")
        
        if index < 0 or index > len(arr):
            self.tracer.add_trace("error", self._to_view_data(arr), 2, f"❌ 索引 {index} 越界！有效范围: 0 ~ {len(arr)}")
            return arr
            
        new_arr = arr[:]
        new_arr.insert(index, val)
        self.tracer.add_trace("insert", self._to_view_data(new_arr, hl=index), 4, f"✅ 在索引 {index} 插入新元素 {val}")
        return new_arr

    def delete_at(self, arr, index):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, f"准备删除索引 {index} 处的元素")
        
        if index < 0 or index >= len(arr):
            self.tracer.add_trace("error", self._to_view_data(arr), 2, f"❌ 索引 {index} 越界！有效范围: 0 ~ {len(arr)-1}")
            return arr
            
        target_val = arr[index]
        self.tracer.add_trace("find", self._to_view_data(arr, hl=index), 3, f"找到要删除的元素: {target_val}，准备移除")
        
        new_arr = arr[:]
        new_arr.pop(index)
        self.tracer.add_trace("delete", self._to_view_data(new_arr), 5, f"✅ 成功移除元素 {target_val}")
        return new_arr

    def update_at(self, arr, index, val):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, f"准备将索引 {index} 处的元素修改为 {val}")
        
        if index < 0 or index >= len(arr):
            self.tracer.add_trace("error", self._to_view_data(arr), 2, f"❌ 索引 {index} 越界！有效范围: 0 ~ {len(arr)-1}")
            return arr
            
        old_val = arr[index]
        self.tracer.add_trace("find", self._to_view_data(arr, hl=index), 3, f"查找到原元素: {old_val}")
        
        new_arr = arr[:]
        new_arr[index] = val
        self.tracer.add_trace("update", self._to_view_data(new_arr, hl=index), 5, f"✅ 已将索引 {index} 处的值更新为 {val}")
        return new_arr

    def get_at(self, arr, index):
        self.tracer.add_trace("start", self._to_view_data(arr), 1, f"准备获取索引 {index} 处的元素")
        
        if index < 0 or index >= len(arr):
            self.tracer.add_trace("error", self._to_view_data(arr), 2, f"❌ 索引 {index} 越界！有效范围: 0 ~ {len(arr)-1}")
            return arr
            
        target_val = arr[index]
        self.tracer.add_trace("found", self._to_view_data(arr, hl=index), 3, f"✅ 成功获取索引 {index} 处的元素：{target_val}")
        return arr

def _parse_input(data):
    numbers = data.get('numbers', [])
    arr = [int(n) for n in numbers if str(n).strip().lstrip('-').isdigit()]
    return arr

@linear_basic_bp.route('/insert', methods=['POST'])
def handle_insert():
    data = request.json
    arr = _parse_input(data)
    try:
        index = int(data.get('index', 0))
        val = int(data.get('target', 0))
    except:
        return jsonify({"code": 400, "message": "无效数字"})
        
    demo = LinearBasicDemo()
    new_arr = demo.insert_at(arr, index, val)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": new_arr})

@linear_basic_bp.route('/delete', methods=['POST'])
def handle_delete():
    data = request.json
    arr = _parse_input(data)
    try:
        index = int(data.get('index', 0))
    except:
        return jsonify({"code": 400, "message": "无效数字"})
        
    demo = LinearBasicDemo()
    new_arr = demo.delete_at(arr, index)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": new_arr})

@linear_basic_bp.route('/update', methods=['POST'])
def handle_update():
    data = request.json
    arr = _parse_input(data)
    try:
        index = int(data.get('index', 0))
        val = int(data.get('target', 0))
    except:
        return jsonify({"code": 400, "message": "无效数字"})
        
    demo = LinearBasicDemo()
    new_arr = demo.update_at(arr, index, val)
    return jsonify({"code": 200, "traces": demo.tracer.traces, "newNumbers": new_arr})

@linear_basic_bp.route('/get', methods=['POST'])
def handle_get():
    data = request.json
    arr = _parse_input(data)
    try:
        index = int(data.get('index', 0))
    except:
        return jsonify({"code": 400, "message": "无效数字"})
        
    demo = LinearBasicDemo()
    demo.get_at(arr, index)
    return jsonify({"code": 200, "traces": demo.tracer.traces})
