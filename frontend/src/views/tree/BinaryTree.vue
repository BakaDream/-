<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    default-input="1, 2, 3, 4, 5, 6, 7"
    @onDraw="drawTree"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="binary-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/tree/binary';

const tabs = [
  { key: 'build',  label: '📦 创建', placeholder: '输入层序序列（如: 1,2,3,4,5）', url: `${API}/visualize`,  isInit: true },
  { key: 'insert', label: '➕ 插入', placeholder: '输入要插入的数字',               url: `${API}/insert_one`, isInit: false },
  { key: 'search', label: '🔍 查找', placeholder: '输入要查找的数字',               url: `${API}/search`,     isInit: false },
  { key: 'delete', label: '🗑 删除', placeholder: '输入要删除的数字',               url: `${API}/delete`,     isInit: false },
];

const codesMap = {
  build: [
    'def build_level_order(values):',
    '    nodes = [Node(v) for v in values]',
    '    root = nodes[0]',
    '    queue = [root]; i = 1',
    '    while i < len(nodes) and queue:',
    '        cur = queue.pop(0)',
    '        if i < len(nodes):',
    '            cur.left = nodes[i]; queue.append(cur.left); i += 1',
    '        if i < len(nodes):',
    '            cur.right = nodes[i]; queue.append(cur.right); i += 1',
  ],
  insert: [
    'def insert_next(root, val):',
    '    # BFS 找第一个空位',
    '    queue = [root]',
    '    while queue:',
    '        node = queue.pop(0)',
    '        if not node.left:',
    '            node.left = Node(val); return',
    '        queue.append(node.left)',
    '        if not node.right:',
    '            node.right = Node(val); return',
    '        queue.append(node.right)',
  ],
  search: [
    'def bfs_search(root, target):',
    '    queue = [root]',
    '    while queue:',
    '        node = queue.pop(0)',
    '        if node.val == target:',
    '            return node  # 找到！',
    '        if node.left:  queue.append(node.left)',
    '        if node.right: queue.append(node.right)',
    '    return None',
  ],
  delete: [
    'def delete_node(root, target):',
    '    # BFS 找目标节点和最深叶子',
    '    queue = [root]; target_node = last = None',
    '    while queue:',
    '        last = queue.pop(0)',
    '        if last.val == target: target_node = last',
    '        if last.left:  queue.append(last.left)',
    '        if last.right: queue.append(last.right)',
    '    # 用最深叶子值替换目标，再删叶子',
    '    if target_node:',
    '        target_node.val = last.val',
    '        delete_deepest(root, last)',
  ],
};

function drawTree(data) {
  const sel = d3.select('#binary-canvas');
  sel.selectAll('*').remove();
  if (!data) return;
  const W = sel.node()?.clientWidth || 600;
  const H = sel.node()?.clientHeight || 440;
  const svg = sel.append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', 'translate(20,40)');

  const root = d3.hierarchy(data);
  d3.tree().size([W - 40, H - 100])(root);

  g.selectAll('.link').data(root.links()).enter().append('path')
    .attr('fill','none').attr('stroke','#cbd5e1').attr('stroke-width', 2)
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

  const node = g.selectAll('.node').data(root.descendants()).enter().append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  node.append('circle').attr('r', 22)
    .attr('fill', d => d.data.highlight ? '#fbbf24' : '#3b82f6')
    .attr('stroke','white').attr('stroke-width', 2.5);
  node.append('text').text(d => d.data.name)
    .attr('dy', 5).attr('text-anchor','middle')
    .style('fill','white').style('font-weight','bold').style('font-size','13px');
}

function clearCanvas() {
  d3.select('#binary-canvas').selectAll('*').remove();
}
</script>
