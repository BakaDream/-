<template>
  <div class="graph-page">
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="crud-tabs">
          <button class="crud-tab active" @click="activeOp='build'">📦 创建</button>
          <button class="crud-tab" :class="{active:activeOp==='insert'}" @click="activeOp='insert'">➕ 添加顶点/边</button>
          <button class="crud-tab" :class="{active:activeOp==='search'}" @click="activeOp='search'">🔍 查找顶点</button>
          <button class="crud-tab" :class="{active:activeOp==='delete'}" @click="activeOp='delete'">🗑 删除顶点</button>
        </div>
      </div>
      <div class="toolbar-row">
        <el-input v-model="verticesInput" placeholder="顶点（逗号分隔，如: A,B,C,D）" class="input-w" />
        <el-input v-model="edgesInput" placeholder="边（如: A-B,B-C,C-D,A-D）" class="input-w" />
        <el-button type="primary" :loading="loading" @click="generate">生成邻接矩阵</el-button>
        <el-button @click="handleNext" :disabled="stepIdx >= traces.length">下一步 ▶</el-button>
        <el-button plain @click="reset">重置</el-button>
      </div>
    </div>

    <div class="content-split">
      <!-- 左：图可视化 -->
      <div class="visual-panel">
        <div class="panel-header">图结构可视化</div>
        <div ref="graphRef" class="canvas-box"></div>
      </div>

      <!-- 中：邻接矩阵 -->
      <div class="matrix-panel" v-if="matrix.length">
        <div class="panel-header">邻接矩阵</div>
        <div class="matrix-wrap">
          <table class="adj-matrix">
            <thead>
              <tr>
                <th></th>
                <th v-for="v in vertices" :key="v">{{ v }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in matrix" :key="i">
                <td class="row-label">{{ vertices[i] }}</td>
                <td v-for="(cell, j) in row" :key="j"
                    :class="{ 'cell-one': cell === 1, 'cell-hl': highlightRow === i }">
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 右：代码 + 日志 -->
      <div class="info-panel">
        <div class="code-box">
          <div class="panel-header">Python Code</div>
          <div class="code-content">
            <div v-for="(line, i) in codeLines" :key="i"
                 class="code-line" :class="{ active: currentLine === i + 1 }">
              <span class="ln">{{ i + 1 }}</span>{{ line }}
            </div>
          </div>
        </div>
        <div class="log-box">
          <span class="step-tag" v-if="logMsg">Step {{ stepIdx }}</span>
          {{ logMsg || '等待开始...' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import * as d3 from 'd3';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const verticesInput = ref('A,B,C,D,E');
const edgesInput = ref('A-B,A-C,B-D,C-D,D-E');
const loading = ref(false);
const traces = ref([]);
const stepIdx = ref(0);
const logMsg = ref('');
const currentLine = ref(0);
const matrix = ref([]);
const vertices = ref([]);
const highlightRow = ref(-1);
const graphRef = ref(null);

const codeLines = [
  'def graph_to_matrix(vertices, edges):',
  '    n = len(vertices)',
  '    idx = {v: i for i, v in enumerate(vertices)}',
  '    mat = [[0] * n for _ in range(n)]',
  '    for u, v in edges:',
  '        mat[idx[u]][idx[v]] = 1',
  '        mat[idx[v]][idx[u]] = 1  # 无向图',
  '    return mat',
];

async function generate() {
  const verts = verticesInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const edgeList = edgesInput.value.split(/[,，]/).map(e => {
    const p = e.trim().split('-');
    return p.length === 2 ? [p[0].trim(), p[1].trim()] : null;
  }).filter(Boolean);

  if (verts.length === 0) return ElMessage.warning('请输入顶点');
  loading.value = true;
  reset();
  try {
    const res = await axios.post('http://localhost:5000/api/graph/to-matrix', { vertices: verts, edges: edgeList });
    if (res.data.code === 200) {
      traces.value = res.data.traces;
      ElMessage.success(`生成成功，共 ${traces.value.length} 步`);
    }
  } catch (e) {
    ElMessage.error('请求失败，请确认后端已启动');
  } finally {
    loading.value = false;
  }
}

function handleNext() {
  if (stepIdx.value >= traces.value.length) return ElMessage.warning('演示已结束');
  const step = traces.value[stepIdx.value];
  logMsg.value = step.message;
  currentLine.value = step.line || 0;
  if (step.data) {
    vertices.value = step.data.vertices || [];
    matrix.value = step.data.matrix || [];
    highlightRow.value = step.data.highlight_row ?? -1;
    drawGraph(step.data);
  }
  stepIdx.value++;
}

function reset() {
  stepIdx.value = 0; logMsg.value = ''; currentLine.value = 0;
  matrix.value = []; vertices.value = []; highlightRow.value = -1;
  if (graphRef.value) d3.select(graphRef.value).selectAll('*').remove();
}

function drawGraph(data) {
  const container = graphRef.value;
  if (!container) return;
  const W = container.clientWidth || 400;
  const H = container.clientHeight || 300;
  d3.select(container).selectAll('*').remove();

  const verts = data.vertices || [];
  const edges = (data.edges || []).map(e => ({ source: e[0] || e.source, target: e[1] || e.target }));

  const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  const sim = d3.forceSimulation(verts.map(v => ({ id: v })))
    .force('link', d3.forceLink(edges).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(W / 2, H / 2));

  const link = svg.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', '#94a3b8').attr('stroke-width', 2);
  const node = svg.append('g').selectAll('g').data(sim.nodes()).enter().append('g');
  node.append('circle').attr('r', 22).attr('fill', '#3b82f6').attr('stroke', 'white').attr('stroke-width', 2);
  node.append('text').text(d => d.id).attr('dy', 5).attr('text-anchor', 'middle').style('fill', 'white').style('font-weight', 'bold');
  sim.on('tick', () => {
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

const onKey = e => { if (e.key === 'Enter') handleNext(); };
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.graph-page { display: flex; flex-direction: column; height: 100%; padding: 15px; background: #f8fafc; box-sizing: border-box; gap: 12px; }
.toolbar { background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.06); flex-shrink: 0; }
.toolbar-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.crud-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.crud-tab { padding: 5px 16px; border-radius: 7px; border: 1.5px solid #e2e8f0; background: #f8fafc; color: #475569; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .18s; }
.crud-tab:hover { background: #e0f2fe; border-color: #38bdf8; color: #0369a1; }
.crud-tab.active { background: #3b82f6; border-color: #3b82f6; color: white; font-weight: 600; }
.content-split { display: flex; flex: 1; gap: 12px; overflow: hidden; }
.visual-panel { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,.06); overflow: hidden; }
.canvas-box { flex: 1; overflow: hidden; }
.matrix-panel { width: 220px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.06); display: flex; flex-direction: column; overflow: hidden; }
.matrix-wrap { flex: 1; overflow: auto; padding: 8px; }
.adj-matrix { border-collapse: collapse; font-size: 13px; }
.adj-matrix th, .adj-matrix td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: center; }
.adj-matrix th { background: #f1f5f9; font-weight: 600; }
.cell-one { background: #dbeafe; color: #1d4ed8; font-weight: bold; }
.cell-hl { background: #fef9c3; }
.row-label { background: #f1f5f9; font-weight: 600; }
.info-panel { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.code-box { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.code-content { flex: 1; background: #282c34; color: #abb2bf; font-family: monospace; font-size: 12px; padding: 8px 0; overflow-y: auto; }
.code-line { display: flex; padding: 2px 8px; white-space: pre; }
.code-line.active { background: #3e4451; color: #e5c07b; font-weight: bold; border-left: 3px solid #e5c07b; }
.ln { color: #5c6370; width: 24px; text-align: right; margin-right: 10px; user-select: none; }
.log-box { min-height: 56px; background: white; border-radius: 8px; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #334155; box-shadow: 0 2px 8px rgba(0,0,0,.06); gap: 8px; }
.step-tag { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 99px; font-size: 11px; white-space: nowrap; }
.panel-header { padding: 8px 14px; background: #f1f5f9; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 13px; flex-shrink: 0; }
</style>
