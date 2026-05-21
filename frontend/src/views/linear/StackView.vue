<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    algo-title="栈（顺序栈）"
    default-input="10, 20, 30"
    @onDraw="draw"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="stack-canvas" style="width:100%;height:100%;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const CAPACITY = 8;
const API = 'http://localhost:5000/api/stack/array';

// ─── Tabs ────────────────────────────────────────────────
const tabs = [
  { key: 'push',  label: '⬆ 入栈', placeholder: '输入元素列表，多个用逗号分隔（如: 10,20,30），点执行可多次入栈', url: `${API}/push`,  isInit: true },
  { key: 'pop',   label: '⬇ 出栈', placeholder: '',                                                                url: `${API}/pop`,   isInit: false },
  { key: 'peek',  label: '👁 取栈顶', placeholder: '',                                                              url: `${API}/peek`,  isInit: false },
  { key: 'clear', label: '🗑 清空', placeholder: '',                                                                url: `${API}/clear`, isInit: false },
];

// ─── Codes (4 languages) ─────────────────────────────────
const codesMap = {
  push: {
    python: [
      'def push(self, val):',
      '    if self.is_full():',
      '        raise OverflowError("Stack Full")',
      '    self.data[self.top + 1] = val',
      '    self.top += 1',
    ],
    cpp: [
      'bool push(int val) {',
      '    if (top >= capacity - 1) return false; // full',
      '    // stack not full, push',
      '    data[++top] = val;',
      '    return true;',
      '}',
    ],
    java: [
      'public void push(int val) {',
      '    if (top >= capacity - 1)',
      '        throw new RuntimeException("Stack Full");',
      '    data[++top] = val;',
      '}',
    ],
    javascript: [
      'push(val) {',
      '    if (this.top >= this.capacity - 1)',
      '        throw new Error("Stack Full");',
      '    this.data[++this.top] = val;',
      '}',
    ],
  },
  pop: {
    python: [
      'def pop(self):',
      '    if self.is_empty():',
      '        raise IndexError("Stack Empty")',
      '    val = self.data[self.top]',
      '    self.top -= 1',
      '    return val',
    ],
    cpp: [
      'int pop() {',
      '    if (top < 0) throw runtime_error("Stack Empty");',
      '    // stack not empty',
      '    int val = data[top];',
      '    top--;',
      '    return val;',
      '}',
    ],
    java: [
      'public int pop() {',
      '    if (top < 0)',
      '        throw new RuntimeException("Stack Empty");',
      '    int val = data[top];',
      '    top--;',
      '    return val;',
      '}',
    ],
    javascript: [
      'pop() {',
      '    if (this.top < 0) throw new Error("Stack Empty");',
      '    const val = this.data[this.top];',
      '    this.top--;',
      '    return val;',
      '}',
    ],
  },
  peek: {
    python: [
      'def peek(self):',
      '    if self.is_empty():',
      '        raise IndexError("Stack Empty")',
      '    return self.data[self.top]  # 不出栈',
      '    # top 指针不变',
    ],
    cpp: [
      'int peek() {',
      '    if (top < 0) throw runtime_error("Stack Empty");',
      '    return data[top]; // top unchanged',
      '    // no modification to top',
      '}',
    ],
    java: [
      'public int peek() {',
      '    if (top < 0)',
      '        throw new RuntimeException("Stack Empty");',
      '    return data[top]; // top unchanged',
      '}',
    ],
    javascript: [
      'peek() {',
      '    if (this.top < 0) throw new Error("Stack Empty");',
      '    return this.data[this.top]; // top unchanged',
      '}',
    ],
  },
  clear: {
    python: [
      'def clear(self):',
      '    while not self.is_empty():',
      '        self.pop()  # 逐个出栈',
      '    # top == -1，栈已清空',
    ],
    cpp: [
      'void clear() {',
      '    while (top >= 0) {',
      '        top--;  // 逐步清除',
      '    }',
      '    // top == -1',
      '}',
    ],
    java: [
      'public void clear() {',
      '    while (top >= 0) {',
      '        top--;',
      '    }',
      '}',
    ],
    javascript: [
      'clear() {',
      '    while (this.top >= 0) {',
      '        this.top--;',
      '    }',
      '}',
    ],
  },
};

// ─── AlgoLayout overrides: inject stack state into every request ──────
// We intercept the handleGenerate by wrapping tab URLs with extra params
// via local state
let currentStack = [];

// Patch tabs to inject currentStack and CAPACITY
import { computed } from 'vue';
const patchedTabs = computed(() => tabs.map(t => ({
  ...t,
  // AlgoLayout will call POST url with {numbers: currentValues, target}
  // We override via a custom url approach below
})));

// ─── Draw ──────────────────────────────────────────────────────────────
function draw(cells) {
  if (!Array.isArray(cells)) return;

  const sel = d3.select('#stack-canvas');
  sel.selectAll('*').remove();

  const W = sel.node()?.clientWidth || 600;
  const H = sel.node()?.clientHeight || 500;
  const svg = sel.append('svg').attr('width', W).attr('height', H);

  const cellH = 52;
  const cellW = 100;
  const startX = (W - cellW) / 2;
  // Draw from bottom to top
  const startY = H - 60;

  // Label: capacity
  svg.append('text')
    .text(`容量 = ${CAPACITY}`)
    .attr('x', startX + cellW + 20).attr('y', startY - (CAPACITY - 1) * cellH - 10)
    .style('fill', 'rgba(255,255,255,0.5)').style('font-size', '12px');

  cells.slice().reverse().forEach((cell, ri) => {
    const i = CAPACITY - 1 - ri; // original index
    const y = startY - ri * cellH;

    // Cell rect
    const rect = svg.append('rect')
      .attr('x', startX).attr('y', y - cellH + 8)
      .attr('width', cellW).attr('height', cellH - 4)
      .attr('rx', 6);

    if (cell.filled) {
      rect.attr('fill', cell.highlight ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.6)')
          .attr('stroke', cell.highlight ? '#ef4444' : '#60a5fa')
          .attr('stroke-width', 2);
    } else {
      rect.attr('fill', 'rgba(255,255,255,0.05)')
          .attr('stroke', 'rgba(255,255,255,0.12)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '4,3');
    }

    // Value
    if (cell.filled) {
      svg.append('text')
        .text(cell.val)
        .attr('x', startX + cellW / 2).attr('y', y - cellH / 2 + 12)
        .attr('text-anchor', 'middle')
        .style('fill', 'white').style('font-size', '18px').style('font-weight', '700');
    }

    // Index label (left)
    svg.append('text')
      .text(i)
      .attr('x', startX - 14).attr('y', y - cellH / 2 + 12)
      .attr('text-anchor', 'middle')
      .style('fill', 'rgba(255,255,255,0.3)').style('font-size', '11px');

    // TOP pointer
    if (cell.top) {
      svg.append('text')
        .text('← TOP')
        .attr('x', startX + cellW + 10).attr('y', y - cellH / 2 + 12)
        .style('fill', '#fbbf24').style('font-size', '13px').style('font-weight', '600');
    }
  });

  // Bottom bracket
  svg.append('line')
    .attr('x1', startX - 6).attr('y1', startY + 8)
    .attr('x2', startX + cellW + 6).attr('y2', startY + 8)
    .attr('stroke', 'rgba(255,255,255,0.3)').attr('stroke-width', 2);
  svg.append('text')
    .text('底部 (Bottom)')
    .attr('x', W / 2).attr('y', startY + 26)
    .attr('text-anchor', 'middle')
    .style('fill', 'rgba(255,255,255,0.4)').style('font-size', '12px');
}

function clearCanvas() {
  d3.select('#stack-canvas').selectAll('*').remove();
}
</script>
