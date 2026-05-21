<template>
  <div class="graph-page">
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="crud-tabs">
          <button class="crud-tab active">📦 创建</button>
          <button class="crud-tab">➕ 添加顶点</button>
          <button class="crud-tab">🔍 查找度数</button>
          <button class="crud-tab">🗑 删除顶点</button>
        </div>
      </div>
      <div class="toolbar-row">
        <el-input v-model="verticesInput" placeholder="顶点（如: A,B,C,D,E）" class="input-w" />
        <el-input v-model="edgesInput" placeholder="边（如: A-B,B-C,C-D,D-E,A-C）" class="input-w" />
        <el-button type="primary" :loading="loading" @click="generate">计算度数</el-button>
        <el-button @click="handleNext" :disabled="stepIdx >= traces.length">下一步 ▶</el-button>
        <el-button plain @click="reset">重置</el-button>
      </div>
    </div>

    <div class="content-split">
      <div class="visual-panel">
        <div class="panel-header">图结构（高亮当前处理边）</div>
        <div ref="graphRef" class="canvas-box"></div>
      </div>

      <!-- 度数表格 -->
      <div class="degree-panel" v-if="Object.keys(degrees).length">
        <div class="panel-header">顶点度数表</div>
        <div class="degree-list">
          <div class="degree-row" v-for="(d, v) in degrees" :key="v"
               :class="{ 'degree-hl': highlightNode === v }">
            <span class="degree-vertex">{{ v }}</span>
            <div class="degree-bar-wrap">
              <div class="degree-bar" :style="{ width: (d / maxDegree * 100) + '%' }"></div>
            </div>
            <span class="degree-val">度 = {{ d }}</span>
          </div>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
const degrees = ref({});
const highlightNode = ref('');
const allEdges = ref([]);
const allVerts = ref([]);
const highlightEdge = ref([]);
const graphRef = ref(null);

const maxDegree = computed(() => Math.max(1, ...Object.values(degrees.value)));

const codeLines = [
  'def calculate_degrees(vertices, edges):',
  '    degrees = {v: 0 for v in vertices}',
  '    for u, v in edges:',
  '        degrees[u] += 1   # u 的度+1',
  '        degrees[v] += 1   # v 的度+1',
  '    return degrees',
];

async function generate() {
  const verts = verticesInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const edgeList = edgesInput.value.split(/[,，]/).map(e => {
    const p = e.trim().split('-');
    return p.length === 2 ? [p[0].trim(), p[1].trim()] : null;
  }).filter(Boolean);
  if (!verts.length) return ElMessage.warning('请输入顶点');
  loading.value = true;
  reset();
  allVerts.value = verts;
  allEdges.value = edgeList;
  try {
    const res = await axios.post('http://localhost:5000/api/graph/degree', { vertices: verts, edges: edgeList });
    if (res.data.code === 200) {
      traces.value = res.data.traces;
      drawGraph({ vertices: verts, edges: edgeList, degrees: {}, highlight_edge: [] });
      ElMessage.success(`共 ${res.data.traces.length} 步，按"下一步"演示`);
    }
  } catch (e) { ElMessage.error('请求失败，请确认后端已启动'); }
  finally { loading.value = false; }
}

function handleNext() {
  if (stepIdx.value >= traces.value.length) return ElMessage.warning('演示已结束');
  const step = traces.value[stepIdx.value];
  logMsg.value = step.message;
  currentLine.value = step.line || 0;
  if (step.data) {
    degrees.value = step.data.degrees || {};
    highlightNode.value = step.data.highlight_edge ? step.data.highlight_edge[0] : '';
    highlightEdge.value = step.data.highlight_edge || [];
    drawGraph(step.data);
  }
  stepIdx.value++;
}

function reset() {
  stepIdx.value = 0; logMsg.value = ''; currentLine.value = 0;
  degrees.value = {}; highlightNode.value = ''; highlightEdge.value = [];
  if (graphRef.value) d3.select(graphRef.value).selectAll('*').remove();
}

function drawGraph(data) {
  const container = graphRef.value;
  if (!container) return;
  const W = container.clientWidth || 400, H = container.clientHeight || 300;
  d3.select(container).selectAll('*').remove();
  const verts = (data.vertices || []).map(v => ({ id: v }));
  const edges = (data.edges || []).map(e => ({ source: e[0] || e.source, target: e[1] || e.target }));
  const hl = data.highlight_edge || [];
  const degs = data.degrees || {};
  const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  const sim = d3.forceSimulation(verts)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(90))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(W / 2, H / 2));
  const link = svg.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', d => (hl.includes(d.source.id || d.source) && hl.includes(d.target.id || d.target)) ? '#f59e0b' : '#94a3b8')
    .attr('stroke-width', d => (hl.includes(d.source.id || d.source) && hl.includes(d.target.id || d.target)) ? 3 : 2);
  const node = svg.append('g').selectAll('g').data(verts).enter().append('g');
  node.append('circle').attr('r', 24)
    .attr('fill', d => hl.includes(d.id) ? '#f59e0b' : '#8b5cf6')
    .attr('stroke', 'white').attr('stroke-width', 2);
  node.append('text').text(d => d.id).attr('dy', 4).attr('text-anchor', 'middle').style('fill', 'white').style('font-weight', 'bold');
  node.append('text').text(d => degs[d.id] !== undefined ? `度:${degs[d.id]}` : '')
    .attr('dy', 40).attr('text-anchor', 'middle').style('fill', '#6b7280').style('font-size', '11px');
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
.input-w { width: 250px; }
.content-split { display: flex; flex: 1; gap: 12px; overflow: hidden; }
.visual-panel { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,.06); overflow: hidden; }
.canvas-box { flex: 1; overflow: hidden; }
.degree-panel { width: 220px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.06); display: flex; flex-direction: column; overflow: hidden; }
.degree-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.degree-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; transition: background .2s; }
.degree-hl { background: #fef3c7; }
.degree-vertex { font-weight: 700; color: #1e293b; width: 28px; text-align: center; background: #e0e7ff; border-radius: 50%; height: 28px; line-height: 28px; flex-shrink: 0; }
.degree-bar-wrap { flex: 1; background: #f1f5f9; border-radius: 99px; height: 10px; overflow: hidden; }
.degree-bar { height: 100%; background: linear-gradient(90deg, #8b5cf6, #3b82f6); border-radius: 99px; transition: width 0.4s; }
.degree-val { font-size: 12px; color: #475569; font-weight: 600; white-space: nowrap; }
.info-panel { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.code-box { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.code-content { flex: 1; background: #282c34; color: #abb2bf; font-family: monospace; font-size: 12px; padding: 8px 0; overflow-y: auto; }
.code-line { display: flex; padding: 2px 8px; white-space: pre; }
.code-line.active { background: #3e4451; color: #e5c07b; font-weight: bold; border-left: 3px solid #e5c07b; }
.ln { color: #5c6370; width: 24px; text-align: right; margin-right: 10px; user-select: none; }
.log-box { min-height: 56px; background: white; border-radius: 8px; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #334155; box-shadow: 0 2px 8px rgba(0,0,0,.06); gap: 8px; }
.step-tag { background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 99px; font-size: 11px; }
.panel-header { padding: 8px 14px; background: #f1f5f9; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 13px; flex-shrink: 0; }
</style>
