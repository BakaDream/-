<template>
  <div class="graph-page">
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="crud-tabs">
          <button class="crud-tab active">📦 创建</button>
          <button class="crud-tab">➕ 添加顶点</button>
          <button class="crud-tab">🔍 查找路径</button>
          <button class="crud-tab">🗑 删除顶点</button>
        </div>
      </div>
      <div class="toolbar-row">
        <el-input v-model="verticesInput" placeholder="顶点（如: A,B,C,D,E）" class="input-w" />
        <el-input v-model="edgesInput" placeholder="边（如: A-B,A-C,B-D,C-D,D-E）" class="input-w" />
        <el-input v-model="sourceInput" placeholder="起点" style="width:80px" />
        <el-input v-model="targetInput" placeholder="终点" style="width:80px" />
        <el-button type="primary" :loading="loading" @click="generate">查找路径</el-button>
        <el-button @click="handleNext" :disabled="stepIdx >= traces.length">下一步 ▶</el-button>
        <el-button plain @click="reset">重置</el-button>
      </div>
    </div>

    <div class="content-split">
      <div class="visual-panel">
        <div class="panel-header">图结构（DFS 路径探索）</div>
        <div ref="graphRef" class="canvas-box"></div>
      </div>

      <!-- 路径显示 -->
      <div class="path-panel">
        <div class="panel-header">路径追踪</div>
        <div class="path-content">
          <div class="path-steps" v-if="currentPath.length">
            <div v-for="(v, i) in currentPath" :key="i" class="path-node-wrap">
              <div class="path-node" :class="{ 'path-node-last': i === currentPath.length - 1 }">{{ v }}</div>
              <div class="path-arrow" v-if="i < currentPath.length - 1">→</div>
            </div>
          </div>
          <div class="path-empty" v-else>路径将在这里显示...</div>
          <div class="visited-list" v-if="visitedNodes.length">
            <div class="visited-label">已访问顶点：</div>
            <div class="visited-chips">
              <span class="visited-chip" v-for="v in visitedNodes" :key="v">{{ v }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="info-panel">
        <div class="code-box">
          <div class="panel-header">Python Code (DFS)</div>
          <div class="code-content">
            <div v-for="(line, i) in codeLines" :key="i"
                 class="code-line" :class="{ active: currentLine === i + 1 }">
              <span class="ln">{{ i + 1 }}</span>{{ line }}
            </div>
          </div>
        </div>
        <div class="log-box">
          <span class="step-tag found" v-if="logMsg && foundPath">✅</span>
          <span class="step-tag notfound" v-else-if="logMsg && notFound">❌</span>
          <span class="step-tag" v-else-if="logMsg">Step {{ stepIdx }}</span>
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
const sourceInput = ref('A');
const targetInput = ref('E');
const loading = ref(false);
const traces = ref([]);
const stepIdx = ref(0);
const logMsg = ref('');
const currentLine = ref(0);
const currentPath = ref([]);
const visitedNodes = ref([]);
const highlightNode = ref('');
const foundPath = ref(false);
const notFound = ref(false);
const graphRef = ref(null);

const codeLines = [
  'def dfs(node, target, path, visited):',
  '    visited.add(node)',
  '    path.append(node)',
  '    if node == target:',
  '        return True  # 找到路径！',
  '    for neighbor in adj[node]:',
  '        if neighbor not in visited:',
  '            if dfs(neighbor, target, path, visited):',
  '                return True',
  '    path.pop()  # 回溯',
  '    return False',
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
  try {
    const res = await axios.post('http://localhost:5000/api/graph/path', {
      vertices: verts, edges: edgeList,
      source: sourceInput.value.trim(), target: targetInput.value.trim()
    });
    if (res.data.code === 200) {
      traces.value = res.data.traces;
      drawGraph({ vertices: verts, edges: edgeList, path: [], visited: [] });
      ElMessage.success(res.data.path.length ? `共 ${res.data.traces.length} 步，按"下一步"查看 DFS 过程` : '未找到路径');
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
    currentPath.value = step.data.path || [];
    visitedNodes.value = step.data.visited || [];
    highlightNode.value = step.data.highlight_node || '';
    foundPath.value = step.type === 'found';
    notFound.value = step.type === 'not_found';
    drawGraph(step.data);
  }
  stepIdx.value++;
}

function reset() {
  stepIdx.value = 0; logMsg.value = ''; currentLine.value = 0;
  currentPath.value = []; visitedNodes.value = []; highlightNode.value = '';
  foundPath.value = false; notFound.value = false;
  if (graphRef.value) d3.select(graphRef.value).selectAll('*').remove();
}

function drawGraph(data) {
  const container = graphRef.value;
  if (!container) return;
  const W = container.clientWidth || 400, H = container.clientHeight || 300;
  d3.select(container).selectAll('*').remove();
  const pathSet = new Set(data.path || []);
  const visitedSet = new Set(data.visited || []);
  const hl = data.highlight_node || '';
  const verts = (data.vertices || []).map(v => ({ id: v }));
  const edges = (data.edges || []).map(e => ({ source: e[0] || e.source, target: e[1] || e.target }));
  const pathArr = data.path || [];
  const pathEdges = new Set();
  for (let i = 0; i < pathArr.length - 1; i++) pathEdges.add(`${pathArr[i]}-${pathArr[i+1]}`);

  const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);
  const sim = d3.forceSimulation(verts)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(W / 2, H / 2));
  const link = svg.append('g').selectAll('line').data(edges).enter().append('line')
    .attr('stroke', d => {
      const s = d.source.id || d.source, t = d.target.id || d.target;
      return (pathEdges.has(`${s}-${t}`) || pathEdges.has(`${t}-${s}`)) ? '#22c55e' : '#94a3b8';
    })
    .attr('stroke-width', d => {
      const s = d.source.id || d.source, t = d.target.id || d.target;
      return (pathEdges.has(`${s}-${t}`) || pathEdges.has(`${t}-${s}`)) ? 4 : 2;
    });
  const node = svg.append('g').selectAll('g').data(verts).enter().append('g');
  node.append('circle').attr('r', 22)
    .attr('fill', d => d.id === hl ? '#f59e0b' : pathSet.has(d.id) ? '#22c55e' : visitedSet.has(d.id) ? '#94a3b8' : '#ef4444')
    .attr('stroke', 'white').attr('stroke-width', 2);
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
.input-w { width: 230px; }
.content-split { display: flex; flex: 1; gap: 12px; overflow: hidden; }
.visual-panel { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 2px 8px rgba(0,0,0,.06); overflow: hidden; }
.canvas-box { flex: 1; overflow: hidden; }
.path-panel { width: 200px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.06); display: flex; flex-direction: column; overflow: hidden; }
.path-content { flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.path-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.path-node-wrap { display: flex; align-items: center; gap: 4px; }
.path-node { background: #22c55e; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
.path-node-last { background: #f59e0b; }
.path-arrow { color: #94a3b8; font-size: 16px; }
.path-empty { color: #94a3b8; font-size: 13px; text-align: center; margin-top: 20px; }
.visited-label { font-size: 12px; color: #475569; font-weight: 600; margin-bottom: 6px; }
.visited-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.visited-chip { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 99px; padding: 2px 8px; font-size: 12px; color: #475569; }
.info-panel { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.code-box { flex: 1; background: white; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.code-content { flex: 1; background: #282c34; color: #abb2bf; font-family: monospace; font-size: 12px; padding: 8px 0; overflow-y: auto; }
.code-line { display: flex; padding: 2px 8px; white-space: pre; }
.code-line.active { background: #3e4451; color: #e5c07b; font-weight: bold; border-left: 3px solid #e5c07b; }
.ln { color: #5c6370; width: 24px; text-align: right; margin-right: 10px; user-select: none; }
.log-box { min-height: 56px; background: white; border-radius: 8px; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #334155; box-shadow: 0 2px 8px rgba(0,0,0,.06); gap: 8px; }
.step-tag { color: white; padding: 2px 8px; border-radius: 99px; font-size: 11px; background: #3b82f6; }
.step-tag.found { background: #22c55e; }
.step-tag.notfound { background: #ef4444; }
.panel-header { padding: 8px 14px; background: #f1f5f9; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 13px; flex-shrink: 0; }
</style>
