<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    default-input="30, 20, 40, 10, 25, 35, 50"
    @onDraw="drawTree"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="avl-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/tree/avl';

const tabs = [
  { key: 'build',  label: '📦 创建', placeholder: '输入序列（如: 30,20,40,10）', url: `${API}/visualize`,  isInit: true },
  { key: 'insert', label: '➕ 插入', placeholder: '输入要插入的数字',             url: `${API}/visualize`,  isInit: false },
  { key: 'search', label: '🔍 查找', placeholder: '输入要查找的数字',             url: `${API}/search`,     isInit: false },
  { key: 'delete', label: '🗑 删除', placeholder: '输入要删除的数字',             url: `${API}/visualize`,  isInit: false },
];

const codesMap = {
  build: [
    'def insert(node, val):',
    '    # 普通 BST 插入',
    '    if not node: return Node(val)',
    '    if val < node.val: node.left  = insert(node.left, val)',
    '    else:              node.right = insert(node.right, val)',
    '    # 更新高度',
    '    node.height = 1 + max(h(node.left), h(node.right))',
    '    # 检查平衡因子',
    '    balance = h(node.left) - h(node.right)',
    '    # 四种旋转情况 (LL / RR / LR / RL)',
    '    if balance > 1 and val < node.left.val:',
    '        return right_rotate(node)   # LL',
    '    if balance < -1 and val > node.right.val:',
    '        return left_rotate(node)    # RR',
  ],
  insert: [
    'def avl_insert(root, val):',
    '    # 在现有 AVL 树中插入新节点',
    '    root = insert(root, val)',
    '    # 自动触发旋转以维持平衡',
    '    return root',
  ],
  search: [
    'def search(root, target):',
    '    # AVL 查找与 BST 相同',
    '    current = root',
    '    while current:',
    '        if current.val == target:',
    '            return current',
    '        elif target < current.val:',
    '            current = current.left',
    '        else:',
    '            current = current.right',
    '    return None',
  ],
  delete: [
    'def avl_delete(root, target):',
    '    # 先执行普通BST删除',
    '    root = bst_delete(root, target)',
    '    # 重新平衡受影响的路径',
    '    balance = h(root.left) - h(root.right)',
    '    if balance > 1:   root = right_rotate(root)',
    '    if balance < -1:  root = left_rotate(root)',
    '    return root',
  ],
};

function drawTree(data) {
  const sel = d3.select('#avl-canvas');
  sel.selectAll('*').remove();
  if (!data) return;
  const W = sel.node()?.clientWidth || 600;
  const H = sel.node()?.clientHeight || 440;
  const svg = sel.append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', 'translate(20,40)');

  const root = d3.hierarchy(data);
  d3.tree().size([W - 40, H - 100])(root);

  g.selectAll('.link').data(root.links()).enter().append('path')
    .attr('fill','none')
    .attr('stroke', d => d.target.data.hidden ? 'none' : '#cbd5e1')
    .attr('stroke-width', 2)
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

  const node = g.selectAll('.node').data(root.descendants()).enter().append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`);

  node.filter(d => !d.data.hidden).append('circle').attr('r', 22)
    .attr('fill', d => d.data.highlight ? '#f59e0b' : '#10b981')
    .attr('stroke','white').attr('stroke-width', 2.5);
  node.filter(d => !d.data.hidden).append('text').text(d => d.data.name)
    .attr('dy', 5).attr('text-anchor','middle')
    .style('fill','white').style('font-weight','bold').style('font-size','13px');
  // Height label
  node.filter(d => !d.data.hidden).append('text').text(d => `h:${d.data.height ?? ''}`)
    .attr('dy', -28).attr('text-anchor','middle')
    .style('fill','#64748b').style('font-size','10px');
}

function clearCanvas() {
  d3.select('#avl-canvas').selectAll('*').remove();
}
</script>
