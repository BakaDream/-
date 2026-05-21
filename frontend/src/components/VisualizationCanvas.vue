<template>
  <div class="canvas-root">
    <div v-if="isStack" class="stack-visual">
      <template v-for="slotItem in stackSlots" :key="slotItem.key">
        <div class="stack-card" :class="{ active: slotItem.highlight, empty: !slotItem.hasValue }">
          <span class="stack-index">{{ slotItem.index }}</span>
          <strong v-if="slotItem.hasValue">{{ slotItem.value }}</strong>
          <span v-else class="empty-slot">-</span>
          <span v-if="slotItem.top" class="marker">栈顶</span>
        </div>
      </template>
      <div v-if="!stackSlots.length" class="empty-block">当前结构为空</div>
      <div class="pointer-strip">
        <span>top 指针：{{ stackTopIndex }}</span>
      </div>
      <div class="boundary-bar">
        <span class="boundary-tag" :class="stackView.length === 0 ? 'warn' : ''">空</span>
        <div class="capacity-track">
          <div class="capacity-fill" :style="{ width: capacityPercent + '%' }" :class="capacityPercent >= 90 ? 'warn' : ''"></div>
        </div>
        <span class="boundary-tag" :class="capacityPercent >= 90 ? 'warn' : ''">满</span>
        <span class="capacity-text">{{ stackView.length }} / {{ stackCapacity }}</span>
      </div>
    </div>

    <div v-else-if="isCircularQueue" class="queue-circle-visual">
      <div v-if="queueCircleItems.length" class="queue-circle-stage">
        <div class="queue-circle-ring"></div>
        <div
          v-for="item in queueCircleItems"
          :key="item.key"
          class="queue-circle-node"
          :class="{ active: item.highlight, empty: item.empty }"
          :style="{ left: item.x, top: item.y }"
        >
          <span class="queue-circle-index">{{ item.index }}</span>
          <strong>{{ item.value }}</strong>
          <span v-if="item.front" class="mini-tag front">front</span>
          <span v-if="item.rear" class="mini-tag rear">rear</span>
        </div>
      </div>
      <div v-else class="empty-block">当前循环队列为空</div>
      <div class="pointer-strip">
        <span>front 指针：{{ queueFrontIndex }}</span>
        <span>rear 指针：{{ queueRearIndex }}</span>
      </div>
      <div v-if="linePointers.length" class="pointer-strip line-pointers">
        <span
          v-for="pointer in linePointers"
          :key="`${pointer.label}-${pointer.index}`"
          class="pointer-pill"
          :style="{ color: pointer.color, borderColor: `${pointer.color}55`, backgroundColor: `${pointer.color}12` }"
        >{{ pointer.label }} → {{ formatPointerIndex(pointer.index) }}</span>
      </div>
      <div v-if="queueCircleItems.length || queueCapacity" class="boundary-bar">
        <span class="boundary-tag" :class="queueCircleItems.length === 0 ? 'warn' : ''">空</span>
        <div class="capacity-track">
          <div class="capacity-fill" :style="{ width: queueCapacityPercent + '%' }" :class="queueCapacityPercent >= 90 ? 'warn' : ''"></div>
        </div>
        <span class="boundary-tag" :class="queueCapacityPercent >= 90 ? 'warn' : ''">满</span>
        <span class="capacity-text">{{ queueSize }} / {{ queueCapacity }}</span>
      </div>
    </div>

    <div v-else-if="isQueue || isLinear || isLinked" class="line-visual">
      <div v-if="isLinear" class="line-track array-grid">
        <template v-for="slot in linearSlots" :key="slot.key">
          <div class="line-card" :class="{ active: slot.highlight, empty: !slot.hasValue }">
            <span class="line-index">{{ slot.index }}</span>
            <strong v-if="slot.hasValue">{{ slot.value }}</strong>
            <span v-else class="empty-slot">#</span>
          </div>
        </template>
      </div>
      <div v-else-if="lineView.length || showsVirtualHead" class="line-track">
        <template v-if="showsVirtualHead">
          <div class="line-card head-card">
            <span class="line-index">H</span>
            <strong>头结点</strong>
          </div>
          <span v-if="lineView.length" class="arrow">-&gt;</span>
        </template>
        <template v-for="item in lineView" :key="item.key">
          <div class="line-card" :class="{ active: item.highlight }">
            <span class="line-index">{{ item.index }}</span>
            <strong>{{ item.value }}</strong>
            <span v-if="item.front" class="mini-tag front">队头</span>
            <span v-else-if="item.head" class="mini-tag front">头</span>
            <span v-if="item.rear" class="mini-tag rear">队尾</span>
            <span v-else-if="item.tail" class="mini-tag rear">尾</span>
          </div>
          <span v-if="isLinked && item.rawIndex < lineView.length - 1" class="arrow">{{ linkConnector }}</span>
        </template>
        <span v-if="isCircularLinked && lineView.length" class="cycle-tip">↺ tail.next → H</span>
      </div>
      <div v-else class="empty-block">暂无数据</div>
      <div v-if="isLinear && (plainItems.length || linearCapacity)" class="linear-size-note">
        当前长度 {{ plainItems.length }}，固定表长 {{ linearCapacity }}；空位使用 # 占位。
      </div>
      <div v-if="isLinear && linePointers.length" class="pointer-strip line-pointers">
        <span
          v-for="pointer in linePointers"
          :key="`${pointer.label}-${pointer.index}`"
          class="pointer-pill"
          :style="{ color: pointer.color, borderColor: `${pointer.color}55`, backgroundColor: `${pointer.color}12` }"
        >{{ pointer.label }} → {{ formatPointerIndex(pointer.index) }}</span>
      </div>

      <!-- 队列边界状态条 -->
      <div v-if="isQueue" class="pointer-strip">
        <span>front 指针：{{ lineView.length ? 0 : -1 }}</span>
        <span>rear 指针：{{ lineView.length ? lineView.length - 1 : -1 }}</span>
      </div>
      <div v-if="isQueue && (lineView.length || queueCapacity)" class="boundary-bar">
        <span class="boundary-tag" :class="lineView.length === 0 ? 'warn' : ''">空</span>
        <div class="capacity-track">
          <div class="capacity-fill" :style="{ width: queueCapacityPercent + '%' }" :class="queueCapacityPercent >= 90 ? 'warn' : ''"></div>
        </div>
        <span class="boundary-tag" :class="queueCapacityPercent >= 90 ? 'warn' : ''">满</span>
        <span class="capacity-text">{{ lineView.length }} / {{ queueCapacity }}</span>
      </div>
    </div>

    <div v-else-if="isBarChart" class="bar-chart-visual">
      <div v-if="barItems.length" class="bar-chart-container">
        <div v-for="bar in barItems" :key="bar.key" class="bar-wrapper" :class="{ active: bar.highlight }">
          <div class="bar-value">{{ bar.value }}</div>
          <div class="bar-fill" :style="{ height: bar.heightPx + 'px' }"></div>
          <div class="bar-index">{{ formatBarIndex(bar.index) }}</div>
          <div
            v-for="(pointer, pointerIndex) in bar.pointers"
            :key="`${bar.key}-pointer-${pointerIndex}`"
            class="bar-pointer"
            :style="{ bottom: `${-30 - pointerIndex * 22}px`, color: pointer.color }"
          >{{ pointer.label }}↑</div>
        </div>
      </div>
      <div v-else class="empty-block">暂无数据</div>
    </div>

    <div v-else-if="isPriority" class="priority-wrap">
      <svg v-if="priorityTreeLayout.count" :viewBox="priorityTreeViewBox" class="tree-svg">
        <line
          v-for="edge in priorityTreeLayout.edges"
          :key="edge.key"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          class="tree-edge"
          :class="{ active: edge.highlight }"
        />
        <g v-for="node in priorityTreeLayout.nodes" :key="node.id" :transform="`translate(${node.x}, ${node.y})`">
          <circle class="tree-node" :class="{ active: node.highlight }" :r="priorityTreeRadius" />
          <text class="tree-node-text" :font-size="priorityTreeFontSize" text-anchor="middle" :dy="priorityTreeFontDy">{{ node.label }}</text>
        </g>
      </svg>
      <div class="priority-grid">
        <div v-for="item in priorityView" :key="item.key" class="priority-card" :class="{ active: item.highlight }">
          <span class="priority-label">{{ item.value }}</span>
          <span class="priority-level">优先级 {{ item.priority }}</span>
          <span class="priority-index">堆下标 {{ item.index }}</span>
          <span v-if="item.isFront" class="mini-tag front">堆顶</span>
        </div>
      </div>
      <div v-if="!priorityView.length" class="empty-block">当前优先队列为空</div>
      <div class="pointer-strip">
        <span>元素个数：{{ priorityView.length }} / {{ queueCapacity }}</span>
        <span>实现方式：大顶堆</span>
      </div>
      <div class="boundary-bar">
        <span class="boundary-tag" :class="priorityView.length === 0 ? 'warn' : ''">空</span>
        <div class="capacity-track">
          <div class="capacity-fill" :style="{ width: queueCapacityPercent + '%' }" :class="queueCapacityPercent >= 90 ? 'warn' : ''"></div>
        </div>
        <span class="boundary-tag" :class="queueCapacityPercent >= 90 ? 'warn' : ''">满</span>
        <span class="capacity-text">{{ priorityView.length }} / {{ queueCapacity }}</span>
      </div>
    </div>

    <div v-else-if="isSharedStack || isSharedStackQueue" class="shared-wrap">
      <div class="memory-grid">
        <div v-for="cell in sharedCells" :key="cell.index" class="memory-cell" :class="[cell.kind, { active: cell.highlight }]">
          <span class="memory-index">{{ cell.index }}</span>
          <strong>{{ cell.value }}</strong>
          <small>{{ cell.label }}</small>
        </div>
      </div>
      <div v-if="sharedPointerSummary.length" class="pointer-strip line-pointers">
        <span
          v-for="pointer in sharedPointerSummary"
          :key="pointer.label"
          class="pointer-pill"
          :style="{ color: pointer.color, borderColor: `${pointer.color}55`, backgroundColor: `${pointer.color}12` }"
        >{{ pointer.label }} → {{ pointer.value }}</span>
      </div>
      <div class="boundary-bar">
        <span class="boundary-tag" :class="sharedUsage.used === 0 ? 'warn' : ''">空</span>
        <div class="capacity-track">
          <div class="capacity-fill" :style="{ width: sharedUsage.percent + '%' }" :class="sharedUsage.percent >= 90 ? 'warn' : ''"></div>
        </div>
        <span class="boundary-tag" :class="sharedUsage.percent >= 90 ? 'warn' : ''">满</span>
        <span class="capacity-text">{{ sharedUsage.used }} / {{ sharedUsage.capacity }}</span>
      </div>
    </div>

    <div v-else-if="isGraph" class="graph-wrap">
      <svg viewBox="0 0 720 360" class="graph-svg">
        <line
          v-for="edge in graphLayout.edges"
          :key="edge.key"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          class="graph-edge"
          :class="{ active: edge.highlight }"
        />
        <text
          v-for="edge in graphLayout.edges"
          :key="`${edge.key}-weight`"
          :x="edge.mx"
          :y="edge.my"
          class="graph-edge-label"
          text-anchor="middle"
        >{{ edge.weight }}</text>
        <g v-for="node in graphLayout.nodes" :key="node.id" :transform="`translate(${node.x}, ${node.y})`">
          <circle class="graph-node" :class="{ active: node.highlight, visited: node.visited }" r="28" />
          <text class="graph-node-text" text-anchor="middle" dy="6">{{ node.id }}</text>
        </g>
      </svg>

      <div class="graph-side-panels" :class="{ centered: graphPanelCount === 1 }">
        <div v-if="showVertexPanel && graphVertices.length" class="mini-panel vertex-panel">
          <h4>顶点数组</h4>
          <div class="vertex-array">
            <div
              v-for="(vertex, index) in graphVertices"
              :key="`${vertex}-${index}`"
              class="vertex-cell"
              :class="{ active: highlightNodeSet.has(String(vertex)), visited: traversalNodeSet.has(String(vertex)) }"
            >
              <span class="vertex-index">{{ index }}</span>
              <strong>{{ vertex }}</strong>
            </div>
          </div>
        </div>

        <div v-if="showMatrixPanel && matrixView.length" class="mini-panel">
          <h4>邻接矩阵</h4>
          <table>
            <thead>
              <tr>
                <th></th>
                <th v-for="vertex in graphVertices" :key="vertex">{{ vertex }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in matrixView" :key="rowIndex">
                <th>{{ graphVertices[rowIndex] }}</th>
                <td
                  v-for="(cell, colIndex) in row"
                  :key="`${rowIndex}-${colIndex}`"
                  :class="{ highlight: cell > 0, focus: highlightCellSet.has(`${rowIndex}-${colIndex}`) }"
                >
                  {{ cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="showAdjacencyPanel && adjacencyEntries.length" class="mini-panel adjacency-panel">
          <h4>邻接表</h4>
          <ul>
            <li
              v-for="[vertex, neighbors] in adjacencyEntries"
              :key="vertex"
              :class="{ active: highlightNodeSet.has(String(vertex)), visited: traversalNodeSet.has(String(vertex)) }"
            >
              <strong>{{ vertex }}</strong>
              <span>{{ neighbors.length ? neighbors.map((neighbor) => formatNeighbor(vertex, neighbor)).join(' → ') : '空' }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-else-if="isTree" class="tree-wrap">
      <div v-if="isHuffmanForestStage" class="huffman-stage">
        <div v-if="treeLayout.count" class="mini-panel huffman-tree-panel">
          <h4>当前合并树</h4>
          <svg :viewBox="treeViewBox" class="tree-svg huffman-tree-svg">
            <line
              v-for="edge in treeLayout.edges"
              :key="edge.key"
              :x1="edge.x1"
              :y1="edge.y1"
              :x2="edge.x2"
              :y2="edge.y2"
              class="tree-edge"
              :class="{ active: edge.highlight }"
            />
            <g v-for="node in treeLayout.nodes" :key="node.id" :transform="`translate(${node.x}, ${node.y})`">
              <circle
                class="tree-node"
                :class="{ active: node.highlight, visited: traversalNodeSet.has(String(node.value)) || traversalNodeSet.has(String(node.label)) }"
                :r="treeRadius"
              />
              <text class="tree-node-text" :font-size="treeFontSize" text-anchor="middle" :dy="treeFontDy">{{ node.label }}</text>
            </g>
          </svg>
        </div>

        <div class="mini-panel huffman-forest-panel">
          <h4>待合并森林</h4>
          <div class="huffman-forest-strip">
            <div
              v-for="node in huffmanForestNodes"
              :key="node.key"
              class="huffman-forest-node"
              :class="{ active: node.highlight, merged: node.merged }"
            >
              <span class="huffman-node-role">{{ node.merged ? '子树' : '叶子' }}</span>
              <strong>{{ node.label }}</strong>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="isForest" class="forest-grid">
        <div v-for="(layout, forestIndex) in forestLayouts" :key="`forest-${forestIndex}`" class="forest-card">
          <svg :viewBox="forestViewBox(layout)" class="tree-svg forest-svg">
            <line
              v-for="edge in layout.edges"
              :key="edge.key"
              :x1="edge.x1"
              :y1="edge.y1"
              :x2="edge.x2"
              :y2="edge.y2"
              class="tree-edge"
              :class="{ active: edge.highlight }"
            />
            <g v-for="node in layout.nodes" :key="node.id" :transform="`translate(${node.x}, ${node.y})`">
              <circle
                class="tree-node"
                :class="{ active: node.highlight, visited: traversalNodeSet.has(String(node.value)) || traversalNodeSet.has(String(node.label)) }"
                :r="forestTreeRadius(layout)"
              />
              <text class="tree-node-text" :font-size="forestTreeFontSize(layout)" text-anchor="middle" :dy="forestTreeFontDy(layout)">{{ node.label }}</text>
            </g>
          </svg>
        </div>
      </div>
      <svg v-else :viewBox="treeViewBox" class="tree-svg">
        <line
          v-for="edge in treeLayout.edges"
          :key="edge.key"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          class="tree-edge"
          :class="{ active: edge.highlight }"
        />
        <g v-for="node in treeLayout.nodes" :key="node.id" :transform="`translate(${node.x}, ${node.y})`">
          <circle
            class="tree-node"
            :class="{ active: node.highlight, visited: traversalNodeSet.has(String(node.value)) || traversalNodeSet.has(String(node.label)) }"
            :r="treeRadius"
          />
          <text class="tree-node-text" :font-size="treeFontSize" text-anchor="middle" :dy="treeFontDy">{{ node.label }}</text>
        </g>
      </svg>

      <div class="pointer-strip tree-stats">
        <span>节点数：{{ treeNodeCount }}</span>
        <span>树深度：{{ treeDepth }}</span>
      </div>

      <div v-if="isHeap && heapSlots.length" class="heap-row">
        <div
          v-for="slot in heapSlots"
          :key="`heap-${slot.index}-${slot.value}`"
          class="heap-card"
          :class="{ active: slot.highlight, sorted: slot.sorted, empty: slot.empty, inactive: !slot.active && !slot.sorted }"
        >
          <span>{{ slot.index }}</span>
          <strong>{{ slot.value }}</strong>
        </div>
      </div>
    </div>

    <div v-else class="empty-block">当前页面没有可渲染的数据</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Object, required: true },
  state: { type: Object, required: true },
})

const meta = computed(() => props.state?.meta || {})
const markerMap = computed(() => meta.value.markers || {})
const highlightIndexSet = computed(() => new Set(meta.value.highlightIndices || []))
const highlightNodeSet = computed(() => new Set((meta.value.highlightNodes || []).map((item) => String(item))))
const highlightCellSet = computed(() => new Set((meta.value.highlightCells || []).map((cell) => `${cell[0]}-${cell[1]}`)))
const highlightEdgeSet = computed(() => new Set((meta.value.highlightEdges || []).map(([from, to]) => [String(from), String(to)].sort().join('::'))))
const traversalNodeSet = computed(() => new Set((meta.value.traversalOrder || []).map((item) => String(item))))

const isStack = computed(() => ['stack', 'linked-stack'].includes(props.page.visualType))
const isQueue = computed(() => ['queue', 'linked-queue', 'queue-circle'].includes(props.page.visualType))
const isCircularQueue = computed(() => props.page.visualType === 'queue-circle')
const isLinear = computed(() => props.page.visualType === 'linear-list')
const isHeadLinked = computed(() => props.page.visualType === 'head-linked-list')
const isDoublyLinked = computed(() => props.page.visualType === 'doubly-linked-list')
const isCircularLinked = computed(() => props.page.visualType === 'circular-linked-list')
const isLinked = computed(() =>
  ['linked-stack', 'linked-queue', 'single-linked-list', 'head-linked-list', 'doubly-linked-list', 'circular-linked-list'].includes(
    props.page.visualType,
  ),
)
const isPriority = computed(() => props.page.visualType === 'priority-queue')
const isBarChart = computed(() => props.page.visualType === 'bar-chart')
const isSharedStack = computed(() => props.page.visualType === 'shared-stack')
const isSharedStackQueue = computed(() => props.page.visualType === 'shared-stack-queue')
const isGraph = computed(() => props.page.visualType === 'graph')
const isTree = computed(() => ['tree', 'heap', 'heap-sort'].includes(props.page.visualType))
const isHeap = computed(() => ['heap', 'heap-sort'].includes(props.page.visualType))
const showsVirtualHead = computed(() => isHeadLinked.value || isDoublyLinked.value || isCircularLinked.value)
const linkConnector = computed(() => (isDoublyLinked.value ? '<->' : '->'))

const plainItems = computed(() => props.state?.items || [])
const circularQueueSlots = computed(() => (Array.isArray(props.state?.slots) ? props.state.slots : []))

// 栈/队列容量状态
const stackCapacity = computed(() => props.state?.capacity || 8)
const stackTopIndex = computed(() => (Number.isInteger(markerMap.value.top) ? markerMap.value.top : plainItems.value.length ? plainItems.value.length - 1 : -1))
const capacityPercent = computed(() => Math.min(100, (plainItems.value.length / stackCapacity.value) * 100))
const queueCapacity = computed(() => props.state?.capacity || 8)
const queueSize = computed(() => (Number.isInteger(props.state?.size) ? props.state.size : plainItems.value.length))
const queueCapacityPercent = computed(() => Math.min(100, (queueSize.value / queueCapacity.value) * 100))
const queueFrontIndex = computed(() => (Number.isInteger(markerMap.value.front) ? markerMap.value.front : plainItems.value.length ? 0 : -1))
const queueRearIndex = computed(() => (Number.isInteger(markerMap.value.rear) ? markerMap.value.rear : plainItems.value.length ? plainItems.value.length - 1 : -1))

const stackView = computed(() =>
  [...plainItems.value]
    .map((value, index) => ({ value, index, key: `${index}-${value}` }))
    .reverse()
    .map((item, visualIndex) => ({
      ...item,
      top: visualIndex === 0,
      highlight: highlightIndexSet.value.has(item.index),
    })),
)

const stackSlots = computed(() => {
  const capacity = stackCapacity.value
  const items = plainItems.value
  const slots = []
  for (let i = capacity - 1; i >= 0; i--) {
    const hasValue = i < items.length
    slots.push({
      index: i,
      value: hasValue ? items[i] : '',
      hasValue,
      key: `slot-${i}`,
      highlight: hasValue && highlightIndexSet.value.has(i),
      top: i === items.length - 1 && hasValue,
    })
  }
  return slots
})

const barItems = computed(() => {
  const items = plainItems.value
  if (!items.length) return []
  const maxVal = Math.max(...items.map(Number), 1)
  const pointers = Array.isArray(meta.value.pointers) ? meta.value.pointers : []
  return items.map((value, index) => ({
    index,
    value,
    key: `bar-${index}-${value}`,
    heightPx: Math.round(24 + (Number(value) / maxVal) * 176),
    highlight: highlightIndexSet.value.has(index),
    pointers: pointers.filter((pointer) => pointer.index === index),
  }))
})

const linePointers = computed(() => (Array.isArray(meta.value.pointers) ? meta.value.pointers : []))

const lineView = computed(() =>
  plainItems.value.map((value, index) => ({
    value,
    index: isLinked.value ? index + 1 : index,
    rawIndex: index,
    key: `${index}-${value}`,
    highlight: highlightIndexSet.value.has(index),
    front: index === 0 && isQueue.value,
    rear: index === plainItems.value.length - 1 && isQueue.value,
    head: index === 0 && isLinked.value && !isQueue.value,
    tail: index === plainItems.value.length - 1 && isLinked.value && !isQueue.value,
  })),
)

const linearCapacity = computed(() => props.state?.capacity || 10)
const linearCapacityPercent = computed(() => Math.min(100, (plainItems.value.length / linearCapacity.value) * 100))
const linearSlots = computed(() => {
  const capacity = linearCapacity.value
  const items = plainItems.value
  const slots = []
  for (let i = 0; i < capacity; i++) {
    const hasValue = i < items.length
    slots.push({
      index: i,
      value: hasValue ? items[i] : '#',
      hasValue,
      key: `linear-slot-${i}`,
      highlight: hasValue && highlightIndexSet.value.has(i),
    })
  }
  return slots
})

const queueCircleItems = computed(() => {
  const slots = circularQueueSlots.value.length ? circularQueueSlots.value : plainItems.value
  if (!slots.length) return []
  const total = Math.max(slots.length, 6)
  const centerX = 160
  const centerY = 118
  const radius = 82
  return slots.map((value, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2) * index) / total
    const x = `${centerX + radius * Math.cos(angle)}px`
    const y = `${centerY + radius * Math.sin(angle)}px`
    return {
      key: `queue-circle-${index}-${value}`,
      value: value ?? '·',
      index,
      highlight: highlightIndexSet.value.has(index),
      empty: value == null,
      front: index === queueFrontIndex.value,
      rear: index === queueRearIndex.value,
      x: `calc(${x} - 28px)`,
      y: `calc(${y} - 28px)`,
    }
  })
})

function formatPointerIndex(index) {
  if (!Number.isInteger(index)) return index
  return isLinked.value ? index + 1 : index
}

function formatBarIndex(index) {
  if (!Number.isInteger(index)) return index
  return index
}

const priorityView = computed(() =>
  (props.state?.items || []).map((item, index) => ({
    ...item,
    index,
    key: `${index}-${item.value}-${item.priority}`,
    isFront: index === 0,
    highlight: highlightIndexSet.value.has(index) || (!highlightIndexSet.value.size && index === 0),
  })),
)

const sharedCells = computed(() => {
  if (isSharedStack.value) {
    const capacity = props.state?.capacity || 10
    const stack1 = props.state?.stack1 || []
    const stack2 = props.state?.stack2 || []
    return Array.from({ length: capacity }, (_, index) => {
      if (index < stack1.length) return { index, value: stack1[index], label: '栈1', kind: 'left', highlight: highlightIndexSet.value.has(index) }
      const rightOffset = capacity - index - 1
      if (rightOffset < stack2.length) return { index, value: stack2[rightOffset], label: '栈2', kind: 'right', highlight: highlightIndexSet.value.has(index) }
      return { index, value: '·', label: '空', kind: 'empty', highlight: false }
    })
  }

  const capacity = props.state?.capacity || 12
  const stack = props.state?.stack || []
  const queue = props.state?.queue || []
  return Array.from({ length: capacity }, (_, index) => {
    if (index < stack.length) return { index, value: stack[index], label: '栈', kind: 'left', highlight: highlightIndexSet.value.has(index) }
    const rightOffset = capacity - index - 1
    if (rightOffset < queue.length) return { index, value: queue[rightOffset], label: '队列', kind: 'right', highlight: highlightIndexSet.value.has(index) }
    return { index, value: '·', label: '空', kind: 'empty', highlight: false }
  })
})

const sharedUsage = computed(() => {
  if (isSharedStack.value) {
    const used = (props.state?.stack1?.length || 0) + (props.state?.stack2?.length || 0)
    const capacity = props.state?.capacity || 10
    return { used, capacity, percent: Math.min(100, (used / capacity) * 100) }
  }
  const used = (props.state?.stack?.length || 0) + (props.state?.queue?.length || 0)
  const capacity = props.state?.capacity || 12
  return { used, capacity, percent: Math.min(100, (used / capacity) * 100) }
})

const sharedPointerSummary = computed(() => {
  if (isSharedStack.value) {
    const capacity = props.state?.capacity || 10
    const leftTop = Number.isInteger(markerMap.value.top1) ? markerMap.value.top1 : (props.state?.stack1?.length || 0) - 1
    const rightFallback = (props.state?.stack2?.length || 0) ? capacity - (props.state?.stack2?.length || 0) : capacity
    const rightTop = Number.isInteger(markerMap.value.top2) ? markerMap.value.top2 : rightFallback
    return [
      { label: '左栈 top1', value: leftTop, color: '#2f77eb' },
      { label: '右栈 top2', value: rightTop, color: '#13a67a' },
    ]
  }
  return []
})

const graphVertices = computed(() => props.state?.vertices || [])
const matrixView = computed(() => props.state?.matrix || [])
const adjacencyEntries = computed(() => Object.entries(props.state?.adjacency || {}))
const graphWeights = computed(() => props.state?.weights || {})
const graphActionKey = computed(() => props.state?.meta?.actionKey || '')
const showVertexPanel = computed(() => props.page.key.startsWith('graph-'))
const showMatrixPanel = computed(() => {
  if (props.page.key === 'graph-matrix' || props.page.key === 'graph-mst') return true
  if (props.page.key === 'graph-list') return false
  if (props.page.key === 'graph-traversal') return ['create', 'random', 'matrix-dfs', 'matrix-bfs'].includes(graphActionKey.value)
  return false
})
const showAdjacencyPanel = computed(() => {
  if (props.page.key === 'graph-list') return true
  if (props.page.key === 'graph-matrix' || props.page.key === 'graph-mst') return false
  if (props.page.key === 'graph-traversal') return ['create', 'random', 'dfs', 'bfs'].includes(graphActionKey.value)
  return false
})
const graphPanelCount = computed(() =>
  Number(showVertexPanel.value && graphVertices.value.length) +
  Number(showMatrixPanel.value && matrixView.value.length) +
  Number(showAdjacencyPanel.value && adjacencyEntries.value.length),
)

function edgeWeight(source, target) {
  return graphWeights.value[`${source},${target}`] || graphWeights.value[`${target},${source}`] || 1
}

function formatNeighbor(vertex, neighbor) {
  return `${neighbor}(${edgeWeight(vertex, neighbor)})`
}

const graphLayout = computed(() => {
  const vertices = graphVertices.value
  const centerX = 360
  const centerY = 170
  const radius = vertices.length > 1 ? 118 : 0
  const nodes = vertices.map((vertex, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(vertices.length, 1) - Math.PI / 2
    return {
      id: vertex,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      highlight: highlightNodeSet.value.has(String(vertex)),
      visited: traversalNodeSet.value.has(String(vertex)),
    }
  })
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]))
  const edges = (props.state?.edges || []).map(([source, target], index) => ({
    key: `${source}-${target}-${index}`,
    x1: nodeMap[source]?.x ?? centerX,
    y1: nodeMap[source]?.y ?? centerY,
    x2: nodeMap[target]?.x ?? centerX,
    y2: nodeMap[target]?.y ?? centerY,
    mx: ((nodeMap[source]?.x ?? centerX) + (nodeMap[target]?.x ?? centerX)) / 2,
    my: ((nodeMap[source]?.y ?? centerY) + (nodeMap[target]?.y ?? centerY)) / 2 - 6,
    weight: edgeWeight(source, target),
    highlight:
      highlightEdgeSet.value.has([String(source), String(target)].sort().join('::')) ||
      (highlightNodeSet.value.has(String(source)) && highlightNodeSet.value.has(String(target))),
  }))
  return { nodes, edges }
})

function buildTreeLayout(root) {
  if (!root) return { nodes: [], edges: [], count: 0, maxDepth: 0 }

  const rawNodes = []
  const rawEdges = []

  const walk = (node, depth, id = 'root', parentId = null) => {
    if (!node) return
    rawNodes.push({
      id,
      value: node.value,
      label: node.label ?? String(node.value),
      depth,
      highlight: highlightNodeSet.value.has(String(node.value)) || highlightNodeSet.value.has(String(node.label ?? node.value)),
    })
    if (parentId) rawEdges.push({ source: parentId, target: id })
    if (node.left) walk(node.left, depth + 1, `${id}-l`, id)
    if (node.right) walk(node.right, depth + 1, `${id}-r`, id)
  }

  walk(root, 0)

  const count = rawNodes.length
  const maxDepth = Math.max(...rawNodes.map((n) => n.depth), 0)

  // 动态缩放
  const scale = count <= 7 ? 1 : count <= 15 ? 0.75 : count <= 25 ? 0.55 : 0.4
  const levelGap = Math.round(90 * scale)

  // 使用固定宽度，根节点始终在中间
  const fixedWidth = 760
  const centerX = fixedWidth / 2

  // 用层级式布局：每层的节点均匀分布在以 centerX 为中心的区域内
  const nodesByDepth = {}
  rawNodes.forEach((node) => {
    if (!nodesByDepth[node.depth]) nodesByDepth[node.depth] = []
    nodesByDepth[node.depth].push(node)
  })

  // 递归计算每个节点的水平位置
  const nodePositions = {}
  const minSpacing = Math.round(55 * scale)

  function assignPositions(node, left, right, depth, id = 'root') {
    if (!node) return
    const mid = (left + right) / 2
    nodePositions[id] = { x: mid, y: 40 + depth * levelGap }
    const halfWidth = (right - left) / 2
    if (node.left) assignPositions(node.left, left, mid, depth + 1, `${id}-l`)
    if (node.right) assignPositions(node.right, mid, right, depth + 1, `${id}-r`)
  }

  assignPositions(root, 20, fixedWidth - 20, 0)

  const nodes = rawNodes.map((node) => ({
    ...node,
    x: nodePositions[node.id]?.x ?? centerX,
    y: nodePositions[node.id]?.y ?? 40,
  }))

  const map = Object.fromEntries(nodes.map((node) => [node.id, node]))
  const edges = rawEdges.map((edge) => ({
    key: `${edge.source}-${edge.target}`,
    x1: map[edge.source].x,
    y1: map[edge.source].y,
    x2: map[edge.target].x,
    y2: map[edge.target].y,
    highlight: map[edge.source].highlight && map[edge.target].highlight,
  }))

  const totalHeight = 40 + maxDepth * levelGap + 60
  return { nodes, edges, count, maxDepth, totalHeight }
}

const forestRoots = computed(() => (Array.isArray(props.state?.forest) ? props.state.forest : []))
const forestLayouts = computed(() => forestRoots.value.map((root) => buildTreeLayout(root)).filter((layout) => layout.count))
const isHuffmanPage = computed(() => props.page.key === 'huffman')
const isForest = computed(() => props.page.key === 'huffman' && forestLayouts.value.length > 1)
const isHuffmanForestStage = computed(() => isHuffmanPage.value && forestRoots.value.length > 1)
const huffmanForestNodes = computed(() =>
  forestRoots.value.map((node, index) => ({
    key: `${node.label ?? node.value}-${index}`,
    label: node.label ?? String(node.value),
    merged: Boolean(node.left || node.right),
    highlight:
      highlightNodeSet.value.has(String(node.value)) ||
      highlightNodeSet.value.has(String(node.label ?? node.value)) ||
      highlightNodeSet.value.has(String(node.char ?? '')),
  })),
)
const treeSource = computed(() => {
  if (props.state?.tree) return props.state.tree
  if (props.page.key === 'huffman' && forestRoots.value.length === 1) return forestRoots.value[0]
  return null
})
const treeLayout = computed(() => buildTreeLayout(treeSource.value))
const treeViewBox = computed(() => {
  const layout = treeLayout.value
  if (!layout.count) return '0 0 760 420'
  const h = layout.totalHeight || 420
  return `0 0 760 ${h}`
})
function treeRadiusByCount(count) {
  return count <= 7 ? 24 : count <= 15 ? 18 : count <= 25 ? 14 : 11
}
function treeFontSizeByCount(count) {
  return count <= 7 ? 13 : count <= 15 ? 11 : count <= 25 ? 9 : 7
}
function treeFontDyByCount(count) {
  return count <= 7 ? 4.5 : count <= 15 ? 4 : count <= 25 ? 3.5 : 3
}
function forestViewBox(layout) {
  return `0 0 760 ${layout.totalHeight || 240}`
}
function forestTreeRadius(layout) {
  return treeRadiusByCount(layout.count || 1)
}
function forestTreeFontSize(layout) {
  return treeFontSizeByCount(layout.count || 1)
}
function forestTreeFontDy(layout) {
  return treeFontDyByCount(layout.count || 1)
}
const treeRadius = computed(() => treeRadiusByCount(treeLayout.value.count || 1))
const treeFontSize = computed(() => treeFontSizeByCount(treeLayout.value.count || 1))
const treeFontDy = computed(() => treeFontDyByCount(treeLayout.value.count || 1))
const priorityTreeLayout = computed(() => buildTreeLayout(props.state?.tree || null))
const priorityTreeViewBox = computed(() => {
  const layout = priorityTreeLayout.value
  return `0 0 760 ${layout.totalHeight || 260}`
})
const priorityTreeRadius = computed(() => treeRadiusByCount(priorityTreeLayout.value.count || 1))
const priorityTreeFontSize = computed(() => treeFontSizeByCount(priorityTreeLayout.value.count || 1))
const priorityTreeFontDy = computed(() => treeFontDyByCount(priorityTreeLayout.value.count || 1))
const heapItems = computed(() => props.state?.items || [])
const heapCapacity = computed(() => props.state?.capacity || 10)
const heapActiveSize = computed(() => props.state?.meta?.heapSize ?? heapItems.value.length)
const heapSlots = computed(() =>
  Array.from({ length: Math.max(heapCapacity.value, heapItems.value.length || 0) }, (_, index) => ({
    index,
    value: index < heapItems.value.length ? heapItems.value[index] : '·',
    empty: index >= heapItems.value.length,
    active: index < heapActiveSize.value,
    sorted: index >= heapActiveSize.value && index < heapItems.value.length,
    highlight: highlightIndexSet.value.has(index),
  })),
)
const treeNodeCount = computed(() => props.state?.meta?.treeCount ?? (isForest.value ? forestLayouts.value.reduce((sum, layout) => sum + layout.count, 0) : treeLayout.value.count ?? 0))
const treeDepth = computed(() => props.state?.meta?.treeDepth ?? (isForest.value ? Math.max(...forestLayouts.value.map((layout) => layout.maxDepth + 1), 0) : (treeLayout.value.maxDepth + (treeLayout.value.count ? 1 : 0)) ?? 0))
</script>

<style scoped>
.canvas-root {
  position: relative;
  min-height: 320px;
  padding: 12px;
  border-radius: 14px;
  background:
    radial-gradient(circle at top left, rgba(47, 119, 235, 0.1), transparent 24%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(244, 249, 255, 0.94) 100%);
  border: 1px solid rgba(16, 33, 62, 0.08);
  overflow: hidden;
}

.canvas-root::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(16, 33, 62, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(16, 33, 62, 0.03) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.35;
  pointer-events: none;
}

.empty-block {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: #69809d;
  font-size: 13px;
}

.stack-visual {
  display: grid;
  gap: 8px;
  justify-content: center;
}

.stack-card,
.line-card,
.priority-card,
.memory-cell,
.heap-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(16, 33, 62, 0.08);
  box-shadow: 0 12px 24px rgba(17, 39, 70, 0.08);
  transition:
    transform 0.35s ease,
    box-shadow 0.35s ease,
    background-color 0.35s ease,
    border-color 0.35s ease;
}

.stack-card {
  min-width: 160px;
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
}

.stack-card.active,
.line-card.active,
.priority-card.active,
.heap-card.active {
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.14) 0%, rgba(75, 225, 195, 0.16) 100%);
  border-color: rgba(47, 119, 235, 0.3);
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 18px 30px rgba(47, 119, 235, 0.12);
}

.heap-card.sorted {
  background: linear-gradient(135deg, rgba(19, 166, 122, 0.18) 0%, rgba(106, 227, 173, 0.24) 100%);
  border-color: rgba(19, 166, 122, 0.28);
}

.heap-card.empty,
.heap-card.inactive {
  background: rgba(245, 248, 252, 0.6);
  border-style: dashed;
  border-color: rgba(16, 33, 62, 0.12);
  box-shadow: none;
}

.stack-card.empty {
  background: rgba(245, 248, 252, 0.6);
  border-style: dashed;
  border-color: rgba(16, 33, 62, 0.12);
}

.empty-slot {
  color: #c0cad8;
  font-size: 14px;
}

.stack-index,
.line-index,
.memory-index,
.heap-card span {
  color: #6f8198;
  font-size: 12px;
}

.marker,
.mini-tag {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.marker,
.mini-tag.front {
  color: #0d624f;
  background: rgba(19, 166, 122, 0.14);
}

.mini-tag.rear {
  color: #8a5f0d;
  background: rgba(201, 122, 21, 0.14);
}

.line-visual {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.queue-circle-visual {
  min-height: 280px;
  display: grid;
  gap: 10px;
  justify-items: center;
}

.queue-circle-stage {
  position: relative;
  width: 320px;
  height: 236px;
}

.queue-circle-ring {
  position: absolute;
  inset: 24px 52px;
  border: 2px dashed rgba(47, 119, 235, 0.28);
  border-radius: 50%;
}

.queue-circle-node {
  position: absolute;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  gap: 2px;
  background: #ffffff;
  border: 1px solid rgba(16, 33, 62, 0.08);
  box-shadow: 0 12px 24px rgba(17, 39, 70, 0.08);
  transition:
    transform 0.35s ease,
    box-shadow 0.35s ease,
    background-color 0.35s ease,
    border-color 0.35s ease;
}

.queue-circle-node.active {
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.14) 0%, rgba(75, 225, 195, 0.16) 100%);
  border-color: rgba(47, 119, 235, 0.3);
  transform: translateY(-4px) scale(1.03);
  box-shadow: 0 18px 30px rgba(47, 119, 235, 0.12);
}

.queue-circle-index {
  font-size: 10px;
  color: #6f8198;
}

.line-track {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.array-grid {
  flex-wrap: wrap;
}

.line-card.empty {
  background: rgba(245, 248, 252, 0.6);
  border-style: dashed;
  border-color: rgba(16, 33, 62, 0.12);
}

.array-grid .line-card.active {
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.22) 0%, rgba(75, 225, 195, 0.24) 100%);
  border-color: rgba(47, 119, 235, 0.55);
  box-shadow:
    0 0 0 2px rgba(47, 119, 235, 0.18),
    0 18px 30px rgba(47, 119, 235, 0.16);
}

.array-grid .line-card.empty.active {
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.18) 0%, rgba(75, 225, 195, 0.2) 100%);
  border-style: solid;
}

.line-card {
  min-width: 72px;
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 10px 8px;
}

.head-card {
  min-width: 80px;
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.16), rgba(75, 225, 195, 0.18));
  border-color: rgba(47, 119, 235, 0.24);
}

.arrow {
  color: #86a0be;
  font-size: 24px;
  font-weight: 700;
}

.cycle-tip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(47, 119, 235, 0.12);
  color: #174ea8;
  font-size: 12px;
  font-weight: 700;
}

/* ── 边界状态条（栈/队列容量指示）── */
.boundary-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(16, 33, 62, 0.04);
  border: 1px solid rgba(16, 33, 62, 0.06);
}

.capacity-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: rgba(16, 33, 62, 0.08);
  overflow: hidden;
}

.capacity-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f77eb, #4be1c3);
  transition: width 0.3s ease;
}

.capacity-fill.warn {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

.boundary-tag {
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(19, 166, 122, 0.12);
  color: #0d624f;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.2s;
}

.boundary-tag.warn {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.capacity-text {
  color: #60728d;
  font-size: 11px;
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}

.linear-size-note,
.pointer-strip {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(47, 119, 235, 0.08);
  color: #315f9f;
  font-size: 12px;
  font-weight: 700;
}

.line-pointers {
  flex-wrap: wrap;
}

.pointer-pill {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 12px;
  font-weight: 700;
}

.priority-wrap,
.shared-wrap {
  display: grid;
  gap: 10px;
}

.priority-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.priority-card {
  padding: 12px;
  display: grid;
  gap: 6px;
}

.priority-label {
  font-size: 16px;
  font-weight: 700;
}

.priority-level {
  color: #5c7190;
}

.priority-index {
  color: #7c8ca5;
  font-size: 12px;
}

.memory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 12px;
}

.memory-cell {
  min-height: 102px;
  display: grid;
  place-items: center;
  gap: 6px;
  padding: 10px;
}

.memory-cell.left {
  background: linear-gradient(135deg, rgba(47, 119, 235, 0.12), rgba(47, 119, 235, 0.04));
}

.memory-cell.right {
  background: linear-gradient(135deg, rgba(75, 225, 195, 0.18), rgba(75, 225, 195, 0.05));
}

.memory-cell.active {
  border-color: rgba(47, 119, 235, 0.3);
  box-shadow: 0 18px 30px rgba(47, 119, 235, 0.12);
  transform: translateY(-4px);
}

.memory-cell.empty {
  background: rgba(245, 248, 252, 0.9);
}

.graph-wrap,
.tree-wrap {
  display: grid;
  gap: 10px;
  min-height: 260px;
}

.forest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.huffman-stage {
  display: grid;
  gap: 10px;
}

.huffman-tree-panel,
.huffman-forest-panel {
  padding: 10px;
}

.huffman-tree-svg {
  min-height: 240px;
}

.huffman-forest-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
}

.huffman-forest-node {
  border-radius: 12px;
  border: 1px solid rgba(16, 33, 62, 0.08);
  background: rgba(244, 249, 255, 0.92);
  padding: 10px 12px;
  display: grid;
  gap: 6px;
  text-align: center;
}

.huffman-forest-node.active {
  border-color: rgba(47, 119, 235, 0.24);
  background: rgba(47, 119, 235, 0.12);
}

.huffman-forest-node.merged {
  background: rgba(19, 166, 122, 0.1);
  border-color: rgba(19, 166, 122, 0.18);
}

.huffman-node-role {
  font-size: 11px;
  color: #6b7d96;
}

.forest-card {
  border-radius: 14px;
  border: 1px solid rgba(16, 33, 62, 0.08);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  padding: 8px;
}

.forest-svg {
  min-height: 180px;
}

.graph-svg,
.tree-svg {
  width: 100%;
  min-height: 260px;
  border-radius: 14px;
  background:
    radial-gradient(circle at top, rgba(47, 119, 235, 0.08), transparent 32%),
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid rgba(16, 33, 62, 0.08);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.graph-edge,
.tree-edge {
  stroke: #b1bfd2;
  stroke-width: 2;
  transition: all 0.45s ease;
}

.graph-edge.active,
.tree-edge.active {
  stroke: #2f77eb;
  stroke-width: 3;
}

.graph-node,
.tree-node {
  fill: #ffffff;
  stroke: #7da4d8;
  stroke-width: 2.5;
  transition: all 0.45s ease;
}

.graph-node.active,
.tree-node.active {
  fill: rgba(47, 119, 235, 0.12);
  stroke: #2f77eb;
}

.graph-node.visited {
  fill: rgba(19, 166, 122, 0.14);
  stroke: #13a67a;
}

.tree-node.visited:not(.active) {
  fill: rgba(19, 166, 122, 0.12);
  stroke: #13a67a;
}

.graph-node-text,
.tree-node-text {
  fill: #10213e;
  font-size: 14px;
  font-weight: 700;
}

.graph-edge-label {
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 5px;
  fill: #c05621;
  font-size: 13px;
  font-weight: 800;
}

.graph-wrap :deep(g),
.tree-wrap :deep(g) {
  transition: transform 0.45s ease;
}

.graph-side-panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.graph-side-panels.centered {
  grid-template-columns: minmax(260px, 420px);
  justify-content: center;
}

.mini-panel {
  border-radius: 12px;
  border: 1px solid rgba(16, 33, 62, 0.08);
  background: rgba(255, 255, 255, 0.9);
  padding: 10px;
}

.mini-panel h4 {
  margin: 0 0 8px;
  font-size: 13px;
}

.vertex-array {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
  gap: 8px;
}

.vertex-cell {
  border-radius: 10px;
  border: 1px solid rgba(16, 33, 62, 0.08);
  background: rgba(244, 249, 255, 0.92);
  padding: 8px;
  display: grid;
  gap: 4px;
  text-align: center;
}

.vertex-cell.active {
  background: rgba(47, 119, 235, 0.12);
  border-color: rgba(47, 119, 235, 0.2);
}

.vertex-cell.visited {
  background: rgba(19, 166, 122, 0.12);
  border-color: rgba(19, 166, 122, 0.2);
}

.vertex-index {
  font-size: 11px;
  color: #7c8ca5;
}

.mini-panel table {
  width: 100%;
  border-collapse: collapse;
}

.mini-panel th,
.mini-panel td {
  border: 1px solid rgba(16, 33, 62, 0.08);
  padding: 4px 6px;
  text-align: center;
  font-size: 12px;
}

.mini-panel td.highlight {
  background: rgba(47, 119, 235, 0.12);
  color: #174ea8;
  font-weight: 700;
}

.mini-panel td.focus {
  background: rgba(75, 225, 195, 0.18);
  color: #0d624f;
  font-weight: 700;
}

.mini-panel ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.mini-panel li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 6px 8px;
  border-radius: 8px;
  transition: all 0.25s ease;
}

.mini-panel li.active {
  background: rgba(47, 119, 235, 0.1);
  box-shadow: inset 0 0 0 1px rgba(47, 119, 235, 0.12);
}

.mini-panel li.visited {
  background: rgba(19, 166, 122, 0.1);
  box-shadow: inset 0 0 0 1px rgba(19, 166, 122, 0.12);
}

.heap-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.heap-card {
  min-width: 78px;
  padding: 12px;
  display: grid;
  gap: 6px;
  justify-items: center;
}

.bar-chart-visual {
  min-height: 300px;
  padding: 16px;
}

.bar-chart-container {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 280px;
  padding: 30px 0 34px;
}

.bar-wrapper {
  flex: 1;
  max-width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  position: relative;
}

.bar-wrapper.active .bar-fill {
  background: linear-gradient(180deg, #2f77eb, #38a7ff);
  box-shadow: 0 4px 12px rgba(47, 119, 235, 0.3);
}

.bar-wrapper.active .bar-value {
  color: #2f77eb;
}

.bar-value {
  font-size: 12px;
  font-weight: 700;
  color: #48637f;
  margin-bottom: 4px;
}

.bar-fill {
  width: 100%;
  height: 24px;
  flex: 0 0 auto;
  min-height: 24px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #c7ddf5, #a8c8f0);
  transition: height 0.35s ease, background 0.35s ease;
}

.bar-index {
  font-size: 11px;
  color: #86a0be;
  margin-top: 4px;
}

.bar-pointer {
  position: absolute;
  bottom: -28px;
  color: #ef4444;
  font-size: 16px;
  font-weight: 700;
  animation: bounce 0.6s ease infinite alternate;
}

.tree-stats {
  flex-wrap: wrap;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-4px); }
}
</style>
