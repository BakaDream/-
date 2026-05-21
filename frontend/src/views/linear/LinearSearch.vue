<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    algo-title="查找操作"
    default-input="11, 22, 34, 45, 64, 90"
    @onDraw="drawArray"
    @onReset="clearArray"
  >
    <template #canvas>
      <div id="search-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/linear/search';

function buildSearchPayload({ input, currentValues, defaultInput }) {
  const baseValues = currentValues?.length
    ? currentValues
    : String(defaultInput || '')
        .split(/[,，\s]+/)
        .map(token => token.trim())
        .filter(Boolean);

  return {
    numbers: baseValues,
    target: String(input || '').trim(),
  };
}

const tabs = [
  { key: 'sequential', label: '🔍 顺序查找', placeholder: '输入目标值，如: 45', url: `${API}/sequential`, isInit: false, promptMsg: '输入目标值查找', buildPayload: buildSearchPayload },
  { key: 'binary',     label: '🔍 折半查找', placeholder: '输入目标值，如: 45', url: `${API}/binary`,     isInit: false, promptMsg: '输入目标值查找（若无序后端会自动排序）', buildPayload: buildSearchPayload },
];

const codesMap = {
  sequential: {
    python: [
      'def sequential_search(arr, target):',
      '    for i in range(len(arr)):',
      '        if arr[i] == target:',
      '            return i',
      '    return -1',
    ],
    cpp: [
      'int sequentialSearch(vector<int>& arr, int target) {',
      '    for (int i = 0; i < arr.size(); i++) {',
      '        if (arr[i] == target) return i;',
      '    }',
      '    return -1;',
      '}',
    ],
    java: [
      'public int sequentialSearch(int[] arr, int target) {',
      '    for (int i = 0; i < arr.length; i++) {',
      '        if (arr[i] == target) return i;',
      '    }',
      '    return -1;',
      '}',
    ],
    javascript: [
      'function sequentialSearch(arr, target) {',
      '    for (let i = 0; i < arr.length; i++) {',
      '        if (arr[i] === target) return i;',
      '    }',
      '    return -1;',
      '}',
    ],
  },
  binary: {
    python: [
      'def binary_search(arr, target):',
      '    left, right = 0, len(arr) - 1',
      '    while left <= right:',
      '        mid = (left + right) // 2',
      '        if arr[mid] == target:',
      '            return mid',
      '        elif arr[mid] < target:',
      '            left = mid + 1',
      '        else:',
      '            right = mid - 1',
      '    return -1',
    ],
    cpp: [
      'int binarySearch(vector<int>& arr, int target) {',
      '    int left = 0, right = arr.size() - 1;',
      '    while (left <= right) {',
      '        int mid = (left + right) / 2;',
      '        if (arr[mid] == target) return mid;',
      '        else if (arr[mid] < target) left = mid + 1;',
      '        else right = mid - 1;',
      '    }',
      '    return -1;',
      '}',
    ],
    java: [
      'public int binarySearch(int[] arr, int target) {',
      '    int left = 0, right = arr.length - 1;',
      '    while (left <= right) {',
      '        int mid = (left + right) / 2;',
      '        if (arr[mid] == target) return mid;',
      '        else if (arr[mid] < target) left = mid + 1;',
      '        else right = mid - 1;',
      '    }',
      '    return -1;',
      '}',
    ],
    javascript: [
      'function binarySearch(arr, target) {',
      '    let left = 0, right = arr.length - 1;',
      '    while (left <= right) {',
      '        const mid = Math.floor((left + right) / 2);',
      '        if (arr[mid] === target) return mid;',
      '        else if (arr[mid] < target) left = mid + 1;',
      '        else right = mid - 1;',
      '    }',
      '    return -1;',
      '}',
    ],
  },
};

function drawArray(data) {
  const sel = d3.select('#search-canvas');
  sel.selectAll('*').remove();
  if (!Array.isArray(data) || data.length === 0) return;
  
  const W = sel.node()?.clientWidth || 800;
  const H = sel.node()?.clientHeight || 400;
  const svg = sel.append('svg').attr('width', W).attr('height', H);

  // Array layout (Block boxes like in basic linear)
  const boxW = 55;
  const boxH = 55;
  const spacing = 12;
  const totalW = data.length * boxW + (data.length - 1) * spacing;
  const startX = Math.max(20, (W - totalW) / 2);
  const startY = 150;
  
  const g = svg.append('g');

  const nodes = g.selectAll('.box')
    .data(data, d => d.id || `${d.index}_${d.val}`)
    .enter()
    .append('g')
    .attr('transform', (d, i) => `translate(${startX + i * (boxW + spacing)}, ${startY})`);

  // Draw Array Boxes
  nodes.append('rect')
    .attr('width', boxW).attr('height', boxH).attr('rx', 6)
    .attr('fill', d => d.highlight ? '#10b981' : (d.searchBounds ? '#dcfce3' : 'white')) // green=match, light green=bounds
    .attr('stroke', d => d.highlight ? '#059669' : (d.searchBounds ? '#10b981' : '#cbd5e1'))
    .attr('stroke-width', 2);

  // Draw Text
  nodes.append('text')
    .text(d => d.val)
    .attr('x', boxW / 2).attr('y', boxH / 2).attr('dy', 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px').style('font-weight', 'bold')
    .style('fill', d => d.highlight ? 'white' : '#334155');

  // Index
  nodes.append('text')
    .text((d, i) => i)
    .attr('x', boxW / 2).attr('y', boxH + 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px').style('fill', '#94a3b8');

  data.forEach((item, index) => {
    (item.pointers || []).forEach((pointer, order) => {
      g.append('text')
        .text(`${pointer.name}↑`)
        .attr('x', startX + index * (boxW + spacing) + boxW / 2)
        .attr('y', startY + boxH + 42 + order * 18)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '700')
        .style('fill', pointer.color || '#f59e0b');
    });
  });
}

function clearArray() {
  d3.select('#search-canvas').selectAll('*').remove();
}
</script>
