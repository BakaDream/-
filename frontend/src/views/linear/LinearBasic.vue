<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    algo-title="数组基本操作"
    default-input="10, 20, 30, 40, 50"
    @onDraw="drawArray"
    @onReset="clearArray"
  >
    <template #canvas>
      <div id="array-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/linear/basic';

function buildPositionPayload({ input, currentValues }) {
  const tokens = String(input || '')
    .split(/[,，\s]+/)
    .map(token => token.trim())
    .filter(Boolean);

  return {
    numbers: currentValues,
    index: tokens[0] ?? '',
    target: tokens[1] ?? '',
  };
}

function buildIndexPayload({ input, currentValues }) {
  return {
    numbers: currentValues,
    index: String(input || '').trim(),
  };
}

const tabs = [
  { key: 'insert', label: '➕ 指定位置插入', placeholder: '输入位置和值 (如: 2,99)', url: `${API}/insert`, isInit: false, promptMsg: '输入 "位置,值"：在索引2处插入99', buildPayload: buildPositionPayload },
  { key: 'delete', label: '🗑 删除操作',     placeholder: '输入位置 (如: 2)',      url: `${API}/delete`, isInit: false, buildPayload: buildIndexPayload },
  { key: 'update', label: '✏️ 修改更新',     placeholder: '输入位置和新值 (如: 2,88)', url: `${API}/update`, isInit: false, promptMsg: '输入 "位置,修改为的值"', buildPayload: buildPositionPayload },
  { key: 'get',    label: '🔍 按位取值',     placeholder: '输入查询位置 (如: 2)',  url: `${API}/get`,    isInit: false, buildPayload: buildIndexPayload },
];

const codesMap = {
  insert: {
    python: [
      'def insert_at(arr, index, val):',
      '    if index < 0 or index > len(arr):',
      '        raise IndexError("Index out of bounds")',
      '    arr.insert(index, val)',
    ],
    cpp: [
      'void insertAt(vector<int>& arr, int index, int val) {',
      '    if (index < 0 || index > arr.size())',
      '        throw out_of_range("Index out of bounds");',
      '    arr.insert(arr.begin() + index, val);',
      '}',
    ],
    java: [
      'public void insertAt(List<Integer> arr, int index, int val) {',
      '    if (index < 0 || index > arr.size())',
      '        throw new IndexOutOfBoundsException("Index out of bounds");',
      '    arr.add(index, val);',
      '}',
    ],
    javascript: [
      'function insertAt(arr, index, val) {',
      '    if (index < 0 || index > arr.length)',
      '        throw new Error("Index out of bounds");',
      '    arr.splice(index, 0, val);',
      '}',
    ],
  },
  delete: {
    python: [
      'def delete_at(arr, index):',
      '    if index < 0 or index >= len(arr):',
      '        raise IndexError("Index out of bounds")',
      '    arr.pop(index)',
    ],
    cpp: [
      'void deleteAt(vector<int>& arr, int index) {',
      '    if (index < 0 || index >= arr.size())',
      '        throw out_of_range("Index out of bounds");',
      '    arr.erase(arr.begin() + index);',
      '}',
    ],
    java: [
      'public void deleteAt(List<Integer> arr, int index) {',
      '    if (index < 0 || index >= arr.size())',
      '        throw new IndexOutOfBoundsException("Index out of bounds");',
      '    arr.remove(index);',
      '}',
    ],
    javascript: [
      'function deleteAt(arr, index) {',
      '    if (index < 0 || index >= arr.length)',
      '        throw new Error("Index out of bounds");',
      '    arr.splice(index, 1);',
      '}',
    ],
  },
  update: {
    python: [
      'def update_at(arr, index, new_val):',
      '    if index < 0 or index >= len(arr):',
      '        raise IndexError("Index out of bounds")',
      '    arr[index] = new_val',
    ],
    cpp: [
      'void updateAt(vector<int>& arr, int index, int newVal) {',
      '    if (index < 0 || index >= arr.size())',
      '        throw out_of_range("Index out of bounds");',
      '    arr[index] = newVal;',
      '}',
    ],
    java: [
      'public void updateAt(List<Integer> arr, int index, int newVal) {',
      '    if (index < 0 || index >= arr.size())',
      '        throw new IndexOutOfBoundsException("Index out of bounds");',
      '    arr.set(index, newVal);',
      '}',
    ],
    javascript: [
      'function updateAt(arr, index, newVal) {',
      '    if (index < 0 || index >= arr.length)',
      '        throw new Error("Index out of bounds");',
      '    arr[index] = newVal;',
      '}',
    ],
  },
  get: {
    python: [
      'def get_at(arr, index):',
      '    if index < 0 or index >= len(arr):',
      '        raise IndexError("Index out of bounds")',
      '    return arr[index]',
    ],
    cpp: [
      'int getAt(vector<int>& arr, int index) {',
      '    if (index < 0 || index >= arr.size())',
      '        throw out_of_range("Index out of bounds");',
      '    return arr[index];',
      '}',
    ],
    java: [
      'public int getAt(List<Integer> arr, int index) {',
      '    if (index < 0 || index >= arr.size())',
      '        throw new IndexOutOfBoundsException("Index out of bounds");',
      '    return arr.get(index);',
      '}',
    ],
    javascript: [
      'function getAt(arr, index) {',
      '    if (index < 0 || index >= arr.length)',
      '        throw new Error("Index out of bounds");',
      '    return arr[index];',
      '}',
    ],
  },
};


function drawArray(data) {
  const sel = d3.select('#array-canvas');
  sel.selectAll('*').remove();
  if (!Array.isArray(data) || data.length === 0) return;
  
  const W = sel.node()?.clientWidth || 800;
  const H = sel.node()?.clientHeight || 400;
  const svg = sel.append('svg').attr('width', W).attr('height', H);
  
  const boxW = 50;
  const boxH = 50;
  const spacing = 10;
  const totalW = data.length * boxW + (data.length - 1) * spacing;
  const startX = Math.max(20, (W - totalW) / 2);
  const startY = 100;
  
  const g = svg.append('g');
  
  const nodes = g.selectAll('.box')
    .data(data, d => d.id || d.val)
    .enter()
    .append('g')
    .attr('transform', (d, i) => `translate(${startX + i * (boxW + spacing)}, ${startY})`);
    
  // Box
  nodes.append('rect')
    .attr('width', boxW).attr('height', boxH).attr('rx', 6)
    .attr('fill', d => d.highlight ? '#38bdf8' : 'white')
    .attr('stroke', d => d.highlight ? '#0284c7' : '#cbd5e1')
    .attr('stroke-width', 2);
    
  // Value text
  nodes.append('text')
    .text(d => d.val)
    .attr('x', boxW / 2).attr('y', boxH / 2).attr('dy', 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px').style('font-weight', 'bold')
    .style('fill', d => d.highlight ? 'white' : '#334155');
    
  // Index text
  nodes.append('text')
    .text((d, i) => i)
    .attr('x', boxW / 2).attr('y', boxH + 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px').style('fill', '#94a3b8');
}

function clearArray() {
  d3.select('#array-canvas').selectAll('*').remove();
}
</script>
