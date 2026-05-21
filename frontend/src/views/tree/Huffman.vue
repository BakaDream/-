<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    default-input="hello world"
    @onDraw="drawTree"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="huffman-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/tree/huffman';

const tabs = [
  { key: 'build',  label: '📦 创建', placeholder: '输入要编码的文本（如: hello world）', url: `${API}/visualize`, isInit: true },
  { key: 'insert', label: '➕ 添加字符', placeholder: '输入新字符（如: xyz）',          url: `${API}/visualize`, isInit: false },
  { key: 'search', label: '🔍 查找编码', placeholder: '输入要查找的字符（如: h）',      url: `${API}/visualize`, isInit: false },
  { key: 'delete', label: '🗑 删除字符', placeholder: '输入要删除的字符（如: l）',      url: `${API}/visualize`, isInit: false },
];

const codesMap = {
  build: [
    'def huffman_encode(text):',
    '    freq = Counter(text)',
    '    heap = [HuffNode(c, f) for c, f in freq.items()]',
    '    heapq.heapify(heap)',
    '    while len(heap) > 1:',
    '        l = heapq.heappop(heap)',
    '        r = heapq.heappop(heap)',
    '        merged = HuffNode(None, l.freq + r.freq)',
    '        merged.left, merged.right = l, r',
    '        heapq.heappush(heap, merged)',
    '    root = heap[0]',
    '    return build_codes(root)',
  ],
  insert: [
    '# 添加新字符：重新统计频率并重建哈夫曼树',
    'def add_char(text, new_chars):',
    '    text += new_chars',
    '    return huffman_encode(text)',
  ],
  search: [
    '# 查找指定字符的哈夫曼编码',
    'def find_code(codes, char):',
    '    return codes.get(char, "字符不存在")',
  ],
  delete: [
    '# 删除字符：从频率表移除后重建树',
    'def delete_char(text, char):',
    '    text = text.replace(char, "")',
    '    return huffman_encode(text)',
  ],
};

function drawTree(data) {
  const sel = d3.select('#huffman-canvas');
  sel.selectAll('*').remove();
  if (!data) return;
  const W = sel.node()?.clientWidth || 600;
  const H = sel.node()?.clientHeight || 440;
  const svg = sel.append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', 'translate(20,40)');

  const root = d3.hierarchy(data);
  d3.tree().size([W - 40, H - 100])(root);

  g.selectAll('.link').data(root.links()).enter().append('path')
    .attr('fill','none').attr('stroke','#cbd5e1').attr('stroke-width',2)
    .attr('d', d3.linkVertical().x(d=>d.x).y(d=>d.y));

  const node = g.selectAll('.node').data(root.descendants()).enter().append('g')
    .attr('transform', d=>`translate(${d.x},${d.y})`);

  node.append('circle').attr('r', 22)
    .attr('fill', d => d.data.name && d.data.name.length === 1 ? '#f59e0b' : '#8b5cf6')
    .attr('stroke','white').attr('stroke-width',2.5);

  node.append('text').text(d => d.data.name?.substring(0,4))
    .attr('dy',4).attr('text-anchor','middle')
    .style('fill','white').style('font-weight','bold').style('font-size','11px');

  node.append('text').text(d => d.data.freq !== undefined ? `f:${d.data.freq}` : '')
    .attr('dy',-28).attr('text-anchor','middle')
    .style('fill','#6b7280').style('font-size','10px');
}

function clearCanvas() {
  d3.select('#huffman-canvas').selectAll('*').remove();
}
</script>
