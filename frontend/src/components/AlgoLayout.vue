<template>
  <div class="algo-root">

    <!-- ═══ Top Header Bar ═══════════════════════════════════════════ -->
    <div class="top-bar">
      <div class="algo-title">
        <span class="title-dot"></span>
        <span>{{ algoTitle }}</span>
      </div>

      <!-- Language switcher -->
      <div class="lang-pills">
        <button
          v-for="lang in languages"
          :key="lang.key"
          class="lang-pill"
          :class="{ active: activeLang === lang.key }"
          @click="activeLang = lang.key"
        >
          <span class="lang-icon">{{ lang.icon }}</span>{{ lang.label }}
        </button>
      </div>
    </div>

    <!-- ═══ Main 2-Column Layout ══════════════════════════════════════ -->
    <div class="main-body">

      <!-- ── Left: Animation + Controls ────────────────────────────── -->
      <div class="center-col">

        <!-- Animation canvas -->
        <div class="anim-card">
          <div class="anim-header">
            <span class="anim-label">▶ 动画演示</span>
            <div class="anim-controls">
              <!-- Speed selector -->
              <div class="speed-btns">
                <span class="speed-label">速度</span>
                <button
                  v-for="s in speeds"
                  :key="s.val"
                  class="speed-btn"
                  :class="{ active: speed === s.val }"
                  @click="speed = s.val"
                >{{ s.label }}</button>
              </div>
              <!-- Progress -->
              <span class="progress-tag" v-if="traceData.length">
                {{ stepIndex }} / {{ traceData.length }}
              </span>
            </div>
          </div>

          <!-- Canvas slot -->
          <div class="canvas-area">
            <slot name="canvas"></slot>
            <!-- Idle placeholder -->
            <div v-if="!hasStarted" class="idle-overlay">
              <div class="idle-icon">◉</div>
              <p>输入数据并点击执行，动画将<strong>自动播放</strong></p>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="progress-bar-wrap" v-if="traceData.length">
            <div
              class="progress-bar-fill"
              :style="{ width: (stepIndex / traceData.length * 100) + '%' }"
            ></div>
          </div>

          <!-- Step log -->
          <div class="step-log" :class="{ active: currentLog }">
            <span v-if="currentLog" class="step-badge">Step {{ currentStep }}</span>
            <span class="log-text">{{ currentLog || '等待操作…' }}</span>
          </div>
        </div>

        <!-- CRUD controls card -->
        <div class="ctrl-card">
          <!-- Operation tabs -->
          <div class="op-tabs" v-if="tabs && tabs.length">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="op-tab"
              :class="{ active: activeTabKey === tab.key }"
              @click="switchTab(tab)"
            >{{ tab.label }}</button>
          </div>

          <!-- Input row -->
          <div class="input-row">
            <input
              v-model="inputVal"
              class="main-input"
              :placeholder="activePlaceholder"
              @keyup.enter="handleGenerate"
            />
            <button class="btn-run" :class="{ loading }" @click="handleGenerate" :disabled="loading">
              <span v-if="loading" class="spin">⟳</span>
              <span v-else>▶ {{ activeTabLabel }}</span>
            </button>
            <button class="btn-reset" @click="handleReset">↺ 重置</button>

            <!-- Playback controls (shown after gen) -->
            <template v-if="traceData.length">
              <button
                class="btn-ctrl"
                @click="playPause"
                :title="isPlaying ? '暂停' : '继续'"
              >{{ isPlaying ? '⏸' : '⏵' }}</button>
              <button class="btn-ctrl" @click="stepBackward" title="上一步">⏮</button>
              <button class="btn-ctrl" @click="stepForward" title="下一步">⏭</button>
            </template>
          </div>
        </div>

      </div><!-- /center-col -->

      <!-- ── Right: Code Panel ───────────────────────────────────────── -->
      <div class="code-col">
        <div class="code-card">
          <div class="code-header">
            <span class="code-title">📄 算法代码</span>
            <span class="lang-badge">{{ activeLangLabel }}</span>
          </div>

          <div class="code-body" ref="codeRef">
            <div
              v-for="(line, i) in activeCodes"
              :key="i"
              class="code-line"
              :class="{
                highlighted: currentLine === i + 1,
                dimmed: currentLine > 0 && currentLine !== i + 1
              }"
            >
              <span class="ln">{{ i + 1 }}</span>
              <span class="code-text">{{ line }}</span>
            </div>
            <div v-if="!activeCodes.length" class="code-empty">
              暂无该语言代码
            </div>
          </div>
        </div>
      </div><!-- /code-col -->

    </div><!-- /main-body -->

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import axios from 'axios';

// ─── Props ────────────────────────────────────────────────────────────
const props = defineProps({
  // Legacy single-url mode
  url:          { type: String,  default: '' },
  codeLines:    { type: Array,   default: () => [] },
  // CRUD tabs mode
  tabs:         { type: Array,   default: null },
  /**
   * codesMap supports two shapes:
   *  Shape A (single lang): { insert: [...lines], delete: [...lines] }
   *  Shape B (multi lang):  { insert: { python:[...], cpp:[...], java:[...], javascript:[...] }, ... }
   */
  codesMap:     { type: Object,  default: null },
  defaultInput: { type: String,  default: '' },
  algoTitle:    { type: String,  default: '算法演示' },
});

const emit = defineEmits(['onDraw', 'onReset']);

function parseDefaultValues(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,，\s]+/)
    .map(token => token.trim())
    .filter(Boolean);
}

// ─── Languages ───────────────────────────────────────────────────────
const languages = [
  { key: 'c',          label: 'C',          icon: '⚙️' },
  { key: 'csharp',     label: 'C#',         icon: '💠' },
  { key: 'python',     label: 'Python',     icon: '🐍' },
  { key: 'java',       label: 'Java',       icon: '☕' },
];
const activeLang      = ref('c');
const activeLangLabel = computed(() => languages.find(l => l.key === activeLang.value)?.label ?? '');

// Speed options (ms per step)
const speeds = [
  { val: 1200, label: '慢' },
  { val: 700,  label: '中' },
  { val: 350,  label: '快' },
  { val: 100,  label: '极速' },
];
const speed = ref(700);

// ─── State ───────────────────────────────────────────────────────────
const inputVal      = ref(props.defaultInput || '');
const loading       = ref(false);
const traceData     = ref([]);
const stepIndex     = ref(0);
const currentLog    = ref('');
const currentStep   = ref(0);
const currentLine   = ref(0);
const codeRef       = ref(null);
const hasStarted    = ref(false);
const isPlaying     = ref(false);
let   timer         = null;
const currentValues = ref(parseDefaultValues(props.defaultInput));

// Active tab
const activeTabKey = ref(props.tabs?.[0]?.key ?? '');
const activeTab    = computed(() => props.tabs?.find(t => t.key === activeTabKey.value) ?? null);
const activePlaceholder = computed(() => activeTab.value?.placeholder ?? '输入数字（如: 50,30,70）');
const activeTabLabel    = computed(() => activeTab.value?.label ?? '执行');

// ─── Code lines resolution ────────────────────────────────────────────
const activeCodes = computed(() => {
  const lang = activeLang.value;

  // Multi-lang codesMap (Shape B)
  if (props.codesMap && activeTabKey.value) {
    const entry = props.codesMap[activeTabKey.value];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return entry[lang] ?? (lang === 'c' ? entry['cpp'] : null) ?? (lang === 'csharp' ? entry['java'] : null) ?? entry['python'] ?? [];
    }
    // Shape A: plain array, return as-is for python, fallback for others
    if (Array.isArray(entry)) {
      return entry;
    }
  }

  // Legacy single codeLines
  return props.codeLines ?? [];
});

// ─── Tab switch ───────────────────────────────────────────────────────
function switchTab(tab) {
  stopPlayback();
  activeTabKey.value = tab.key;
  currentLine.value  = 0;
  currentLog.value   = '';
  traceData.value    = [];
  stepIndex.value    = 0;
  hasStarted.value   = false;
  inputVal.value     = tab.isInit ? (props.defaultInput || '') : '';
}

// ─── Generate / Execute ───────────────────────────────────────────────
async function handleGenerate() {
  const tab = activeTab.value;
  const url = tab ? tab.url : props.url;
  if (!url) return alert('未配置 API 地址');

  stopPlayback();
  loading.value = true;
  resetState();

  try {
    let payload;
    if (tab?.buildPayload) {
      payload = tab.buildPayload({
        input: inputVal.value,
        currentValues: currentValues.value,
        defaultInput: props.defaultInput,
      });
    } else if (!tab || tab.isInit) {
      const nums = inputVal.value.split(/[,，\s]+/).map(n => n.trim()).filter(Boolean);
      payload = { numbers: nums };
      currentValues.value = nums;
    } else {
      const target = inputVal.value.trim();
      if (!target) { loading.value = false; return; }
      payload = { numbers: currentValues.value, target };
    }

    const res = await axios.post(url, payload);
    if (res.data.code === 200) {
      traceData.value = res.data.traces;
      if (res.data.newNumbers) currentValues.value = res.data.newNumbers;
      hasStarted.value = true;
      // Auto-play immediately
      startPlayback();
    }
  } catch (e) {
    console.error(e);
    alert('连接失败，请检查 Python 后端是否启动 (python app.py)');
  } finally {
    loading.value = false;
  }
}

// ─── Playback engine ─────────────────────────────────────────────────
function startPlayback() {
  if (isPlaying.value) return;
  isPlaying.value = true;
  scheduleNext();
}

function scheduleNext() {
  timer = setTimeout(async () => {
    if (!isPlaying.value) return;
    if (stepIndex.value >= traceData.value.length) {
      isPlaying.value = false;
      return;
    }
    await applyStep(stepIndex.value);
    stepIndex.value++;
    if (stepIndex.value < traceData.value.length) {
      scheduleNext();
    } else {
      isPlaying.value = false;
    }
  }, speed.value);
}

async function applyStep(idx) {
  const step = traceData.value[idx];
  currentLog.value  = step.message ?? '';
  currentStep.value = step.step ?? idx + 1;
  if (step.line) {
    currentLine.value = step.line;
    await nextTick();
    scrollToHighlight();
  }
  if (step.data !== undefined) emit('onDraw', step.data);
}

function scrollToHighlight() {
  const el = codeRef.value?.querySelector('.highlighted');
  const top = el.offsetTop - (codeRef.value?.offsetHeight ?? 0) / 2 + el.offsetHeight / 2
  if (codeRef.value) codeRef.value.scrollTop = Math.max(0, top)
}

function stopPlayback() {
  clearTimeout(timer);
  isPlaying.value = false;
}

function playPause() {
  if (isPlaying.value) {
    stopPlayback();
  } else {
    if (stepIndex.value >= traceData.value.length) {
      // Restart from beginning
      resetState();
      hasStarted.value = true;
    }
    startPlayback();
  }
}

async function stepForward() {
  stopPlayback();
  if (stepIndex.value >= traceData.value.length) return;
  await applyStep(stepIndex.value);
  stepIndex.value++;
}

async function stepBackward() {
  stopPlayback();
  if (stepIndex.value <= 0) return;
  stepIndex.value--;
  if (stepIndex.value > 0) {
    await applyStep(stepIndex.value - 1);
  } else {
    currentLine.value = 0;
    currentLog.value  = '';
  }
}

// ─── Reset ────────────────────────────────────────────────────────────
function resetState() {
  stepIndex.value   = 0;
  traceData.value   = [];
  currentLine.value = 0;
  currentLog.value  = '';
  currentStep.value = 0;
}

function handleReset() {
  stopPlayback();
  resetState();
  hasStarted.value = false;
  currentValues.value = parseDefaultValues(props.defaultInput);
  emit('onReset');
}

// Re-schedule when speed changes mid-play
watch(speed, () => {
  if (isPlaying.value) {
    clearTimeout(timer);
    scheduleNext();
  }
});

onUnmounted(() => clearTimeout(timer));
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

/* ═══ Root ═══════════════════════════════════════════════════════════ */
.algo-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: 'Inter', sans-serif;
  background: #f0f4f8;
  box-sizing: border-box;
  overflow: hidden;
}

/* ═══ Top bar ════════════════════════════════════════════════════════ */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}

.algo-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
}
.title-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
}

/* Language pills */
.lang-pills { display: flex; gap: 6px; }
.lang-pill {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 14px;
  border-radius: 20px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: all .18s;
}
.lang-pill:hover { border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; }
.lang-pill.active {
  background: #1d4ed8; border-color: #1d4ed8;
  color: #fff; font-weight: 600;
  box-shadow: 0 2px 8px rgba(29,78,216,.3);
}
.lang-icon { font-size: 13px; }

/* ═══ Main body: 2 cols ══════════════════════════════════════════════ */
.main-body {
  display: flex;
  flex: 1;
  gap: 14px;
  padding: 14px;
  overflow: hidden;
  min-height: 0;
}

/* ── Center column ────── */
.center-col {
  display: flex;
  flex-direction: column;
  flex: 1.4;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

/* ── Code column ─────── */
.code-col {
  flex: 0 0 420px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ═══ Animation card ═════════════════════════════════════════════════ */
.anim-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,.12);
  background: linear-gradient(160deg, #1565c0 0%, #0277bd 50%, #01579b 100%);
  min-height: 0;
}

.anim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(0,0,0,.18);
}
.anim-label {
  color: rgba(255,255,255,.9);
  font-size: 13px; font-weight: 600;
  letter-spacing: .5px;
}
.anim-controls { display: flex; align-items: center; gap: 14px; }

/* Speed buttons */
.speed-btns { display: flex; align-items: center; gap: 6px; }
.speed-label { color: rgba(255,255,255,.6); font-size: 11px; }
.speed-btn {
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.25);
  background: rgba(255,255,255,.1);
  color: rgba(255,255,255,.75);
  font-size: 11px; cursor: pointer;
  transition: all .15s;
}
.speed-btn:hover { background: rgba(255,255,255,.2); }
.speed-btn.active {
  background: rgba(255,255,255,.9); color: #1565c0; font-weight: 700;
}

.progress-tag {
  color: rgba(255,255,255,.7);
  font-size: 12px;
}

/* Canvas area */
.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 200px;
}

/* Idle overlay */
.idle-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: rgba(255,255,255,.5);
  gap: 12px;
  pointer-events: none;
}
.idle-icon {
  font-size: 56px;
  animation: pulse 2.5s ease-in-out infinite;
}
.idle-overlay p { font-size: 14px; text-align: center; }
.idle-overlay strong { color: rgba(255,255,255,.85); }

@keyframes pulse {
  0%,100% { opacity: .4; transform: scale(1); }
  50%      { opacity: .9; transform: scale(1.1); }
}

/* Progress bar */
.progress-bar-wrap {
  height: 4px;
  background: rgba(255,255,255,.15);
  flex-shrink: 0;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #a78bfa);
  transition: width .3s ease;
}

/* Step log */
.step-log {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0,0,0,.22);
  color: rgba(255,255,255,.65);
  font-size: 13px;
  min-height: 42px;
  flex-shrink: 0;
  transition: color .3s;
}
.step-log.active { color: rgba(255,255,255,.95); }
.step-badge {
  background: rgba(255,255,255,.18);
  color: #e2e8f0;
  padding: 2px 10px;
  border-radius: 99px;
  font-size: 11px;
  white-space: nowrap;
}

/* ═══ Controls card ══════════════════════════════════════════════════ */
.ctrl-card {
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 14px;
  padding: 12px 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Op tabs */
.op-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.op-tab {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 13px; font-weight: 500;
  cursor: pointer;
  transition: all .18s;
}
.op-tab:hover  { border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; }
.op-tab.active {
  background: #1d4ed8; border-color: #1d4ed8;
  color: #fff; font-weight: 600;
  box-shadow: 0 2px 8px rgba(29,78,216,.25);
}

/* Input row */
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.main-input {
  flex: 1; min-width: 180px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  font-size: 13px; font-family: inherit;
  outline: none;
  transition: border-color .18s;
  background: #f8fafc;
}
.main-input:focus { border-color: #3b82f6; background: #fff; }

.btn-run {
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #06b6d4);
  color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
  transition: opacity .18s, transform .1s;
  box-shadow: 0 2px 8px rgba(37,99,235,.35);
}
.btn-run:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
.btn-run:disabled { opacity: .5; cursor: not-allowed; }
.btn-run.loading { background: #94a3b8; }

.btn-reset {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b; font-size: 13px; font-weight: 500;
  cursor: pointer;
  transition: all .18s;
}
.btn-reset:hover { border-color: #f87171; color: #ef4444; background: #fff5f5; }

.btn-ctrl {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  color: #334155; font-size: 16px;
  cursor: pointer;
  transition: all .18s;
}
.btn-ctrl:hover { border-color: #93c5fd; background: #eff6ff; }

.spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ═══ Code card ══════════════════════════════════════════════════════ */
.code-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,.12);
  background: #1e1e2e;
  min-height: 0;
  height: 100%;
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #16162a;
  border-bottom: 1px solid rgba(255,255,255,.06);
  flex-shrink: 0;
}
.code-title { color: rgba(255,255,255,.8); font-size: 13px; font-weight: 600; }
.lang-badge {
  background: rgba(99,102,241,.25);
  color: #a5b4fc;
  padding: 2px 10px;
  border-radius: 99px;
  font-size: 11px; font-weight: 600;
  border: 1px solid rgba(99,102,241,.3);
}

.code-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12.5px;
  line-height: 1.65;
  scroll-behavior: auto;
}
.code-body::-webkit-scrollbar { width: 6px; }
.code-body::-webkit-scrollbar-track { background: transparent; }
.code-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 3px; }

.code-line {
  display: flex;
  align-items: baseline;
  padding: 2px 16px;
  white-space: pre;
  transition: background .25s, color .25s;
  border-left: 3px solid transparent;
}
.code-line.highlighted {
  background: rgba(239, 68, 68, 0.18);
  border-left-color: #ef4444;
}
.code-line.highlighted .code-text {
  color: #fca5a5;
  font-weight: 600;
}
.code-line.dimmed .code-text { color: rgba(148,163,184,.45); }

.ln {
  width: 30px;
  text-align: right;
  margin-right: 16px;
  color: rgba(255,255,255,.2);
  font-size: 11px;
  user-select: none;
  flex-shrink: 0;
}
.code-line.highlighted .ln { color: #f87171; }
.code-text { color: #c9d1d9; }

.code-empty {
  color: rgba(255,255,255,.25);
  text-align: center;
  padding: 40px 20px;
  font-size: 13px;
}
</style>
