<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    algo-title="排序操作"
    default-input="64, 34, 25, 12, 22, 11, 90"
    @onDraw="drawArray"
    @onReset="clearArray"
  >
    <template #canvas>
      <div id="sort-canvas" style="width:100%;height:100%;min-height:500px;display:flex;justify-content:center;align-items:center;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/linear/sort';

const tabs = [
  { key: 'insertion', label: '📥 插入排序', placeholder: '输入待排序序列，如: 64,34,25,12,22,11', url: `${API}/insertion`, isInit: true },
];

const codesMap = {
  insertion: {
    python: [
      'def insertion_sort(arr):',
      '    for i in range(1, len(arr)):',
      '        key = arr[i]',
      '        j = i - 1',
      '        while j >= 0 and key < arr[j]:',
      '            arr[j + 1] = arr[j]',
      '            j -= 1',
      '        arr[j + 1] = key',
      '    return arr',
    ],
    cpp: [
      'void insertionSort(vector<int>& arr) {',
      '    for (int i = 1; i < arr.size(); i++) {',
      '        int key = arr[i], j = i - 1;',
      '        while (j >= 0 && arr[j] > key) {',
      '            arr[j + 1] = arr[j];',
      '            j--;',
      '        }',
      '        arr[j + 1] = key;',
      '    }',
      '}',
    ],
    java: [
      'public void insertionSort(int[] arr) {',
      '    for (int i = 1; i < arr.length; i++) {',
      '        int key = arr[i], j = i - 1;',
      '        while (j >= 0 && arr[j] > key) {',
      '            arr[j + 1] = arr[j];',
      '            j--;',
      '        }',
      '        arr[j + 1] = key;',
      '    }',
      '}',
    ],
    javascript: [
      'function insertionSort(arr) {',
      '    for (let i = 1; i < arr.length; i++) {',
      '        let key = arr[i], j = i - 1;',
      '        while (j >= 0 && arr[j] > key) {',
      '            arr[j + 1] = arr[j];',
      '            j--;',
      '        }',
      '        arr[j + 1] = key;',
      '    }',
      '    return arr;',
      '}',
    ],
  },
};

function drawArray(data) {
  const sel = d3.select('#sort-canvas');
  sel.selectAll('*').remove();
  if (!Array.isArray(data) || data.length === 0) return;

  const W = sel.node()?.clientWidth || 800;
  const H = sel.node()?.clientHeight || 400;
  const svg = sel.append('svg').attr('width', W).attr('height', H);

  // use bars for sorting makes it easier to compare sizes visually
  const maxVal = d3.max(data, d => Number(d.val));
  
  const widthPerBar = Math.min(60, (W - 100) / data.length);
  const spacing = 8;
  const totalW = data.length * widthPerBar + (data.length - 1) * spacing;
  const startX = (W - totalW) / 2;
  const baseY = H - 100;

  // Setup scales
  const yScale = d3.scaleLinear()
    .domain([0, Math.max(10, maxVal)])
    .range([10, 200]);

  const g = svg.append('g').attr('transform', `translate(${startX}, 0)`);

  const nodes = g.selectAll('.bar-group')
    .data(data, d => d.id || `${d.index}_${d.val}`)
    .enter()
    .append('g')
    .attr('class', 'bar-group')
    .attr('transform', (d, i) => `translate(${i * (widthPerBar + spacing)}, 0)`);

  // Draw Bars
  nodes.append('rect')
    .attr('width', widthPerBar)
    .attr('height', d => yScale(d.val))
    .attr('y', d => baseY - yScale(d.val))
    .attr('x', 0)
    .attr('rx', 4)
    .attr('fill', d => {
      if (d.done) return '#22c55e'; // Green if sorted
      if (d.highlight) return '#f59e0b'; // Orange if being compared/swapped
      return '#3b82f6'; // Blue default
    });

  // Value text on top of bars
  nodes.append('text')
    .text(d => d.val)
    .attr('x', widthPerBar / 2)
    .attr('y', d => baseY - yScale(d.val) - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .style('fill', '#334155');
    
  // Index text below bars
  nodes.append('text')
    .text((d, i) => i)
    .attr('x', widthPerBar / 2)
    .attr('y', baseY + 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#94a3b8');

  const rowHeight = 20;
  const pointerBaseY = baseY + 45;

  data.forEach((item, index) => {
    (item.pointers || []).forEach((pointer, pointerIndex) => {
      g.append('text')
        .text(`${pointer.name}↑`)
        .attr('x', index * (widthPerBar + spacing) + widthPerBar / 2)
        .attr('y', pointerBaseY + pointerIndex * rowHeight)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '700')
        .style('fill', pointer.color || '#f8fafc');
    });
  });
}

function clearArray() {
  d3.select('#sort-canvas').selectAll('*').remove();
}
</script>
