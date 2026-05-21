<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    default-input="50, 30, 70, 20, 40, 60, 80"
    @onDraw="drawHeap"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="heap-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/tree/heap';

const tabs = [
  { key: 'build',  label: '📦 建堆', placeholder: '输入序列（如: 50,30,70,20,40）', url: `${API}/visualize`, isInit: true },
  { key: 'insert', label: '➕ 插入', placeholder: '输入要插入的数字',                url: `${API}/visualize`, isInit: false },
  { key: 'search', label: '🔍 查找', placeholder: '输入要查找的数字',                url: `${API}/visualize`, isInit: false },
  { key: 'delete', label: '🗑 提取最大', placeholder: '点击执行提取堆顶元素',       url: `${API}/visualize`, isInit: false },
];

const codesMap = {
  build: [
    'def build_heap(arr):',
    '    n = len(arr)',
    '    # 从最后一个非叶节点向上调整',
    '    for i in range(n // 2 - 1, -1, -1):',
    '        heapify_down(arr, n, i)',
    '',
    'def heapify_down(arr, n, i):',
    '    largest = i',
    '    l, r = 2*i+1, 2*i+2',
    '    if l < n and arr[l] > arr[largest]: largest = l',
    '    if r < n and arr[r] > arr[largest]: largest = r',
    '    if largest != i:',
    '        arr[i], arr[largest] = arr[largest], arr[i]',
    '        heapify_down(arr, n, largest)',
  ],
  insert: [
    'def heap_push(heap, val):',
    '    heap.append(val)',
    '    # 从末尾向上调整（上浮）',
    '    i = len(heap) - 1',
    '    while i > 0:',
    '        parent = (i - 1) // 2',
    '        if heap[i] > heap[parent]:',
    '            heap[i], heap[parent] = heap[parent], heap[i]',
    '            i = parent',
    '        else: break',
  ],
  search: [
    'def heap_find(heap, target):',
    '    # 堆中线性查找（O(n)）',
    '    for i, val in enumerate(heap):',
    '        if val == target:',
    '            return i  # 找到！',
    '    return -1  # 未找到',
  ],
  delete: [
    'def heap_pop(heap):',
    '    # 提取最大值（堆顶）',
    '    max_val = heap[0]',
    '    heap[0] = heap[-1]',
    '    heap.pop()',
    '    # 从顶部向下调整',
    '    heapify_down(heap, len(heap), 0)',
    '    return max_val',
  ],
};

function drawHeap(data) {
  const sel = d3.select('#heap-canvas');
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
    .attr('fill', d => d.data.highlight ? '#ef4444' : d.depth === 0 ? '#f59e0b' : '#ec4899')
    .attr('stroke','white').attr('stroke-width',2.5);
  node.append('text').text(d => d.data.name)
    .attr('dy',5).attr('text-anchor','middle')
    .style('fill','white').style('font-weight','bold').style('font-size','13px');
}

function clearCanvas() {
  d3.select('#heap-canvas').selectAll('*').remove();
}
</script>
