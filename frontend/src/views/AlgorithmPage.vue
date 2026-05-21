<template>
  <div class="page-shell">
    <div class="content-grid">
      <div class="main-column">
        <header class="page-header">
          <div class="hero-copy">
            <div class="hero-topline">
              <p class="page-kicker">{{ page.category }}</p>
              <span class="run-indicator" :class="{ playing: isPlaying }">
                {{ isPlaying ? '自动演示中' : '点击执行后自动播放' }}
              </span>
            </div>
            <h2 class="page-title">{{ page.title }}</h2>
            <p class="page-desc">{{ page.description }}</p>
          </div>

          <div class="hero-stats">
            <span class="stat-pill">当前操作：{{ statusText }}</span>
            <span class="stat-pill">{{ traceStatusText }}</span>
          </div>
        </header>

        <section class="workspace-card">
          <div class="card-header">
            <div>
              <h3>结构演示区</h3>
              <p class="subtle-text">点击执行后会自动播放，动画、日志和代码高亮会同步推进。</p>
            </div>

            <div class="canvas-status">
              <span class="status-chip accent">{{ statusText }}</span>
              <span class="status-chip">{{ isPlaying ? '播放中' : '待命' }}</span>
            </div>
          </div>

          <VisualizationCanvas :page="page" :state="displayState" />

          <div class="result-bar">
            <div>
              <span class="result-label">当前结果</span>
              <p class="result-message">{{ currentMessage }}</p>
            </div>
            <strong class="result-value">{{ resultText }}</strong>
          </div>

          <div v-if="traces.length" class="progress-strip">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
            </div>
            <span class="progress-text">{{ traceIndex + 1 }} / {{ traces.length }}</span>
          </div>

          <div class="controls-panel">
            <div v-if="isSharedStackPage" class="action-row-panel">
              <div v-for="row in sharedActionRows" :key="row.key" class="action-row">
                <span class="action-row-label">{{ row.label }}</span>
                <div class="action-grid">
                  <button
                    v-for="action in row.actions"
                    :key="action.key"
                    type="button"
                    class="action-button"
                    :class="{ active: activeActionKey === action.key }"
                    @click="selectAction(action.key)"
                  >
                    {{ action.label }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="action-grid">
              <button
                v-for="action in page.actions"
                :key="action.key"
                type="button"
                class="action-button"
                :class="{ active: activeActionKey === action.key }"
                @click="selectAction(action.key)"
              >
                {{ action.label }}
              </button>
            </div>

            <!-- 排序模式切换 -->
            <div v-if="isSortAction" class="mode-switcher">
              <span class="mode-label">执行模式</span>
              <div class="mode-pills">
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ active: sortMode === 'step' }"
                  @click="sortMode = 'step'"
                >每一步</button>
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ active: sortMode === 'round' }"
                  @click="sortMode = 'round'"
                >每轮</button>
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ active: sortMode === 'all' }"
                  @click="sortMode = 'all'"
                >直接完成</button>
              </div>
            </div>

            <div v-if="isBstDepthTraverse" class="mode-switcher">
              <span class="mode-label">遍历模式</span>
              <div class="mode-pills">
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ active: treeTraverseMode === 'pre' }"
                  @click="treeTraverseMode = 'pre'"
                >前序</button>
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ active: treeTraverseMode === 'in' }"
                  @click="treeTraverseMode = 'in'"
                >中序</button>
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ active: treeTraverseMode === 'post' }"
                  @click="treeTraverseMode = 'post'"
                >后序</button>
              </div>
            </div>

            <div class="input-shell">
              <div class="input-hint">
                <span class="hint-icon">ℹ</span>
                <span>输入提示：{{ currentAction?.placeholder || '无需输入，直接执行即可' }}</span>
              </div>
              <label class="input-label">{{ currentAction?.label }}</label>
              <div class="input-row">
                <input
                  v-if="needsCapacityInput"
                  v-model.number="capacityValue"
                  type="number"
                  min="1"
                  max="30"
                  class="capacity-input"
                  :placeholder="capacityPlaceholder"
                  @keyup.enter="runCurrentAction"
                />
                <input
                  v-model="inputValue"
                  :placeholder="currentAction?.placeholder || '请输入参数'"
                  class="main-input"
                  @keyup.enter="runCurrentAction"
                />
                <button type="button" class="primary-button" @click="runCurrentAction">执行动画</button>

                <!-- 播放控制组 -->
                <div class="playback-group">
                  <button type="button" class="step-btn square" :disabled="!filteredTraces.length || isPlaying" @click="stepBackward" title="上一步">◀</button>
                  <button
                    type="button"
                    class="play-btn"
                    :disabled="!filteredTraces.length"
                    @click="togglePlayback"
                  >
                    {{ isPlaying ? '⏸ 暂停' : '▶ 自动播放' }}
                  </button>
                  <button type="button" class="step-btn square" :disabled="!filteredTraces.length || isPlaying" @click="stepForward" title="下一步">▶</button>
                </div>

                <button type="button" class="secondary-button" @click="resetPage">重置</button>
                <button type="button" class="undo-button" :disabled="!historyStack.length" @click="undoLast" title="撤销上一次操作">撤销</button>
              </div>
            </div>
          </div>

          <div class="trace-panel">
            <div class="card-header compact">
              <h3>执行日志</h3>
              <span>{{ traceStatusText }}</span>
            </div>

            <div class="trace-list">
              <button
                v-for="(trace, index) in traces"
                :key="`${trace.message}-${index}`"
                type="button"
                class="trace-item"
                :class="{ active: index === traceIndex }"
                @click="jumpToTrace(index)"
              >
                <span class="trace-step">{{ index + 1 }}</span>
                <span class="trace-message">{{ trace.message }}</span>
              </button>

              <div v-if="!traces.length" class="trace-empty">点击上方按钮开始执行算法。</div>
            </div>
          </div>
        </section>
      </div>

      <aside ref="codeCardRef" class="code-card">
        <div v-if="hasStruct" class="struct-card">
          <div class="struct-title">结构体定义</div>
          <div class="struct-body">
            <div
              v-for="(line, index) in currentStruct"
              :key="`struct-${index}`"
              class="code-line struct-line"
            >
              <span class="line-no">{{ index + 1 }}</span>
              <code>{{ line }}</code>
            </div>
          </div>
        </div>

        <div class="code-top">
          <div class="code-top-main">
            <div>
              <p class="page-kicker code-kicker">{{ page.category }}</p>
              <h3>代码视图</h3>
              <p class="code-tip">当前执行步骤会自动滚动并高亮对应代码行。</p>
            </div>

            <div class="code-meta">
              <span class="code-badge">{{ currentLanguageLabel }}</span>
              <span class="code-badge ghost">{{ currentAction?.label }}</span>
              <span class="code-badge ghost">{{ traceStatusText }}</span>
            </div>
          </div>

          <div class="language-switcher code-switcher">
            <button
              v-for="lang in languages"
              :key="lang.key"
              type="button"
              class="language-pill"
              :class="{ active: activeLanguage === lang.key }"
              @click="activeLanguage = lang.key"
            >
              {{ lang.label }}
            </button>
          </div>
        </div>

        <div ref="codeBodyRef" class="code-body">
          <div
            v-for="(line, index) in currentCode"
            :key="`${activeLanguage}-${index}`"
            class="code-line"
            :class="{ active: isLineActive(index), dimmed: isLineDimmed(index) }"
          >
            <span class="line-no">{{ index + 1 }}</span>
            <code>{{ line }}</code>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import VisualizationCanvas from '../components/VisualizationCanvas.vue'
import { pageMap } from '../data/algorithmCatalog'
import { useAiContextStore } from '../stores/aiContext'
import { buildCodeMap } from '../utils/codeSnippets'
import { createInitialState, runOperation } from '../utils/algorithmSimulator'

const route = useRoute()
const aiContextStore = useAiContextStore()
const clone = (value) => JSON.parse(JSON.stringify(value))
const PLAYBACK_DELAY = 1800

const languages = [
  { key: 'c', label: 'C' },
  { key: 'cpp', label: 'C++' },
  { key: 'python', label: 'Python' },
  { key: 'java', label: 'Java' },
]

const activeLanguage = ref('c')
const activeActionKey = ref('')
const inputValue = ref('')
const capacityValue = ref(10)
const traces = ref([])
const traceIndex = ref(-1)
const committedState = ref(null)
const displayState = ref({ meta: {} })
const isPlaying = ref(false)
const codeBodyRef = ref(null)
const codeCardRef = ref(null)
const sortMode = ref('step') // 'step' | 'round' | 'all'
const treeTraverseMode = ref('pre')
const historyStack = ref([]) // 操作历史栈（用于撤销）

let playbackTimer = null

const page = computed(() => pageMap[route.name] || Object.values(pageMap)[0])
const currentAction = computed(() => page.value.actions.find((action) => action.key === activeActionKey.value) || page.value.actions[0])
const codeMap = computed(() => buildCodeMap(page.value))
const currentCode = computed(() => codeMap.value[currentAction.value.key]?.[activeLanguage.value] || codeMap.value[currentAction.value.key]?.cpp || codeMap.value[currentAction.value.key]?.c || [])
const currentLanguageLabel = computed(() => languages.find((lang) => lang.key === activeLanguage.value)?.label || '')
const currentTrace = computed(() => (traceIndex.value >= 0 ? traces.value[traceIndex.value] : null))
const needsCapacityInput = computed(() =>
  [
    'linear-list-basic',
    'linear-list-sort-selection',
    'linear-list-sort-insertion',
    'linear-list-sort-quick',
    'linear-list-sort-heap',
    'linear-list-sort-shell',
    'linear-list-search-sequential',
    'linear-list-search-reverse',
    'linear-list-search-binary',
    'seq-stack',
    'circular-queue',
    'priority-queue',
    'shared-stack',
  ].includes(page.value.key) &&
  ['create', 'init', 'random', 'list-random'].includes(currentAction.value?.key),
)
const capacityPlaceholder = computed(() => {
  if (['seq-stack', 'shared-stack'].includes(page.value.key)) return '栈容量'
  if (['circular-queue', 'priority-queue'].includes(page.value.key)) return '队列容量'
  return '表长'
})
const sanitizedCapacity = computed(() => {
  const value = Number(capacityValue.value)
  const fallback = Number(page.value.defaultCapacity || 10)
  return Math.max(1, Math.min(Number.isFinite(value) ? Math.floor(value) : fallback, 30))
})

function isMeaningfulCodeLine(content) {
  const text = String(content || '').trim()
  if (!text) return false
  if (text === '{' || text === '}' || text === '};') return false
  return true
}

// 直接使用 tracer 的 line 值，支持单行数字或 [start, end] 范围
const currentLineRange = computed(() => {
  const trace = currentTrace.value
  if (!trace) return []
  const line = trace.line

  if (!line) return []
  let start
  let end
  if (Array.isArray(line)) {
    start = line[0]
    end = line[1]
  } else {
    start = line
    end = line
  }

  const code = currentCode.value || []
  if (!code.length) return [start, end]

  const meaningful = []
  for (let i = start; i <= end; i += 1) {
    const content = code[i - 1]
    if (isMeaningfulCodeLine(content)) meaningful.push(i)
  }
  if (meaningful.length) return [meaningful[0], meaningful[meaningful.length - 1]]

  for (let offset = 1; offset <= code.length; offset += 1) {
    const left = start - offset
    const right = end + offset
    if (left >= 1 && isMeaningfulCodeLine(code[left - 1])) return [left, left]
    if (right <= code.length && isMeaningfulCodeLine(code[right - 1])) return [right, right]
  }

  return [start, end]
})

// 检查某行是否在当前高亮范围内
function isLineActive(lineIndex) {
  const range = currentLineRange.value
  if (!range || range.length < 2) return false
  const [start, end] = range
  return lineIndex + 1 >= start && lineIndex + 1 <= end
}

// 检查某行是否应该被 dimmed
function isLineDimmed(lineIndex) {
  const range = currentLineRange.value
  if (!range || !range.length) return false
  return !isLineActive(lineIndex)
}
const currentMessage = computed(() => currentTrace.value?.message || '等待执行')
const isSortAction = computed(() => currentAction.value?.mode === 'sort')
const isBstDepthTraverse = computed(() => page.value.key === 'bst' && currentAction.value?.key === 'depth-traverse')
const isSharedStackPage = computed(() => page.value.key === 'shared-stack')
const sharedActionRows = computed(() => {
  const rows = [
    { key: 'public', label: '双栈操作', actions: [] },
    { key: 'left', label: '左栈操作', actions: [] },
    { key: 'right', label: '右栈操作', actions: [] },
  ]
  const rowMap = Object.fromEntries(rows.map((row) => [row.key, row]))
  page.value.actions.forEach((action) => {
    const row = rowMap[action.row || 'public'] || rows[0]
    row.actions.push(action)
  })
  return rows.filter((row) => row.actions.length)
})

// 结构体定义（按语言和页面分组）
const structDefinitionsMap = {
  'linear-list': {
    python: [
      '# 顺序表的结构体定义（Python 使用列表模拟）',
      'class SeqList:',
      '    def __init__(self, maxsize=100):',
      '        self.data = [None] * maxsize   # 存储元素的数组',
      '        self.length = 0                  # 当前长度',
      '        self.maxsize = maxsize          # 最大容量',
    ],
    c: [
      '// 顺序表的结构体定义',
      '#define MAXSIZE 100',
      'typedef struct {',
      '    ElemType data[MAXSIZE];  // 存储元素的数组',
      '    int length;              // 当前长度',
      '} SqList;',
    ],
    csharp: [
      '// 顺序表的结构体定义（C# 使用类实现）',
      'public class SeqList {',
      '    private const int MAXSIZE = 100;',
      '    private int[] data;      // 存储元素的数组',
      '    private int length;      // 当前长度',
      '    public SeqList() {',
      '        this.data = new int[MAXSIZE];',
      '        this.length = 0;',
      '    }',
      '}',
    ],
    java: [
      '// 顺序表的结构体定义（Java 使用类实现）',
      'public class SeqList {',
      '    private static final int MAXSIZE = 100;',
      '    private int[] data;      // 存储元素的数组',
      '    private int length;      // 当前长度',
      '    public SeqList() {',
      '        this.data = new int[MAXSIZE];',
      '        this.length = 0;',
      '    }',
      '}',
    ],
  },
  'linked-list': {
    python: [
      '# 单链表结点结构体定义',
      'class ListNode:',
      '    def __init__(self, val=0, next=None):',
      '        self.val = val       # 数据域',
      '        self.next = next     # 指针域',
    ],
    c: [
      '// 单链表结点结构体定义',
      'typedef struct LNode {',
      '    ElemType data;       // 数据域',
      '    struct LNode *next;  // 指针域',
      '} LNode, *LinkList;',
    ],
    csharp: [
      '// 单链表结点结构体定义（C# 使用类实现）',
      'public class ListNode {',
      '    public int Val;          // 数据域',
      '    public ListNode Next;    // 指针域',
      '    public ListNode(int val) {',
      '        this.Val = val;',
      '        this.Next = null;',
      '    }',
      '}',
    ],
    java: [
      '// 单链表结点结构体定义',
      'public class ListNode {',
      '    int val;             // 数据域',
      '    ListNode next;      // 指针域',
      '    public ListNode(int val) {',
      '        this.val = val;',
      '        this.next = null;',
      '    }',
      '}',
    ],
  },
  'stack-queue': {
    python: [
      '# 顺序栈的结构体定义',
      'class SeqStack:',
      '    def __init__(self, maxsize=100):',
      '        self.data = [None] * maxsize',
      '        self.top = -1       # 栈顶指针（-1表示空栈）',
    ],
    c: [
      '// 顺序栈的结构体定义',
      '#define MAXSIZE 100',
      'typedef struct {',
      '    ElemType data[MAXSIZE];  // 存储元素的数组',
      '    int top;                 // 栈顶指针',
      '} SqStack;',
    ],
    csharp: [
      '// 顺序栈的结构体定义（C# 使用类实现）',
      'public class SeqStack {',
      '    private const int MAXSIZE = 100;',
      '    private int[] data;      // 存储元素的数组',
      '    private int top;         // 栈顶指针',
      '    public SeqStack() {',
      '        this.data = new int[MAXSIZE];',
      '        this.top = -1;',
      '    }',
      '}',
    ],
    java: [
      '// 顺序栈的结构体定义',
      'public class SeqStack {',
      '    private static final int MAXSIZE = 100;',
      '    private int[] data;      // 存储元素的数组',
      '    private int top;         // 栈顶指针',
      '    public SeqStack() {',
      '        this.data = new int[MAXSIZE];',
      '        this.top = -1;',
      '    }',
      '}',
    ],
  },
  'tree': {
    python: [
      '# 二叉树结点结构体定义',
      'class TreeNode:',
      '    def __init__(self, val=0):',
      '        self.val = val       # 数据域',
      '        self.left = None     # 左子树',
      '        self.right = None    # 右子树',
    ],
    c: [
      '// 二叉树结点结构体定义',
      'typedef struct BiTNode {',
      '    ElemType data;            // 数据域',
      '    struct BiTNode *lchild;   // 左子树指针',
      '    struct BiTNode *rchild;   // 右子树指针',
      '} BiTNode, *BiTree;',
    ],
    csharp: [
      '// 二叉树结点结构体定义（C# 使用类实现）',
      'public class TreeNode {',
      '    public int Val;          // 数据域',
      '    public TreeNode Left;    // 左子树',
      '    public TreeNode Right;   // 右子树',
      '    public TreeNode(int val) {',
      '        this.Val = val;',
      '        this.Left = null;',
      '        this.Right = null;',
      '    }',
      '}',
    ],
    java: [
      '// 二叉树结点结构体定义',
      'public class TreeNode {',
      '    int val;              // 数据域',
      '    TreeNode left;       // 左子树',
      '    TreeNode right;      // 右子树',
      '    public TreeNode(int val) {',
      '        this.val = val;',
      '        this.left = null;',
      '        this.right = null;',
      '    }',
      '}',
    ],
  },
  'graph': {
    python: [
      '# 图的邻接矩阵结构体定义',
      'class MGraph:',
      '    def __init__(self, maxv=100):',
      '        self.vexs = []               # 顶点表',
      '        self.edges = [[0]*maxv for _ in range(maxv)]  # 邻接矩阵',
      '        self.vexnum = 0              # 顶点数',
      '        self.edgenum = 0             # 边数',
    ],
    c: [
      '// 图的邻接矩阵结构体定义',
      '#define MAXV 100',
      'typedef struct {',
      '    VertexType vexs[MAXV];       // 顶点表',
      '    EdgeType edges[MAXV][MAXV];  // 邻接矩阵',
      '    int vexnum, edgenum;         // 顶点数和边数',
      '} MGraph;',
    ],
    csharp: [
      '// 图的邻接矩阵结构体定义（C# 使用类实现）',
      'public class MGraph {',
      '    private const int MAXV = 100;',
      '    public string[] Vexs;      // 顶点表',
      '    public int[][] Edges;      // 邻接矩阵',
      '    public int Vexnum, Edgenum; // 顶点数和边数',
      '    public MGraph() {',
      '        this.Vexs = new string[MAXV];',
      '        this.Edges = new int[MAXV][];',
      '    }',
      '}',
    ],
    java: [
      '// 图的邻接矩阵结构体定义',
      'public class MGraph {',
      '    private static final int MAXV = 100;',
      '    String[] vexs;              // 顶点表',
      '    int[][] edges;              // 邻接矩阵',
      '    int vexnum, edgenum;        // 顶点数和边数',
      '    public MGraph() {',
      '        this.vexs = new String[MAXV];',
      '        this.edges = new int[MAXV][MAXV];',
      '    }',
      '}',
    ],
  },
}

const pageStructDefinitionsMap = {
  'linear-list-basic': {
    c: [
      '// 顺序表完整定义',
      '#define MAXSIZE 100',
      'typedef int ElemType;',
      'typedef struct {',
      '    ElemType data[MAXSIZE];  // 顺序存储空间',
      '    int length;              // 当前元素个数',
      '} SqList;',
      'SqList L;',
    ],
    cpp: [
      '// 顺序表完整定义',
      'const int MAXSIZE = 100;',
      'struct SqList {',
      '    int data[MAXSIZE];',
      '    int length;',
      '};',
      'SqList L;',
    ],
  },
  'circular-queue': {
    python: [
      '# 循环队列完整定义',
      'class CircularQueue:',
      '    def __init__(self, maxsize=100):',
      '        self.data = [None] * maxsize',
      '        self.front = 0',
      '        self.rear = 0',
      '        self.maxsize = maxsize',
    ],
    c: [
      '// 循环队列完整定义',
      '#define MAXSIZE 100',
      'typedef int ElemType;',
      'typedef struct {',
      '    ElemType data[MAXSIZE];',
      '    int front;               // 队头指针',
      '    int rear;                // 队尾指针',
      '} SqQueue;',
      '/* 队空：front == rear */',
      '/* 队满：(rear + 1) % MAXSIZE == front */',
    ],
    cpp: [
      '// 循环队列完整定义',
      'const int MAXSIZE = 100;',
      'struct SqQueue {',
      '    int data[MAXSIZE];',
      '    int front;',
      '    int rear;',
      '};',
      '/* 队空：front == rear */',
      '/* 队满：(rear + 1) % MAXSIZE == front */',
    ],
  },
  'seq-stack': {
    python: [
      '# 顺序栈完整定义',
      'class SeqStack:',
      '    def __init__(self, maxsize=100):',
      '        self.data = [None] * maxsize',
      '        self.top = -1',
      '        self.maxsize = maxsize',
    ],
    c: [
      '// 顺序栈完整定义',
      '#define MAXSIZE 100',
      'typedef int ElemType;',
      'typedef struct {',
      '    ElemType data[MAXSIZE];',
      '    int top;                 // 栈顶指针，空栈为 -1',
      '} SqStack;',
      'SqStack S;',
    ],
    cpp: [
      '// 顺序栈完整定义',
      'const int MAXSIZE = 100;',
      'struct SqStack {',
      '    int data[MAXSIZE];',
      '    int top;',
      '};',
      'SqStack S;',
    ],
  },
  'priority-queue': {
    python: [
      '# 优先队列（大顶堆实现）',
      'class PriorityQueue:',
      '    def __init__(self, maxsize=100):',
      '        self.data = [None] * maxsize',
      '        self.priority = [0] * maxsize',
      '        self.size = 0',
      '        self.maxsize = maxsize',
      '    def parent(self, i):',
      '        return (i - 1) // 2',
    ],
    c: [
      '// 优先队列（大顶堆实现）',
      '#define MAXSIZE 100',
      'typedef struct {',
      '    char value[MAXSIZE][16];',
      '    int priority[MAXSIZE];',
      '    int size;                // 当前元素个数',
      '} PriorityQueue;',
      '/* 堆顶下标固定为 0，始终保存最高优先级元素 */',
    ],
    cpp: [
      '// 优先队列（大顶堆实现）',
      'const int MAXSIZE = 100;',
      'struct PriorityQueue {',
      '    std::string value[MAXSIZE];',
      '    int priority[MAXSIZE];',
      '    int size;',
      '};',
      '/* 堆顶下标固定为 0 */',
    ],
  },
  'shared-stack': {
    python: [
      '# 共栈完整定义',
      'class SharedStack:',
      '    def __init__(self, maxsize=100):',
      '        self.data = [None] * maxsize',
      '        self.top1 = -1',
      '        self.top2 = maxsize',
      '        self.maxsize = maxsize',
    ],
    c: [
      '// 共栈完整定义',
      '#define MAXSIZE 100',
      'typedef int ElemType;',
      'typedef struct {',
      '    ElemType data[MAXSIZE];',
      '    int top1;                // 左栈栈顶',
      '    int top2;                // 右栈栈顶',
      '} DblStack;',
      '/* 栈空：top1 == -1 或 top2 == MAXSIZE */',
      '/* 栈满：top1 + 1 == top2 */',
    ],
    cpp: [
      '// 共栈完整定义',
      'const int MAXSIZE = 100;',
      'struct DblStack {',
      '    int data[MAXSIZE];',
      '    int top1;',
      '    int top2;',
      '};',
      '/* 栈满：top1 + 1 == top2 */',
    ],
  },
  bst: {
    c: [
      '// 二叉排序树结点定义',
      'typedef int KeyType;',
      'typedef struct BSTNode {',
      '    KeyType data;',
      '    struct BSTNode *lchild;',
      '    struct BSTNode *rchild;',
      '} BSTNode, *BSTree;',
      'BSTree root;',
    ],
    cpp: [
      '// 二叉排序树结点定义',
      'struct BSTNode {',
      '    int data;',
      '    BSTNode* left;',
      '    BSTNode* right;',
      '};',
      'BSTNode* root = nullptr;',
    ],
  },
  avl: {
    c: [
      '// AVL 结点定义',
      'typedef struct AVLNode {',
      '    int data;',
      '    int height;              // 结点高度',
      '    struct AVLNode *lchild;',
      '    struct AVLNode *rchild;',
      '} AVLNode, *AVLTree;',
      'AVLTree root;',
    ],
    cpp: [
      '// AVL 结点定义',
      'struct AVLNode {',
      '    int data;',
      '    int height;',
      '    AVLNode* left;',
      '    AVLNode* right;',
      '};',
      'AVLNode* root = nullptr;',
    ],
  },
  huffman: {
    c: [
      '// 哈夫曼树结点定义',
      'typedef struct HuffmanNode {',
      '    char ch;                 // 字符',
      '    int weight;              // 权值',
      '    struct HuffmanNode *lchild;',
      '    struct HuffmanNode *rchild;',
      '} HuffmanNode;',
      'HuffmanNode forest[MAXSIZE];',
    ],
    cpp: [
      '// 哈夫曼树结点定义',
      'struct HuffmanNode {',
      '    char ch;',
      '    int weight;',
      '    HuffmanNode* left;',
      '    HuffmanNode* right;',
      '};',
      'HuffmanNode forest[MAXSIZE];',
    ],
  },
  'graph-matrix': {
    c: [
      '// 邻接矩阵图定义',
      '#define MAXV 20',
      'typedef char VertexType;',
      'typedef int EdgeType;',
      'typedef struct {',
      '    VertexType vexs[MAXV];',
      '    EdgeType edges[MAXV][MAXV];',
      '    int vexnum, edgenum;',
      '} MGraph;',
    ],
    cpp: [
      '// 邻接矩阵图定义',
      'const int MAXV = 20;',
      'struct MGraph {',
      '    char vexs[MAXV];',
      '    int edges[MAXV][MAXV];',
      '    int vexnum, edgenum;',
      '};',
    ],
  },
  'graph-list': {
    c: [
      '// 邻接表图定义',
      '#define MAXV 20',
      'typedef struct ArcNode {',
      '    int adjvex;',
      '    int weight;',
      '    struct ArcNode *next;',
      '} ArcNode;',
      'typedef struct {',
      '    char data;',
      '    ArcNode *first;',
      '} VNode;',
      'typedef struct {',
      '    VNode vertices[MAXV];   // 顶点数组，每个元素对应一个顶点',
      '    int vexnum, arcnum;',
      '} ALGraph;',
    ],
    cpp: [
      '// 邻接表图定义',
      'const int MAXV = 20;',
      'struct ArcNode {',
      '    int adjvex;',
      '    int weight;',
      '    ArcNode* next;',
      '};',
      'struct VNode {',
      '    char data;',
      '    ArcNode* first;',
      '};',
      'struct ALGraph {',
      '    VNode vertices[MAXV];',
      '    int vexnum, arcnum;',
      '};',
    ],
  },
  'graph-traversal': {
    c: [
      '// 图遍历辅助定义',
      '#define MAXV 20',
      'char vexs[MAXV];',
      'int edges[MAXV][MAXV];',
      'int visited[MAXV];',
      'int queue[MAXV];',
      'int front, rear;',
      '/* DFS 用递归或辅助栈 */',
      '/* BFS 用循环队列推进 */',
    ],
    cpp: [
      '// 图遍历辅助定义',
      'const int MAXV = 20;',
      'char vexs[MAXV];',
      'int edges[MAXV][MAXV];',
      'int visited[MAXV];',
      'int queue[MAXV];',
      'int front = 0, rear = 0;',
      '/* DFS / BFS 共用访问标记 */',
    ],
  },
  'graph-mst': {
    c: [
      '// 带权图最短路径/最小生成树辅助定义',
      '#define MAXV 20',
      'char vexs[MAXV];',
      'int matrix[MAXV][MAXV];',
      'typedef struct {',
      '    int begin;',
      '    int end;',
      '    int weight;',
      '} Edge;',
      'Edge edges[MAXV * MAXV];',
      'int parent[MAXV];',
    ],
    cpp: [
      '// 带权图最短路径/最小生成树辅助定义',
      'const int MAXV = 20;',
      'char vexs[MAXV];',
      'int matrix[MAXV][MAXV];',
      'struct Edge {',
      '    int begin;',
      '    int end;',
      '    int weight;',
      '};',
      'Edge edges[MAXV * MAXV];',
      'int parent[MAXV];',
    ],
  },
}

const hasStruct = computed(() =>
  ['linear-list', 'linked-list', 'stack-queue', 'tree', 'graph'].includes(page.value.groupKey)
)
const currentStruct = computed(() => {
  const pageStructs = pageStructDefinitionsMap[page.value.key]
  const groupStructs = structDefinitionsMap[page.value.groupKey]
  return (
    pageStructs?.[activeLanguage.value] ||
    groupStructs?.[activeLanguage.value] ||
    pageStructs?.cpp ||
    pageStructs?.c ||
    groupStructs?.cpp ||
    groupStructs?.c ||
    []
  )
})

const filteredTraces = computed(() => {
  if (!isSortAction.value || sortMode.value === 'all') return traces.value
  if (sortMode.value === 'step') {
    return traces.value.filter(t => !t.round)
  }
  // 'round' mode: show traces up to and including each round-end marker
  const result = []
  for (const t of traces.value) {
    result.push(t)
    if (t.round && String(t.round).startsWith('round-end')) break
  }
  return result
})
const resultText = computed(() => displayState.value?.meta?.result || '等待执行')
const statusText = computed(() => currentAction.value?.label || '未选择操作')
const progressPercent = computed(() => (filteredTraces.value.length ? ((traceIndex.value + 1) / filteredTraces.value.length) * 100 : 0))
const traceStatusText = computed(() => (filteredTraces.value.length ? `步骤 ${traceIndex.value + 1} / ${filteredTraces.value.length}` : '尚未执行'))

function syncAiContext() {
  aiContextStore.setContext({
    routeName: String(route.name || ''),
    title: page.value.title,
    category: page.value.category,
    description: page.value.description,
    currentActionLabel: currentAction.value?.label || '',
    inputValue: inputValue.value,
    statusText: statusText.value,
    resultText: resultText.value,
    recentTraces: traces.value.slice(-5).map((trace) => trace.message || ''),
  })
}

function scrollToActiveCodeLine() {
  const container = codeBodyRef.value
  const element = container?.querySelector('.code-line.active')
  if (!container || !element) return
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const visibleTop = container.scrollTop + (elementRect.top - containerRect.top)
  const targetTop = Math.max(0, visibleTop - container.clientHeight / 2 + element.clientHeight / 2)
  container.scrollTo({
    top: targetTop,
    behavior: 'smooth',
  })

  const card = codeCardRef.value
  if (!card) return
  const cardRect = card.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const isCardOutOfView = cardRect.top < 12 || cardRect.bottom > viewportHeight - 12
  if (isCardOutOfView) {
    card.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }
}

function stopPlayback() {
  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
  isPlaying.value = false
}

function applyState(value) {
  displayState.value = clone(value)
}

function clearTraceView(message = '等待执行') {
  traces.value = []
  traceIndex.value = -1
  const baseState = clone(committedState.value ?? createInitialState(page.value.key))
  baseState.meta = {
    ...(baseState.meta || {}),
    result: message,
  }
  applyState(baseState)
}

function setTrace(index) {
  if (index < 0 || index >= filteredTraces.value.length) return
  traceIndex.value = index
  const t = filteredTraces.value[index]
  console.log('[setTrace] index:', index, 'line:', t?.line, 'msg:', t?.message)
  applyState(t?.state)
}

function startPlayback(startIndex = 0) {
  stopPlayback()
  if (!filteredTraces.value.length) return

  let current = Math.max(0, Math.min(startIndex, filteredTraces.value.length - 1))
  isPlaying.value = true
  setTrace(current)

  const tick = () => {
    if (!isPlaying.value) return
    current += 1
    if (current >= filteredTraces.value.length) {
      stopPlayback()
      onPlaybackComplete()
      return
    }
    setTrace(current)
    playbackTimer = setTimeout(tick, PLAYBACK_DELAY)
  }

  if (current < filteredTraces.value.length - 1) {
    playbackTimer = setTimeout(tick, PLAYBACK_DELAY)
  } else {
    isPlaying.value = false
    onPlaybackComplete()
  }
}

function onPlaybackComplete() {
  const actionKey = currentAction.value?.key
  const searchActions = ['search-by-pos', 'search-by-val', 'list-search-by-pos', 'list-search-by-val', 'get', 'peek', 'front']
  if (searchActions.includes(actionKey)) {
    const result = displayState.value?.meta?.result || ''
    if (result) {
      ElMessage({ message: result, type: 'success', duration: 3000, showClose: true })
    }
  }
}

function preparePageState() {
  stopPlayback()
  const initial = createInitialState(page.value.key)
  committedState.value = clone(initial)
  clearTraceView('等待执行')
  activeActionKey.value = page.value.actions[0].key
  inputValue.value = page.value.actions[0].defaultInput || ''
  capacityValue.value = page.value.defaultCapacity || initial.capacity || 10
}

watch(
  () => page.value.key,
  () => {
    preparePageState()
  },
  { immediate: true },
)

watch(currentAction, (action) => {
  inputValue.value = action?.defaultInput || ''
  if (needsCapacityInput.value && !Number(capacityValue.value)) {
    capacityValue.value = page.value.defaultCapacity || committedState.value?.capacity || 10
  }
})

watch([traceIndex, activeLanguage], async () => {
  await nextTick()
  scrollToActiveCodeLine()
})

watch(
  () => [
    route.name,
    page.value.title,
    currentAction.value?.label,
    inputValue.value,
    statusText.value,
    resultText.value,
    traceIndex.value,
    traces.value.length,
    traces.value.slice(-5).map((trace) => trace.message).join('|'),
  ],
  syncAiContext,
  { immediate: true, flush: 'post' },
)

function selectAction(actionKey) {
  stopPlayback()
  activeActionKey.value = actionKey
  const action = page.value.actions.find((item) => item.key === actionKey)
  clearTraceView(`已切换到${action?.label || '当前操作'}，等待执行`)
}

function runCurrentAction() {
  stopPlayback()

  const beforeState = clone(committedState.value ?? createInitialState(page.value.key))
  const actionKey = currentAction.value?.key
  const nonMutatingActions = ['search-by-pos', 'search-by-val', 'sequential-search', 'binary-search', 'peek', 'front', 'rear', 'is-empty', 'is-empty-1', 'is-empty-2', 'is-full', 'traverse', 'forward-traverse', 'reverse-traverse', 'level-traverse', 'preorder-traverse', 'inorder-traverse', 'postorder-traverse', 'count', 'depth']
  const shouldCommit =
    (!page.value.navGroupKey?.includes('linear-list-sort') || ['create', 'random', 'list-random'].includes(actionKey) || isSortAction.value) &&
    !nonMutatingActions.includes(actionKey)
  if (shouldCommit) historyStack.value.push(beforeState)
  const result = runOperation({
    page: page.value,
    action: currentAction.value,
    input: inputValue.value,
    state: committedState.value,
    capacity: needsCapacityInput.value ? sanitizedCapacity.value : undefined,
    mode: treeTraverseMode.value,
  })

  if (shouldCommit) committedState.value = clone(result.state)
  traces.value = result.traces?.length
    ? [...result.traces]
    : [
        {
          message: `开始执行：${currentAction.value.label}`,
          line: 1,
          state: beforeState,
        },
      ]

  if (!traces.value.length) {
    traceIndex.value = -1
    applyState(committedState.value)
    return
  }

  startPlayback(0)
}

function jumpToTrace(index) {
  stopPlayback()
  setTrace(index)
}

function togglePlayback() {
  if (!filteredTraces.value.length) return
  if (isPlaying.value) {
    stopPlayback()
    return
  }
  const startIndex = traceIndex.value >= filteredTraces.value.length - 1 ? 0 : Math.max(traceIndex.value, 0)
  startPlayback(startIndex)
}

function stepForward() {
  if (!filteredTraces.value.length || isPlaying.value) return
  const next = Math.min(traceIndex.value + 1, filteredTraces.value.length - 1)
  console.log('[stepForward] from', traceIndex.value, 'to', next, 'range:', currentLineRange.value)
  if (next !== traceIndex.value) setTrace(next)
}

function stepBackward() {
  if (!filteredTraces.value.length || isPlaying.value) return
  const prev = Math.max(traceIndex.value - 1, 0)
  console.log('[stepBackward] from', traceIndex.value, 'to', prev, 'range:', currentLineRange.value)
  if (prev !== traceIndex.value) setTrace(prev)
}

function resetPage() {
  historyStack.value = []
  preparePageState()
}

function undoLast() {
  if (!historyStack.value.length) return
  stopPlayback()
  const prevState = historyStack.value.pop()
  committedState.value = clone(prevState)
  clearTraceView('已撤销上一次操作')
}

onUnmounted(() => {
  stopPlayback()
})
</script>

<style scoped>
.page-shell {
  padding: 14px;
}

.main-column {
  display: grid;
  gap: 12px;
}

.page-header {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background:
    radial-gradient(circle at top right, rgba(56, 167, 255, 0.22), transparent 32%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(247, 251, 255, 0.86) 100%);
  border: 1px solid rgba(16, 33, 62, 0.08);
  box-shadow: 0 18px 44px rgba(17, 39, 70, 0.08);
}

.hero-copy {
  display: grid;
  gap: 4px;
}

.hero-topline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.page-kicker {
  margin: 0;
  color: #2f77eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.run-indicator {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(16, 33, 62, 0.06);
  color: #60728d;
  font-size: 11px;
  font-weight: 600;
}

.run-indicator.playing {
  background: rgba(19, 166, 122, 0.16);
  color: #0d6a54;
}

.page-title {
  margin: 0;
  font-size: 22px;
  line-height: 1.15;
  color: #152c52;
}

.page-desc {
  margin: 0;
  max-width: 720px;
  color: #60728d;
  font-size: 13px;
}

.language-switcher {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(16, 33, 62, 0.07);
}

.language-pill,
.action-button,
.primary-button,
.secondary-button,
.ghost-button,
.trace-item {
  border: 0;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.language-pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: transparent;
  color: #2f77eb;
  font-weight: 700;
  font-size: 12px;
}

.language-pill:hover,
.action-button:hover,
.primary-button:hover,
.secondary-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
}

.language-pill.active {
  background: linear-gradient(135deg, #2f77eb 0%, #38a7ff 100%);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(47, 119, 235, 0.24);
}

.hero-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.stat-pill {
  padding: 4px 10px;
  border-radius: 10px;
  background: rgba(16, 33, 62, 0.06);
  color: #60728d;
  font-size: 12px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.85fr);
  gap: 12px;
  align-items: start;
}

.workspace-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(249, 252, 255, 0.96) 100%);
  border: 1px solid rgba(16, 33, 62, 0.08);
  box-shadow: 0 18px 40px rgba(17, 39, 70, 0.08);
  min-height: max-content;
}

.code-card {
  position: sticky;
  top: 14px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 28px);
  max-height: calc(100vh - 28px);
  min-width: 0;
  border-radius: 14px;
  overflow: hidden;
  overscroll-behavior: contain;
  background:
    radial-gradient(circle at top right, rgba(56, 167, 255, 0.2), transparent 24%),
    linear-gradient(180deg, #0a1427 0%, #122243 100%);
  border: 1px solid rgba(56, 167, 255, 0.12);
  box-shadow: 0 24px 48px rgba(11, 22, 44, 0.24);
}

.card-header,
.code-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.code-top {
  display: grid;
  gap: 10px;
  padding: 12px 12px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    radial-gradient(circle at top right, rgba(86, 192, 255, 0.16), transparent 30%);
}

.card-header h3,
.code-top h3 {
  margin: 0;
  font-size: 15px;
}

.subtle-text,
.card-header.compact span,
.result-label,
.status-chip,
.code-tip,
.progress-text {
  color: #60728d;
  font-size: 12px;
}

.canvas-status,
.code-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.code-top-main {
  display: grid;
  gap: 6px;
}

.code-kicker {
  margin-bottom: 4px;
  color: rgba(142, 192, 255, 0.92);
}

.status-chip,
.code-badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(16, 33, 62, 0.06);
  font-size: 11px;
}

.status-chip.accent {
  background: rgba(47, 119, 235, 0.12);
  color: #2f77eb;
  font-weight: 700;
}

.result-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.08), rgba(75, 225, 195, 0.12));
}

.result-message {
  margin: 4px 0 0;
  color: #60728d;
  font-size: 12px;
}

.result-value {
  color: #1a3560;
  font-size: 15px;
}

.progress-strip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: rgba(16, 33, 62, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f77eb 0%, #4be1c3 100%);
  transition: width 0.35s ease;
}

.controls-panel {
  display: grid;
  gap: 10px;
}

.mode-switcher {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(47, 119, 235, 0.06);
  border: 1px solid rgba(47, 119, 235, 0.12);
}

.mode-label {
  color: #48637f;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.mode-pills {
  display: flex;
  gap: 4px;
}

.mode-pill {
  padding: 4px 12px;
  border-radius: 8px;
  border: 1.5px solid rgba(47, 119, 235, 0.2);
  background: transparent;
  color: #2f77eb;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.mode-pill:hover {
  background: rgba(47, 119, 235, 0.08);
}

.mode-pill.active {
  background: linear-gradient(135deg, #2f77eb 0%, #38a7ff 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(47, 119, 235, 0.24);
}

.action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-row-panel {
  display: grid;
  gap: 8px;
}

.action-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  align-items: center;
  gap: 8px;
}

.action-row-label {
  color: #60728d;
  font-size: 12px;
  font-weight: 800;
}

.action-button {
  padding: 6px 12px;
  border-radius: 10px;
  background: #f3f7fc;
  color: #16345d;
  font-weight: 700;
  font-size: 12px;
}

.action-button.active {
  background: linear-gradient(135deg, #2f77eb 0%, #59b0ff 100%);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(47, 119, 235, 0.2);
}

.input-shell {
  display: grid;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(16, 33, 62, 0.04);
}

.input-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(47, 119, 235, 0.08);
  border: 1px solid rgba(47, 119, 235, 0.15);
  color: #174ea8;
  font-size: 12px;
}

.hint-icon {
  font-size: 14px;
}

.input-label {
  color: #48637f;
  font-size: 12px;
  font-weight: 700;
}

.input-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.main-input {
  flex: 1 1 260px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(16, 33, 62, 0.12);
  background: #ffffff;
  color: #17355e;
  font-size: 13px;
}

.main-input:focus {
  outline: none;
  border-color: rgba(47, 119, 235, 0.35);
  box-shadow: 0 0 0 4px rgba(47, 119, 235, 0.08);
}

.primary-button,
.secondary-button,
.ghost-button {
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
}

.primary-button {
  background: linear-gradient(135deg, #2f77eb 0%, #38a7ff 100%);
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(47, 119, 235, 0.24);
}

.secondary-button {
  background: rgba(16, 33, 62, 0.08);
  color: #16345d;
}

.ghost-button {
  background: rgba(19, 166, 122, 0.12);
  color: #0d6a54;
}

.ghost-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.undo-button {
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  background: rgba(245, 158, 11, 0.12);
  color: #92400e;
  border: 1.5px solid rgba(245, 158, 11, 0.25);
  cursor: pointer;
  transition: all 0.18s ease;
}

.undo-button:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
}

.undo-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 播放控制组 */
.playback-group {
  display: flex;
  gap: 6px;
  align-items: center;
}

.play-btn {
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  background: linear-gradient(135deg, #2f77eb 0%, #38a7ff 100%);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
}

.play-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.play-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.step-btn {
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 12px;
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
  border: 1.5px solid rgba(59, 130, 246, 0.25);
  cursor: pointer;
  transition: all 0.18s ease;
  min-width: 36px;
}

.step-btn.square {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.struct-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 10px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(14, 31, 56, 0.98), rgba(17, 42, 78, 0.96));
  border: 1px solid rgba(137, 196, 255, 0.18);
  box-shadow: 0 18px 40px rgba(8, 18, 34, 0.18);
}

.capacity-input {
  flex: 0 0 112px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(201, 122, 21, 0.22);
  background: #fffaf0;
  color: #7c4a03;
  font-size: 13px;
  font-weight: 800;
}

.capacity-input:focus {
  outline: none;
  border-color: rgba(201, 122, 21, 0.45);
  box-shadow: 0 0 0 4px rgba(201, 122, 21, 0.1);
}

.struct-title {
  padding: 10px 14px;
  color: #f8c56a;
  font-size: 13px;
  font-weight: 800;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.struct-body {
  flex: 1;
  max-height: none;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 6px 0;
}

.struct-line {
  color: rgba(255, 214, 138, 0.92) !important;
  font-size: 12px !important;
}

.trace-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(16, 33, 62, 0.04);
}

.trace-list {
  display: grid;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}

.trace-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  text-align: left;
}

.trace-item.active {
  background: rgba(47, 119, 235, 0.12);
}

.trace-step {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #ffffff;
  color: #2f77eb;
  font-weight: 700;
  font-size: 11px;
}

.trace-message {
  color: #16345d;
  line-height: 1.35;
  font-size: 12px;
}

.trace-empty {
  padding: 14px;
  text-align: center;
  color: #69809d;
  font-size: 12px;
}

.code-top h3 {
  color: #f3f7ff;
}

.code-tip {
  margin: 4px 0 0;
  color: rgba(226, 235, 255, 0.62);
  line-height: 1.4;
}

.code-meta {
  align-items: flex-start;
  justify-content: flex-start;
}

.code-badge {
  color: #d7e7ff;
  background: rgba(255, 255, 255, 0.08);
}

.code-badge.ghost {
  color: rgba(215, 231, 255, 0.74);
  background: rgba(255, 255, 255, 0.04);
}

.code-switcher {
  padding: 4px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
}

.code-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 8px 0 12px;
}

.code-line {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  padding: 5px 12px;
  color: #d9e6ff;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.55;
  transition: background-color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
  border-left: 3px solid transparent;
}

.code-line.active {
  background: rgba(56, 167, 255, 0.16);
  border-left-color: #56c0ff;
}

.code-line.dimmed {
  opacity: 0.55;
}

.line-no {
  color: rgba(217, 230, 255, 0.5);
  text-align: right;
}

@media (max-width: 1280px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .code-card {
    position: static;
    height: auto;
    min-height: 400px;
    max-height: none;
  }

  .struct-body {
    min-height: 220px;
  }
}

@media (max-width: 900px) {
  .language-switcher,
  .hero-stats {
    justify-content: flex-start;
  }

  .input-row {
    grid-template-columns: 1fr;
  }
}
</style>
