<template>
  <AlgoLayout
    :tabs="tabs"
    :codesMap="codesMap"
    algo-title="单链表"
    default-input="10, 20, 30, 40, 50"
    @onDraw="drawList"
    @onReset="clearList"
  >
    <template #canvas>
      <div id="list-canvas" style="width:100%;height:100%;min-height:480px;"></div>
    </template>
  </AlgoLayout>
</template>

<script setup>
import AlgoLayout from '../../components/AlgoLayout.vue';
import * as d3 from 'd3';

const API = 'http://localhost:5000/api/linear/list';

const tabs = [
  { key: 'build',  label: '📦 创建', placeholder: '输入序列（如: 10,20,30,40,50）', url: `${API}/visualize`,  isInit: true },
  { key: 'insert', label: '➕ 插入', placeholder: '输入要追加的数字',                 url: `${API}/insert`,     isInit: false },
  { key: 'search', label: '🔍 查找', placeholder: '输入要查找的数字',                 url: `${API}/search`,     isInit: false },
  { key: 'delete', label: '🗑 删除', placeholder: '输入要删除的数字',                 url: `${API}/delete`,     isInit: false },
];

const codesMap = {
  build: {
    python: [
      'class LinkedList:',
      '    def __init__(self):',
      '        self.head = None',
      '',
      '    def build(self, values):',
      '        for val in values:',
      '            self.append(val)',
      '',
      '    def append(self, val):',
      '        node = Node(val)',
      '        if not self.head:',
      '            self.head = node; return',
      '        cur = self.head',
      '        while cur.next: cur = cur.next',
      '        cur.next = node',
    ],
    cpp: [
      'struct Node { int val; Node* next; };',
      'class LinkedList {',
      '    Node* head = nullptr;',
      'public:',
      '    void build(vector<int>& vals) {',
      '        for (int v : vals) append(v);',
      '    }',
      '    void append(int val) {',
      '        Node* node = new Node{val, nullptr};',
      '        if (!head) { head = node; return; }',
      '        Node* cur = head;',
      '        while (cur->next) cur = cur->next;',
      '        cur->next = node;',
      '    }',
      '};',
    ],
    java: [
      'class LinkedList {',
      '    Node head = null;',
      '    void build(int[] vals) {',
      '        for (int v : vals) append(v);',
      '    }',
      '    void append(int val) {',
      '        Node node = new Node(val);',
      '        if (head == null) { head = node; return; }',
      '        Node cur = head;',
      '        while (cur.next != null) cur = cur.next;',
      '        cur.next = node;',
      '    }',
      '}',
    ],
    javascript: [
      'class LinkedList {',
      '    constructor() { this.head = null; }',
      '    build(values) {',
      '        values.forEach(v => this.append(v));',
      '    }',
      '    append(val) {',
      '        const node = { val, next: null };',
      '        if (!this.head) { this.head = node; return; }',
      '        let cur = this.head;',
      '        while (cur.next) cur = cur.next;',
      '        cur.next = node;',
      '    }',
      '}',
    ],
  },
  insert: {
    python: [
      'def append(self, val):',
      '    new_node = Node(val)',
      '    if not self.head:',
      '        self.head = new_node; return',
      '    current = self.head',
      '    while current.next:',
      '        current = current.next',
      '    current.next = new_node  # 尾部追加',
    ],
    cpp: [
      'void append(int val) {',
      '    Node* node = new Node{val, nullptr};',
      '    if (!head) { head = node; return; }',
      '    Node* cur = head;',
      '    while (cur->next) cur = cur->next;',
      '    cur->next = node;',
      '}',
    ],
    java: [
      'void append(int val) {',
      '    Node node = new Node(val);',
      '    if (head == null) { head = node; return; }',
      '    Node cur = head;',
      '    while (cur.next != null) cur = cur.next;',
      '    cur.next = node;',
      '}',
    ],
    javascript: [
      'append(val) {',
      '    const node = { val, next: null };',
      '    if (!this.head) { this.head = node; return; }',
      '    let cur = this.head;',
      '    while (cur.next) cur = cur.next;',
      '    cur.next = node;',
      '}',
    ],
  },
  search: {
    python: [
      'def search(self, target):',
      '    current = self.head',
      '    index = 0',
      '    while current:',
      '        if current.val == target:',
      '            return index  # 找到！',
      '        current = current.next',
      '        index += 1',
      '    return -1  # 未找到',
    ],
    cpp: [
      'int search(int target) {',
      '    Node* cur = head; int idx = 0;',
      '    while (cur) {',
      '        if (cur->val == target) return idx;',
      '        cur = cur->next; idx++;',
      '    }',
      '    return -1;',
      '}',
    ],
    java: [
      'int search(int target) {',
      '    Node cur = head; int idx = 0;',
      '    while (cur != null) {',
      '        if (cur.val == target) return idx;',
      '        cur = cur.next; idx++;',
      '    }',
      '    return -1;',
      '}',
    ],
    javascript: [
      'search(target) {',
      '    let cur = this.head, idx = 0;',
      '    while (cur) {',
      '        if (cur.val === target) return idx;',
      '        cur = cur.next; idx++;',
      '    }',
      '    return -1;',
      '}',
    ],
  },
  delete: {
    python: [
      'def delete(self, target):',
      '    if not self.head: return',
      '    if self.head.val == target:',
      '        self.head = self.head.next; return',
      '    cur = self.head',
      '    while cur.next:',
      '        if cur.next.val == target:',
      '            cur.next = cur.next.next; return',
      '        cur = cur.next',
    ],
    cpp: [
      'void delete_(int target) {',
      '    if (!head) return;',
      '    if (head->val == target) { head = head->next; return; }',
      '    Node* cur = head;',
      '    while (cur->next) {',
      '        if (cur->next->val == target) {',
      '            cur->next = cur->next->next; return;',
      '        }',
      '        cur = cur->next;',
      '    }',
      '}',
    ],
    java: [
      'void delete(int target) {',
      '    if (head == null) return;',
      '    if (head.val == target) { head = head.next; return; }',
      '    Node cur = head;',
      '    while (cur.next != null) {',
      '        if (cur.next.val == target) {',
      '            cur.next = cur.next.next; return;',
      '        }',
      '        cur = cur.next;',
      '    }',
      '}',
    ],
    javascript: [
      'delete(target) {',
      '    if (!this.head) return;',
      '    if (this.head.val === target) { this.head = this.head.next; return; }',
      '    let cur = this.head;',
      '    while (cur.next) {',
      '        if (cur.next.val === target) {',
      '            cur.next = cur.next.next; return;',
      '        }',
      '        cur = cur.next;',
      '    }',
      '}',
    ],
  },
};

function drawList(data) {
  if (!Array.isArray(data)) return;
  const sel = d3.select('#list-canvas');
  sel.selectAll('*').remove();
  const W = sel.node()?.clientWidth || 600;
  const H = sel.node()?.clientHeight || 200;
  const svg = sel.append('svg').attr('width', W).attr('height', H);
  const g   = svg.append('g').attr('transform', 'translate(40, 80)');

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id','arr').attr('viewBox','0 -5 10 10')
    .attr('refX', 28).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient','auto')
    .append('path').attr('fill','#94a3b8').attr('d','M0,-5L10,0L0,5');

  const spacing = Math.min(120, (W - 80) / Math.max(data.length, 1));

  // Links
  data.forEach((d, i) => {
    if (i < data.length - 1) {
      g.append('line')
        .attr('x1', i * spacing).attr('y1', 0)
        .attr('x2', (i+1) * spacing).attr('y2', 0)
        .attr('stroke','#94a3b8').attr('stroke-width', 2)
        .attr('marker-end','url(#arr)');
    }
  });

  // Nodes
  const nodes = g.selectAll('.n').data(data).enter().append('g')
    .attr('transform', (d, i) => `translate(${i * spacing}, 0)`);

  nodes.append('circle').attr('r', 24)
    .attr('fill', d => d.highlight ? '#fbbf24' : '#3b82f6')
    .attr('stroke', 'white').attr('stroke-width', 2.5);
  nodes.append('text').text(d => d.val ?? d)
    .attr('dy', 5).attr('text-anchor','middle')
    .style('fill','white').style('font-weight','bold').style('font-size','13px');
}

function clearList() {
  d3.select('#list-canvas').selectAll('*').remove();
}
</script>