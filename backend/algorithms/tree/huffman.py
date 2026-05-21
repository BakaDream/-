from flask import Blueprint, request, jsonify
from core.tracer import OperationTracer
import uuid
import heapq

huffman_bp = Blueprint('huffman', __name__, url_prefix='/api/tree/huffman')

# Front-end pythonCode line numbers (1-indexed from Huffman.vue):
#  1  class HuffmanTreeDemo:
#  2      def build_tree(self, frequencies):
#  3          forest = [Node(char, freq) for char, freq in frequencies.items()]
#  4          heapq.heapify(forest)
#  5          
#  6          while len(forest) > 1:
#  7              left = heapq.heappop(forest)
#  8              right = heapq.heappop(forest)
#  9              
# 10              merged = Node(None, left.freq + right.freq)
# 11              merged.left = left
# 12              merged.right = right
# 13              
# 14              heapq.heappush(forest, merged)
# 15              
# 16          self.root = forest[0]

class HuffmanNode:
    def __init__(self, char, freq):
        self.char = char
        self.freq = freq
        self.left = None
        self.right = None
        self.id = f"n_{freq}_{uuid.uuid4().hex[:4]}"

    def __lt__(self, other):
        return self.freq < other.freq


class HuffmanTreeDemo:
    def __init__(self):
        self.tracer = OperationTracer()
        self.root = None

    def _to_d3_format(self, node):
        if not node: return None
        name = f"{node.char}:{node.freq}" if node.char else str(node.freq)
        d3_node = {
            "name": name,
            "uuid": node.id,
            "children": []
        }
        if node.left:  d3_node["children"].append(self._to_d3_format(node.left))
        if node.right: d3_node["children"].append(self._to_d3_format(node.right))
        if not d3_node["children"]: del d3_node["children"]
        return d3_node

    def build_tree(self, frequencies):
        # line 2: start
        self.tracer.add_trace("start", None, 2, f"开始构建哈夫曼树，频率表: {frequencies}")

        # line 3-4: build initial forest and heapify
        forest = [HuffmanNode(char, freq) for char, freq in frequencies.items()]
        heapq.heapify(forest)
        self.tracer.add_trace("init", None, 4, f"初始化优先队列（最小堆），共 {len(forest)} 个节点")

        # line 6: main loop
        while len(forest) > 1:
            self.tracer.add_trace("loop", None, 6, f"队列中还有 {len(forest)} 个节点，继续合并")

            # line 7: pop left (smallest)
            left = heapq.heappop(forest)
            label_l = f"{left.char}:{left.freq}" if left.char else str(left.freq)
            self.tracer.add_trace("pop_left", self._to_d3_format(left), 7, f"弹出最小节点（左子树）：{label_l}")

            # line 8: pop right (second smallest)
            right = heapq.heappop(forest)
            label_r = f"{right.char}:{right.freq}" if right.char else str(right.freq)
            self.tracer.add_trace("pop_right", self._to_d3_format(right), 8, f"弹出次小节点（右子树）：{label_r}")

            # line 10-12: merge
            merged = HuffmanNode(None, left.freq + right.freq)
            merged.left = left
            merged.right = right
            self.tracer.add_trace("merge", self._to_d3_format(merged), 10,
                                  f"合并两节点，新节点频率 = {left.freq} + {right.freq} = {merged.freq}")

            # line 14: push back
            heapq.heappush(forest, merged)
            self.tracer.add_trace("push", self._to_d3_format(merged), 14,
                                  f"将合并后的节点（频率={merged.freq}）推回优先队列")

        if forest:
            self.root = forest[0]
            # line 16: done
            self.tracer.add_trace("done", self._to_d3_format(self.root), 16,
                                  "🎉 哈夫曼树构建完成！根节点频率 = " + str(self.root.freq))


@huffman_bp.route('/visualize', methods=['POST'])
def visualize():
    data = request.json
    numbers = data.get('numbers', [])

    # Map input numbers to frequencies with labels A, B, C...
    frequencies = {chr(65 + i): int(n) for i, n in enumerate(numbers)}

    demo = HuffmanTreeDemo()
    demo.build_tree(frequencies)

    return jsonify({"code": 200, "traces": demo.tracer.traces})
