<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    default-input="50, 30, 70, 20, 40, 60, 80"
    @onDraw="drawTree"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="bst-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/tree/bst';

const tabs = [
  { key: 'build',  label: '📦 创建', placeholder: '输入序列（如: 50,30,70,20,40）', url: `${API}/visualize`,  isInit: true },
  { key: 'insert', label: '➕ 插入', placeholder: '输入要插入的数字',               url: `${API}/insert_one`, isInit: false },
  { key: 'search', label: '🔍 查找', placeholder: '输入要查找的数字',               url: `${API}/search`,     isInit: false },
  { key: 'delete', label: '🗑 删除', placeholder: '输入要删除的数字',               url: `${API}/delete`,     isInit: false },
];

const codesMap = {
  build: [
    'def insert(root, val):',
    '    new_node = Node(val)',
    '    if not root: return new_node',
    '    current = root',
    '    while True:',
    '        if val < current.val:',
    '            if not current.left:',
    '                current.left = new_node; break',
    '            current = current.left',
    '        else:',
    '            if not current.right:',
    '                current.right = new_node; break',
    '            current = current.right',
  ],
  search: [
    'def search(root, target):',
    '    current = root',
    '    while current:',
    '        if current.val == target:',
    '            return current  # 找到！',
    '        elif target < current.val:',
    '            current = current.left',
    '        else:',
    '            current = current.right',
    '    return None  # 未找到',
  ],
  insert: [
    'def insert_one(root, val):',
    '    # 找到合适的空位',
    '    current = root',
    '    while True:',
    '        if val < current.val:',
    '            if not current.left:',
    '                current.left = Node(val); break',
    '            current = current.left',
    '        else:',
    '            if not current.right:',
    '                current.right = Node(val); break',
    '            current = current.right',
  ],
  delete: [
    'def delete(root, target):',
    '    node = find(root, target)',
    '    # 叶子节点：直接删除',
    '    if not node.left and not node.right:',
    '        parent.child = None',
    '    # 单子节点：用子节点替代',
    '    elif not node.left or not node.right:',
    '        parent.child = node.left or node.right',
    '    # 双子节点：找右子树最小后继',
    '    else:',
    '        successor = find_min(node.right)',
    '        node.val = successor.val',
    '        delete(node.right, successor.val)',
  ],
};

function drawTree(data) {
  const container = d3.select('#bst-canvas');
  container.selectAll('*').remove();
  if (!data) return;
  const W = container.node()?.clientWidth || 600;
  const H = container.node()?.clientHeight || 440;
  const svg = container.append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', 'translate(20, 40)');

  const root = d3.hierarchy(data);
  d3.tree().size([W - 40, H - 100])(root);

  g.selectAll('.link').data(root.links()).enter().append('path')
    .attr('fill','none').attr('stroke','#cbd5e1').attr('stroke-width', 2)
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

  const node = g.selectAll('.node').data(root.descendants()).enter().append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  node.append('circle').attr('r', 22)
    .attr('fill', d => d.data.highlight ? '#fbbf24' : d.data.found ? '#22c55e' : '#3b82f6')
    .attr('stroke','white').attr('stroke-width', 2.5);
  node.append('text').text(d => d.data.name)
    .attr('dy', 5).attr('text-anchor','middle')
    .style('fill','white').style('font-weight','bold').style('font-size','13px');
}

function clearCanvas() {
  d3.select('#bst-canvas').selectAll('*').remove();
}
</script>