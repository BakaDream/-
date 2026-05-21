<template>
  <div class="algo-container">
    <div class="toolbar">
      <!-- 初始建树 -->
      <div class="tool-group">
        <el-input v-model="inputVal" placeholder="初始序列 (逗号分隔)" class="custom-input" style="width: 200px" />
        <el-button type="primary" @click="handleInit" :loading="loading" plain>
          重新建树
        </el-button>
      </div>

      <el-divider direction="vertical" />

      <!-- CRUD 操作 -->
      <div class="tool-group">
        <el-input v-model="targetVal" placeholder="目标数字" style="width: 100px" />
        <el-button type="success" @click="handleInsert" :loading="loading">增 (Insert)</el-button>
        <el-button type="danger" @click="handleDelete" :loading="loading">删 (Delete)</el-button>
        <!-- 改 = 删旧 + 增新 -->
        <el-button color="#626aef" @click="handleUpdateDialog" :loading="loading">改 (Update)</el-button>
        <el-button type="warning" @click="handleSearch" :loading="loading">查 (Search)</el-button>
      </div>

      <el-divider direction="vertical" />

      <div class="tool-group">
        <el-button type="info" @click="handleNext" :disabled="!hasMoreSteps">
          下一步 (Enter)
        </el-button>
        <el-button @click="handleResetPlay">重置动画</el-button>
      </div>
    </div>

    <!-- 中间弹窗：修改节点 -->
    <el-dialog v-model="showUpdateDialog" title="修改节点" width="300px">
      <el-form :model="updateForm">
        <el-form-item label="原节点值">
          <el-input v-model="updateForm.oldVal" disabled />
        </el-form-item>
        <el-form-item label="新节点值">
          <el-input v-model="updateForm.newVal" placeholder="输入新数字" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showUpdateDialog = false">取消</el-button>
          <el-button type="primary" @click="executeupdate">执行修改</el-button>
        </span>
      </template>
    </el-dialog>

    <div class="content-split">
      <div class="visual-panel">
        <div class="canvas-box" id="bst-crud-canvas"></div>
      </div>

      <div class="info-panel">
        <!-- 移除代码框，因为 CRUD 共用多个代码分支，主要展示动画日志即可 -->
        <div class="code-box" style="flex: 2">
          <div class="panel-header">当前树节点列表 (Store)</div>
          <div class="code-content" style="padding: 15px; font-size: 16px; white-space: normal; line-height: 1.5">
            [ <span v-for="(v, i) in bstStore.values" :key="i">{{ v }}{{ i<bstStore.values.length-1 ? ', ' : '' }}</span> ]
          </div>
        </div>
        <div class="log-box" style="flex: 1; flex-direction: column; align-items: flex-start; padding: 15px">
           <div style="font-weight: bold; margin-bottom: 8px;">操作日志：</div>
           <div class="log-status">
             <span v-if="currentLog" class="step-tag">Step {{ currentStep }} / {{ traceData.length }}</span>
             {{ currentLog || '等待开始...' }}
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import * as d3 from 'd3';
import { useBstStore } from '../../stores/bstStore';

const bstStore = useBstStore();

const inputVal = ref("50, 30, 70, 20, 40, 60, 80");
const targetVal = ref("");
const loading = ref(false);

const traceData = ref([]);
const stepIndex = ref(0);
const currentLog = ref("");
const currentStep = ref(0);
const hasMoreSteps = ref(false);

// Update Dialog state
const showUpdateDialog = ref(false);
const updateForm = ref({ oldVal: '', newVal: '' });
const pendingUpdateStage = ref(null);

const BASE_URL = 'http://localhost:5000/api/tree';

// --- API Calls ---

async function fetchTraces(endpoint, payload, onSuccess) {
  if (loading.value) return;
  loading.value = true;
  handleResetPlay();
  
  try {
    const res = await axios.post(`${BASE_URL}${endpoint}`, payload);
    if (res.data.code === 200) {
      traceData.value = res.data.traces;
      hasMoreSteps.value = traceData.value.length > 0;
      if (onSuccess) onSuccess(res.data);
      // Automatically draw initial state or empty state
      if (traceData.value.length > 0) {
        drawTree(traceData.value[0]?.data);
      } else {
        clearTree();
      }
      ElMessage.success(`操作成功，共 ${traceData.value.length} 步演示`);
    } else {
      ElMessage.error("后端返回错误");
    }
  } catch (e) {
    console.error(e);
    ElMessage.error("连接失败，请检查 Python 后端是否启动");
  } finally {
    loading.value = false;
  }
}

const handleInit = () => {
  const nums = inputVal.value.split(/[,，]/).map(n => n.trim()).filter(n => n).map(Number);
  bstStore.setValues(nums);
  
  fetchTraces('/bst/visualize', { numbers: bstStore.values });
};

const handleInsert = () => {
  if (!targetVal.value) return ElMessage.warning("请输入要插入的值");
  const val = Number(targetVal.value);
  
  fetchTraces('/bst/insert_one', { numbers: bstStore.values, target: val }, (data) => {
    bstStore.setValues(data.newNumbers);
  });
};

const handleSearch = () => {
  if (!targetVal.value) return ElMessage.warning("请输入要查找的值");
  const val = Number(targetVal.value);
  
  fetchTraces('/bst/search', { numbers: bstStore.values, target: val });
};

const handleDelete = () => {
  if (!targetVal.value) return ElMessage.warning("请输入要删除的值");
  const val = Number(targetVal.value);
  
  fetchTraces('/bst/delete', { numbers: bstStore.values, target: val }, (data) => {
    bstStore.setValues(data.newNumbers);
  });
};

// Update is a combination of Delete then Insert
const handleUpdateDialog = () => {
  if (!targetVal.value) return ElMessage.warning("在上方输入框填入想修改的 目标值(修改前)，然后点击改");
  updateForm.value.oldVal = targetVal.value;
  updateForm.value.newVal = '';
  showUpdateDialog.value = true;
};

const executeupdate = () => {
  if (!updateForm.value.newVal) return ElMessage.error("新节点值不能为空");
  showUpdateDialog.value = false;
  
  const oldV = Number(updateForm.value.oldVal);
  const newV = Number(updateForm.value.newVal);
  
  // Phase 1: Delete
  fetchTraces('/bst/delete', { numbers: bstStore.values, target: oldV }, (data) => {
    bstStore.setValues(data.newNumbers);
    
    // Set a flag so when Delete finishes, we start Insert
    pendingUpdateStage.value = newV;
  });
};


// --- Playback Logic ---

const handleNext = () => {
  if (stepIndex.value >= traceData.value.length) {
    hasMoreSteps.value = false;
    
    // Check if we have pending update (Insert phase)
    if (pendingUpdateStage.value !== null) {
      const newV = pendingUpdateStage.value;
      pendingUpdateStage.value = null; // clear
      
      ElMessage.info(`删除阶段演示完毕，即将开始插入新值: ${newV}`);
      setTimeout(() => {
        fetchTraces('/bst/insert_one', { numbers: bstStore.values, target: newV }, (data) => {
          bstStore.setValues(data.newNumbers);
        });
      }, 1000);
    } else {
      ElMessage.warning("演示已结束");
    }
    return;
  }

  const step = traceData.value[stepIndex.value];
  currentLog.value = step.message;
  currentStep.value = step.step;

  if (step.data || step.data === null) {
    drawTree(step.data);
  }

  stepIndex.value++;
  if (stepIndex.value >= traceData.value.length && pendingUpdateStage.value === null) {
    hasMoreSteps.value = false;
  }
};

const handleResetPlay = () => {
  stepIndex.value = 0;
  currentLog.value = "";
  currentStep.value = 0;
  hasMoreSteps.value = false;
  
  if (traceData.value && traceData.value.length > 0) {
      drawTree(traceData.value[0]?.data);
      hasMoreSteps.value = true;
  }
};

const onKey = (e) => { 
  if(e.key === 'Enter' && hasMoreSteps.value) handleNext(); 
};
onMounted(() => {
    window.addEventListener('keydown', onKey);
    handleInit(); // Default init
});
onUnmounted(() => window.removeEventListener('keydown', onKey));

// --- D3 Drawing Logic (Reused from BST.vue) ---

const drawTree = (data) => {
  const container = d3.select("#bst-crud-canvas");
  container.selectAll("*").remove();
  if (!data) return;

  const width = container.node().clientWidth;
  const height = container.node().clientHeight;
  const svg = container.append("svg").attr("width", width).attr("height", height);
  const g = svg.append("g").attr("transform", "translate(0, 50)");

  const root = d3.hierarchy(data);
  const treeLayout = d3.tree().size([width - 80, height - 120]);
  treeLayout(root);

  g.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("fill", "none").attr("stroke", "#ccc").attr("stroke-width", 2)
    .attr("d", d3.linkVertical().x(d => d.x + 40).y(d => d.y));

  const nodes = g.selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("transform", d => `translate(${d.x + 40},${d.y})`);

  // We can change colors dynamically if needed based on state, to show search results, but standard color is fine for now
  nodes.append("circle").attr("r", 20).attr("fill", "white").attr("stroke", "#409EFF").attr("stroke-width", 3);
  nodes.append("text").text(d => d.data.name).attr("dy", 5).attr("text-anchor", "middle").style("font-weight", "bold");
};

const clearTree = () => {
  d3.select("#bst-crud-canvas").selectAll("*").remove();
};
</script>

<style scoped>
/* Adapted from AlgoLayout.vue Layout */
.algo-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 15px;
  background-color: #f8fafc;
  box-sizing: border-box;
}
.toolbar { background: white; padding: 12px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.tool-group { display: flex; gap: 10px; align-items: center;}
.content-split { display: flex; flex: 1; gap: 15px; overflow: hidden; }

/* 左侧可视化 */
.visual-panel { flex: 1; background: white; border-radius: 8px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column; }
.canvas-box { flex: 1; width: 100%; height: 100%; min-height: 500px; overflow: hidden; }

/* 右侧信息栏 */
.info-panel { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; gap: 15px; }
.code-box { background: white; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.log-box { background: white; border-radius: 8px; display: flex; align-items: center; padding: 0 15px; font-size: 14px; font-weight: 500; color: #334155; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

.panel-header { padding: 10px; background: #f1f5f9; font-weight: bold; color: #475569; border-bottom: 1px solid #e2e8f0; }
.code-content { flex: 1; padding: 10px 0; background: #282c34; color: #abb2bf; font-family: monospace; overflow-y: auto; }
.step-tag { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 8px; }
</style>
