<template>
  <div class="graph-page">
    <div class="toolbar">
      <div class="toolbar-row">
        <el-input v-model="verticesInput" placeholder="顶点（如: A,B,C,D）" class="input-w" />
        <el-input v-model="edgesInput" placeholder="初始边（如: A-B,B-C,C-D）" class="input-w" />
        <el-button type="primary" :loading="loading" @click="generate">初始化图</el-button>
        <el-button plain @click="reset">重置</el-button>
      </div>
      <div class="toolbar-row" style="margin-top:8px;" v-if="matrix.length">
        <span style="font-size:13px;color:#475569;font-weight:600;">修改矩阵元素：</span>
        <el-input-number v-model="editRow" :min="0" :max="vertices.length-1" size="small" style="width:90px" />
        <span style="font-size:13px;">行</span>
        <el-input-number v-model="editCol" :min="0" :max="vertices.length-1" size="small" style="width:90px" />
        <span style="font-size:13px;">列 → 值</span>
        <el-input-number v-model="editVal" :min="0" :max="1" size="small" style="width:70px" />
        <el-button type="warning" @click="updateCell">修改并更新图</el-button>
        <el-button @click="handleNext" :disabled="stepIdx >= traces.length">下一步 ▶</el-button>
      </div>
    </div>

    <div class="content-split">
      <div class="visual-panel">
        <div class="panel-header">图结构（实时同步）</div>
        <div ref="graphRef" class="canvas-box"></div>
      </div>

      <div class="matrix-panel" v-if="matrix.length">
        <div class="panel-header">邻接矩阵（可编辑）</div>
        <div class="matrix-wrap">
          <table class="adj-matrix">
            <thead>
              <tr><th></th><th v-for="v in vertices" :key="v">{{ v }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in matrix" :key="i">
                <td class="row-label">{{ vertices[i] }}</td>
                <td v-for="(cell, j) in row" :key="j"
                    :class="{ 'cell-one': cell === 1, 'cell-edited': editRow===i&&editCol===j }">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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

const verticesInput = ref('A,B,C,D');
const edgesInput = ref('A-B,B-C,C-D');
const loading = ref(false);
const traces = ref([]);
const stepIdx = ref(0);
const logMsg = ref('');
const currentLine = ref(0);
const matrix = ref([]);
const vertices = ref([]);
const editRow = ref(0);
const editCol = ref(1);
const editVal = ref(1);
const graphRef = ref(null);

const codeLines = [
  'def update_matrix(matrix, row, col, val):',
  '    old = matrix[row][col]',
  '    matrix[row][col] = val      # 更新目标位置',
  '    matrix[col][row] = val      # 同步对称位置（无向图）',
  '    # 重新生成边列表',
  '    edges = []',
  '    for i in range(len(matrix)):',
  '        for j in range(i, len(matrix)):',
  '            if matrix[i][j] == 1:',
  '                edges.append((vertices[i], vertices[j]))',
  '    return matrix, edges',
];

async function generate() {
  const verts = verticesInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const edgeList = edgesInput.value.split(/[,，]/).map(e => {
    const p = e.trim().split('-');
    return p.length === 2 ? [p[0].trim(), p[1].trim()] : null;
  }).filter(Boolean);
  if (!verts.length) return ElMessage.warning('请输入顶点');
  loading.value = true;
  try {
    const res = await axios.post('http://localhost:5000/api/graph/to-matrix', { vertices: verts, edges: edgeList });
    if (res.data.code === 200) {
      const last = res.data.traces[res.data.traces.length - 1];
      vertices.value = last.data.vertices;
      matrix.value = last.data.matrix;
      drawGraph({ vertices: vertices.value, edges: last.data.edges });
      logMsg.value = '图已初始化，可在上方修改矩阵元素';
    }
  } catch (e) { ElMessage.error('请求失败，请确认后端已启动'); }
  finally { loading.value = false; }
}

async function updateCell() {
  const res = await axios.post('http://localhost:5000/api/graph/update-matrix', {
    vertices: vertices.value, matrix: matrix.value,
    row: editRow.value, col: editCol.value, value: editVal.value
  });
  if (res.data.code === 200) {
    traces.value = res.data.traces;
    stepIdx.value = 0;
    matrix.value = res.data.matrix;
    ElMessage.success(`矩阵已更新，共 ${res.data.traces.length} 步动画`);
  }
}

function handleNext() {
  if (stepIdx.value >= traces.value.length) return ElMessage.warning('演示已结束');
  const step = traces.value[stepIdx.value];
  logMsg.value = step.message;
  currentLine.value = step.line || 0;
  if (step.data) drawGraph(step.data);
  stepIdx.value++;
}

function reset() {
  stepIdx.value = 0; logMsg.value = ''; currentLine.value = 0;
  matrix.value = []; vertices.value = [];
  if (graphRef.value) d3.select(graphRef.value).selectAll('*').remove();
}

function drawGraph(data) {
  const container = graphRef.value;
  if (!container) return;
  const W = container.clientWidth || 400, H = container.clientHeight || 300;
  d3.select(container).selectAll('*').remove();
  const verts = (data.vertices || []).map(v => ({ id: v }));
  const edges = (data.edges || []).map(e => ({ source: e[0] || e.source, target: e[1] || e.target }));
  const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  const sim = d3.forceSimulation(verts)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(W / 2, H / 2));
  const link = svg.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', '#94a3b8').attr('stroke-width', 2);
  const node = svg.append('g').selectAll('g').data(verts).enter().append('g');
  node.append('circle').attr('r', 22).attr('fill', '#10b981').attr('stroke', 'white').attr('stroke-width', 2);
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
.input-w { width: 220px; }
.content-split { display: flex; flex: 1; gap: 12px; overflow: hidden; }
.visual-panel { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,.06); overflow: hidden; }
.canvas-box { flex: 1; overflow: hidden; }
.matrix-panel { width: 220px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.06); display: flex; flex-direction: column; overflow: hidden; }
.matrix-wrap { flex: 1; overflow: auto; padding: 8px; }
.adj-matrix { border-collapse: collapse; font-size: 13px; }
.adj-matrix th, .adj-matrix td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: center; }
.adj-matrix th { background: #f1f5f9; font-weight: 600; }
.cell-one { background: #dbeafe; color: #1d4ed8; font-weight: bold; }
.cell-edited { background: #fde68a !important; outline: 2px solid #f59e0b; }
.row-label { background: #f1f5f9; font-weight: 600; }
.info-panel { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.code-box { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.code-content { flex: 1; background: #282c34; color: #abb2bf; font-family: monospace; font-size: 12px; padding: 8px 0; overflow-y: auto; }
.code-line { display: flex; padding: 2px 8px; white-space: pre; }
.code-line.active { background: #3e4451; color: #e5c07b; font-weight: bold; border-left: 3px solid #e5c07b; }
.ln { color: #5c6370; width: 24px; text-align: right; margin-right: 10px; user-select: none; }
.log-box { min-height: 56px; background: white; border-radius: 8px; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #334155; box-shadow: 0 2px 8px rgba(0,0,0,.06); gap: 8px; }
.step-tag { background: #f59e0b; color: white; padding: 2px 8px; border-radius: 99px; font-size: 11px; }
.panel-header { padding: 8px 14px; background: #f1f5f9; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 13px; flex-shrink: 0; }
</style>
