from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer
import uuid

heap_bp = Blueprint('heap', __name__, url_prefix='/api/tree/heap')

class HeapSortDemo:
    def __init__(self):
        self.tracer = OperationTracer()
        self.arr = []
        self.node_ids = []
        self.heap_size = 0  # track logical heap size for rendering

    def _to_d3_format(self, size=None):
        """Convert array representation of heap to D3 tree format.
        Only renders indices 0..size-1 as the "active" heap.
        """
        n = size if size is not None else len(self.arr)

        def build(index):
            if index >= n:
                return None
            d3_node = {
                "name": str(self.arr[index]),
                "uuid": self.node_ids[index],
                "children": []
            }
            left = build(2 * index + 1)
            right = build(2 * index + 2)
            if left:  d3_node["children"].append(left)
            if right: d3_node["children"].append(right)
            if not d3_node["children"]: del d3_node["children"]
            return d3_node

        return build(0)

    # ------------------------------------------------------------------ #
    # Front-end pythonCode line numbers (1-indexed):                      #
    #  1  class HeapSortDemo:                                              #
    #  2      def heapify(self, n, i):                                     #
    #  3          largest = i                                              #
    #  4          l = 2*i+1; r = 2*i+2                                    #
    #  5                                                                   #
    #  6          if l < n and arr[l] > arr[largest]:                      #
    #  7              largest = l                                          #
    #  8          if r < n and arr[r] > arr[largest]:                      #
    #  9              largest = r                                          #
    # 10                                                                   #
    # 11          if largest != i:                                         #
    # 12              arr[i], arr[largest] = arr[largest], arr[i]          #
    # 13              self.heapify(n, largest)     # recurse               #
    # 14                                                                   #
    # 15      def sort(self, arr):                                         #
    # 16          n = len(arr)                                             #
    # 17          # Build max-heap                                         #
    # 18          for i in range(n//2-1, -1, -1):                         #
    # 19              self.heapify(n, i)                                   #
    # 20          # 初始大顶堆建好                                          #
    # 21          for i in range(n-1, 0, -1):                              #
    # 22              arr[i], arr[0] = arr[0], arr[i]  # 提取最大值        #
    # 23              self.heapify(i, 0)                                   #
    # ------------------------------------------------------------------ #

    def heapify(self, n, i, phase=""):
        largest = i
        l = 2 * i + 1
        r = 2 * i + 2

        self.tracer.add_trace("compare", self._to_d3_format(n), 3,
                              f"{phase} 以索引 {i}（值 {self.arr[i]}）为 largest，比较左右子节点")

        if l < n and self.arr[l] > self.arr[largest]:
            largest = l
            self.tracer.add_trace("compare", self._to_d3_format(n), 7,
                                  f"{phase} 左子 {self.arr[l]} 更大，largest ← {l}")

        if r < n and self.arr[r] > self.arr[largest]:
            largest = r
            self.tracer.add_trace("compare", self._to_d3_format(n), 9,
                                  f"{phase} 右子 {self.arr[r]} 更大，largest ← {r}")

        if largest != i:
            self.tracer.add_trace("swap", self._to_d3_format(n), 12,
                                  f"{phase} 交换 arr[{i}]={self.arr[i]} 与 arr[{largest}]={self.arr[largest]}")
            self.arr[i], self.arr[largest] = self.arr[largest], self.arr[i]
            self.node_ids[i], self.node_ids[largest] = self.node_ids[largest], self.node_ids[i]

            self.tracer.add_trace("recurse", self._to_d3_format(n), 13,
                                  f"{phase} 递归向下调整子树 heapify(n={n}, i={largest})")
            self.heapify(n, largest, phase)
        else:
            self.tracer.add_trace("balanced", self._to_d3_format(n), 11,
                                  f"{phase} 节点 {self.arr[i]} 已满足堆性质，无需交换")

    def sort(self, arr):
        self.arr = arr
        n = len(arr)
        self.node_ids = [f"n_{val}_{uuid.uuid4().hex[:4]}" for val in arr]

        self.tracer.add_trace("start", self._to_d3_format(n), 15,
                              f"开始堆排序，输入数组: {arr}")

        # Phase 1: Build max-heap
        self.tracer.add_trace("build_start", self._to_d3_format(n), 18,
                              "阶段1：从最后一个非叶节点向上建大顶堆")
        for i in range(n // 2 - 1, -1, -1):
            self.tracer.add_trace("build_node", self._to_d3_format(n), 19,
                                  f"对索引 {i}（值 {self.arr[i]}）执行 heapify")
            self.heapify(n, i, "[建堆]")

        self.tracer.add_trace("build_done", self._to_d3_format(n), 20,
                              f"✅ 大顶堆建立完成，堆顶最大值 = {self.arr[0]}")

        # Phase 2: Extract elements
        self.tracer.add_trace("extract_phase", self._to_d3_format(n), 21,
                              "阶段2：逐步将堆顶最大值放到数组末尾")
        for i in range(n - 1, 0, -1):
            self.tracer.add_trace("extract", self._to_d3_format(i + 1), 22,
                                  f"将堆顶 {self.arr[0]} 与末尾 {self.arr[i]} 交换，已排序 {n - i} 个")
            self.arr[i], self.arr[0] = self.arr[0], self.arr[i]
            self.node_ids[i], self.node_ids[0] = self.node_ids[0], self.node_ids[i]

            self.tracer.add_trace("reheapify", self._to_d3_format(i), 23,
                                  f"对剩余 {i} 个节点重新 heapify")
            self.heapify(i, 0, "[排序]")

        self.tracer.add_trace("done", self._to_d3_format(1), 23,
                              f"🎉 堆排序完成！已排序数组: {sorted(arr)}")


@heap_bp.route('/visualize', methods=['POST'])
def visualize():
    data = request.json
    numbers = data.get('numbers', [])
    arr = [int(n) for n in numbers]

    demo = HeapSortDemo()
    demo.sort(arr)

    return jsonify({"code": 200, "traces": demo.tracer.traces})
