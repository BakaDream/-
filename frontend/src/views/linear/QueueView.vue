<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    algo-title="队列（顺序队列）"
    default-input="10, 20, 30"
    @onDraw="draw"
    @onReset="clearCanvas"
  >
    <template #canvas>
      <div id="queue-canvas" style="width:100%;height:100%;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const CAPACITY = 8;
const API = 'http://localhost:5000/api/queue/array';

const tabs = [
  { key: 'enqueue', label: '➡ 入队', placeholder: '输入元素列表，多个用逗号分隔（如: 10,20,30），点执行可多次入队', url: `${API}/enqueue`, isInit: true },
  { key: 'dequeue', label: '⬅ 出队', placeholder: '',                      url: `${API}/dequeue`, isInit: false },
  { key: 'clear',   label: '🗑 清空', placeholder: '',                      url: `${API}/clear`,   isInit: false },
];

const codesMap = {
  enqueue: {
    python: [
      'def enqueue(self, val):',
      '    if self.is_full():',
      '        raise OverflowError("Queue Full")',
      '    self.data[self.rear + 1] = val',
      '    self.rear += 1',
    ],
    cpp: [
      'bool enqueue(int val) {',
      '    if (rear >= capacity - 1) return false; // full',
      '    // queue not full',
      '    data[++rear] = val;',
      '    return true;',
      '}',
    ],
    java: [
      'public void enqueue(int val) {',
      '    if (rear >= capacity - 1)',
      '        throw new RuntimeException("Queue Full");',
      '    data[++rear] = val;',
      '}',
    ],
    javascript: [
      'enqueue(val) {',
      '    if (this.rear >= this.capacity - 1)',
      '        throw new Error("Queue Full");',
      '    this.data[++this.rear] = val;',
      '}',
    ],
  },
  dequeue: {
    python: [
      'def dequeue(self):',
      '    if self.is_empty():',
      '        raise IndexError("Queue Empty")',
      '    val = self.data[self.front]',
      '    self.front += 1',
      '    return val',
    ],
    cpp: [
      'int dequeue() {',
      '    if (front > rear) throw runtime_error("Queue Empty");',
      '    // queue not empty',
      '    int val = data[front];',
      '    front++;',
      '    return val;',
      '}',
    ],
    java: [
      'public int dequeue() {',
      '    if (front > rear)',
      '        throw new RuntimeException("Queue Empty");',
      '    int val = data[front];',
      '    front++;',
      '    return val;',
      '}',
    ],
    javascript: [
      'dequeue() {',
      '    if (this.front > this.rear) throw new Error("Queue Empty");',
      '    const val = this.data[this.front];',
      '    this.front++;',
      '    return val;',
      '}',
    ],
  },
  clear: {
    python: [
      'def clear(self):',
      '    while not self.is_empty():',
      '        self.dequeue()  # 逐个出队',
      '    # front = rear = -1',
    ],
    cpp: [
      'void clear() {',
      '    while (front <= rear) {',
      '        front++;',
      '    }',
      '    front = rear = -1;',
      '}',
    ],
    java: [
      'public void clear() {',
      '    while (front <= rear) {',
      '        front++;',
      '    }',
      '    front = rear = -1;',
      '}',
    ],
    javascript: [
      'clear() {',
      '    while (this.front <= this.rear) {',
      '        this.front++;',
      '    }',
      '    this.front = this.rear = -1;',
      '}',
    ],
  },
};

// ─── Draw ──────────────────────────────────────────────────
function draw(cells) {
  if (!Array.isArray(cells)) return;

  const sel = d3.select('#queue-canvas');
  sel.selectAll('*').remove();

  const W = sel.node()?.clientWidth || 700;
  const H = sel.node()?.clientHeight || 400;
  const svg = sel.append('svg').attr('width', W).attr('height', H);

  const cellW = Math.min(72, (W - 100) / CAPACITY);
  const cellH = 60;
  const totalW = CAPACITY * cellW;
  const startX = (W - totalW) / 2;
  const midY = H / 2 - cellH / 2;

  // Draw horizontal queue cells
  cells.forEach((cell, i) => {
    const x = startX + i * cellW;

    const rect = svg.append('rect')
      .attr('x', x + 2).attr('y', midY)
      .attr('width', cellW - 4).attr('height', cellH)
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
        .attr('x', x + cellW / 2).attr('y', midY + cellH / 2 + 6)
        .attr('text-anchor', 'middle')
        .style('fill', 'white').style('font-size', '16px').style('font-weight', '700');
    }

    // Index below
    svg.append('text')
      .text(i)
      .attr('x', x + cellW / 2).attr('y', midY + cellH + 20)
      .attr('text-anchor', 'middle')
      .style('fill', 'rgba(255,255,255,0.3)').style('font-size', '11px');

    // FRONT / REAR pointers
    if (cell.isFront) {
      svg.append('text')
        .text('▲ FRONT')
        .attr('x', x + cellW / 2).attr('y', midY - 12)
        .attr('text-anchor', 'middle')
        .style('fill', '#34d399').style('font-size', '11px').style('font-weight', '600');
    }
    if (cell.isRear) {
      svg.append('text')
        .text('▲ REAR')
        .attr('x', x + cellW / 2).attr('y', midY - 12)
        .attr('text-anchor', 'middle')
        .style('fill', '#fbbf24').style('font-size', '11px').style('font-weight', '600');
    }
  });

  // Enqueue arrow (right side)
  svg.append('text')
    .text('入队 ⟵')
    .attr('x', startX + totalW + 30).attr('y', midY + cellH / 2 + 6)
    .style('fill', '#fbbf24').style('font-size', '13px');

  // Dequeue arrow (left side)
  svg.append('text')
    .text('⟵ 出队')
    .attr('x', startX - 80).attr('y', midY + cellH / 2 + 6)
    .style('fill', '#34d399').style('font-size', '13px');
}

function clearCanvas() {
  d3.select('#queue-canvas').selectAll('*').remove();
}
</script>
