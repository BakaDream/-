const clone = (value) => JSON.parse(JSON.stringify(value))

function withMeta(state, extra = {}) {
  state.meta = {
    result: '',
    message: '',
    last: null,
    flag: null,
    highlightIndices: [],
    highlightNodes: [],
    highlightEdges: [],
    highlightCells: [],
    traversalOrder: [],
    output: null,
    markers: {},
    pointers: [],
    ...state.meta,
    ...extra,
  }
}

function makePointer(index, label, color = '#ef4444') {
  return { index, label, color }
}

function makeQueuePointers(front, rear) {
  const pointers = []
  if (Number.isInteger(front) && front >= 0) pointers.push(makePointer(front, 'front', '#13a67a'))
  if (Number.isInteger(rear) && rear >= 0) pointers.push(makePointer(rear, 'rear', '#c97a15'))
  return pointers
}

function makeStackMarker(top) {
  return { top }
}

function makeSharedStackMeta(state) {
  const top1 = state.stack1.length - 1
  const top2 = state.stack2.length ? state.capacity - state.stack2.length : state.capacity
  const pointers = []
  if (top1 >= 0) pointers.push(makePointer(top1, 'top1', '#2f77eb'))
  if (state.stack2.length) pointers.push(makePointer(top2, 'top2', '#13a67a'))
  return { markers: { top1, top2 }, pointers }
}

function makeTracer(state) {
  const traces = []
  return {
    add(message, line, extra = {}, round = null) {
      withMeta(state, { message, ...extra })
      traces.push({ message, line, state: clone(state), round })
    },
    // 新增：高亮多行代码块
    addBlock(message, lines, extra = {}, round = null) {
      withMeta(state, { message, ...extra })
      traces.push({ message, line: lines, state: clone(state), round })
    },
    done() {
      return traces
    },
  }
}

function normalizeInput(raw, fallback = '') {
  const value = String(raw ?? '').trim()
  return value || String(fallback ?? '').trim()
}

function parseNumberList(raw, fallback = '') {
  return normalizeInput(raw, fallback)
    .split(/[\s,，]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))
}

function parseSingleNumber(raw, fallback = 0) {
  const list = parseNumberList(raw, String(fallback))
  return list[0] ?? fallback
}

function parsePair(raw, fallback = '0,0') {
  const list = parseNumberList(raw, fallback)
  return [list[0] ?? 0, list[1] ?? 0]
}

function parseTriple(raw, fallback = '0,0,0') {
  const list = parseNumberList(raw, fallback)
  return [list[0] ?? 0, list[1] ?? 0, list[2] ?? 0]
}

function ensureLimit(items, capacity) {
  return items.slice(0, capacity)
}

function sortUniqueNumbers(raw, fallback = '') {
  return [...new Set(parseNumberList(raw, fallback))].sort((a, b) => a - b)
}

function parsePriorityItems(raw, fallback = '') {
  return normalizeInput(raw, fallback)
    .split(/[;,，]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [valuePart, priorityPart] = part.split(':').map((item) => item.trim())
      const value = valuePart || `E${index + 1}`
      const priority = Number(priorityPart ?? valuePart)
      return { value, priority: Number.isFinite(priority) ? priority : index + 1 }
    })
}

function defaultGraphData() {
  const weights = {
    'A,B': 2, 'B,A': 2,
    'A,C': 5, 'C,A': 5,
    'B,D': 3, 'D,B': 3,
    'C,D': 4, 'D,C': 4,
    'D,E': 6, 'E,D': 6,
  }
  return {
    vertices: ['A', 'B', 'C', 'D', 'E'],
    edges: [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
      ['D', 'E'],
    ],
    weights,
  }
}

function buildMatrix(vertices, edges, weights = {}) {
  const map = Object.fromEntries(vertices.map((vertex, index) => [vertex, index]))
  const matrix = Array.from({ length: vertices.length }, () => Array(vertices.length).fill(0))
  edges.forEach(([source, target]) => {
    const row = map[source]
    const col = map[target]
    if (row === undefined || col === undefined) return
    const key01 = `${source},${target}`
    const key10 = `${target},${source}`
    const w = weights[key01] || weights[key10] || 1
    matrix[row][col] = w
    matrix[col][row] = w
  })
  return matrix
}

function matrixToEdges(vertices, matrix) {
  const edges = []
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = row + 1; col < matrix[row].length; col += 1) {
      if (matrix[row][col]) edges.push([vertices[row], vertices[col]])
    }
  }
  return edges
}

function buildAdjacency(vertices, edges) {
  const adjacency = Object.fromEntries(vertices.map((vertex) => [vertex, []]))
  edges.forEach(([source, target]) => {
    if (adjacency[source] && !adjacency[source].includes(target)) adjacency[source].push(target)
    if (adjacency[target] && !adjacency[target].includes(source)) adjacency[target].push(source)
  })
  Object.values(adjacency).forEach((neighbors) => neighbors.sort())
  return adjacency
}

function adjacencyToEdges(vertices, adjacency) {
  const seen = new Set()
  const edges = []
  vertices.forEach((vertex) => {
    ;(adjacency[vertex] || []).forEach((neighbor) => {
      const key = [vertex, neighbor].sort().join('::')
      if (!seen.has(key)) {
        seen.add(key)
        edges.push([vertex, neighbor])
      }
    })
  })
  return edges
}

function adjacencyToMatrix(vertices, adjacency) {
  return buildMatrix(vertices, adjacencyToEdges(vertices, adjacency))
}

function weightedEdgesFromState(state) {
  return (state.edges || []).map(([from, to]) => ({
    from,
    to,
    weight: state.weights?.[`${from},${to}`] || state.weights?.[`${to},${from}`] || 1,
  }))
}

function parseGraphInput(raw, fallback = 'A,B,C,D,E | A-B:1,A-C:4,A-D:3,B-D:2,C-D:5,D-E:6') {
  const text = normalizeInput(raw, fallback)
  const [verticesPart, edgesPart] = text.split('|').map((item) => item.trim())
  const vertices = (verticesPart || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const edges = []
  const weights = {}
  ;(edgesPart || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const weightIdx = item.lastIndexOf(':')
      let edgePart = item
      let weight = 1
      if (weightIdx > 0) {
        const maybeWeight = item.slice(weightIdx + 1)
        if (/^\d+$/.test(maybeWeight)) {
          edgePart = item.slice(0, weightIdx)
          weight = Number(maybeWeight)
        }
      }
      const parts = edgePart.split('-').map((p) => p.trim()).filter(Boolean)
      if (parts.length === 2 && parts[0] && parts[1]) {
        edges.push([parts[0], parts[1]])
        const key01 = `${parts[0]},${parts[1]}`
        const key10 = `${parts[1]},${parts[0]}`
        weights[key01] = weight
        weights[key10] = weight
      }
    })
  return vertices.length ? { vertices, edges, weights } : defaultGraphData()
}

function parseMatrixInput(raw, fallback = 'A,B,C,D | 0 1 1 1;1 0 1 0;1 1 0 1;1 0 1 0') {
  const text = normalizeInput(raw, fallback)
  const [verticesPart, matrixPart] = text.split('|').map((item) => item.trim())
  const vertices = (verticesPart || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const matrix = (matrixPart || '')
    .split(';')
    .map((row) =>
      row
        .trim()
        .split(/[\s,，]+/)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item)),
    )
    .filter((row) => row.length)
  if (!vertices.length || !matrix.length) {
    const sample = defaultGraphData()
    return { vertices: sample.vertices, matrix: buildMatrix(sample.vertices, sample.edges) }
  }
  return { vertices, matrix }
}

function parseAdjacencyInput(raw, fallback = 'A:B,C; B:A,D; C:A,D; D:B,C') {
  const text = normalizeInput(raw, fallback)
  const adjacency = {}
  const vertices = []
  text.split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const [vertex, neighborsText] = segment.split(':').map((item) => item.trim())
      if (!vertex) return
      vertices.push(vertex)
      adjacency[vertex] = (neighborsText || '')
        .split(/[,\s，]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    })
  if (!vertices.length) {
    const sample = defaultGraphData()
    return { vertices: sample.vertices, adjacency: buildAdjacency(sample.vertices, sample.edges) }
  }
  return { vertices, adjacency }
}

function createTreeNode(value, left = null, right = null) {
  return { value, label: String(value), left, right }
}

function buildTreeFromLevelOrder(tokens) {
  if (!tokens.length) return null
  const list = tokens.map((item) => String(item).trim())
  if (!list[0] || list[0] === '#' || list[0].toLowerCase() === 'null') return null
  const root = createTreeNode(list[0])
  const queue = [root]
  let index = 1
  while (queue.length && index < list.length) {
    const current = queue.shift()
    const leftValue = list[index]
    index += 1
    if (leftValue && leftValue !== '#' && leftValue.toLowerCase() !== 'null') {
      current.left = createTreeNode(leftValue)
      queue.push(current.left)
    }
    const rightValue = list[index]
    index += 1
    if (rightValue && rightValue !== '#' && rightValue.toLowerCase() !== 'null') {
      current.right = createTreeNode(rightValue)
      queue.push(current.right)
    }
  }
  return root
}

function treeToLevelOrder(root) {
  if (!root) return []
  const result = []
  const queue = [root]
  while (queue.length) {
    const current = queue.shift()
    if (!current) {
      result.push('#')
      continue
    }
    result.push(String(current.value))
    queue.push(current.left || null)
    queue.push(current.right || null)
  }
  while (result[result.length - 1] === '#') result.pop()
  return result
}

function insertIntoBinaryTree(root, value) {
  const node = createTreeNode(value)
  if (!root) return node
  const queue = [root]
  while (queue.length) {
    const current = queue.shift()
    if (!current.left) {
      current.left = node
      return root
    }
    if (!current.right) {
      current.right = node
      return root
    }
    queue.push(current.left, current.right)
  }
  return root
}

function searchBinaryTree(root, target, path = []) {
  if (!root) return null
  const nextPath = [...path, root.value]
  if (String(root.value) === String(target)) return nextPath
  return searchBinaryTree(root.left, target, nextPath) || searchBinaryTree(root.right, target, nextPath)
}

function deleteBinaryTreeValue(root, target) {
  if (!root) return null
  const queue = [root]
  let targetNode = null
  let lastNode = null
  let parent = null
  while (queue.length) {
    const current = queue.shift()
    if (String(current.value) === String(target)) targetNode = current
    if (current.left) {
      parent = current
      lastNode = current.left
      queue.push(current.left)
    }
    if (current.right) {
      parent = current
      lastNode = current.right
      queue.push(current.right)
    }
  }
  if (!targetNode) return root
  if (!lastNode) return null
  targetNode.value = lastNode.value
  targetNode.label = String(lastNode.value)
  if (parent?.left === lastNode) parent.left = null
  if (parent?.right === lastNode) parent.right = null
  return root
}

function insertIntoBst(root, value) {
  if (!root) return createTreeNode(value)
  if (value < root.value) root.left = insertIntoBst(root.left, value)
  else if (value > root.value) root.right = insertIntoBst(root.right, value)
  return root
}

function buildBstFromValues(values) {
  let root = null
  values.forEach((value) => {
    root = insertIntoBst(root, value)
  })
  return root
}

function searchBstPath(root, target, path = []) {
  if (!root) return null
  const nextPath = [...path, root.value]
  if (root.value === target) return nextPath
  if (target < root.value) return searchBstPath(root.left, target, nextPath)
  return searchBstPath(root.right, target, nextPath)
}

function traverseTreePreOrder(root, visit = () => {}) {
  if (!root) return
  visit(root)
  traverseTreePreOrder(root.left, visit)
  traverseTreePreOrder(root.right, visit)
}

function traverseTreeInOrder(root, visit = () => {}) {
  if (!root) return
  traverseTreeInOrder(root.left, visit)
  visit(root)
  traverseTreeInOrder(root.right, visit)
}

function traverseTreePostOrder(root, visit = () => {}) {
  if (!root) return
  traverseTreePostOrder(root.left, visit)
  traverseTreePostOrder(root.right, visit)
  visit(root)
}

function countTreeNodes(root) {
  if (!root) return 0
  return 1 + countTreeNodes(root.left) + countTreeNodes(root.right)
}

function getTreeDepth(root) {
  if (!root) return 0
  return 1 + Math.max(getTreeDepth(root.left), getTreeDepth(root.right))
}

function buildBalancedTree(values) {
  if (!values.length) return null
  const mid = Math.floor(values.length / 2)
  return createTreeNode(values[mid], buildBalancedTree(values.slice(0, mid)), buildBalancedTree(values.slice(mid + 1)))
}

function buildFrequencyMap(text) {
  const map = {}
  String(text || '')
    .split('')
    .filter((char) => char.trim())
    .forEach((char) => {
      map[char] = (map[char] || 0) + 1
    })
  return map
}

function parseCharacterUpdate(raw, fallback = 'a:1') {
  const [charPart, weightPart] = normalizeInput(raw, fallback).split(':').map((item) => item.trim())
  return [charPart?.[0] || 'a', Number.isFinite(Number(weightPart)) ? Number(weightPart) : 1]
}

function parseCharacterWeights(raw, fallback = 'a:5,b:9,c:12,d:13,e:16,f:45') {
  return normalizeInput(raw, fallback)
    .split(/[;,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const [charPart, weightPart] = pair.split(':').map((item) => item.trim())
      const char = charPart?.[0]
      const weight = Number(weightPart)
      if (char && Number.isFinite(weight) && weight > 0) acc[char] = weight
      return acc
    }, {})
}

function buildHuffman(freq) {
  const entries = Object.entries(freq)
  if (!entries.length) return { tree: null, codes: {} }
  let nodes = entries.map(([char, weight]) => ({ value: weight, label: `${char}:${weight}`, char, left: null, right: null }))
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.value - b.value)
    const left = nodes.shift()
    const right = nodes.shift()
    nodes.push({ value: left.value + right.value, label: `${left.value + right.value}`, left, right })
  }
  const tree = nodes[0]
  const codes = {}
  const walk = (node, prefix) => {
    if (!node) return
    if (node.char) {
      codes[node.char] = prefix || '0'
      return
    }
    walk(node.left, `${prefix}0`)
    walk(node.right, `${prefix}1`)
  }
  walk(tree, '')
  return { tree, codes }
}

function heapifyDown(heap, index) {
  let current = index
  while (true) {
    const left = current * 2 + 1
    const right = current * 2 + 2
    let largest = current
    if (left < heap.length && heap[left] > heap[largest]) largest = left
    if (right < heap.length && heap[right] > heap[largest]) largest = right
    if (largest === current) break
    ;[heap[current], heap[largest]] = [heap[largest], heap[current]]
    current = largest
  }
}

function heapifyUp(heap, index) {
  let current = index
  while (current > 0) {
    const parent = Math.floor((current - 1) / 2)
    if (heap[parent] >= heap[current]) break
    ;[heap[parent], heap[current]] = [heap[current], heap[parent]]
    current = parent
  }
}

function buildMaxHeap(values) {
  const heap = [...values]
  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) {
    heapifyDown(heap, index)
  }
  return heap
}

function buildTreeFromHeap(items) {
  const walk = (index) => {
    if (index >= items.length) return null
    return createTreeNode(items[index], walk(index * 2 + 1), walk(index * 2 + 2))
  }
  return walk(0)
}

function priorityNodeLabel(item) {
  if (!item) return ''
  return `${item.value}:${item.priority}`
}

function priorityHigher(a, b) {
  if (!a) return false
  if (!b) return true
  if (a.priority !== b.priority) return a.priority > b.priority
  return String(a.value) < String(b.value)
}

function priorityHeapifyUp(items, index) {
  let cursor = index
  while (cursor > 0) {
    const parent = Math.floor((cursor - 1) / 2)
    if (!priorityHigher(items[cursor], items[parent])) break
    ;[items[cursor], items[parent]] = [items[parent], items[cursor]]
    cursor = parent
  }
}

function priorityHeapifyDown(items, index, limit = items.length) {
  let cursor = index
  while (true) {
    const left = cursor * 2 + 1
    const right = cursor * 2 + 2
    let largest = cursor
    if (left < limit && priorityHigher(items[left], items[largest])) largest = left
    if (right < limit && priorityHigher(items[right], items[largest])) largest = right
    if (largest === cursor) break
    ;[items[cursor], items[largest]] = [items[largest], items[cursor]]
    cursor = largest
  }
}

function buildPriorityTree(items) {
  const walk = (index) => {
    const item = items[index]
    if (!item) return null
    return {
      value: item.priority,
      label: priorityNodeLabel(item),
      left: walk(index * 2 + 1),
      right: walk(index * 2 + 2),
    }
  }
  return walk(0)
}

function syncPriorityVisualState(state) {
  state.meta = { ...(state.meta || {}), heapSize: state.items.length }
  state.tree = buildPriorityTree(state.items)
}

function syncHeapVisualState(state, heapSize = null) {
  const size = heapSize == null ? (state.meta?.heapSize ?? state.items.length) : heapSize
  state.meta = { ...(state.meta || {}), heapSize: Math.max(0, size) }
  state.tree = buildTreeFromHeap(state.items.slice(0, state.meta.heapSize))
}

function ensureSeqState(state, capacity = 8) {
  if (state?.capacity) return { destroyed: false, ...clone(state) }
  return { items: [], capacity, destroyed: false, meta: {} }
}

function ensureCircularQueueState(state, capacity = 8) {
  if (state?.slots?.length) return { destroyed: false, ...clone(state) }
  return { items: [], slots: Array(capacity).fill(null), front: -1, rear: -1, size: 0, capacity, destroyed: false, meta: {} }
}

function ensurePriorityState(state, capacity = 8) {
  if (state?.capacity) {
    const next = { destroyed: false, ...clone(state) }
    syncPriorityVisualState(next)
    return next
  }
  const next = { items: [], capacity, destroyed: false, tree: null, meta: { heapSize: 0 } }
  syncPriorityVisualState(next)
  return next
}

function applyGraphData(state, graphData) {
  state.vertices = [...graphData.vertices]
  state.edges = graphData.edges.map(([from, to]) => [from, to])
  state.weights = { ...(graphData.weights || {}) }
  state.matrix = buildMatrix(state.vertices, state.edges, state.weights)
  state.adjacency = buildAdjacency(state.vertices, state.edges)
}

function createRandomGraphData(vertexCount = 5, weighted = true) {
  const count = Math.max(3, Math.min(Number(vertexCount) || 5, 8))
  const vertices = Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index))
  const edgeSet = new Set()
  const edges = []
  const weights = {}
  const addEdge = (from, to) => {
    const key = [from, to].sort().join('::')
    if (from === to || edgeSet.has(key)) return false
    edgeSet.add(key)
    edges.push([from, to])
    const weight = weighted ? Math.floor(Math.random() * 9) + 1 : 1
    weights[`${from},${to}`] = weight
    weights[`${to},${from}`] = weight
    return true
  }
  for (let index = 1; index < count; index += 1) {
    const from = vertices[Math.floor(Math.random() * index)]
    addEdge(from, vertices[index])
  }
  const extraBudget = Math.max(1, count - 2)
  for (let step = 0; step < extraBudget; step += 1) {
    const from = vertices[Math.floor(Math.random() * count)]
    const to = vertices[Math.floor(Math.random() * count)]
    addEdge(from, to)
  }
  return { vertices, edges, weights }
}

function ensureSharedStackState(state) {
  if (state?.capacity) return { destroyed: false, ...clone(state) }
  return { stack1: [], stack2: [], capacity: 10, destroyed: false, meta: {} }
}

function ensureSharedStackQueueState(state) {
  return state?.capacity ? clone(state) : { stack: [], queue: [], capacity: 12, meta: {} }
}

function ensureGraphState(state) {
  if (state?.vertices?.length) return clone(state)
  const sample = defaultGraphData()
  return {
    vertices: sample.vertices,
    edges: sample.edges,
    weights: sample.weights,
    matrix: buildMatrix(sample.vertices, sample.edges, sample.weights),
    adjacency: buildAdjacency(sample.vertices, sample.edges),
    meta: {},
  }
}

function ensureLinearListState(state) {
  if (Array.isArray(state?.items)) return clone(state)
  return { items: [], capacity: 10, meta: {} }
}

function ensureSingleLinkedListState(state) {
  return Array.isArray(state?.items) ? clone(state) : { items: [], meta: {} }
}

function ensureBinaryTreeState(state) {
  return state?.tree || state?.sequence ? clone(state) : { sequence: [], tree: null, meta: {} }
}

function ensureTreeValuesState(state) {
  return state?.values ? clone(state) : { values: [], tree: null, meta: {} }
}

function ensureHuffmanState(state) {
  return state?.freq ? clone(state) : { freq: {}, codes: {}, tree: null, meta: {} }
}

function ensureHeapState(state) {
  if (state?.items) {
    const next = clone(state)
    next.meta = { ...(next.meta || {}), heapSize: next.meta?.heapSize ?? next.items.length }
    return next
  }
  return { items: [], capacity: 10, tree: null, meta: { heapSize: 0 } }
}

function guardDestroyedStructure(state, tracer, actionKey, initKeys = ['init']) {
  if (!state.destroyed || initKeys.includes(actionKey)) return false
  tracer.addBlock('结构已被销毁，当前操作被拦截', [1, 3], {
    result: '结构已被销毁，请先初始化',
  })
  return true
}

function createInitialState(pageKey) {
  switch (pageKey) {
    case 'seq-stack':
      return ensureSeqState(null)
    case 'circular-queue':
      return ensureCircularQueueState(null)
    case 'priority-queue':
      return ensurePriorityState(null)
    case 'shared-stack':
      return ensureSharedStackState(null)
    case 'shared-stack-queue':
      return ensureSharedStackQueueState(null)
    case 'graph-matrix':
    case 'graph-list':
    case 'graph-traversal':
    case 'graph-mst':
      return ensureGraphState(null)
    case 'linear-list':
    case 'linear-list-basic':
    case 'linear-list-sort':
    case 'linear-list-sort-bubble':
    case 'linear-list-sort-selection':
    case 'linear-list-sort-insertion':
    case 'linear-list-sort-quick':
    case 'linear-list-sort-heap':
    case 'linear-list-sort-shell':
    case 'linear-list-search-sequential':
    case 'linear-list-search-reverse':
    case 'linear-list-search-binary':
      return ensureLinearListState(null)
    case 'singly-linked-list':
    case 'singly-linked-list-head':
    case 'doubly-linked-list':
    case 'circular-linked-list':
      return ensureSingleLinkedListState(null)
    case 'binary-tree':
      return ensureBinaryTreeState(null)
    case 'bst':
    case 'avl':
      return ensureTreeValuesState(null)
    case 'huffman':
      return ensureHuffmanState(null)
    case 'heap':
      return ensureHeapState(null)
    default:
      return { meta: {} }
  }
}
function runSeqStack(action, rawInput, currentState, capacityInput) {
  const state = ensureSeqState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)

  if (guardDestroyedStructure(state, tracer, action.key)) {
    return { state, traces: tracer.done() }
  }

  switch (action.key) {
    case 'init': {
      state.destroyed = false
      state.capacity = Math.max(1, Math.min(Number(capacityInput) || state.capacity || 8, 30))
      const values = ensureLimit(parseNumberList(input, action.defaultInput), state.capacity)
      state.items = []
      tracer.addBlock('读取初始化序列并创建顺序栈', [1, 4], { result: `准备装入 ${values.length} 个元素`, markers: makeStackMarker(-1) })
      values.forEach((value, index) => {
        state.items.push(value)
        tracer.addBlock(`将元素 ${value} 压入顺序栈`, [6, 7], {
          result: `初始化进度 ${index + 1} / ${values.length}`,
          highlightIndices: [state.items.length - 1],
          markers: makeStackMarker(state.items.length - 1),
        })
      })
      tracer.addBlock('顺序栈初始化完成', [8, 9], {
        result: `当前共有 ${state.items.length} 个元素`,
        highlightIndices: state.items.length ? [state.items.length - 1] : [],
        markers: makeStackMarker(state.items.length - 1),
      })
      break
    }
    case 'destroy':
      state.destroyed = true
      state.items = []
      tracer.addBlock('顺序栈已销毁', [1, 3], { result: '栈空间已重置为空', markers: makeStackMarker(-1) })
      break
    case 'push': {
      const value = parseSingleNumber(input, state.items.length + 1)
      tracer.addBlock('检查顺序栈是否已满', [1, 3], { result: `当前容量 ${state.items.length} / ${state.capacity}`, markers: makeStackMarker(state.items.length - 1) })
      if (state.items.length >= state.capacity) {
        tracer.addBlock('顺序栈已满，入栈失败', [4, 5], { result: '栈满，无法继续入栈', markers: makeStackMarker(state.items.length - 1) })
      } else {
        tracer.addBlock(`为元素 ${value} 预留新的栈顶位置`, [4, 5], {
          result: `即将在下标 ${state.items.length} 处压栈`,
          highlightIndices: state.items.length ? [state.items.length - 1] : [],
          markers: makeStackMarker(state.items.length - 1),
        })
        state.items.push(value)
        tracer.addBlock(`元素 ${value} 入栈成功`, [6, 7], {
          result: `栈顶变为 ${value}`,
          highlightIndices: [state.items.length - 1],
          markers: makeStackMarker(state.items.length - 1),
        })
      }
      break
    }
    case 'pop': {
      tracer.addBlock('检查顺序栈是否为空', [1, 3], { result: `当前元素个数 ${state.items.length}`, markers: makeStackMarker(state.items.length - 1) })
      if (!state.items.length) {
        tracer.addBlock('顺序栈为空，无法出栈', [4, 5], { result: '栈空', markers: makeStackMarker(-1) })
      } else {
        tracer.addBlock(`定位到栈顶元素 ${state.items[state.items.length - 1]}`, [4, 5], {
          result: '准备执行出栈',
          highlightIndices: [state.items.length - 1],
        })
        const removed = state.items.pop()
        tracer.addBlock(`元素 ${removed} 已出栈`, [6, 7], {
          result: `出栈元素为 ${removed}`,
          last: removed,
          highlightIndices: state.items.length ? [state.items.length - 1] : [],
          markers: makeStackMarker(state.items.length - 1),
        })
      }
      break
    }
    case 'peek':
      tracer.addBlock('读取栈顶元素', [1, 3], { result: '准备访问栈顶', markers: makeStackMarker(state.items.length - 1) })
      tracer.addBlock('返回当前栈顶元素', [4, 5], {
        result: state.items.length ? `栈顶元素为 ${state.items[state.items.length - 1]}` : '当前栈为空',
        highlightIndices: state.items.length ? [state.items.length - 1] : [],
        markers: makeStackMarker(state.items.length - 1),
      })
      break
    case 'is-empty':
      tracer.addBlock('判断顺序栈是否为空', [1, 3], { result: '比较元素个数与 0', markers: makeStackMarker(state.items.length - 1) })
      tracer.addBlock('得到栈空判断结果', [4, 5], {
        flag: state.items.length === 0,
        result: state.items.length === 0 ? '栈为空' : '栈非空',
        markers: makeStackMarker(state.items.length - 1),
      })
      break
    case 'is-full':
      tracer.addBlock('判断顺序栈是否已满', [1, 3], { result: `比较 ${state.items.length} 与容量 ${state.capacity}`, markers: makeStackMarker(state.items.length - 1) })
      tracer.addBlock('得到栈满判断结果', [4, 5], {
        flag: state.items.length >= state.capacity,
        result: state.items.length >= state.capacity ? '栈已满' : '栈未满',
        markers: makeStackMarker(state.items.length - 1),
      })
      break
    case 'traverse': {
      const order = [...state.items].reverse()
      tracer.addBlock('从栈顶到栈底遍历所有元素', [1, 3], { result: `待遍历元素个数 ${order.length}`, markers: makeStackMarker(state.items.length - 1) })
      order.forEach((value, index) => {
        const actualIndex = state.items.length - 1 - index
        tracer.addBlock(`访问第 ${index + 1} 个栈元素 ${value}`, [4, 5], {
          output: order.slice(0, index + 1),
          result: `当前输出：${order.slice(0, index + 1).join(' -> ')}`,
          highlightIndices: [actualIndex],
          markers: makeStackMarker(actualIndex),
        })
      })
      tracer.addBlock('顺序栈遍历结束', [6, 7], {
        output: order,
        result: order.length ? `遍历结果：${order.join(' -> ')}` : '当前栈为空',
        markers: makeStackMarker(state.items.length - 1),
      })
      break
    }
    case 'clear':
      state.destroyed = false
      tracer.addBlock('开始清空顺序栈', [1, 3], { result: `当前共有 ${state.items.length} 个元素待删除`, markers: makeStackMarker(state.items.length - 1) })
      while (state.items.length) {
        tracer.addBlock(`准备移除栈顶元素 ${state.items[state.items.length - 1]}`, [4, 5], {
          highlightIndices: [state.items.length - 1],
          result: '正在逐个清空栈元素',
          markers: makeStackMarker(state.items.length - 1),
        })
        state.items.pop()
      }
      tracer.addBlock('顺序栈已清空', [6, 7], { result: '所有元素已移除', markers: makeStackMarker(-1) })
      break
    default:
      tracer.add('未实现的顺序栈操作', 1)
  }

  return { state, traces: tracer.done() }
}
function circularQueueValues(state) {
  if (!state.size || state.front < 0) return []
  return Array.from({ length: state.size }, (_, offset) => state.slots[(state.front + offset) % state.capacity])
}

function syncCircularQueueState(state) {
  state.items = circularQueueValues(state)
}

function circularQueueMeta(state, extra = {}) {
  return {
    markers: { front: state.front, rear: state.rear },
    pointers: makeQueuePointers(state.front, state.rear),
    ...extra,
  }
}

function runSeqQueue(action, rawInput, currentState, capacityInput) {
  const state = ensureCircularQueueState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)

  const resetQueue = (capacity = state.capacity) => {
    state.capacity = capacity
    state.slots = Array(capacity).fill(null)
    state.front = -1
    state.rear = -1
    state.size = 0
    state.items = []
  }

  if (guardDestroyedStructure(state, tracer, action.key)) {
    return { state, traces: tracer.done() }
  }

  switch (action.key) {
    case 'init': {
      state.destroyed = false
      const capacity = Math.max(1, Math.min(Number(capacityInput) || state.capacity || 8, 30))
      const values = ensureLimit(parseNumberList(input, action.defaultInput), capacity)
      resetQueue(capacity)
      tracer.addBlock('读取初始化序列并创建循环队列', [1, 4], {
        result: `准备入队 ${values.length} 个元素`,
        ...circularQueueMeta(state),
      })
      values.forEach((value, index) => {
        const nextRear = state.size === 0 ? 0 : (state.rear + 1) % state.capacity
        state.rear = nextRear
        state.slots[nextRear] = value
        if (state.front === -1) state.front = nextRear
        state.size += 1
        syncCircularQueueState(state)
        tracer.addBlock(`元素 ${value} 进入队尾槽位 ${nextRear}`, [6, 7], {
          result: `初始化进度 ${index + 1} / ${values.length}`,
          highlightIndices: [nextRear],
          ...circularQueueMeta(state),
        })
      })
      tracer.addBlock('循环队列初始化完成', [8, 9], {
        result: `队列长度为 ${state.size}`,
        highlightIndices: state.size ? [state.front, state.rear] : [],
        ...circularQueueMeta(state),
      })
      break
    }
    case 'destroy':
      state.destroyed = true
      resetQueue(Math.max(1, Math.min(Number(capacityInput) || state.capacity || 8, 30)))
      tracer.addBlock('循环队列已销毁', [1, 3], {
        result: '队列空间已重置为空',
        ...circularQueueMeta(state),
      })
      break
    case 'enqueue': {
      const value = parseSingleNumber(input, state.size + 1)
      const nextRear = state.size === 0 ? 0 : (state.rear + 1) % state.capacity
      tracer.addBlock('检查循环队列是否已满', [1, 3], {
        result: `当前容量 ${state.size} / ${state.capacity}`,
        highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
        ...circularQueueMeta(state),
      })
      if (state.size >= state.capacity) {
        tracer.addBlock('循环队列已满，发生假溢出保护，入队失败', [4, 5], {
          result: `队满，rear 下一位置 ${(state.rear + 1) % state.capacity} 会撞上 front ${state.front}`,
          highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
          ...circularQueueMeta(state),
        })
      } else {
        tracer.addBlock(`元素 ${value} 准备进入队尾槽位 ${nextRear}`, [4, 5], {
          result: state.size && nextRear < state.rear ? 'rear 指针回绕到环形起点' : `即将写入下标 ${nextRear}`,
          highlightIndices: [nextRear],
          ...circularQueueMeta(state),
        })
        state.rear = nextRear
        state.slots[nextRear] = value
        if (state.front === -1) state.front = nextRear
        state.size += 1
        syncCircularQueueState(state)
        tracer.addBlock(`元素 ${value} 入队成功`, [6, 7], {
          result: `rear 指针移动到 ${state.rear}，队尾变为 ${value}`,
          highlightIndices: [state.rear],
          ...circularQueueMeta(state),
        })
      }
      break
    }
    case 'dequeue': {
      tracer.addBlock('检查循环队列是否为空', [1, 3], {
        result: `当前元素个数 ${state.size}`,
        highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
        ...circularQueueMeta(state),
      })
      if (!state.size) {
        tracer.addBlock('循环队列为空，无法出队', [4, 5], {
          result: '队空',
          ...circularQueueMeta(state),
        })
      } else {
        const removeIndex = state.front
        const removed = state.slots[removeIndex]
        tracer.addBlock(`定位到队头元素 ${removed}`, [4, 5], {
          result: '准备执行出队',
          highlightIndices: [removeIndex],
          ...circularQueueMeta(state),
        })
        state.slots[removeIndex] = null
        if (state.size === 1) {
          state.front = -1
          state.rear = -1
          state.size = 0
        } else {
          state.front = (state.front + 1) % state.capacity
          state.size -= 1
        }
        syncCircularQueueState(state)
        tracer.addBlock(`元素 ${removed} 出队成功`, [6, 7], {
          result: state.size ? `front 指针移动到 ${state.front}，出队元素为 ${removed}` : `队列已空，出队元素为 ${removed}`,
          last: removed,
          highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
          ...circularQueueMeta(state),
        })
      }
      break
    }
    case 'front':
    case 'rear': {
      const targetIndex = action.key === 'rear' ? state.rear : state.front
      const targetValue = targetIndex >= 0 ? state.slots[targetIndex] : null
      tracer.addBlock(action.key === 'rear' ? '读取队尾元素' : '读取队头元素', [1, 3], {
        result: action.key === 'rear' ? '准备访问队尾' : '准备访问队头',
        highlightIndices: targetIndex >= 0 ? [targetIndex] : [],
        ...circularQueueMeta(state),
      })
      tracer.addBlock(action.key === 'rear' ? '返回当前队尾元素' : '返回当前队头元素', [4, 5], {
        result: targetValue == null ? '当前队列为空' : action.key === 'rear' ? `队尾元素为 ${targetValue}` : `队头元素为 ${targetValue}`,
        highlightIndices: targetIndex >= 0 ? [targetIndex] : [],
        ...circularQueueMeta(state),
      })
      break
    }
    case 'is-empty':
      tracer.addBlock('判断队列是否为空', [1, 3], {
        result: '比较 size 与 0',
        ...circularQueueMeta(state),
      })
      tracer.addBlock('得到队空判断结果', [4, 5], {
        flag: state.size === 0,
        result: state.size === 0 ? '队列为空' : '队列非空',
        ...circularQueueMeta(state),
      })
      break
    case 'is-full':
      tracer.addBlock('判断队列是否已满', [1, 3], {
        result: `比较 size=${state.size} 与 capacity=${state.capacity}`,
        highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
        ...circularQueueMeta(state),
      })
      tracer.addBlock('得到队满判断结果', [4, 5], {
        flag: state.size >= state.capacity,
        result: state.size >= state.capacity ? '队列已满' : '队列未满',
        highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
        ...circularQueueMeta(state),
      })
      break
    case 'traverse': {
      const values = circularQueueValues(state)
      tracer.addBlock('从队头到队尾遍历所有元素', [1, 3], {
        result: `待遍历元素个数 ${values.length}`,
        ...circularQueueMeta(state),
      })
      values.forEach((value, offset) => {
        const slotIndex = (state.front + offset) % state.capacity
        tracer.addBlock(`访问第 ${offset + 1} 个队列元素 ${value}`, [4, 5], {
          output: values.slice(0, offset + 1),
          result: `当前输出：${values.slice(0, offset + 1).join(' -> ')}`,
          highlightIndices: [slotIndex],
          ...circularQueueMeta(state),
        })
      })
      tracer.addBlock('循环队列遍历结束', [6, 7], {
        output: values,
        result: values.length ? `遍历结果：${values.join(' -> ')}` : '当前队列为空',
        highlightIndices: [state.front, state.rear].filter((index) => index >= 0),
        ...circularQueueMeta(state),
      })
      break
    }
    case 'clear':
      state.destroyed = false
      tracer.addBlock('开始清空循环队列', [1, 3], {
        result: `当前共有 ${state.size} 个元素待删除`,
        ...circularQueueMeta(state),
      })
      while (state.size) {
        const removeIndex = state.front
        tracer.addBlock(`准备移除队头槽位 ${removeIndex} 的元素 ${state.slots[removeIndex]}`, [4, 5], {
          highlightIndices: [removeIndex],
          result: '正在逐个清空队列元素',
          ...circularQueueMeta(state),
        })
        state.slots[removeIndex] = null
        if (state.size === 1) {
          state.front = -1
          state.rear = -1
          state.size = 0
        } else {
          state.front = (state.front + 1) % state.capacity
          state.size -= 1
        }
      }
      syncCircularQueueState(state)
      tracer.addBlock('循环队列已清空', [6, 7], {
        result: '所有元素已移除',
        ...circularQueueMeta(state),
      })
      break
    default:
      tracer.add('未实现的循环队列操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runPriorityQueue(action, rawInput, currentState, capacityInput) {
  const state = ensurePriorityState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)
  state.meta = { ...(state.meta || {}), actionKey: action.key }

  const queueMeta = (extra = {}) => ({
    markers: { front: state.items.length ? 0 : -1, rear: state.items.length ? state.items.length - 1 : -1 },
    pointers: makeQueuePointers(state.items.length ? 0 : -1, state.items.length ? state.items.length - 1 : -1),
    highlightNodes: (extra.highlightIndices || []).map((index) => priorityNodeLabel(state.items[index])).filter(Boolean),
    ...extra,
  })

  if (guardDestroyedStructure(state, tracer, action.key)) {
    return { state, traces: tracer.done() }
  }

  switch (action.key) {
    case 'init': {
      state.destroyed = false
      state.capacity = Math.max(1, Math.min(Number(capacityInput) || state.capacity || 8, 30))
      const values = ensureLimit(parsePriorityItems(input, action.defaultInput), state.capacity)
      state.items = []
      syncPriorityVisualState(state)
      tracer.addBlock('读取带优先级的输入序列并建立空堆', [1, 3], queueMeta({ result: `准备插入 ${values.length} 个元素` }))
      values.forEach((item, index) => {
        state.items.push(item)
        tracer.addBlock(`元素 ${priorityNodeLabel(item)} 先放到堆尾`, [4, 5], queueMeta({
          result: `初始化进度 ${index + 1} / ${values.length}`,
          highlightIndices: [state.items.length - 1],
        }))
        priorityHeapifyUp(state.items, state.items.length - 1)
        syncPriorityVisualState(state)
        tracer.addBlock('执行上滤，维护大顶堆顺序', [6, 7], queueMeta({
          result: `当前堆顶为 ${priorityNodeLabel(state.items[0])}`,
          highlightIndices: [0],
        }))
      })
      tracer.addBlock('优先队列初始化完成', [8, 9], queueMeta({
        result: state.items.length ? `堆顶元素为 ${priorityNodeLabel(state.items[0])}` : '当前队列为空',
        highlightIndices: state.items.length ? [0] : [],
      }))
      break
    }
    case 'destroy':
      state.destroyed = true
      state.items = []
      syncPriorityVisualState(state)
      tracer.addBlock('优先队列已销毁', [1, 3], queueMeta({ result: '堆空间已重置为空' }))
      break
    case 'enqueue': {
      const item = parsePriorityItems(input, action.defaultInput)[0] || { value: 'X', priority: 1 }
      tracer.addBlock('检查优先队列是否已满', [1, 3], queueMeta({ result: `当前容量 ${state.items.length} / ${state.capacity}` }))
      if (state.items.length >= state.capacity) {
        tracer.addBlock('优先队列已满，入队失败', [4, 5], queueMeta({ result: '队满' }))
      } else {
        state.items.push(item)
        tracer.addBlock(`元素 ${priorityNodeLabel(item)} 追加到堆尾`, [4, 5], queueMeta({
          result: '准备执行上滤',
          highlightIndices: [state.items.length - 1],
        }))
        priorityHeapifyUp(state.items, state.items.length - 1)
        syncPriorityVisualState(state)
        tracer.addBlock('上滤完成，优先队列恢复为大顶堆', [6, 7], queueMeta({
          result: `当前堆顶为 ${priorityNodeLabel(state.items[0])}`,
          highlightIndices: [0],
        }))
      }
      break
    }
    case 'dequeue': {
      tracer.addBlock('定位堆顶元素并准备出队', [1, 3], queueMeta({
        result: state.items.length ? `当前堆顶为 ${priorityNodeLabel(state.items[0])}` : '当前队列为空',
        highlightIndices: state.items.length ? [0] : [],
      }))
      if (!state.items.length) {
        tracer.addBlock('优先队列为空，无法出队', [4, 5], queueMeta({ result: '当前队列为空' }))
      } else {
        const removed = state.items[0]
        const tailIndex = state.items.length - 1
        tracer.addBlock(`交换堆顶 ${priorityNodeLabel(removed)} 与堆尾元素`, [4, 5], queueMeta({
          result: tailIndex > 0 ? `将下标 0 与下标 ${tailIndex} 交换` : '队列只有一个元素，直接删除',
          highlightIndices: tailIndex > 0 ? [0, tailIndex] : [0],
        }))
        ;[state.items[0], state.items[tailIndex]] = [state.items[tailIndex], state.items[0]]
        const last = state.items.pop()
        syncPriorityVisualState(state)
        tracer.addBlock(`移除原堆顶元素 ${priorityNodeLabel(last)}`, [6, 7], queueMeta({
          result: state.items.length ? '准备对新的堆顶执行下滤' : `出队后队列为空，移除元素为 ${priorityNodeLabel(last)}`,
          last,
          highlightIndices: state.items.length ? [0] : [],
        }))
        if (state.items.length) {
          priorityHeapifyDown(state.items, 0)
          syncPriorityVisualState(state)
          tracer.addBlock('下滤完成，优先队列重新满足大顶堆', [8, 9], queueMeta({
            result: `出队元素为 ${priorityNodeLabel(last)}，新堆顶为 ${priorityNodeLabel(state.items[0])}`,
            last,
            highlightIndices: [0],
          }))
        }
      }
      break
    }
    case 'front':
      tracer.addBlock('读取优先队列堆顶元素', [1, 3], queueMeta({ result: '准备查看最高优先级元素' }))
      tracer.addBlock('返回当前堆顶元素', [4, 5], queueMeta({
        result: state.items.length ? `最高优先级元素为 ${priorityNodeLabel(state.items[0])}` : '当前队列为空',
        highlightIndices: state.items.length ? [0] : [],
      }))
      break
    case 'is-empty':
      tracer.addBlock('判断优先队列是否为空', [1, 3], queueMeta({ result: '比较元素个数与 0' }))
      tracer.addBlock('得到队空判断结果', [4, 5], queueMeta({
        flag: state.items.length === 0,
        result: state.items.length === 0 ? '队列为空' : '队列非空',
      }))
      break
    case 'is-full':
      tracer.addBlock('判断优先队列是否已满', [1, 3], queueMeta({ result: `比较 ${state.items.length} 与容量 ${state.capacity}` }))
      tracer.addBlock('得到队满判断结果', [4, 5], queueMeta({
        flag: state.items.length >= state.capacity,
        result: state.items.length >= state.capacity ? '队列已满' : '队列未满',
      }))
      break
    case 'traverse': {
      tracer.addBlock('按堆数组顺序遍历优先队列', [1, 3], queueMeta({ result: `待遍历元素个数 ${state.items.length}` }))
      state.items.forEach((item, index) => {
        tracer.addBlock(`输出第 ${index + 1} 个结点 ${priorityNodeLabel(item)}`, [4, 5], queueMeta({
          output: state.items.slice(0, index + 1).map((entry) => `${entry.value}:${entry.priority}`),
          result: `当前输出：${state.items.slice(0, index + 1).map((entry) => `${entry.value}:${entry.priority}`).join(' | ')}`,
          highlightIndices: [index],
        }))
      })
      tracer.addBlock('优先队列遍历结束', [6, 7], queueMeta({
        output: state.items.map((item) => `${item.value}:${item.priority}`),
        result: state.items.length ? state.items.map((item) => `${item.value}:${item.priority}`).join(' | ') : '当前队列为空',
        highlightIndices: state.items.length ? [0] : [],
      }))
      break
    }
    case 'clear':
      state.destroyed = false
      tracer.addBlock('开始清空优先队列', [1, 3], queueMeta({ result: `当前共有 ${state.items.length} 个元素待删除` }))
      while (state.items.length) {
        tracer.addBlock(`准备移除堆顶元素 ${priorityNodeLabel(state.items[0])}`, [4, 5], queueMeta({
          result: '按堆顶优先规则逐个清空元素',
          highlightIndices: [0],
        }))
        const tailIndex = state.items.length - 1
        ;[state.items[0], state.items[tailIndex]] = [state.items[tailIndex], state.items[0]]
        state.items.pop()
        if (state.items.length) priorityHeapifyDown(state.items, 0)
        syncPriorityVisualState(state)
      }
      syncPriorityVisualState(state)
      tracer.addBlock('优先队列已清空', [6, 7], queueMeta({ result: '所有元素已移除' }))
      break
    default:
      tracer.add('未实现的优先队列操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runSharedStack(action, rawInput, currentState, capacityInput) {
  const state = ensureSharedStackState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)
  const total = () => state.stack1.length + state.stack2.length

  if (guardDestroyedStructure(state, tracer, action.key)) {
    return { state, traces: tracer.done() }
  }

  switch (action.key) {
    case 'init':
      state.destroyed = false
      state.capacity = Math.max(1, Math.min(Number(capacityInput) || state.capacity || 10, 30))
      state.stack1 = []
      state.stack2 = []
      tracer.addBlock('共享栈空间初始化完成', [1, 3], { result: `可用容量为 ${state.capacity}`, ...makeSharedStackMeta(state) })
      break
    case 'destroy':
      state.destroyed = true
      state.stack1 = []
      state.stack2 = []
      tracer.addBlock('共享栈已销毁', [1, 3], { result: '双栈空间已重置为空', ...makeSharedStackMeta(state) })
      break
    case 'push-1': {
      const value = parseSingleNumber(input, 1)
      tracer.addBlock('检查共享栈剩余空间', [1, 3], { result: `已占用 ${total()} / ${state.capacity}`, ...makeSharedStackMeta(state) })
      if (total() >= state.capacity) tracer.addBlock('共享栈空间已满', [4, 5], { result: '共享栈满', ...makeSharedStackMeta(state) })
      else {
        state.stack1.push(value)
        tracer.addBlock(`栈1 压入 ${value}`, [4, 5], { result: `栈1 栈顶为 ${value}`, highlightIndices: [state.stack1.length - 1], ...makeSharedStackMeta(state) })
      }
      break
    }
    case 'push-2': {
      const value = parseSingleNumber(input, 99)
      tracer.addBlock('检查共享栈剩余空间', [1, 3], { result: `已占用 ${total()} / ${state.capacity}`, ...makeSharedStackMeta(state) })
      if (total() >= state.capacity) tracer.addBlock('共享栈空间已满', [4, 5], { result: '共享栈满', ...makeSharedStackMeta(state) })
      else {
        state.stack2.push(value)
        tracer.addBlock(`栈2 压入 ${value}`, [4, 5], { result: `栈2 栈顶为 ${value}`, highlightIndices: [state.capacity - state.stack2.length], ...makeSharedStackMeta(state) })
      }
      break
    }
    case 'pop-1': {
      if (!state.stack1.length) tracer.addBlock('执行栈1出栈', [1, 3], { result: '栈1 为空', ...makeSharedStackMeta(state) })
      else {
        tracer.addBlock(`定位到栈1栈顶元素 ${state.stack1[state.stack1.length - 1]}`, [1, 3], { result: '准备执行出栈', highlightIndices: [state.stack1.length - 1], ...makeSharedStackMeta(state) })
        const removed = state.stack1.pop()
        tracer.addBlock('执行栈1出栈', [1, 3], { result: `栈1 出栈元素为 ${removed}`, last: removed, highlightIndices: state.stack1.length ? [state.stack1.length - 1] : [], ...makeSharedStackMeta(state) })
      }
      break
    }
    case 'pop-2': {
      if (!state.stack2.length) tracer.addBlock('执行栈2出栈', [1, 3], { result: '栈2 为空', ...makeSharedStackMeta(state) })
      else {
        tracer.addBlock(`定位到栈2栈顶元素 ${state.stack2[state.stack2.length - 1]}`, [1, 3], { result: '准备执行出栈', highlightIndices: [state.capacity - state.stack2.length], ...makeSharedStackMeta(state) })
        const removed = state.stack2.pop()
        tracer.addBlock('执行栈2出栈', [1, 3], { result: `栈2 出栈元素为 ${removed}`, last: removed, highlightIndices: state.stack2.length ? [state.capacity - state.stack2.length] : [], ...makeSharedStackMeta(state) })
      }
      break
    }
    case 'peek-1':
      tracer.addBlock('读取栈1栈顶元素', [1, 3], { result: state.stack1.length ? `栈1 栈顶为 ${state.stack1[state.stack1.length - 1]}` : '栈1 为空', ...makeSharedStackMeta(state), highlightIndices: state.stack1.length ? [state.stack1.length - 1] : [] })
      break
    case 'peek-2':
      tracer.addBlock('读取栈2栈顶元素', [1, 3], { result: state.stack2.length ? `栈2 栈顶为 ${state.stack2[state.stack2.length - 1]}` : '栈2 为空', ...makeSharedStackMeta(state), highlightIndices: state.stack2.length ? [state.capacity - state.stack2.length] : [] })
      break
    case 'is-empty-1':
      tracer.addBlock('判断栈1是否为空', [1, 3], { flag: state.stack1.length === 0, result: state.stack1.length === 0 ? '栈1 为空' : '栈1 非空', ...makeSharedStackMeta(state) })
      break
    case 'is-empty-2':
      tracer.addBlock('判断栈2是否为空', [1, 3], { flag: state.stack2.length === 0, result: state.stack2.length === 0 ? '栈2 为空' : '栈2 非空', ...makeSharedStackMeta(state) })
      break
    case 'is-full':
      tracer.addBlock('判断共享栈空间是否已满', [1, 3], { flag: total() >= state.capacity, result: total() >= state.capacity ? '共享栈已满' : `剩余 ${state.capacity - total()} 个单元`, ...makeSharedStackMeta(state) })
      break
    case 'traverse':
      tracer.addBlock('从两个栈顶开始遍历共栈', [1, 3], {
        result: `左栈元素 ${state.stack1.length} 个，右栈元素 ${state.stack2.length} 个`,
        ...makeSharedStackMeta(state),
      })
      for (let index = state.stack1.length - 1, step = 1; index >= 0; index -= 1, step += 1) {
        tracer.addBlock(`访问左栈第 ${step} 个元素 ${state.stack1[index]}`, [4, 5], {
          result: '左栈按栈顶到栈底输出',
          output: state.stack1.slice(index).reverse(),
          highlightIndices: [index],
          ...makeSharedStackMeta(state),
        })
      }
      for (let index = state.stack2.length - 1, step = 1; index >= 0; index -= 1, step += 1) {
        tracer.addBlock(`访问右栈第 ${step} 个元素 ${state.stack2[index]}`, [6, 7], {
          result: '右栈按栈顶到栈底输出',
          output: state.stack2.slice(index).reverse(),
          highlightIndices: [state.capacity - index - 1],
          ...makeSharedStackMeta(state),
        })
      }
      tracer.addBlock('共栈遍历结束', [8, 9], {
        result: `左栈：${[...state.stack1].reverse().join(' -> ') || '空'}；右栈：${[...state.stack2].reverse().join(' -> ') || '空'}`,
        highlightIndices: [...state.stack1.map((_, i) => i), ...state.stack2.map((_, i) => state.capacity - i - 1)],
        ...makeSharedStackMeta(state),
      })
      break
    case 'clear':
      state.destroyed = false
      state.stack1 = []
      state.stack2 = []
      tracer.addBlock('共享栈已清空', [1, 3], { result: '两个栈都已清空', ...makeSharedStackMeta(state) })
      break
    default:
      tracer.add('未实现的共享栈操作', 1)
  }

  return { state, traces: tracer.done() }
}

function runSharedStackQueue(action, rawInput, currentState) {
  const state = ensureSharedStackQueueState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)
  const total = () => state.stack.length + state.queue.length

  switch (action.key) {
    case 'init':
      state.stack = []
      state.queue = []
      tracer.addBlock('共享栈队空间初始化完成', [1, 3], { result: `可用容量为 ${state.capacity}` })
      break
    case 'stack-push': {
      const value = parseSingleNumber(input, 1)
      tracer.addBlock('检查共享空间是否可供栈使用', [1, 3])
      if (total() >= state.capacity) tracer.addBlock('共享空间已满', [4, 5], { result: '无法继续入栈' })
      else {
        state.stack.push(value)
        tracer.addBlock(`栈压入 ${value}`, [4, 5], { result: `当前栈顶为 ${value}` })
      }
      break
    }
    case 'stack-pop': {
      const removed = state.stack.pop()
      tracer.addBlock('执行栈出栈', [1, 3], { result: removed === undefined ? '当前栈为空' : `出栈元素为 ${removed}`, last: removed })
      break
    }
    case 'queue-enqueue': {
      const value = parseSingleNumber(input, 9)
      tracer.addBlock('检查共享空间是否可供队列使用', [1, 3])
      if (total() >= state.capacity) tracer.addBlock('共享空间已满', [4, 5], { result: '无法继续入队' })
      else {
        state.queue.push(value)
        tracer.addBlock(`队列入队 ${value}`, [4, 5], { result: `当前队头为 ${state.queue[0]}` })
      }
      break
    }
    case 'queue-dequeue': {
      const removed = state.queue.shift()
      tracer.addBlock('执行队列出队', [1, 3], { result: removed === undefined ? '当前队列为空' : `出队元素为 ${removed}`, last: removed })
      break
    }
    case 'stack-peek':
      tracer.addBlock('读取栈顶元素', [1, 3], { result: state.stack.length ? `栈顶元素为 ${state.stack[state.stack.length - 1]}` : '当前栈为空' })
      break
    case 'queue-front':
      tracer.addBlock('读取队头元素', [1, 3], { result: state.queue.length ? `队头元素为 ${state.queue[0]}` : '当前队列为空' })
      break
    case 'stack-empty':
      tracer.addBlock('判断栈是否为空', [1, 3], { flag: state.stack.length === 0, result: state.stack.length === 0 ? '栈为空' : '栈非空' })
      break
    case 'queue-empty':
      tracer.addBlock('判断队列是否为空', [1, 3], { flag: state.queue.length === 0, result: state.queue.length === 0 ? '队列为空' : '队列非空' })
      break
    case 'is-full':
      tracer.addBlock('判断共享空间是否已满', [1, 3], { flag: total() >= state.capacity, result: total() >= state.capacity ? '共享空间已满' : `剩余 ${state.capacity - total()} 个单元` })
      break
    case 'traverse':
      tracer.addBlock('遍历整个共享栈队空间', [1, 3], { result: `栈：${state.stack.join(', ') || '空'}；队列：${state.queue.join(', ') || '空'}` })
      break
    case 'clear':
      state.stack = []
      state.queue = []
      tracer.addBlock('共享栈队空间已清空', [1, 3], { result: '栈和队列都已清空' })
      break
    default:
      tracer.add('未实现的共享栈队操作', 1)
  }

  return { state, traces: tracer.done() }
}

function runGraphMatrix(action, rawInput, currentState) {
  const state = ensureGraphState(currentState)
  const tracer = makeTracer(state)
  state.meta = { ...(state.meta || {}), actionKey: action.key }

  if (action.key === 'build-matrix') {
    const parsed = parseGraphInput(rawInput, action.defaultInput)
    state.vertices = []
    state.weights = parsed.weights || {}
    state.edges = []
    state.matrix = []
    state.adjacency = {}
    tracer.addBlock('准备构建邻接矩阵', [1, 4], { result: `顶点：${parsed.vertices.join(', ')}，待处理 ${parsed.edges.length} 条带权边` })
    parsed.vertices.forEach((vertex, index) => {
      state.vertices.push(vertex)
      state.adjacency[vertex] = []
      state.matrix = Array.from({ length: state.vertices.length }, () => Array(state.vertices.length).fill(0))
      tracer.addBlock(`生成顶点 ${vertex}`, [4, 5], {
        result: `顶点生成进度 ${index + 1} / ${parsed.vertices.length}`,
        highlightNodes: [vertex],
      })
    })
    parsed.edges.forEach(([from, to], index) => {
      const fromIdx = parsed.vertices.indexOf(from)
      const toIdx = parsed.vertices.indexOf(to)
      const w = state.weights[`${from},${to}`] || state.weights[`${to},${from}`] || 1
      state.matrix[fromIdx][toIdx] = w
      state.matrix[toIdx][fromIdx] = w
      state.edges.push([from, to])
      state.adjacency[from] = state.adjacency[from] || []
      if (!state.adjacency[from].includes(to)) state.adjacency[from].push(to)
      state.adjacency[to] = state.adjacency[to] || []
      if (!state.adjacency[to].includes(from)) state.adjacency[to].push(from)
      tracer.addBlock(`处理边 ${from}-${to}，权值 ${w}`, [6, 8], {
        result: `矩阵 [${fromIdx}][${toIdx}] = [${toIdx}][${fromIdx}] = ${w}`,
        highlightCells: [[fromIdx, toIdx], [toIdx, fromIdx]],
        highlightNodes: [from, to],
      })
    })
    tracer.addBlock('邻接矩阵构建完成', [10, 11], { result: `共 ${parsed.vertices.length}x${parsed.vertices.length} 矩阵，${parsed.edges.length} 条边` })
  } else if (action.key === 'from-matrix') {
    const parsed = parseMatrixInput(rawInput, action.defaultInput)
    state.vertices = parsed.vertices
    state.matrix = parsed.matrix
    state.edges = []
    state.adjacency = Object.fromEntries(parsed.vertices.map(v => [v, []]))
    tracer.addBlock('准备从矩阵还原图', [1, 4], { result: `矩阵大小 ${parsed.vertices.length}x${parsed.vertices.length}` })
    const edges = matrixToEdges(parsed.vertices, parsed.matrix)
    edges.forEach(([from, to], index) => {
      state.edges.push([from, to])
      if (!state.adjacency[from].includes(to)) state.adjacency[from].push(to)
      if (!state.adjacency[to].includes(from)) state.adjacency[to].push(from)
      const fromIdx = parsed.vertices.indexOf(from)
      const toIdx = parsed.vertices.indexOf(to)
      tracer.addBlock(`发现边 ${from}-${to}`, [6, 8], {
        result: `矩阵位置 [${fromIdx}][${toIdx}] = 1`,
        highlightCells: [[fromIdx, toIdx], [toIdx, fromIdx]],
        highlightNodes: [from, to],
      })
    })
    tracer.addBlock('图还原完成', [10, 11], { result: `共还原 ${edges.length} 条边` })
  } else if (action.key === 'add-vertex') {
    const vertex = normalizeInput(rawInput, action.defaultInput)
    if (vertex && !state.vertices.includes(vertex)) {
      state.vertices.push(vertex)
      state.matrix = Array.from({ length: state.vertices.length }, (_, row) =>
        Array.from({ length: state.vertices.length }, (_, col) => state.matrix?.[row]?.[col] || 0),
      )
      state.adjacency[vertex] = []
    }
    tracer.addBlock('添加顶点并扩展邻接矩阵', [1, 4], { result: vertex ? `已添加顶点 ${vertex}` : '未输入有效顶点', highlightNodes: vertex ? [vertex] : [] })
  } else if (action.key === 'remove-vertex') {
    const vertex = normalizeInput(rawInput, action.defaultInput)
    const index = state.vertices.indexOf(vertex)
    if (index >= 0) {
      state.vertices.splice(index, 1)
      state.matrix.splice(index, 1)
      state.matrix.forEach((row) => row.splice(index, 1))
      delete state.adjacency[vertex]
      Object.keys(state.adjacency).forEach((key) => {
        state.adjacency[key] = state.adjacency[key].filter((item) => item !== vertex)
      })
      state.edges = matrixToEdges(state.vertices, state.matrix)
    }
    tracer.addBlock('删除顶点并压缩邻接矩阵', [1, 4], { result: index >= 0 ? `已删除顶点 ${vertex}` : `未找到顶点 ${vertex}` })
  } else if (action.key === 'rename-vertex') {
    const [from, to] = normalizeInput(rawInput, action.defaultInput).split(/[,\s，]+/).map((item) => item.trim())
    const index = state.vertices.indexOf(from)
    if (index >= 0 && to) {
      state.vertices[index] = to
      state.adjacency[to] = state.adjacency[from] || []
      delete state.adjacency[from]
      state.edges = state.edges.map(([a, b]) => [a === from ? to : a, b === from ? to : b])
    }
    tracer.addBlock('修改顶点名称', [1, 4], { result: index >= 0 && to ? `${from} 已修改为 ${to}` : '顶点修改失败', highlightNodes: to ? [to] : [] })
  } else if (action.key === 'query-vertex') {
    const vertex = normalizeInput(rawInput, action.defaultInput)
    tracer.addBlock('查询顶点信息', [1, 4], {
      result: state.vertices.includes(vertex) ? `顶点 ${vertex} 存在，度为 ${(state.adjacency[vertex] || []).length}` : `未找到顶点 ${vertex}`,
      highlightNodes: vertex ? [vertex] : [],
    })
  } else if (action.key === 'query-edge' || action.key === 'add-edge' || action.key === 'remove-edge') {
    const parts = normalizeInput(rawInput, action.defaultInput).split(/[,\s，]+/).map((item) => item.trim()).filter(Boolean)
    const [from, to, weightRaw] = parts
    const weight = Math.max(0, Number(weightRaw) || 0)
    if (action.key === 'query-edge') {
      const hasEdge = !!(state.weights?.[`${from},${to}`] || state.weights?.[`${to},${from}`])
      tracer.addBlock('查询边信息', [1, 4], { result: hasEdge ? `边 ${from}-${to} 存在` : `边 ${from}-${to} 不存在`, highlightNodes: [from, to].filter(Boolean) })
    } else {
      if (!state.vertices.includes(from)) state.vertices.push(from)
      if (!state.vertices.includes(to)) state.vertices.push(to)
      state.matrix = Array.from({ length: state.vertices.length }, (_, row) =>
        Array.from({ length: state.vertices.length }, (_, col) => state.matrix?.[row]?.[col] || 0),
      )
      state.weights = state.weights || {}
      const row = state.vertices.indexOf(from)
      const col = state.vertices.indexOf(to)
      if (action.key === 'add-edge') {
        state.matrix[row][col] = weight || 1
        state.matrix[col][row] = weight || 1
        state.weights[`${from},${to}`] = weight || 1
        state.weights[`${to},${from}`] = weight || 1
      } else {
        state.matrix[row][col] = 0
        state.matrix[col][row] = 0
        delete state.weights[`${from},${to}`]
        delete state.weights[`${to},${from}`]
      }
      state.edges = matrixToEdges(state.vertices, state.matrix)
      state.adjacency = buildAdjacency(state.vertices, state.edges)
      tracer.addBlock(action.key === 'add-edge' ? '添加边并更新图结构' : '删除边并更新图结构', [1, 4], {
        result: action.key === 'add-edge' ? `已添加边 ${from}-${to}，权值 ${weight || 1}` : `已删除边 ${from}-${to}`,
        highlightNodes: [from, to].filter(Boolean),
      })
    }
  } else {
    const [rowRaw, colRaw, valueRaw] = parseTriple(rawInput, action.defaultInput)
    const row = Math.max(0, Math.min(rowRaw, state.matrix.length - 1))
    const col = Math.max(0, Math.min(colRaw, state.matrix.length - 1))
    const value = Math.max(0, Math.floor(valueRaw || 0))
    if (state.matrix.length) {
      state.matrix[row][col] = value
      state.matrix[col][row] = value
      state.edges = matrixToEdges(state.vertices, state.matrix)
      state.weights = state.weights || {}
      const from = state.vertices[row]
      const to = state.vertices[col]
      if (from && to) {
        if (value > 0) {
          state.weights[`${from},${to}`] = value
          state.weights[`${to},${from}`] = value
        } else {
          delete state.weights[`${from},${to}`]
          delete state.weights[`${to},${from}`]
        }
      }
      state.adjacency = buildAdjacency(state.vertices, state.edges)
    }
    tracer.addBlock('修改矩阵元素并动态更新图', [1, 4], { result: `已将 [${row}, ${col}] 更新为权值 ${value}`, highlightCells: [[row, col], [col, row]] })
  }

  return { state, traces: tracer.done() }
}

function runGraphList(action, rawInput, currentState) {
  const state = ensureGraphState(currentState)
  const tracer = makeTracer(state)
  state.meta = { ...(state.meta || {}), actionKey: action.key }

  if (action.key === 'build-list') {
    const parsed = parseGraphInput(rawInput, action.defaultInput)
    state.vertices = []
    state.weights = parsed.weights || {}
    state.edges = []
    state.adjacency = {}
    state.matrix = []
    tracer.addBlock('准备构建邻接表', [1, 4], { result: `顶点：${parsed.vertices.join(', ')}，待处理 ${parsed.edges.length} 条带权边` })
    parsed.vertices.forEach((vertex, index) => {
      state.vertices.push(vertex)
      state.adjacency[vertex] = []
      state.matrix = Array.from({ length: state.vertices.length }, () => Array(state.vertices.length).fill(0))
      tracer.addBlock(`生成邻接表表头顶点 ${vertex}`, [4, 5], {
        result: `表头结点生成进度 ${index + 1} / ${parsed.vertices.length}`,
        highlightNodes: [vertex],
      })
    })
    parsed.edges.forEach(([from, to], index) => {
      state.edges.push([from, to])
      if (!state.adjacency[from].includes(to)) state.adjacency[from].push(to)
      if (!state.adjacency[to].includes(from)) state.adjacency[to].push(from)
      const fromIdx = parsed.vertices.indexOf(from)
      const toIdx = parsed.vertices.indexOf(to)
      const w = state.weights[`${from},${to}`] || state.weights[`${to},${from}`] || 1
      state.matrix[fromIdx][toIdx] = w
      state.matrix[toIdx][fromIdx] = w
      tracer.addBlock(`连接边 ${from}-${to}，权值 ${w}`, [6, 8], {
        result: `邻接表：${from} → ${state.adjacency[from].join(',')}`,
        highlightNodes: [from, to],
      })
    })
    tracer.addBlock('邻接表构建完成', [10, 11], { result: `共 ${parsed.vertices.length} 个表头结点，${parsed.edges.length} 条边` })
  } else if (action.key === 'from-list' || action.key === 'list-to-matrix') {
    const parsed = parseAdjacencyInput(rawInput, action.defaultInput)
    state.vertices = parsed.vertices
    state.adjacency = parsed.adjacency
    state.matrix = adjacencyToMatrix(parsed.vertices, parsed.adjacency)
    state.edges = adjacencyToEdges(parsed.vertices, parsed.adjacency)
    tracer.addBlock('根据邻接表生成邻接矩阵', [1, 4], { result: `共生成 ${state.edges.length} 条边` })
  } else if (action.key === 'add-vertex') {
    const vertex = normalizeInput(rawInput, action.defaultInput)
    if (vertex && !state.vertices.includes(vertex)) {
      state.vertices.push(vertex)
      state.adjacency[vertex] = []
      state.matrix = adjacencyToMatrix(state.vertices, state.adjacency)
    }
    tracer.addBlock('向邻接表添加顶点', [1, 4], { result: vertex ? `已添加顶点 ${vertex}` : '未输入有效顶点', highlightNodes: vertex ? [vertex] : [] })
  } else if (action.key === 'remove-vertex') {
    const vertex = normalizeInput(rawInput, action.defaultInput)
    if (state.vertices.includes(vertex)) {
      state.vertices = state.vertices.filter((item) => item !== vertex)
      delete state.adjacency[vertex]
      Object.keys(state.adjacency).forEach((key) => {
        state.adjacency[key] = state.adjacency[key].filter((item) => item !== vertex)
      })
      state.edges = adjacencyToEdges(state.vertices, state.adjacency)
      state.matrix = buildMatrix(state.vertices, state.edges, state.weights)
    }
    tracer.addBlock('从邻接表删除顶点', [1, 4], { result: `已处理顶点 ${vertex}` })
  } else if (action.key === 'rename-vertex') {
    const [from, to] = normalizeInput(rawInput, action.defaultInput).split(/[,\s，]+/).map((item) => item.trim())
    if (state.vertices.includes(from) && to) {
      state.vertices = state.vertices.map((item) => (item === from ? to : item))
      state.adjacency[to] = (state.adjacency[from] || []).map((item) => (item === from ? to : item))
      delete state.adjacency[from]
      Object.keys(state.adjacency).forEach((key) => {
        state.adjacency[key] = state.adjacency[key].map((item) => (item === from ? to : item))
      })
      state.edges = adjacencyToEdges(state.vertices, state.adjacency)
      state.matrix = buildMatrix(state.vertices, state.edges, state.weights)
    }
    tracer.addBlock('修改邻接表顶点名称', [1, 4], { result: to ? `${from} → ${to}` : '顶点修改失败', highlightNodes: to ? [to] : [] })
  } else if (action.key === 'query-vertex') {
    const vertex = normalizeInput(rawInput, action.defaultInput)
    tracer.addBlock('查询邻接表顶点信息', [1, 4], {
      result: state.vertices.includes(vertex) ? `顶点 ${vertex} 存在，邻接点：${(state.adjacency[vertex] || []).join(', ') || '空'}` : `未找到顶点 ${vertex}`,
      highlightNodes: vertex ? [vertex] : [],
    })
  } else if (action.key === 'query-edge') {
    const [from, to] = normalizeInput(rawInput, action.defaultInput).split(/[,\s，]+/).map((item) => item.trim())
    const hasEdge = (state.adjacency[from] || []).includes(to)
    tracer.addBlock('查询邻接表边信息', [1, 4], {
      result: hasEdge ? `边 ${from}-${to} 存在` : `边 ${from}-${to} 不存在`,
      highlightNodes: [from, to].filter(Boolean),
    })
  } else {
    const [vertex, neighbor, flag] = normalizeInput(rawInput, action.defaultInput)
      .split(/[,\s，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    const weight = Math.max(0, Number(flag) || 0)
    if (!state.vertices.includes(vertex)) state.vertices.push(vertex)
    if (!state.vertices.includes(neighbor)) state.vertices.push(neighbor)
    state.adjacency[vertex] = state.adjacency[vertex] || []
    state.adjacency[neighbor] = state.adjacency[neighbor] || []
    state.weights = state.weights || {}
    if (weight > 0) {
      if (!state.adjacency[vertex].includes(neighbor)) state.adjacency[vertex].push(neighbor)
      if (!state.adjacency[neighbor].includes(vertex)) state.adjacency[neighbor].push(vertex)
      state.weights[`${vertex},${neighbor}`] = weight
      state.weights[`${neighbor},${vertex}`] = weight
    } else {
      state.adjacency[vertex] = state.adjacency[vertex].filter((item) => item !== neighbor)
      state.adjacency[neighbor] = state.adjacency[neighbor].filter((item) => item !== vertex)
      delete state.weights[`${vertex},${neighbor}`]
      delete state.weights[`${neighbor},${vertex}`]
    }
    state.edges = adjacencyToEdges(state.vertices, state.adjacency)
    state.matrix = buildMatrix(state.vertices, state.edges, state.weights)
    tracer.addBlock('修改邻接表元素并动态更新图', [1, 4], { result: `${vertex || '?'} 与 ${neighbor || '?'} 的关系已更新，权值 ${weight}`, highlightNodes: [vertex, neighbor].filter(Boolean) })
  }

  return { state, traces: tracer.done() }
}

function runGraphTraversal(action, rawInput, currentState) {
  const state = ensureGraphState(currentState)
  const tracer = makeTracer(state)
  state.meta = { ...(state.meta || {}), actionKey: action.key }
  const input = normalizeInput(rawInput, action.defaultInput)

  if (action.key === 'create') {
    const graphData = parseGraphInput(input, action.defaultInput)
    applyGraphData(state, graphData)
    tracer.addBlock('读取顶点数组和边集合并创建图', [1, 3], {
      result: `已创建 ${state.vertices.length} 个顶点、${state.edges.length} 条边`,
      highlightNodes: state.vertices,
    })
    tracer.addBlock('同步生成邻接矩阵和邻接表', [4, 5], {
      result: `顶点数组：${state.vertices.join(' -> ')}`,
      highlightNodes: state.vertices,
    })
    return { state, traces: tracer.done() }
  }

  if (action.key === 'random') {
    const graphData = createRandomGraphData(parseSingleNumber(input, 5), true)
    applyGraphData(state, graphData)
    tracer.addBlock('随机生成连通图的顶点数组', [1, 3], {
      result: `随机得到 ${state.vertices.length} 个顶点`,
      highlightNodes: state.vertices,
    })
    tracer.addBlock('补齐随机边并同步邻接矩阵和邻接表', [4, 5], {
      result: `当前共有 ${state.edges.length} 条边`,
      highlightNodes: state.vertices,
    })
    return { state, traces: tracer.done() }
  }

  if (input.includes('|')) {
    const graphData = parseGraphInput(input, action.defaultInput)
    applyGraphData(state, graphData)
  } else {
    state.matrix = buildMatrix(state.vertices, state.edges, state.weights)
    state.adjacency = buildAdjacency(state.vertices, state.edges)
  }

  const start = state.vertices.includes(input) ? input : (state.vertices[0] || 'A')
  const adjacency = state.adjacency || buildAdjacency(state.vertices, state.edges)
  const visited = new Set()
  const discovered = new Set()
  const order = []
  const isDfs = ['dfs', 'matrix-dfs'].includes(action.key)
  const modeLabel = action.key === 'matrix-dfs' ? '邻接矩阵 DFS' : action.key === 'matrix-bfs' ? '邻接矩阵 BFS' : action.key === 'dfs' ? '深度优先搜索' : '广度优先搜索'
  const vertexIndex = Object.fromEntries(state.vertices.map((vertex, index) => [vertex, index]))
  const matrixHighlights = (from, to) => {
    const row = vertexIndex[from]
    const col = vertexIndex[to]
    return row === undefined || col === undefined ? [] : [[row, col], [col, row]]
  }

  tracer.addBlock(`${modeLabel}：从顶点 ${start} 开始`, isDfs ? [11, 12] : [19, 20], {
    result: `起始顶点 ${start}`,
    highlightNodes: [start],
  })

  if (isDfs) {
    const dfs = (node) => {
      if (!node || visited.has(node)) return
      visited.add(node)
      order.push(node)
      tracer.addBlock(`访问顶点 ${node}`, [13, 14], {
        highlightNodes: [node],
        traversalOrder: [...order],
      })
      ;(adjacency[node] || []).forEach((neighbor) => {
        tracer.addBlock(`检查边 ${node}-${neighbor}`, [15, 16], {
          result: visited.has(neighbor) ? `${neighbor} 已访问，跳过` : `沿边 ${node}-${neighbor} 继续深入`,
          highlightNodes: [node, neighbor],
          highlightEdges: [[node, neighbor]],
          highlightCells: matrixHighlights(node, neighbor),
          traversalOrder: [...order],
        })
        if (!visited.has(neighbor)) dfs(neighbor)
      })
    }
    dfs(start)
  } else {
    const queue = [start]
    discovered.add(start)
    tracer.addBlock(`起始顶点 ${start} 入队`, [21, 22], {
      result: `当前队列：${queue.join(' -> ')}`,
      highlightNodes: [start],
    })
    while (queue.length) {
      const node = queue.shift()
      if (visited.has(node)) continue
      visited.add(node)
      order.push(node)
      tracer.addBlock(`访问顶点 ${node}`, [23, 24], {
        highlightNodes: [node],
        traversalOrder: [...order],
        result: `访问顺序：${order.join(' -> ')}`,
      })
      ;(adjacency[node] || []).forEach((neighbor) => {
        const seen = visited.has(neighbor) || discovered.has(neighbor)
        tracer.addBlock(`检查边 ${node}-${neighbor}`, [25, 26], {
          result: seen ? `${neighbor} 已在访问流程中，跳过` : `${neighbor} 入队等待访问`,
          highlightNodes: [node, neighbor],
          highlightEdges: [[node, neighbor]],
          highlightCells: matrixHighlights(node, neighbor),
          traversalOrder: [...order],
        })
        if (!seen) {
          queue.push(neighbor)
          discovered.add(neighbor)
        }
      })
    }
  }

  tracer.addBlock('遍历结束', [27, 28], {
    result: order.length ? `遍历序列：${order.join(' -> ')}` : '未找到可遍历顶点',
    traversalOrder: order,
    highlightNodes: order,
  })
  state.adjacency = adjacency
  return { state, traces: tracer.done() }
}
function parseWeightedGraphInput(raw, fallback = 'A,B,C,D,E | A-B:4,A-C:7,A-B:4,A-C:7,B-D:5,B-E:3,C-D:2,D-E:6') {
  const text = String(raw ?? '').trim() || fallback
  const [verticesPart, edgesPart] = text.split('|').map((item) => item.trim())
  const vertices = (verticesPart || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const edges = (edgesPart || '')
    .split(/[,\s，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(':')
      const [from, to] = parts[0].split('-').map((p) => p.trim())
      const weight = Number(parts[1] ?? 1)
      return { from, to, weight }
    })
    .filter((e) => e.from && e.to)
  return vertices.length ? { vertices, edges } : { vertices: ['A', 'B', 'C', 'D', 'E'], edges: [] }
}
function runGraphMst(action, rawInput, currentState) {
  const state = ensureGraphState(currentState)
  const tracer = makeTracer(state)
  state.meta = { ...(state.meta || {}), actionKey: action.key }
  const text = normalizeInput(rawInput, action.defaultInput)
  const hasGraphPayload = text.includes('|')
  const parsed = hasGraphPayload ? parseWeightedGraphInput(rawInput, action.defaultInput) : null

  if (action.key === 'create') {
    const created = parseWeightedGraphInput(text, action.defaultInput)
    applyGraphData(state, {
      vertices: created.vertices,
      edges: created.edges.map((edge) => [edge.from, edge.to]),
      weights: Object.fromEntries(created.edges.flatMap(({ from, to, weight }) => [
        [`${from},${to}`, weight],
        [`${to},${from}`, weight],
      ])),
    })
    tracer.addBlock('读取顶点数组和带权边并创建图', [1, 3], {
      result: `已创建 ${state.vertices.length} 个顶点、${state.edges.length} 条带权边`,
      highlightNodes: state.vertices,
    })
    tracer.addBlock('同步生成带权邻接矩阵', [4, 5], {
      result: `顶点数组：${state.vertices.join(' -> ')}`,
      highlightNodes: state.vertices,
    })
    return { state, traces: tracer.done() }
  }

  if (action.key === 'random') {
    const randomGraph = createRandomGraphData(parseSingleNumber(text, 5), true)
    applyGraphData(state, randomGraph)
    tracer.addBlock('随机生成带权连通图的顶点数组', [1, 3], {
      result: `随机得到 ${state.vertices.length} 个顶点`,
      highlightNodes: state.vertices,
    })
    tracer.addBlock('补齐随机带权边并生成邻接矩阵', [4, 5], {
      result: `当前共有 ${state.edges.length} 条带权边`,
      highlightNodes: state.vertices,
    })
    return { state, traces: tracer.done() }
  }

  if (parsed) {
    applyGraphData(state, {
      vertices: parsed.vertices,
      edges: parsed.edges.map((e) => [e.from, e.to]),
      weights: Object.fromEntries(parsed.edges.flatMap(({ from, to, weight }) => [
        [`${from},${to}`, weight],
        [`${to},${from}`, weight],
      ])),
    })
  } else {
    state.matrix = buildMatrix(state.vertices, state.edges, state.weights)
    state.adjacency = buildAdjacency(state.vertices, state.edges)
  }
  const weightedEdges = parsed?.edges || weightedEdgesFromState(state)
  tracer.addBlock('读取邻接矩阵中的带权图数据', [6, 7], { result: `顶点数 ${state.vertices.length}，边数 ${weightedEdges.length}` })

  if (action.key === 'prim') {
    const requestedStart = hasGraphPayload ? state.vertices[0] : text
    const start = state.vertices.includes(requestedStart) ? requestedStart : state.vertices[0]
    const dist = {}
    const parent = {}
    const visited = new Set()
    state.vertices.forEach((v) => { dist[v] = Infinity; parent[v] = null })
    dist[start] = 0
    tracer.addBlock(`Prim 算法：从顶点 ${start} 开始`, [11, 12], { result: `起始顶点 ${start}` })
    for (let i = 0; i < state.vertices.length; i += 1) {
      let u = null
      let minDist = Infinity
      for (const v of state.vertices) {
        if (!visited.has(v) && dist[v] < minDist) {
          minDist = dist[v]; u = v
        }
      }
      if (u === null) break
      visited.add(u)
      const label = dist[u] === 0 ? `起点 ${u}` : `选择边 ${parent[u]}-${u}，权值 ${dist[u]}`
      tracer.addBlock(`将顶点 ${u} 加入 MST${dist[u] !== 0 ? `（边 ${parent[u]}-${u}，权值 ${dist[u]}）` : '（起点）'}`, [13, 14], {
        result: label,
        highlightNodes: [u, parent[u]].filter(Boolean),
        highlightEdges: parent[u] ? [[parent[u], u]] : [],
        traversalOrder: [...visited],
      })
      for (const edge of weightedEdges) {
        const { from, to, weight } = edge
        const neighbor = from === u ? to : to === u ? from : null
        if (neighbor !== null && !visited.has(neighbor) && weight < dist[neighbor]) {
          tracer.addBlock(`检查边 ${from}-${to}，权值 ${weight}，更新 ${neighbor} 的距离`, [15, 16], {
            result: `dist[${neighbor}]：${dist[neighbor]} → ${weight}`,
            highlightNodes: [from, to],
            highlightEdges: [[from, to]],
          })
          dist[neighbor] = weight
          parent[neighbor] = u
        }
      }
    }
    const mstEdges = state.vertices.filter((v) => parent[v] !== null).map((v) => parent[v])
    const totalWeight = Object.values(dist).reduce((s, w) => s + w, 0) - dist[start]
    tracer.addBlock('Prim 算法结束', [17, 18], {
      result: `MST 边数：${mstEdges.length}，总权值：${totalWeight}`,
      highlightNodes: state.vertices,
      traversalOrder: [...visited],
    })
  } else if (action.key === 'kruskal') {
    const sortedEdges = [...weightedEdges].sort((a, b) => a.weight - b.weight)
    const uf = {}
    state.vertices.forEach((v) => { uf[v] = v })
    const find = (x) => { while (uf[x] !== x) { uf[x] = uf[uf[x]]; x = uf[x] } return x }
    const union = (x, y) => { uf[find(y)] = find(x) }
    const mstEdges = []
    const mstTotal = []
    tracer.addBlock('Kruskal 算法：对所有边按权值排序', [6, 7], { result: `共 ${sortedEdges.length} 条边待处理` })
    for (const { from, to, weight } of sortedEdges) {
      tracer.addBlock(`检查边 ${from}-${to}，权值 ${weight}`, [11, 12], {
        result: find(from) === find(to) ? `${from} 和 ${to} 已在同一集合，跳过` : `加入 MST`,
        highlightNodes: [from, to],
        highlightEdges: [[from, to]],
      })
      if (find(from) !== find(to)) {
        union(from, to)
        mstEdges.push([from, to])
        mstTotal.push(weight)
        tracer.addBlock(`将边 ${from}-${to}（权值 ${weight}）加入 MST`, [13, 14], {
          result: `MST 边数：${mstEdges.length}`,
          highlightNodes: [from, to],
          highlightEdges: [[from, to]],
          traversalOrder: mstEdges.flat(),
        })
      }
    }
    const totalWeight = mstTotal.reduce((s, w) => s + w, 0)
    tracer.addBlock('Kruskal 算法结束', [17, 18], {
      result: `MST 边数：${mstEdges.length}，总权值：${totalWeight}`,
      highlightNodes: state.vertices,
      traversalOrder: mstEdges.flat(),
    })
  } else if (action.key === 'boruvka') {
    const parent = Object.fromEntries(state.vertices.map((v) => [v, v]))
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    const union = (a, b) => { parent[find(b)] = find(a) }
    let components = state.vertices.length
    let totalWeight = 0
    tracer.addBlock('Boruvka 算法：为每个连通分量寻找最短外连边', [6, 7], { result: `初始连通分量数 ${components}` })
    while (components > 1) {
      const cheapest = {}
      weightedEdges.forEach((edge) => {
        const set1 = find(edge.from)
        const set2 = find(edge.to)
        if (set1 === set2) return
        if (!cheapest[set1] || cheapest[set1].weight > edge.weight) cheapest[set1] = edge
        if (!cheapest[set2] || cheapest[set2].weight > edge.weight) cheapest[set2] = edge
      })
      const picked = Object.values(cheapest)
      if (!picked.length) break
      picked.forEach((edge) => {
        const set1 = find(edge.from)
        const set2 = find(edge.to)
        if (set1 !== set2) {
          union(edge.from, edge.to)
          components -= 1
          totalWeight += edge.weight
          tracer.addBlock(`选择分量最短边 ${edge.from}-${edge.to}`, [11, 12], {
            result: `权值 ${edge.weight}，剩余分量 ${components}`,
            highlightNodes: [edge.from, edge.to],
            highlightEdges: [[edge.from, edge.to]],
          })
        }
      })
    }
    tracer.addBlock('Boruvka 算法结束', [17, 18], {
      result: `最小生成树总权值：${totalWeight}`,
      highlightNodes: state.vertices,
    })
  } else if (action.key === 'floyd') {
    const size = state.vertices.length
    const indexMap = Object.fromEntries(state.vertices.map((vertex, index) => [vertex, index]))
    const dist = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => {
        if (row === col) return 0
        const from = state.vertices[row]
        const to = state.vertices[col]
        return state.weights?.[`${from},${to}`] ?? Number.POSITIVE_INFINITY
      }),
    )
    tracer.addBlock('初始化 Floyd 距离矩阵', [1, 3], {
      result: `准备计算 ${size} 个顶点之间的最短路径`,
      highlightNodes: state.vertices,
    })
    for (let k = 0; k < size; k += 1) {
      tracer.addBlock(`选择顶点 ${state.vertices[k]} 作为中转点`, [4, 5], {
        result: `尝试用 ${state.vertices[k]} 更新所有点对距离`,
        highlightNodes: [state.vertices[k]],
      })
      for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
          if (dist[i][k] === Number.POSITIVE_INFINITY || dist[k][j] === Number.POSITIVE_INFINITY) continue
          const candidate = dist[i][k] + dist[k][j]
          if (candidate < dist[i][j]) {
            const from = state.vertices[i]
            const via = state.vertices[k]
            const to = state.vertices[j]
            tracer.addBlock(`更新 ${from} 到 ${to} 的最短距离`, [6, 7], {
              result: `${from} -> ${via} -> ${to} 的距离由 ${Number.isFinite(dist[i][j]) ? dist[i][j] : '∞'} 变为 ${candidate}`,
              highlightNodes: [from, via, to],
              highlightCells: [[i, k], [k, j], [i, j]],
            })
            dist[i][j] = candidate
          }
        }
      }
    }
    state.matrix = dist.map((row) => row.map((cell) => (Number.isFinite(cell) ? cell : 0)))
    state.meta = { ...(state.meta || {}), distanceMatrix: clone(state.matrix) }
    tracer.addBlock('Floyd 算法结束', [8, 9], {
      result: '所有顶点对的最短路径已更新到矩阵中',
      highlightNodes: state.vertices,
      highlightCells: state.vertices.flatMap((_, row) => state.vertices.map((__, col) => [row, col])),
    })
  }
  return { state, traces: tracer.done() }
}
function ensureLinearData(state, fallback = '35,12,48,7,26') {
  if (!state.items.length) state.items = parseNumberList(fallback, fallback)
}

function parseLinearActionInput(raw, fallback = '') {
  const text = normalizeInput(raw, fallback)
  if (!text.includes('|')) return { seedValues: null, actionInput: text }
  const [seedPart, actionPart] = text.split('|')
  const seedValues = parseNumberList(seedPart, seedPart)
  return { seedValues, actionInput: String(actionPart ?? '').trim() }
}

function parseFindMode(rawMode) {
  const mode = String(rawMode || '').trim()
  return mode === '全部' ? 'all' : 'first'
}

function clampLinearSlot(rawIndex, maxIndex) {
  return Math.max(0, Math.min(rawIndex, maxIndex))
}

function runLinearList(action, rawInput, currentState, capacityInput, pageKey = 'linear-list-basic') {
  const state = ensureLinearListState(currentState)
  const tracer = makeTracer(state)
  const { seedValues, actionInput } = parseLinearActionInput(rawInput, action.defaultInput)
  const syncHeapSortView = () => {
    if (pageKey !== 'linear-list-sort-heap') return
    syncHeapVisualState(state, state.meta?.heapSize ?? state.items.length)
  }
  if (seedValues?.length && action.key !== 'create' && action.key !== 'random' && action.key !== 'list-random') {
    state.items = [...seedValues]
    state.capacity = Math.max(Number(capacityInput) || state.capacity || 10, state.items.length)
    if (pageKey === 'linear-list-sort-heap') {
      state.meta = { ...(state.meta || {}), heapSize: state.items.length }
      syncHeapSortView()
    }
  }
  const input = actionInput

  switch (action.key) {
    case 'create': {
      state.capacity = Math.max(1, Math.min(Number(capacityInput) || state.capacity || 10, 30))
      const allValues = parseNumberList(input, action.defaultInput)
      const values = ensureLimit(allValues, state.capacity)
      state.items = []
      state.meta = { ...(state.meta || {}), heapSize: 0 }
      tracer.addBlock('读取表长和输入序列并准备创建顺序表', [9, 10], {
        result: `表长固定为 ${state.capacity}，准备插入 ${values.length} 个元素${allValues.length > values.length ? '，超出部分已忽略' : ''}`,
      })
      values.forEach((value, index) => {
        state.items.push(value)
        tracer.addBlock(`将元素 ${value} 放入位置 ${index}`, [11, 12], {
          result: `创建进度 ${index + 1} / ${values.length}`,
          highlightIndices: [index],
        })
      })
      state.meta.heapSize = state.items.length
      syncHeapSortView()
      tracer.addBlock('顺序表创建完成', [16, 17], { result: `当前元素 ${state.items.length} 个，表长 ${state.capacity}` })
      break
    }
    case 'insert': {
      ensureLinearData(state)
      const [positionRaw, value] = parsePair(input, action.defaultInput)
      const index = clampLinearSlot(positionRaw, state.items.length)
      if (state.items.length >= state.capacity) {
        tracer.addBlock('顺序表已达到固定表长，插入失败', [7, 8], { result: `当前长度 ${state.items.length} / 表长 ${state.capacity}` })
        break
      }
      tracer.addBlock('解析插入位置与元素值', [7, 8], { result: `准备在显示序号 ${index} 处插入 ${value}` })
      for (let cursor = 0; cursor < index; cursor += 1) {
        tracer.addBlock(`经过序号 ${cursor} 的元素 ${state.items[cursor]}`, [9, 10], {
          result: `正在定位显示序号 ${index}`,
          highlightIndices: [cursor],
        })
      }
      tracer.addBlock(`定位到显示序号 ${index}，准备后移元素`, [11, 12], {
        result: index === state.items.length ? '插入位置在表尾，无需移动现有元素' : '将从表尾开始依次后移元素',
        highlightIndices: [index],
      })
      state.items.push(state.items[state.items.length - 1])
      for (let cursor = state.items.length - 2; cursor >= index; cursor -= 1) {
        state.items[cursor + 1] = state.items[cursor]
        tracer.addBlock(`将序号 ${cursor} 的元素后移到序号 ${cursor + 1}`, [13, 14], {
          result: `元素 ${state.items[cursor + 1]} 向后移动一格`,
          highlightIndices: [cursor, cursor + 1],
        })
      }
      state.items[index] = value
      tracer.addBlock('在顺序表中写入新元素', [16, 17], {
        result: `已在显示序号 ${index} 处插入 ${value}，表长变为 ${state.items.length}`,
        highlightIndices: [index],
      })
      break
    }
    case 'delete': {
      ensureLinearData(state)
      const index = clampLinearSlot(parseSingleNumber(input, 0), Math.max(state.items.length - 1, 0))
      tracer.addBlock('解析待删除位置', [7, 8], { result: `准备删除显示序号 ${index} 的元素` })
      for (let cursor = 0; cursor <= index && cursor < state.items.length; cursor += 1) {
        tracer.addBlock(`扫描到序号 ${cursor} 的元素 ${state.items[cursor]}`, [9, 10], {
          result: cursor === index ? '定位到待删除元素' : `继续查找到显示序号 ${index}`,
          highlightIndices: [cursor],
        })
      }
      const removed = state.items[index]
      tracer.addBlock(`删除显示序号 ${index} 上的元素 ${removed}`, [11, 12], {
        result: '删除目标元素后，后续元素需要依次前移',
        highlightIndices: [index],
      })
      for (let cursor = index; cursor < state.items.length - 1; cursor += 1) {
        state.items[cursor] = state.items[cursor + 1]
        tracer.addBlock(`将序号 ${cursor + 1} 的元素前移到序号 ${cursor}`, [13, 14], {
          result: `元素 ${state.items[cursor]} 向前移动一格`,
          highlightIndices: [cursor, cursor + 1],
        })
      }
      if (state.items.length) state.items.pop()
      tracer.addBlock('顺序表删除完成', [16, 17], {
        result: removed === undefined ? '没有可删除的元素' : `已删除 ${removed}，表长变为 ${state.items.length}`,
        last: removed,
        highlightIndices: state.items.length ? [Math.min(index, state.items.length - 1)] : [],
      })
      break
    }
    case 'delete-by-val': {
      ensureLinearData(state)
      const parts = input.split(',').map(s => s.trim())
      const target = parseSingleNumber(parts[0], state.items[0] ?? 0)
      const mode = parseFindMode(parts[1])
      const modeLabel = mode === 'all' ? '全部匹配' : '首个匹配'
      tracer.addBlock('准备按值删除', [6, 7], { result: `目标值：${target}，模式：${modeLabel}` })
      const positions = []
      for (let i = 0; i < state.items.length; i += 1) {
        tracer.addBlock(`扫描位置 ${i} 的元素 ${state.items[i]}`, [9, 10], {
          result: state.items[i] === target ? `发现匹配值 ${target}` : '不匹配',
          highlightIndices: [i],
        })
        if (state.items[i] === target) positions.push(i)
      }
      if (!positions.length) {
        tracer.addBlock('未找到匹配元素', [12, 13], { result: `顺序表中不存在值 ${target}` })
      } else {
        if (mode === 'first') {
          const pos = positions[0]
          tracer.addBlock(`定位到首个匹配位置 ${pos}，值为 ${state.items[pos]}`, [9, 10], {
            result: `准备删除位置 ${pos} 上的 ${target}`,
            highlightIndices: [pos],
          })
          state.items.splice(pos, 1)
          tracer.addBlock('按值删除完成', [12, 13], { result: `已删除首个 ${target}，剩余 ${state.items.length} 个元素` })
        } else {
          tracer.addBlock(`找到 ${positions.length} 个匹配，依次删除`, [9, 10], {
            result: `匹配位置：${positions.join(', ')}`,
            highlightIndices: [...positions],
          })
          // 从后往前删，避免索引偏移
          for (let i = positions.length - 1; i >= 0; i -= 1) {
            const pos = positions[i]
            tracer.addBlock(`删除位置 ${pos} 上的 ${target}`, [12, 13], {
              result: `剩余 ${i} 个待删除`,
              highlightIndices: [pos],
            })
            state.items.splice(pos, 1)
          }
          tracer.addBlock('按值删除完成', [12, 13], { result: `已删除全部 ${positions.length} 个 ${target}` })
        }
      }
      break
    }
    case 'insertion-sort':
      ensureLinearData(state)
      tracer.addBlock('开始执行插入排序', [8, 10], { result: `当前序列：${state.items.join(', ')}` })
      for (let index = 1; index < state.items.length; index += 1) {
        tracer.addBlock(`=== 第 ${index} 轮开始 ===`, [19, 21], { result: `将第 ${index} 个元素插入前方有序区` }, `round-${index}`)
        const value = state.items[index]
        let cursor = index - 1
        tracer.addBlock(`取出待插入元素 ${value}`, [22, 23], {
          result: `准备将 ${value} 插入到前方有序区间`,
          highlightIndices: [index],
          pointers: [
            makePointer(index, 'i', '#8b5cf6'),
            makePointer(index, 'key', '#ef4444'),
          ],
        })
        while (cursor >= 0 && state.items[cursor] > value) {
          tracer.addBlock(`比较 ${value} 与位置 ${cursor} 的 ${state.items[cursor]}`, [25, 27], {
            result: `${state.items[cursor]} 大于 ${value}，后移一位`,
            highlightIndices: [cursor, cursor + 1],
            pointers: [
              makePointer(index, 'key', '#ef4444'),
              makePointer(cursor, 'j', '#f59e0b'),
              makePointer(cursor + 1, 'j+1', '#22c55e'),
            ],
          })
          state.items[cursor + 1] = state.items[cursor]
          cursor -= 1
        }
        state.items[cursor + 1] = value
        tracer.addBlock(`将 ${value} 插入到位置 ${cursor + 1}`, [29, 30], {
          result: `当前序列：${state.items.join(', ')}`,
          highlightIndices: [cursor + 1],
          pointers: [
            makePointer(cursor + 1, 'insert', '#22c55e'),
            makePointer(index, 'i', '#8b5cf6'),
          ],
        })
        tracer.addBlock(`=== 第 ${index} 轮结束 ===`, [31, 32], { result: `当前序列：${state.items.join(', ')}` }, `round-end-${index}`)
      }
      tracer.addBlock('插入排序完成', [34, 35], { result: `排序结果：${state.items.join(', ')}` })
      break
    case 'sequential-search': {
      ensureLinearData(state)
      const parts = input.split(',').map(s => s.trim())
      const target = parseSingleNumber(parts[0], state.items[0] ?? 0)
      const matches = []
      tracer.addBlock('执行顺序查找', [18, 20], { result: `准备查找 ${target} 的全部匹配位置` })
      for (let index = 0; index < state.items.length; index += 1) {
        const matched = state.items[index] === target
        tracer.addBlock(`检查位置 ${index} 的元素 ${state.items[index]}`, [22, 24], {
          result: matched ? `位置 ${index} 命中 ${target}` : `当前位置不是 ${target}`,
          highlightIndices: [index],
          pointers: [makePointer(index, 'i', matched ? '#22c55e' : '#ef4444')],
        })
        if (matched) {
          matches.push(index)
          tracer.addBlock(`记录匹配位置 ${index}`, [22, 24], {
            result: `当前已找到：${matches.join(', ')}`,
            highlightIndices: [index],
            pointers: [makePointer(index, 'hit', '#22c55e')],
          })
        }
      }
      tracer.addBlock('顺序查找结束', [25, 26], {
        result: matches.length
          ? `元素 ${target} 的全部位置：${matches.join(', ')}`
          : `未找到 ${target}`,
        highlightIndices: matches,
      })
      break
    }
    case 'reverse-search': {
      ensureLinearData(state)
      const target = parseSingleNumber(input, state.items[state.items.length - 1] ?? 0)
      tracer.addBlock('执行逆序查找', [18, 20], { result: `准备从尾到头查找 ${target} 的全部匹配位置` })
      const matches = []
      for (let index = state.items.length - 1; index >= 0; index -= 1) {
        const matched = state.items[index] === target
        tracer.addBlock(`检查位置 ${index} 的元素 ${state.items[index]}`, [22, 24], {
          result: matched ? `位置 ${index} 命中 ${target}` : `当前位置不是 ${target}`,
          highlightIndices: [index],
          pointers: [makePointer(index, 'i', matched ? '#22c55e' : '#ef4444')],
        })
        if (matched) {
          matches.push(index)
          tracer.addBlock(`记录匹配位置 ${index}`, [22, 24], {
            result: `当前已找到：${matches.join(', ')}`,
            highlightIndices: [index],
            pointers: [makePointer(index, 'hit', '#22c55e')],
          })
        }
      }
      tracer.addBlock('逆序查找结束', [25, 26], {
        result: matches.length ? `元素 ${target} 的全部位置：${matches.join(', ')}` : `未找到 ${target}`,
        highlightIndices: matches,
      })
      break
    }
    case 'binary-search': {
      ensureLinearData(state)
      state.items.sort((a, b) => a - b)
      const target = parseSingleNumber(input, state.items[0] ?? 0)
      let left = 0
      let right = state.items.length - 1
      let found = -1
      const matches = []
      tracer.addBlock('执行折半查找', [21, 23], { result: `排序后序列：${state.items.join(', ')}` })
      while (left <= right) {
        const mid = Math.floor((left + right) / 2)
        const range = Array.from({ length: right - left + 1 }, (_, offset) => left + offset)
        tracer.addBlock(`检查中间位置 ${mid} 的元素 ${state.items[mid]}`, [24, 26], {
          result: `当前查找区间 [${left}, ${right}]`,
          highlightIndices: [...range, mid],
          pointers: [
            makePointer(left, 'L', '#38bdf8'),
            makePointer(mid, 'M', '#f59e0b'),
            makePointer(right, 'R', '#f472b6'),
          ],
        })
        if (state.items[mid] === target) {
          found = mid
          break
        }
        if (state.items[mid] < target) left = mid + 1
        else right = mid - 1
      }
      if (found >= 0) {
        let start = found
        let end = found
        while (start - 1 >= 0 && state.items[start - 1] === target) start -= 1
        while (end + 1 < state.items.length && state.items[end + 1] === target) end += 1
        for (let index = start; index <= end; index += 1) matches.push(index)
        tracer.addBlock(`向左右扩展重复值区间 [${start}, ${end}]`, [27, 29], {
          result: `目标 ${target} 的重复值位置：${matches.join(', ')}`,
          highlightIndices: matches,
          pointers: matches.map((index) => makePointer(index, 'hit', '#22c55e')),
        })
      }
      tracer.addBlock('折半查找结束', [30, 31], {
        result: matches.length ? `元素 ${target} 的全部位置：${matches.join(', ')}` : `未找到 ${target}`,
        highlightIndices: matches,
        pointers: matches.map((index) => makePointer(index, 'hit', '#22c55e')),
      })
      break
    }
    case 'search-by-pos':
    case 'list-search-by-pos': {
      ensureLinearData(state)
      const index = clampLinearSlot(parseSingleNumber(input, 0), Math.max(state.items.length - 1, 0))
      tracer.addBlock(`准备查找显示序号 ${index} 的元素`, [6, 7], { result: `目标显示序号为 ${index}` })
      for (let cursor = 0; cursor <= index; cursor += 1) {
        tracer.addBlock(`移动到显示序号 ${cursor}`, [9, 10], {
          result: cursor === index ? '定位到目标位置' : `继续查找到显示序号 ${index}`,
          highlightIndices: [cursor],
          pointers: [makePointer(cursor, 'i', cursor === index ? '#22c55e' : '#ef4444')],
        })
      }
      tracer.addBlock(`显示序号 ${index} 的元素为 ${state.items[index]}`, [13, 14], {
        result: `查找到的元素值：${state.items[index]}`,
        highlightIndices: [index],
      })
      break
    }
    case 'search-by-val':
    case 'list-search-by-val': {
      ensureLinearData(state)
      const parts = input.split(',').map(s => s.trim())
      const target = parseSingleNumber(parts[0], state.items[0] ?? 0)
      const matches = []
      tracer.addBlock(`准备按值查找 ${target}`, [6, 7], {
        result: `在 ${state.items.length} 个元素中查找全部匹配`,
      })
      for (let i = 0; i < state.items.length; i += 1) {
        const matched = state.items[i] === target
        tracer.addBlock(`检查位置 ${i} 的元素 ${state.items[i]}`, [9, 10], {
          result: matched ? `位置 ${i} 命中 ${target}` : `继续查找`,
          highlightIndices: [i],
          pointers: [makePointer(i, 'i', matched ? '#22c55e' : '#ef4444')],
        })
        if (matched) {
          matches.push(i)
          tracer.addBlock(`记录匹配位置 ${i}`, [9, 10], {
            result: `当前已找到：${matches.join(', ')}`,
            highlightIndices: [i],
            pointers: [makePointer(i, 'hit', '#22c55e')],
          })
        }
      }
      tracer.addBlock('按值查找结束', [12, 13], {
        result: matches.length
          ? `在位置 ${matches.join(', ')} 找到 ${target}`
          : `未找到 ${target}`,
        highlightIndices: matches,
      })
      break
    }
    case 'update':
    case 'list-update': {
      ensureLinearData(state)
      const [posRaw, newVal] = parsePair(input, '1,0')
      const pos = Math.max(1, Math.min(posRaw, state.items.length))
      const index = pos - 1
      const oldVal = state.items[index]
      tracer.addBlock(`准备修改第 ${pos} 个位置的元素`, [6, 7], { result: `目标位置第 ${pos} 个，旧值：${oldVal}，新值：${newVal}` })
      for (let cursor = 0; cursor <= index; cursor += 1) {
        tracer.addBlock(`扫描到第 ${cursor + 1} 个位置的元素 ${state.items[cursor]}`, [9, 10], {
          result: cursor === index ? '定位到待修改元素' : `继续定位第 ${pos} 个位置`,
          highlightIndices: [cursor],
          pointers: [makePointer(cursor, 'i', cursor === index ? '#22c55e' : '#ef4444')],
        })
      }
      tracer.addBlock(`读取第 ${pos} 个位置的旧值 ${oldVal}`, [11, 12], {
        result: `确认旧值为 ${oldVal}`,
        highlightIndices: [index],
        pointers: [makePointer(index, 'old', '#f59e0b')],
      })
      state.items[index] = newVal
      tracer.addBlock(`将第 ${pos} 个位置的 ${oldVal} 替换为 ${newVal}`, [12, 13], {
        result: `修改成功，第 ${pos} 个位置的新值为 ${newVal}`,
        highlightIndices: [index],
        pointers: [makePointer(index, 'new', '#22c55e')],
      })
      break
    }
    case 'random':
    case 'list-random': {
      const len = Math.max(1, Math.min(Number(capacityInput) || state.capacity || 10, 30))
      state.capacity = len
      state.items = Array.from({ length: len }, () => Math.floor(Math.random() * 99) + 1)
      state.meta = { ...(state.meta || {}), heapSize: state.items.length }
      syncHeapSortView()
      tracer.addBlock(`按固定表长生成 ${len} 个随机数`, [18, 19], { result: `表长 ${state.capacity}，生成数量 ${len}` })
      tracer.addBlock(`随机序列：${state.items.join(', ')}`, [19, 20], {
        result: `顺序表包含 ${state.items.length} 个元素`,
        highlightIndices: state.items.map((_, i) => i),
      })
      break
    }
    case 'clear':
    case 'list-clear':
      tracer.addBlock('开始清空顺序表', [18, 19], { result: `当前有 ${state.items.length} 个元素` })
      while (state.items.length) {
        tracer.addBlock(`移除位置 0 的元素 ${state.items[0]}`, [20, 21], {
          result: '正在逐个清空',
          highlightIndices: [0],
        })
        state.items.shift()
      }
      tracer.addBlock('顺序表已清空', [22, 23], { result: '所有元素已移除' })
      break
    case 'bubble-sort':
      ensureLinearData(state)
      tracer.addBlock('开始执行冒泡排序', [8, 10], { result: `当前序列：${state.items.join(', ')}` })
      for (let end = state.items.length - 1; end > 0; end -= 1) {
        const round = state.items.length - end
        let swapped = false
        tracer.addBlock(`=== 第 ${round} 轮开始 ===`, [19, 21], {
          result: `本轮待排序区间 [0, ${end}]`,
        }, `round-${round}`)
        for (let index = 0; index < end; index += 1) {
          tracer.addBlock(`比较位置 ${index} 和 ${index + 1}`, [24, 26], {
            result: `比较 ${state.items[index]} 与 ${state.items[index + 1]}`,
            highlightIndices: [index, index + 1],
            pointers: [
              makePointer(index, 'j', '#ef4444'),
              makePointer(index + 1, 'j+1', '#f59e0b'),
            ],
          })
          if (state.items[index] > state.items[index + 1]) {
            ;[state.items[index], state.items[index + 1]] = [state.items[index + 1], state.items[index]]
            swapped = true
            tracer.addBlock(`交换位置 ${index} 和 ${index + 1} 的元素`, [26, 27], {
              result: `交换后：${state.items.join(', ')}`,
              highlightIndices: [index, index + 1],
              pointers: [
                makePointer(index, 'j', '#ef4444'),
                makePointer(index + 1, 'j+1', '#f59e0b'),
              ],
            })
          }
        }
        tracer.addBlock(`=== 第 ${round} 轮结束 ===`, [30, 31], {
          result: swapped ? `本轮结果：${state.items.join(', ')}` : '本轮未交换，序列已有序',
        }, `round-end-${round}`)
        if (!swapped) break
      }
      tracer.addBlock('冒泡排序完成', [33, 34], { result: `排序结果：${state.items.join(', ')}` })
      break
    case 'selection-sort':
      ensureLinearData(state)
      tracer.addBlock('开始执行选择排序', [8, 10], { result: `当前序列：${state.items.join(', ')}` })
      for (let i = 0; i < state.items.length - 1; i += 1) {
        tracer.addBlock(`=== 第 ${i + 1} 轮开始 ===`, [19, 21], { result: `当前有序区：[0, ${i - 1}]，无序区：[${i}, ${state.items.length - 1}]` }, `round-${i + 1}`)
        let minIdx = i
        for (let j = i + 1; j < state.items.length; j += 1) {
          tracer.addBlock(`比较 ${state.items[j]} 与当前最小值 ${state.items[minIdx]}`, [23, 25], {
            result: state.items[j] < state.items[minIdx] ? `发现更小值 ${state.items[j]}` : `${state.items[minIdx]} 仍为最小`,
            highlightIndices: [j, minIdx],
            pointers: [
              makePointer(i, 'i', '#8b5cf6'),
              makePointer(j, 'j', '#ef4444'),
              makePointer(minIdx, 'min', '#22c55e'),
            ],
          })
          if (state.items[j] < state.items[minIdx]) minIdx = j
        }
        if (minIdx !== i) {
          tracer.addBlock(`交换位置 ${i} 和 ${minIdx}`, [27, 28], {
            result: `交换 ${state.items[i]} 与 ${state.items[minIdx]}`,
            highlightIndices: [i, minIdx],
            pointers: [
              makePointer(i, 'i', '#8b5cf6'),
              makePointer(minIdx, 'min', '#22c55e'),
            ],
          })
          ;[state.items[i], state.items[minIdx]] = [state.items[minIdx], state.items[i]]
        }
        tracer.addBlock(`=== 第 ${i + 1} 轮结束 ===`, [29, 30], { result: `当前序列：${state.items.join(', ')}` }, `round-end-${i + 1}`)
      }
      tracer.addBlock('选择排序完成', [32, 33], { result: `排序结果：${state.items.join(', ')}` })
      break
    case 'quick-sort':
      ensureLinearData(state)
      tracer.addBlock('开始执行快速排序', [1, 3], { result: `当前序列：${state.items.join(', ')}` })
      ;((arr, lo, hi, roundIdx) => {
        const quickSort = (left, right, roundNo) => {
          if (left >= right) return
          const pivot = arr[left]
          tracer.addBlock(`=== 第 ${roundNo} 轮：处理区间 [${left}, ${right}] ===`, [7, 9], { result: `选取基准元素 ${pivot}` }, `round-${roundNo}`)
          let i = left, j = right
          tracer.addBlock(`选取基准元素 ${pivot}（位置 ${left}）`, [9, 10], {
            result: `基准值 = ${pivot}`,
            highlightIndices: [left],
            pointers: [makePointer(left, 'pivot', '#8b5cf6')],
          })
          while (i < j) {
            while (i < j && arr[j] >= pivot) {
              tracer.addBlock(`从右向左跳过 ${arr[j]} >= ${pivot}`, [12, 14], {
                highlightIndices: [j],
                pointers: [
                  makePointer(left, 'pivot', '#8b5cf6'),
                  makePointer(i, 'i', '#22c55e'),
                  makePointer(j, 'j', '#ef4444'),
                ],
              })
              j -= 1
            }
            if (i < j) {
              arr[i] = arr[j]
              tracer.addBlock(`将 ${arr[j]} 放到左边`, [15, 16], {
                result: `i=${i}, j=${j}`,
                highlightIndices: [i, j],
                pointers: [
                  makePointer(left, 'pivot', '#8b5cf6'),
                  makePointer(i, 'i', '#22c55e'),
                  makePointer(j, 'j', '#ef4444'),
                ],
              })
              i += 1
            }
            while (i < j && arr[i] < pivot) {
              tracer.addBlock(`从左向右跳过 ${arr[i]} < ${pivot}`, [17, 18], {
                highlightIndices: [i],
                pointers: [
                  makePointer(left, 'pivot', '#8b5cf6'),
                  makePointer(i, 'i', '#22c55e'),
                  makePointer(j, 'j', '#ef4444'),
                ],
              })
              i += 1
            }
            if (i < j) {
              arr[j] = arr[i]
              tracer.addBlock(`将 ${arr[i]} 放到右边`, [19, 20], {
                result: `i=${i}, j=${j}`,
                highlightIndices: [i, j],
                pointers: [
                  makePointer(left, 'pivot', '#8b5cf6'),
                  makePointer(i, 'i', '#22c55e'),
                  makePointer(j, 'j', '#ef4444'),
                ],
              })
              j -= 1
            }
          }
          arr[i] = pivot
          tracer.addBlock(`将基准 ${pivot} 放到正确位置 ${i}`, [21, 22], {
            result: `基准归位完成，区间 [${left}, ${right}] 划分完毕`,
            highlightIndices: [i],
            pointers: [makePointer(i, 'pivot', '#8b5cf6')],
          })
          tracer.addBlock(`=== 第 ${roundNo} 轮结束 ===`, [23, 24], { result: `当前序列：${arr.join(', ')}` }, `round-end-${roundNo}`)
          quickSort(left, i - 1, roundNo + 1)
          quickSort(i + 1, right, roundNo + 2)
        }
        quickSort(lo, hi, roundIdx)
      })(state.items, 0, state.items.length - 1, 1)
      tracer.addBlock('快速排序完成', [25, 26], { result: `排序结果：${state.items.join(', ')}` })
      break
    case 'shell-sort':
      ensureLinearData(state)
      tracer.addBlock('开始执行希尔排序', [10, 12], { result: `当前序列：${state.items.join(', ')}` })
      ;((arr) => {
        let gap = Math.floor(arr.length / 2)
        let roundIdx = 1
        tracer.addBlock(`初始增量 gap = ${gap}`, [13, 14], { result: `分成 ${gap} 组`, pointers: [makePointer(0, `gap=${gap}`, '#8b5cf6')] })
        while (gap >= 1) {
          tracer.addBlock(`=== 第 ${roundIdx} 轮（gap=${gap}）开始 ===`, [14, 15], { result: `按间隔 ${gap} 进行直接插入排序` }, `round-${roundIdx}`)
          for (let i = gap; i < arr.length; i += 1) {
            const temp = arr[i]
            let j = i - gap
            tracer.addBlock(`比较间隔为 ${gap} 的元素：${temp} 与 ${arr[j]}`, [20, 21], {
              result: `temp = ${temp}，j = ${j}`,
              highlightIndices: [i, j].filter(x => x >= 0 && x < arr.length),
              pointers: [
                makePointer(i, 'i', '#ef4444'),
                makePointer(j, 'j', '#22c55e'),
              ],
            })
            while (j >= 0 && arr[j] > temp) {
              tracer.addBlock(`元素 ${arr[j]} 后移 ${gap} 位`, [22, 24], {
                result: `arr[${j + gap}] = ${arr[j]}`,
                highlightIndices: [j, j + gap].filter(x => x >= 0 && x < arr.length),
                pointers: [
                  makePointer(j, 'j', '#22c55e'),
                  makePointer(j + gap, `+${gap}`, '#f59e0b'),
                ],
              })
              arr[j + gap] = arr[j]
              j -= gap
            }
            arr[j + gap] = temp
            tracer.addBlock(`将 ${temp} 插入到位置 ${j + gap}`, [25, 26], {
              result: `当前序列：${arr.join(', ')}`,
              highlightIndices: [j + gap],
              pointers: [makePointer(j + gap, 'insert', '#22c55e')],
            })
          }
          tracer.addBlock(`=== 第 ${roundIdx} 轮（gap=${gap}）结束 ===`, [27, 28], { result: `当前序列：${arr.join(', ')}` }, `round-end-${roundIdx}`)
          roundIdx += 1
          gap = Math.floor(gap / 2)
          if (gap > 0) {
            tracer.addBlock(`缩小增量，gap = ${gap}`, [13, 14], { result: `分成 ${gap} 组`, pointers: [makePointer(0, `gap=${gap}`, '#8b5cf6')] })
          }
        }
      })(state.items)
      tracer.addBlock('希尔排序完成', [29, 30], { result: `排序结果：${state.items.join(', ')}` })
      break
    case 'heap-sort': {
      ensureLinearData(state)
      state.meta = { ...(state.meta || {}), heapSize: state.items.length }
      syncHeapSortView()
      tracer.addBlock('开始执行堆排序', [8, 10], { result: `当前序列：${state.items.join(', ')}` })
      for (let start = Math.floor(state.items.length / 2) - 1; start >= 0; start -= 1) {
        let root = start
        tracer.addBlock(`从最后一个非叶子结点 ${start} 开始下滤建堆`, [12, 14], {
          result: `准备调整以 ${start} 为根的子树`,
          highlightIndices: [root],
        })
        while (true) {
          const left = root * 2 + 1
          const right = left + 1
          let largest = root
          if (left < state.meta.heapSize && state.items[left] > state.items[largest]) largest = left
          if (right < state.meta.heapSize && state.items[right] > state.items[largest]) largest = right
          if (largest === root) break
          ;[state.items[root], state.items[largest]] = [state.items[largest], state.items[root]]
          syncHeapSortView()
          tracer.addBlock(`交换 ${root} 与 ${largest}，维持大顶堆`, [16, 18], {
            result: `当前堆区：${state.items.slice(0, state.meta.heapSize).join(', ')}`,
            highlightIndices: [root, largest],
          })
          root = largest
        }
      }
      tracer.addBlock('初始大顶堆建立完成', [20, 21], {
        result: `堆顶元素为 ${state.items[0]}`,
        highlightIndices: [0],
      })
      for (let end = state.items.length - 1; end > 0; end -= 1) {
        ;[state.items[0], state.items[end]] = [state.items[end], state.items[0]]
        state.meta.heapSize = end
        syncHeapSortView()
        tracer.addBlock(`将堆顶交换到位置 ${end}，已排序区扩大`, [23, 24], {
          result: `已排序区起点为 ${end}`,
          highlightIndices: [0, end],
        })
        let root = 0
        while (true) {
          const left = root * 2 + 1
          const right = left + 1
          let largest = root
          if (left < end && state.items[left] > state.items[largest]) largest = left
          if (right < end && state.items[right] > state.items[largest]) largest = right
          if (largest === root) break
          ;[state.items[root], state.items[largest]] = [state.items[largest], state.items[root]]
          syncHeapSortView()
          tracer.addBlock(`下滤调整：交换 ${root} 与 ${largest}`, [26, 28], {
            result: `剩余堆区长度 ${end}`,
            highlightIndices: [root, largest],
          })
          root = largest
        }
      }
      state.meta.heapSize = 0
      syncHeapSortView()
      tracer.addBlock('堆排序完成', [30, 31], { result: `排序结果：${state.items.join(', ')}`, highlightIndices: state.items.map((_, index) => index) })
      break
    }
    default:
      tracer.add('未实现的顺序表操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runSingleLinkedList(action, rawInput, currentState) {
  const state = ensureSingleLinkedListState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)

  switch (action.key) {
    case 'head-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('开始头插法建立单链表', [1, 4], { result: `准备处理 ${values.length} 个结点` })
      values.forEach((value, index) => {
        state.items.unshift(value)
        tracer.addBlock(`将结点 ${value} 插入到表头`, [6, 7], {
          result: `头插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [0],
        })
      })
      tracer.addBlock('单链表头插法建立完成', [8, 9], { result: `结点总数：${state.items.length}` })
      break
    }
    case 'tail-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('开始尾插法建立单链表', [1, 4], { result: `准备处理 ${values.length} 个结点` })
      values.forEach((value, index) => {
        state.items.push(value)
        tracer.addBlock(`在表尾追加结点 ${value}`, [6, 7], {
          result: `尾插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [state.items.length - 1],
        })
      })
      tracer.addBlock('单链表尾插法建立完成', [8, 9], { result: `结点总数：${state.items.length}` })
      break
    }
    case 'insert': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const [positionRaw, value] = parsePair(input, action.defaultInput)
      const position = Math.max(1, Math.min(positionRaw, state.items.length + 1))
      tracer.addBlock('解析插入位置与结点值', [1, 3], { result: `准备在位置 ${position} 插入 ${value}` })
      for (let cursor = 0; cursor < position - 1; cursor += 1) {
        tracer.addBlock(`经过第 ${cursor + 1} 个结点`, [5, 6], {
          result: `定位到位置 ${position}`,
          highlightIndices: [cursor],
        })
      }
      state.items.splice(position - 1, 0, value)
      tracer.addBlock('单链表插入完成', [7, 8], {
        result: `已在位置 ${position} 插入 ${value}`,
        highlightIndices: [position - 1],
      })
      break
    }
    case 'search': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('开始在单链表中查找', [1, 3], { result: `查找目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`访问第 ${index + 1} 个结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? `命中目标 ${target}` : `继续查找 ${target}`,
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      tracer.addBlock('单链表查找结束', [7, 8], {
        result: found >= 0 ? `在位置 ${found + 1} 找到 ${target}` : `未找到目标 ${target}`,
        highlightIndices: found >= 0 ? [found] : [],
      })
      break
    }
    case 'traverse': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      tracer.addBlock('从首元结点开始遍历单链表', [1, 2], { result: `当前共有 ${state.items.length} 个结点` })
      state.items.forEach((value, index) => {
        tracer.addBlock(`访问第 ${index + 1} 个结点 ${value}`, [3, 4], {
          output: state.items.slice(0, index + 1),
          result: `当前遍历结果：${state.items.slice(0, index + 1).join(' -> ')}`,
          highlightIndices: [index],
        })
      })
      tracer.addBlock('单链表遍历结束', [5, 6], {
        output: [...state.items],
        result: `遍历结果：${state.items.join(' -> ')}`,
        highlightIndices: state.items.length ? [state.items.length - 1] : [],
      })
      break
    }
    case 'delete': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('开始在单链表中删除', [1, 3], { result: `删除目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`检查第 ${index + 1} 个结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? '找到目标结点' : `继续搜索 ${target}`,
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      if (found >= 0) state.items.splice(found, 1)
      tracer.addBlock('单链表删除完成', [7, 8], {
        result: found >= 0 ? `已删除值为 ${target} 的结点` : `未找到目标 ${target}`,
      })
      break
    }
    default:
      tracer.add('未实现的单链表操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runHeadLinkedList(action, rawInput, currentState) {
  const state = ensureSingleLinkedListState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)

  switch (action.key) {
    case 'head-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('头插法建立带头结点单链表', [1, 4], { result: `准备处理 ${values.length} 个结点` })
      values.forEach((value, index) => {
        state.items.unshift(value)
        tracer.addBlock(`将结点 ${value} 插入到头结点之后`, [6, 7], {
          result: `头插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [0],
        })
      })
      tracer.addBlock('带头结点单链表建立完成', [8, 9], { result: `数据结点数：${state.items.length}` })
      break
    }
    case 'tail-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('尾插法建立带头结点单链表', [1, 4], { result: `准备处理 ${values.length} 个结点` })
      values.forEach((value, index) => {
        state.items.push(value)
        tracer.addBlock(`在尾部追加结点 ${value}`, [6, 7], {
          result: `尾插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [state.items.length - 1],
        })
      })
      tracer.addBlock('带头结点单链表建立完成', [8, 9], { result: `数据结点数：${state.items.length}` })
      break
    }
    case 'insert': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const [positionRaw, value] = parsePair(input, action.defaultInput)
      const position = Math.max(1, Math.min(positionRaw, state.items.length + 1))
      tracer.addBlock('从头结点开始定位前驱', [1, 3], { result: `准备在位置 ${position} 插入 ${value}` })
      for (let cursor = 0; cursor < position - 1; cursor += 1) {
        tracer.addBlock(`移动当前指针到第 ${cursor + 1} 个数据结点`, [5, 6], {
          result: '继续定位插入位置',
          highlightIndices: [cursor],
        })
      }
      state.items.splice(position - 1, 0, value)
      tracer.addBlock('带头结点单链表插入完成', [7, 8], {
        result: `已在位置 ${position} 插入 ${value}`,
        highlightIndices: [position - 1],
      })
      break
    }
    case 'search': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('从头结点的 next 开始查找', [1, 3], { result: `查找目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`访问第 ${index + 1} 个数据结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? `命中目标 ${target}` : '移动到下一个结点',
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      tracer.addBlock('带头结点单链表查找结束', [7, 8], {
        result: found >= 0 ? `在第 ${found + 1} 个结点找到 ${target}` : `未找到目标 ${target}`,
        highlightIndices: found >= 0 ? [found] : [],
      })
      break
    }
    case 'traverse':
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      tracer.addBlock('从头结点的 next 开始遍历', [1, 2], { result: `当前共有 ${state.items.length} 个数据结点` })
      state.items.forEach((value, index) => {
        tracer.addBlock(`访问第 ${index + 1} 个数据结点 ${value}`, [3, 4], {
          output: state.items.slice(0, index + 1),
          result: `当前遍历结果：${state.items.slice(0, index + 1).join(' -> ')}`,
          highlightIndices: [index],
        })
      })
      tracer.addBlock('带头结点单链表遍历结束', [5, 6], {
        output: [...state.items],
        result: `遍历结果：${state.items.join(' -> ')}`,
        highlightIndices: state.items.length ? [state.items.length - 1] : [],
      })
      break
    case 'delete': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('查找目标结点的前驱', [1, 3], { result: `删除目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`检查第 ${index + 1} 个数据结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? '目标结点已定位' : '继续搜索',
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      if (found >= 0) state.items.splice(found, 1)
      tracer.addBlock('带头结点单链表删除完成', [7, 8], {
        result: found >= 0 ? `已删除值为 ${target} 的结点` : `未找到目标 ${target}`,
        highlightIndices: found >= 0 && state.items.length ? [Math.max(found - 1, 0)] : [],
      })
      break
    }
    case 'length':
      tracer.addBlock('从头结点的 next 开始计数', [1, 3], { result: '长度 = 0' })
      state.items.forEach((value, index) => {
        tracer.addBlock(`计数结点 ${value}`, [4, 5], {
          result: `当前长度 = ${index + 1}`,
          highlightIndices: [index],
        })
      })
      tracer.addBlock('计数完成', [6, 7], { result: `表长 = ${state.items.length}` })
      break
    case 'reverse': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const original = [...state.items]
      tracer.addBlock('设置 prev = null，cur = head.next', [1, 3], { result: '开始逆置链表' })
      original.forEach((value, index) => {
        tracer.addBlock(`逆置结点 ${value} 的指针`, [4, 5], {
          result: `已处理 ${index + 1} / ${original.length} 个结点`,
          highlightIndices: [index],
        })
      })
      state.items.reverse()
      tracer.addBlock('将头结点的 next 重新指向新的首元结点', [6, 7], {
        result: '逆置完成',
        highlightIndices: state.items.length ? [0] : [],
      })
      break
    }
    case 'update': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const [positionRaw, value] = parsePair(input, action.defaultInput)
      const position = Math.max(1, Math.min(positionRaw, state.items.length))
      tracer.addBlock('从头结点的 next 定位待更新结点', [1, 3], { result: `更新位置 ${position}` })
      for (let index = 0; index < position - 1; index += 1) {
        tracer.addBlock(`经过第 ${index + 1} 个结点，值为 ${state.items[index]}`, [4, 5], {
          result: '移动到目标结点',
          highlightIndices: [index],
        })
      }
      const oldValue = state.items[position - 1]
      state.items[position - 1] = value
      tracer.addBlock('结点更新完成', [6, 7], {
        result: `第 ${position} 个结点：${oldValue} → ${value}`,
        highlightIndices: [position - 1],
      })
      break
    }
    case 'get-by-index': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const position = Math.max(1, Math.min(parseSingleNumber(input, action.defaultInput), state.items.length))
      tracer.addBlock('从头结点的 next 按序号定位', [1, 3], { result: `序号 = ${position}` })
      for (let index = 0; index < position; index += 1) {
        tracer.addBlock(`移动到第 ${index + 1} 个结点，值为 ${state.items[index]}`, [4, 5], {
          result: index === position - 1 ? '到达目标结点' : '继续移动',
          highlightIndices: [index],
        })
      }
      tracer.addBlock('按序号取值完成', [6, 7], {
        result: `第 ${position} 个结点的值为 ${state.items[position - 1]}`,
        highlightIndices: [position - 1],
      })
      break
    }
    case 'is-empty':
      tracer.addBlock('检查头结点的 next 是否为空', [1, 3], { result: '比较 head.next 与 null' })
      tracer.addBlock('判空完成', [4, 5], {
        flag: state.items.length === 0,
        result: state.items.length === 0 ? '链表为空' : `链表非空（共 ${state.items.length} 个结点）`,
      })
      break
    default:
      tracer.add('未实现的带头结点单链表操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runDoublyLinkedList(action, rawInput, currentState) {
  const state = ensureSingleLinkedListState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)

  switch (action.key) {
    case 'head-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('头插法建立双向链表', [1, 4], { result: `准备处理 ${values.length} 个结点` })
      values.forEach((value, index) => {
        state.items.unshift(value)
        tracer.addBlock(`插入结点 ${value} 并更新前驱/后继指针`, [6, 7], {
          result: `头插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [0],
        })
      })
      tracer.addBlock('双向链表建立完成', [8, 9], { result: `数据结点数：${state.items.length}` })
      break
    }
    case 'tail-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('尾插法建立双向链表', [1, 4], { result: `准备处理 ${values.length} 个结点` })
      values.forEach((value, index) => {
        state.items.push(value)
        tracer.addBlock(`追加结点 ${value} 并更新前驱/后继指针`, [6, 7], {
          result: `尾插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [state.items.length - 1],
        })
      })
      tracer.addBlock('双向链表建立完成', [8, 9], { result: `数据结点数：${state.items.length}` })
      break
    }
    case 'insert': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const [positionRaw, value] = parsePair(input, action.defaultInput)
      const position = Math.max(1, Math.min(positionRaw, state.items.length + 1))
      tracer.addBlock('在双向链表中定位插入位置', [1, 3], { result: `准备在位置 ${position} 插入 ${value}` })
      for (let cursor = 0; cursor < position - 1; cursor += 1) {
        tracer.addBlock(`访问第 ${cursor + 1} 个结点并检查前驱/后继`, [5, 6], {
          result: '继续定位插入位置',
          highlightIndices: [cursor],
        })
      }
      state.items.splice(position - 1, 0, value)
      tracer.addBlock('双向链表插入完成', [7, 8], {
        result: `已在位置 ${position} 插入 ${value}`,
        highlightIndices: [position - 1],
      })
      break
    }
    case 'search': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('从首元结点开始查找双向链表', [1, 3], { result: `查找目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`检查第 ${index + 1} 个结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? '找到目标结点' : '移动到下一个结点',
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      tracer.addBlock('双向链表查找结束', [7, 8], {
        result: found >= 0 ? `在第 ${found + 1} 个结点找到 ${target}` : `未找到目标 ${target}`,
        highlightIndices: found >= 0 ? [found] : [],
      })
      break
    }
    case 'delete': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('在双向链表中定位待删除结点', [1, 3], { result: `删除目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`检查第 ${index + 1} 个结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? '找到目标结点' : '继续搜索',
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      if (found >= 0) state.items.splice(found, 1)
      tracer.addBlock('双向链表删除完成', [7, 8], {
        result: found >= 0 ? `已删除值为 ${target} 的结点` : `未找到目标 ${target}`,
        highlightIndices: found >= 0 && state.items.length ? [Math.min(found, state.items.length - 1)] : [],
      })
      break
    }
    case 'forward-traverse':
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      tracer.addBlock('从首元结点开始做正向遍历', [1, 2], { result: `当前共有 ${state.items.length} 个结点` })
      state.items.forEach((value, index) => {
        tracer.addBlock(`沿 next 访问第 ${index + 1} 个结点 ${value}`, [3, 4], {
          output: state.items.slice(0, index + 1),
          result: `当前正向结果：${state.items.slice(0, index + 1).join(' <-> ')}`,
          highlightIndices: [index],
        })
      })
      tracer.addBlock('双向链表正向遍历结束', [5, 6], {
        output: [...state.items],
        result: `正向遍历：${state.items.join(' <-> ')}`,
        highlightIndices: state.items.length ? [state.items.length - 1] : [],
      })
      break
    case 'reverse-traverse': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const reverseValues = [...state.items].reverse()
      tracer.addBlock('从尾结点开始做逆向遍历', [1, 2], { result: `当前共有 ${state.items.length} 个结点` })
      reverseValues.forEach((value, index) => {
        const rawIndex = state.items.length - 1 - index
        tracer.addBlock(`沿 prior 访问第 ${index + 1} 个结点 ${value}`, [3, 4], {
          output: reverseValues.slice(0, index + 1),
          result: `当前逆向结果：${reverseValues.slice(0, index + 1).join(' <-> ')}`,
          highlightIndices: [rawIndex],
        })
      })
      tracer.addBlock('双向链表逆向遍历结束', [5, 6], {
        output: reverseValues,
        result: `逆向遍历：${reverseValues.join(' <-> ')}`,
        highlightIndices: state.items.length ? [0] : [],
      })
      break
    }
    default:
      tracer.add('未实现的双向链表操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runCircularLinkedList(action, rawInput, currentState) {
  const state = ensureSingleLinkedListState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)

  switch (action.key) {
    case 'head-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('头插法建立带头结点循环单链表', [1, 4], { result: `准备处理 ${values.length} 个结点，头结点保持存在` })
      values.forEach((value, index) => {
        state.items.unshift(value)
        tracer.addBlock(`将结点 ${value} 插入到头结点之后，并保持 tail.next → H`, [6, 7], {
          result: `头插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [0],
        })
      })
      tracer.addBlock('带头结点循环单链表建立完成', [8, 9], {
        result: state.items.length ? '尾结点 next 已重新指向头结点 H' : '循环链表为空，仅保留头结点',
        highlightIndices: state.items.length ? [0, state.items.length - 1] : [],
      })
      break
    }
    case 'tail-create': {
      const values = parseNumberList(input, action.defaultInput)
      state.items = []
      tracer.addBlock('尾插法建立带头结点循环单链表', [1, 4], { result: `准备处理 ${values.length} 个结点，头结点保持存在` })
      values.forEach((value, index) => {
        state.items.push(value)
        tracer.addBlock(`追加结点 ${value}，并重新连接 tail.next → H`, [6, 7], {
          result: `尾插法进度 ${index + 1} / ${values.length}`,
          highlightIndices: [state.items.length - 1],
        })
      })
      tracer.addBlock('带头结点循环单链表建立完成', [8, 9], {
        result: state.items.length ? '循环链接已建立，尾结点回指头结点 H' : '循环链表为空，仅保留头结点',
        highlightIndices: state.items.length ? [0, state.items.length - 1] : [],
      })
      break
    }
    case 'insert': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const [positionRaw, value] = parsePair(input, action.defaultInput)
      const position = Math.max(1, Math.min(positionRaw, state.items.length + 1))
      tracer.addBlock('从头结点出发，遍历循环链表定位插入位置', [1, 3], { result: `准备在位置 ${position} 插入 ${value}` })
      for (let cursor = 0; cursor < position - 1; cursor += 1) {
        tracer.addBlock(`访问循环链表第 ${cursor + 1} 个结点，值为 ${state.items[cursor]}`, [5, 6], {
          result: '沿 next 指针继续移动',
          highlightIndices: [cursor],
        })
      }
      state.items.splice(position - 1, 0, value)
      tracer.addBlock('循环链表插入完成', [7, 8], {
        result: `已在位置 ${position} 插入 ${value}`,
        highlightIndices: [position - 1],
      })
      break
    }
    case 'search': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('从头结点的 next 开始查找循环链表', [1, 3], { result: `查找目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`访问循环链表第 ${index + 1} 个结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? '找到目标结点' : '沿环继续移动',
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      tracer.addBlock('循环链表查找结束', [7, 8], {
        result: found >= 0 ? `在第 ${found + 1} 个结点找到 ${target}` : `回到表头仍未找到 ${target}`,
        highlightIndices: found >= 0 ? [found] : [],
      })
      break
    }
    case 'traverse':
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      tracer.addBlock('从头结点的 next 开始遍历循环链表', [1, 2], { result: `当前共有 ${state.items.length} 个结点` })
      state.items.forEach((value, index) => {
        tracer.addBlock(`沿环访问第 ${index + 1} 个结点 ${value}`, [3, 4], {
          output: state.items.slice(0, index + 1),
          result: `当前遍历结果：${state.items.slice(0, index + 1).join(' -> ')}`,
          highlightIndices: [index],
        })
      })
      tracer.addBlock('循环单链表遍历结束', [5, 6], {
        output: [...state.items],
        result: `遍历结果：${state.items.join(' -> ')}，尾结点 next 回到头结点`,
        highlightIndices: state.items.length ? [state.items.length - 1] : [],
      })
      break
    case 'delete': {
      if (!state.items.length) state.items = parseNumberList('1,2,3,4')
      const target = parseSingleNumber(input, action.defaultInput)
      tracer.addBlock('从头结点出发定位待删除结点，并保持 tail.next → H', [1, 3], { result: `删除目标：${target}` })
      let found = -1
      for (let index = 0; index < state.items.length; index += 1) {
        tracer.addBlock(`访问循环链表第 ${index + 1} 个结点，值为 ${state.items[index]}`, [5, 6], {
          result: state.items[index] === target ? '找到目标结点' : '沿环继续移动',
          highlightIndices: [index],
        })
        if (state.items[index] === target) {
          found = index
          break
        }
      }
      if (found >= 0) state.items.splice(found, 1)
      tracer.addBlock('循环链表删除完成', [7, 8], {
        result: found >= 0 ? `已删除 ${target} 并重新连接 tail.next` : `回到表头仍未找到 ${target}`,
        highlightIndices: found >= 0 && state.items.length ? [Math.min(found, state.items.length - 1)] : [],
      })
      break
    }
    default:
      tracer.add('未实现的循环链表操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runBinaryTree(action, rawInput, currentState) {
  const state = ensureBinaryTreeState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)
  const ensureDefaultTree = () => {
    if (state.tree) return
    const defaults = normalizeInput('A,B,C,#,D,E,F', 'A,B,C,#,D,E,F').split(/[,\s，]+/).filter(Boolean)
    state.tree = buildTreeFromLevelOrder(defaults)
    state.sequence = treeToLevelOrder(state.tree)
  }
  const emitTraversal = (label, beginLines, visitLines, doneLines, visit) => {
    ensureDefaultTree()
    const order = []
    tracer.add(`开始${label}`, beginLines, { result: state.tree ? `准备执行${label}` : '当前树为空' })
    if (state.tree) visit(state.tree, (node) => {
      order.push(String(node.value))
      tracer.add(`访问结点 ${node.value}`, visitLines, {
        result: `当前${label}结果：${order.join(' -> ')}`,
        highlightNodes: [String(node.value)],
        traversalOrder: [...order],
      })
    })
    tracer.add(`${label}结束`, doneLines, {
      result: order.length ? `${label}：${order.join(' -> ')}` : '当前树为空',
      highlightNodes: order.length ? [order[order.length - 1]] : [],
      traversalOrder: [...order],
    })
  }

  switch (action.key) {
    case 'create': {
      const tokens = normalizeInput(input, action.defaultInput)
        .split(/[,\s，]+/)
        .map((item) => item.trim())
        .filter(Boolean)
      state.sequence = []
      state.tree = null
      tracer.add('读取层序序列并准备创建普通二叉树', [42, 43], { result: `共读取到 ${tokens.length} 个序列元素` })
      if (!tokens.length || ['#', 'null'].includes(String(tokens[0]).toLowerCase())) {
        tracer.add('普通二叉树创建结束', [42, 43], { result: '输入为空，未创建结点' })
        break
      }
      state.tree = createTreeNode(tokens[0])
      state.sequence = treeToLevelOrder(state.tree)
      tracer.add(`创建根结点 ${tokens[0]}`, [8, 9], {
        result: '根结点创建完成',
        highlightNodes: [tokens[0]],
      })
      const queue = [state.tree]
      let index = 1
      while (queue.length && index < tokens.length) {
        const current = queue.shift()
        tracer.add(`处理结点 ${current.value} 的左右孩子`, [25, 26], {
          result: '按层序为当前结点补充孩子结点',
          highlightNodes: [current.value],
        })
        const leftValue = tokens[index]
        index += 1
        if (leftValue && leftValue !== '#' && leftValue.toLowerCase() !== 'null') {
          current.left = createTreeNode(leftValue)
          queue.push(current.left)
          state.sequence = treeToLevelOrder(state.tree)
          tracer.add(`将 ${leftValue} 连接为 ${current.value} 的左孩子`, [28, 32], {
            result: `左孩子 ${leftValue} 已加入二叉树`,
            highlightNodes: [current.value, leftValue],
          })
        }
        const rightValue = tokens[index]
        index += 1
        if (rightValue && rightValue !== '#' && rightValue.toLowerCase() !== 'null') {
          current.right = createTreeNode(rightValue)
          queue.push(current.right)
          state.sequence = treeToLevelOrder(state.tree)
          tracer.add(`将 ${rightValue} 连接为 ${current.value} 的右孩子`, [34, 38], {
            result: `右孩子 ${rightValue} 已加入二叉树`,
            highlightNodes: [current.value, rightValue],
          })
        }
      }
      state.sequence = treeToLevelOrder(state.tree)
      tracer.add('普通二叉树创建完成', [40, 41], {
        result: `已创建包含 ${state.sequence.length} 个层序元素的二叉树`,
        highlightNodes: state.sequence.length ? [state.sequence[0]] : [],
      })
      break
    }
    case 'insert': {
      const defaultTokens = normalizeInput(action.defaultInput, 'A,B,C,#,D,E,F')
        .split(/[,\s，]+/)
        .filter(Boolean)
      if (!state.tree) {
        state.sequence = defaultTokens
        state.tree = buildTreeFromLevelOrder(defaultTokens)
      }
      const value = normalizeInput(input, 'X')
      tracer.add(`开始按层序寻找结点 ${value} 的插入位置`, [42, 43], { result: '从根结点开始逐层扫描' })
      if (!state.tree) {
        state.tree = createTreeNode(value)
        state.sequence = treeToLevelOrder(state.tree)
        tracer.add(`当前为空，${value} 成为根结点`, [8, 9], { result: '插入后该结点成为新的根', highlightNodes: [value] })
        tracer.add('普通二叉树插入完成', [40, 41], { result: `已插入结点 ${value}`, highlightNodes: [value] })
        break
      }
      const queue = [state.tree]
      while (queue.length) {
        const current = queue.shift()
        tracer.add(`访问结点 ${current.value}`, [25, 26], {
          result: '检查左右孩子是否存在空位',
          highlightNodes: [current.value],
        })
        if (!current.left) {
          current.left = createTreeNode(value)
          state.sequence = treeToLevelOrder(state.tree)
          tracer.add(`将 ${value} 插入为 ${current.value} 的左孩子`, [28, 32], {
            result: `插入位置已找到：${current.value} 的左侧`,
            highlightNodes: [current.value, value],
          })
          break
        }
        if (!current.right) {
          current.right = createTreeNode(value)
          state.sequence = treeToLevelOrder(state.tree)
          tracer.add(`将 ${value} 插入为 ${current.value} 的右孩子`, [34, 38], {
            result: `插入位置已找到：${current.value} 的右侧`,
            highlightNodes: [current.value, value],
          })
          break
        }
        tracer.add(`将 ${current.left.value} 和 ${current.right.value} 加入队列`, [25, 26], {
          result: '当前结点左右孩子都存在，继续层序扫描',
          highlightNodes: [current.value, current.left.value, current.right.value],
        })
        queue.push(current.left, current.right)
      }
      state.sequence = treeToLevelOrder(state.tree)
      tracer.add('普通二叉树插入完成', [40, 41], { result: `已插入结点 ${value}`, highlightNodes: [value] })
      break
    }
    case 'search': {
      const target = normalizeInput(input, action.defaultInput)
      tracer.add(`开始在普通二叉树中查找结点 ${target}`, [42, 43], { result: '采用层序遍历逐层查找' })
      if (!state.tree) {
        tracer.add('普通二叉树查找结束', [40, 41], { result: `未找到结点 ${target}` })
        break
      }
      const queue = [{ node: state.tree, path: [String(state.tree.value)] }]
      let foundPath = []
      while (queue.length) {
        const current = queue.shift()
        tracer.add(`访问结点 ${current.node.value}`, [25, 26], {
          result: `当前路径：${current.path.join(' -> ')}`,
          highlightNodes: current.path,
        })
        if (String(current.node.value) === String(target)) {
          foundPath = current.path
          tracer.add(`命中目标结点 ${target}`, [28, 32], {
            result: `查找路径：${current.path.join(' -> ')}`,
            highlightNodes: current.path,
          })
          break
        }
        tracer.add(`将 ${current.node.value} 的孩子继续加入队列`, [25, 26], {
          result: '当前结点不是目标，继续扩展下一层',
          highlightNodes: current.path,
        })
        if (current.node.left) queue.push({ node: current.node.left, path: [...current.path, String(current.node.left.value)] })
        if (current.node.right) queue.push({ node: current.node.right, path: [...current.path, String(current.node.right.value)] })
      }
      tracer.add('普通二叉树查找结束', [40, 41], {
        result: foundPath.length ? `查找路径：${foundPath.join(' -> ')}` : `未找到结点 ${target}`,
        highlightNodes: foundPath,
      })
      break
    }
    case 'level-traverse': {
      ensureDefaultTree()
      const order = []
      tracer.add('开始层序遍历', [42, 43], { result: state.tree ? '借助队列从上到下、从左到右访问结点' : '当前树为空' })
      const queue = state.tree ? [state.tree] : []
      while (queue.length) {
        const current = queue.shift()
        order.push(String(current.value))
        tracer.add(`访问结点 ${current.value}`, [25, 26], {
          result: `当前层序结果：${order.join(' -> ')}`,
          highlightNodes: [String(current.value)],
          traversalOrder: [...order],
        })
        if (current.left) queue.push(current.left)
        if (current.right) queue.push(current.right)
      }
      tracer.add('层序遍历结束', [40, 41], {
        result: order.length ? `层序遍历：${order.join(' -> ')}` : '当前树为空',
        highlightNodes: order.length ? [order[order.length - 1]] : [],
        traversalOrder: [...order],
      })
      break
    }
    case 'preorder-traverse':
      emitTraversal('前序遍历', [42, 43], [25, 26], [40, 41], traverseTreePreOrder)
      break
    case 'inorder-traverse':
      emitTraversal('中序遍历', [42, 43], [25, 26], [40, 41], traverseTreeInOrder)
      break
    case 'postorder-traverse':
      emitTraversal('后序遍历', [42, 43], [25, 26], [40, 41], traverseTreePostOrder)
      break
    case 'update': {
      ensureDefaultTree()
      const [oldValue, newValue] = normalizeInput(input, action.defaultInput).split(/[,\s，]+/).map((item) => String(item).trim())
      tracer.add(`开始修改结点 ${oldValue}`, [42, 43], { result: `准备将 ${oldValue} 修改为 ${newValue}` })
      let updated = false
      const queue = state.tree ? [state.tree] : []
      while (queue.length) {
        const current = queue.shift()
        tracer.add(`访问结点 ${current.value}`, [25, 26], {
          result: String(current.value) === oldValue ? '定位到待修改结点' : '继续层序扫描',
          highlightNodes: [String(current.value)],
        })
        if (String(current.value) === oldValue) {
          current.value = newValue
          current.label = String(newValue)
          updated = true
          tracer.add(`将 ${oldValue} 修改为 ${newValue}`, [34, 38], {
            result: '结点值已更新',
            highlightNodes: [String(newValue)],
          })
          break
        }
        if (current.left) queue.push(current.left)
        if (current.right) queue.push(current.right)
      }
      state.sequence = treeToLevelOrder(state.tree)
      tracer.add('修改节点结束', [40, 41], {
        result: updated ? `已将 ${oldValue} 修改为 ${newValue}` : `未找到结点 ${oldValue}`,
        highlightNodes: updated ? [String(newValue)] : [],
      })
      break
    }
    case 'count':
      ensureDefaultTree()
      tracer.add('开始统计节点数', [42, 43], { result: '遍历整棵树并累计结点数量' })
      tracer.add('统计节点数结束', [40, 41], {
        result: `当前节点总数：${countTreeNodes(state.tree)}`,
        highlightNodes: treeToLevelOrder(state.tree),
      })
      break
    case 'depth':
      ensureDefaultTree()
      tracer.add('开始计算树深度', [42, 43], { result: '递归比较左右子树深度' })
      tracer.add('计算树深度结束', [40, 41], {
        result: `当前树深度：${getTreeDepth(state.tree)}`,
        highlightNodes: treeToLevelOrder(state.tree),
      })
      break
    case 'delete': {
      const target = normalizeInput(input, action.defaultInput)
      tracer.add(`开始删除普通二叉树中的结点 ${target}`, [42, 43], { result: '需要同时定位目标结点和最后一个结点' })
      if (!state.tree) {
        tracer.add('普通二叉树删除结束', [40, 41], { result: `未找到结点 ${target}` })
        break
      }
      if (!state.tree.left && !state.tree.right && String(state.tree.value) === String(target)) {
        tracer.add(`定位到唯一的根结点 ${target}`, [25, 26], { result: '删除后树将为空', highlightNodes: [target] })
        state.tree = null
        state.sequence = []
        tracer.add('普通二叉树删除结束', [40, 41], { result: `已删除结点 ${target}` })
        break
      }
      const queue = [{ node: state.tree, parent: null, path: [String(state.tree.value)] }]
      let targetNode = null
      let targetPath = []
      let lastNode = state.tree
      let lastParent = null
      while (queue.length) {
        const current = queue.shift()
        tracer.add(`访问结点 ${current.node.value}`, [25, 26], {
          result: '持续扫描以记录目标结点和最后一个结点',
          highlightNodes: current.path,
        })
        if (String(current.node.value) === String(target)) {
          targetNode = current.node
          targetPath = current.path
          tracer.add(`记录到待删除结点 ${target}`, [28, 32], {
            result: '继续向后扫描以寻找最后一个结点',
            highlightNodes: current.path,
          })
        }
        if (current.node.left) {
          lastNode = current.node.left
          lastParent = current.node
          queue.push({ node: current.node.left, parent: current.node, path: [...current.path, String(current.node.left.value)] })
        }
        if (current.node.right) {
          lastNode = current.node.right
          lastParent = current.node
          queue.push({ node: current.node.right, parent: current.node, path: [...current.path, String(current.node.right.value)] })
        }
      }
      if (!targetNode) {
        tracer.add('普通二叉树删除结束', [40, 41], { result: `未找到结点 ${target}` })
        break
      }
      tracer.add(`用最后一个结点 ${lastNode.value} 覆盖目标结点 ${target}`, [34, 38], {
        result: '执行值替换并断开最后一个结点',
        highlightNodes: [...targetPath, String(lastNode.value)],
      })
      targetNode.value = lastNode.value
      targetNode.label = String(lastNode.value)
      if (lastParent?.left === lastNode) lastParent.left = null
      if (lastParent?.right === lastNode) lastParent.right = null
      state.sequence = treeToLevelOrder(state.tree)
      tracer.add('普通二叉树删除结束', [40, 41], {
        result: `已删除结点 ${target}`,
        highlightNodes: [String(targetNode.value)],
      })
      break
    }
    default:
      tracer.add('未实现的普通二叉树操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runBstLike(action, rawInput, currentState, balanced = false, mode = 'pre') {
  const state = ensureTreeValuesState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)
  const fallbackDefaults = balanced ? '10,20,30,40,50,25' : '50,30,70,20,40,60,80'
  const parseTreeDefaults = () =>
    balanced
      ? sortUniqueNumbers(fallbackDefaults, fallbackDefaults)
      : [...new Set(parseNumberList(fallbackDefaults, fallbackDefaults))]
  const rebuild = () => {
    state.values = [...new Set(state.values)]
    if (balanced) state.values.sort((a, b) => a - b)
    state.tree = balanced ? buildBalancedTree(state.values) : buildBstFromValues(state.values)
    state.meta = state.meta || {}
    state.meta.treeCount = countTreeNodes(state.tree)
    state.meta.treeDepth = getTreeDepth(state.tree)
  }

  // AVL和BST代码行号映射
  const L = balanced
    ? { input: [65, 66], insertFn: [38, 39], compare: [41, 43], rotate: [46, 48], main: [68, 69], result: [71, 71] }
    : { input: [35, 36], insertFn: [14, 15], compare: [19, 22], rotate: [19, 22], main: [37, 38], result: [38, 39] }

  switch (action.key) {
    case 'create': {
      const values = balanced ? sortUniqueNumbers(input, action.defaultInput) : [...new Set(parseNumberList(input, action.defaultInput))]
      state.values = []
      state.tree = null
      tracer.add('读取关键字序列并准备创建树结构', L.input, { result: `准备插入 ${values.length} 个关键字` })
      tracer.add('清空旧树并准备从空树开始插入', L.input, { result: '当前树结构已重置' })
      values.forEach((value, index) => {
        state.values.push(value)
        tracer.add(`将关键字 ${value} 放入构建序列`, L.main, {
          result: `创建进度 ${index + 1} / ${values.length}`,
          highlightNodes: [value],
        })
        rebuild()
        tracer.add(`根据关键字 ${value} 更新树形结构`, balanced ? L.rotate : L.compare, {
          result: balanced ? '插入后执行平衡调整' : '插入后更新二叉排序树',
          highlightNodes: [value],
        })
      })
      tracer.add('树结构创建完成', L.result, { result: `已载入 ${state.values.length} 个关键字` })
      break
    }
    case 'insert': {
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      const value = parseSingleNumber(input, 0)
      tracer.add(`开始插入关键字 ${value}`, L.input, { result: '从根结点开始比较大小关系' })
      let current = state.tree
      const path = []
      while (current) {
        path.push(current.value)
        tracer.add(`访问结点 ${current.value}`, L.compare, {
          result: value === current.value ? `${value} 已存在于树中` : value < current.value ? `${value} < ${current.value}` : `${value} > ${current.value}`,
          highlightNodes: [...path],
        })
        if (value === current.value) break
        tracer.add(`沿着比较结果继续向${value < current.value ? '左' : '右'}子树移动`, L.compare, {
          result: '继续定位插入位置',
          highlightNodes: [...path],
        })
        current = value < current.value ? current.left : current.right
      }
      if (state.values.includes(value)) {
        tracer.add('树结构插入结束', L.result, { result: `关键字 ${value} 已存在，无需重复插入`, highlightNodes: [value] })
      } else {
        state.values.push(value)
        tracer.add(`将关键字 ${value} 接入树结构`, L.insertFn, { result: '新结点已连接到目标位置', highlightNodes: [...path, value] })
        rebuild()
        if (balanced) tracer.add(`对插入后的路径执行平衡调整`, L.rotate, { result: 'AVL 旋转或重平衡已完成', highlightNodes: [...path, value] })
        tracer.add('树结构插入结束', L.result, {
          result: balanced ? `已插入 ${value} 并重新调整平衡` : `已插入 ${value}`,
          highlightNodes: [...path, value],
        })
      }
      break
    }
    case 'search': {
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      const target = parseSingleNumber(rawInput, parseSingleNumber(action.defaultInput, 0))
      tracer.add(`开始查找关键字 ${target}`, L.input, { result: '按二叉排序树大小关系逐步查找' })
      const path = []
      let found = false
      let current = state.tree
      while (current) {
        path.push(current.value)
        tracer.add(`访问结点 ${current.value}`, L.compare, {
          result: current.value === target ? `找到关键字 ${target}` : target < current.value ? `${target} < ${current.value}，转向左子树` : `${target} > ${current.value}，转向右子树`,
          highlightNodes: [...path],
        })
        if (current.value === target) {
          found = true
          tracer.add(`命中目标关键字 ${target}`, L.compare, { result: `查找路径：${path.join(' -> ')}`, highlightNodes: [...path] })
          break
        }
        current = target < current.value ? current.left : current.right
      }
      tracer.add('树结构查找结束', L.result, {
        result: found ? `查找路径：${path.join(' -> ')}` : `未找到 ${target}`,
        highlightNodes: found ? path : [],
      })
      break
    }
    case 'level-traverse': {
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      const queue = state.tree ? [state.tree] : []
      const order = []
      tracer.add('开始层序遍历二叉排序树', L.input, { result: '借助队列按层访问结点' })
      while (queue.length) {
        const node = queue.shift()
        order.push(node.value)
        tracer.add(`访问第 ${order.length} 个结点 ${node.value}`, L.compare, {
          result: `当前层序结果：${order.join(' -> ')}`,
          highlightNodes: [node.value],
          traversalOrder: [...order],
        })
        if (node.left) queue.push(node.left)
        if (node.right) queue.push(node.right)
      }
      tracer.add('层序遍历结束', L.result, {
        result: order.length ? `层序遍历：${order.join(' -> ')}` : '当前树为空',
        highlightNodes: order.length ? [order[order.length - 1]] : [],
        traversalOrder: [...order],
      })
      break
    }
    case 'depth-traverse': {
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      const order = []
      const modeMap = {
        pre: {
          label: '前序遍历',
          visit: (node, walk) => {
            if (!node) return
            order.push(node.value)
            tracer.add(`访问结点 ${node.value}`, L.compare, {
              result: `当前前序结果：${order.join(' -> ')}`,
              highlightNodes: [node.value],
              traversalOrder: [...order],
            })
            walk(node.left)
            walk(node.right)
          },
        },
        in: {
          label: '中序遍历',
          visit: (node, walk) => {
            if (!node) return
            walk(node.left)
            order.push(node.value)
            tracer.add(`访问结点 ${node.value}`, L.compare, {
              result: `当前中序结果：${order.join(' -> ')}`,
              highlightNodes: [node.value],
              traversalOrder: [...order],
            })
            walk(node.right)
          },
        },
        post: {
          label: '后序遍历',
          visit: (node, walk) => {
            if (!node) return
            walk(node.left)
            walk(node.right)
            order.push(node.value)
            tracer.add(`访问结点 ${node.value}`, L.compare, {
              result: `当前后序结果：${order.join(' -> ')}`,
              highlightNodes: [node.value],
              traversalOrder: [...order],
            })
          },
        },
      }
      const selectedMode = modeMap[mode] || modeMap.pre
      tracer.add(`开始${selectedMode.label}`, L.input, { result: `当前模式：${selectedMode.label}` })
      const walk = (node) => selectedMode.visit(node, walk)
      walk(state.tree)
      tracer.add(`${selectedMode.label}结束`, L.result, {
        result: order.length ? `${selectedMode.label}：${order.join(' -> ')}` : '当前树为空',
        highlightNodes: order.length ? [order[order.length - 1]] : [],
        traversalOrder: [...order],
      })
      break
    }
    case 'count':
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      tracer.add('开始统计节点数', L.input, { result: '通过遍历整棵树累计结点数量' })
      tracer.add('节点统计结束', L.result, {
        result: `当前节点总数：${countTreeNodes(state.tree)}`,
        highlightNodes: state.values,
      })
      break
    case 'depth':
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      tracer.add('开始计算树深度', L.input, { result: '递归比较左右子树的最大深度' })
      tracer.add('树深度计算结束', L.result, {
        result: `当前树深度：${getTreeDepth(state.tree)}`,
        highlightNodes: state.values,
      })
      break
    case 'delete': {
      if (!state.values.length) state.values = parseTreeDefaults()
      rebuild()
      const target = parseSingleNumber(rawInput, parseSingleNumber(action.defaultInput, 0))
      tracer.add(`开始删除关键字 ${target}`, L.input, { result: '先定位目标结点，再重建树结构' })
      let current = state.tree
      const path = []
      while (current) {
        path.push(current.value)
        tracer.add(`访问结点 ${current.value}`, L.compare, {
          result: current.value === target ? '定位到待删除结点' : `${target} 与 ${current.value} 比较中`,
          highlightNodes: [...path],
        })
        if (current.value === target) {
          tracer.add(`确认关键字 ${target} 可以被删除`, L.compare, { result: '删除操作即将开始', highlightNodes: [...path] })
          break
        }
        tracer.add(`继续向${target < current.value ? '左' : '右'}子树移动`, L.compare, {
          result: '根据大小关系继续查找',
          highlightNodes: [...path],
        })
        current = target < current.value ? current.left : current.right
      }
      if (!state.values.includes(target)) {
        tracer.add('树结构删除结束', L.result, { result: `未找到 ${target}` })
      } else {
        state.values = state.values.filter((item) => item !== target)
        tracer.add(`从关键字集合中移除 ${target}`, L.main, { result: '正在重建删除后的树结构', highlightNodes: path })
        rebuild()
        if (balanced) tracer.add('删除后执行平衡调整', L.rotate, { result: 'AVL 平衡已恢复', highlightNodes: path.filter((item) => item !== target) })
        tracer.add('树结构删除结束', L.result, {
          result: balanced ? `已删除 ${target} 并重新调整平衡` : `已删除 ${target}`,
          highlightNodes: path.filter((item) => item !== target),
        })
      }
      break
    }
    default:
      tracer.add('未实现的树操作', 1)
  }

  return { state, traces: tracer.done() }
}
function runHuffman(action, rawInput, currentState) {
  const state = ensureHuffmanState(currentState)
  const tracer = makeTracer(state)
  const rebuild = () => {
    const built = buildHuffman(state.freq)
    state.tree = built.tree
    state.forest = built.tree ? [built.tree] : []
    state.codes = built.codes
  }
  const rebuildStepByStep = (reason = '重建哈夫曼树') => {
    let nodes = Object.entries(state.freq).map(([char, weight]) => ({ value: weight, label: `${char}:${weight}`, char, left: null, right: null }))
    state.tree = nodes.length === 1 ? clone(nodes[0]) : null
    state.forest = clone(nodes)
    tracer.add(`${reason}：把字符频次放入森林`, [31, 33], {
      result: nodes.length ? `初始森林：${nodes.map((n) => n.label).join(', ')}` : '当前没有字符',
      highlightNodes: nodes.map((n) => n.char || n.value),
    })
    let round = 1
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.value - b.value)
      state.tree = nodes.length === 1 ? clone(nodes[0]) : null
      state.forest = clone(nodes)
      const left = nodes.shift()
      const right = nodes.shift()
      const merged = { value: left.value + right.value, label: `${left.value + right.value}`, left, right }
      tracer.add(`第 ${round} 步：选出两个最小权值 ${left.label} 和 ${right.label}`, [34, 36], {
        result: `合并权值 ${left.value} + ${right.value} = ${merged.value}`,
        highlightNodes: [left.char || left.value, right.char || right.value],
      })
      nodes.push(merged)
      const built = buildHuffman(Object.fromEntries(Object.entries(state.freq)))
      state.tree = nodes.length === 1 ? clone(nodes[0]) : clone(merged)
      state.forest = clone(nodes)
      state.codes = built.codes
      tracer.add(`第 ${round} 步：生成新父结点 ${merged.value}`, [37, 39], {
        result: `森林剩余 ${nodes.length} 棵树`,
        highlightNodes: [merged.value],
      })
      round += 1
    }
    rebuild()
    tracer.add(`${reason}完成`, [40, 42], {
      result: `编码表：${Object.entries(state.codes).map(([k, v]) => `${k}:${v}`).join('，') || '空'}`,
      highlightNodes: Object.keys(state.freq),
    })
  }

  switch (action.key) {
    case 'create': {
      const text = normalizeInput(rawInput, action.defaultInput)
      state.freq = {}
      String(text || '').split('').filter((char) => char.trim()).forEach((char) => {
        state.freq[char] = (state.freq[char] || 0) + 1
        state.tree = null
        state.codes = {}
        state.forest = Object.entries(state.freq)
          .map(([key, weight]) => ({ value: weight, label: `${key}:${weight}`, char: key, left: null, right: null }))
          .sort((a, b) => a.value - b.value)
        tracer.add(`统计字符 ${char} 的频次`, [28, 30], {
          result: `${char} 出现 ${state.freq[char]} 次，当前森林包含 ${Object.keys(state.freq).length} 个叶子结点`,
          highlightNodes: [char],
        })
      })
      rebuildStepByStep('根据文本创建哈夫曼树')
      break
    }
    case 'create-by-weight': {
      state.freq = parseCharacterWeights(rawInput, action.defaultInput)
      const partialFreq = {}
      Object.entries(state.freq).forEach(([char, weight]) => {
        partialFreq[char] = weight
        state.tree = null
        state.codes = {}
        state.forest = Object.entries(partialFreq)
          .map(([key, currentWeight]) => ({ value: currentWeight, label: `${key}:${currentWeight}`, char: key, left: null, right: null }))
          .sort((a, b) => a.value - b.value)
        tracer.add(`读取字符 ${char} 的权重 ${weight}`, [28, 30], {
          result: `${char} 的权重设为 ${weight}，当前森林包含 ${Object.keys(partialFreq).length} 个叶子结点`,
          highlightNodes: [char],
        })
      })
      rebuildStepByStep('根据手动权重创建哈夫曼树')
      break
    }
    case 'insert': {
      if (!Object.keys(state.freq).length) state.freq = parseCharacterWeights('a:5,b:9,c:12,d:13,e:16,f:45')
      const [char, weight] = parseCharacterUpdate(rawInput, action.defaultInput)
      tracer.add(`准备添加字符 ${char}`, [24, 26], { result: `新增权值 ${weight}` })
      state.freq[char] = (state.freq[char] || 0) + weight
      tracer.add(`字符 ${char} 的频次更新为 ${state.freq[char]}`, [28, 30], { result: '频次表已更新', highlightNodes: [char] })
      rebuildStepByStep('更新字符频次并重建哈夫曼树')
      break
    }
    case 'search': {
      const char = normalizeInput(rawInput, action.defaultInput)[0]
      if (!Object.keys(state.freq).length) state.freq = parseCharacterWeights('a:5,b:9,c:12,d:13,e:16,f:45')
      if (!Object.keys(state.codes).length) rebuild()
      const code = state.codes[char]
      tracer.add(`开始查找字符 ${char} 的编码`, [43, 44], { result: '从根到叶读取 0/1 路径', highlightNodes: [char] })
      if (code) {
        code.split('').forEach((bit, index) => {
          tracer.add(`读取第 ${index + 1} 位编码 ${bit}`, [45, 47], {
            result: `当前前缀：${code.slice(0, index + 1)}`,
            highlightNodes: [char],
          })
        })
      }
      tracer.add('查询字符编码结束', [48, 49], { result: code ? `字符 ${char} 的编码为 ${code}` : `未找到字符 ${char}`, highlightNodes: [char] })
      break
    }
    case 'delete': {
      const char = normalizeInput(rawInput, action.defaultInput)[0]
      if (!Object.keys(state.freq).length) state.freq = parseCharacterWeights('a:5,b:9,c:12,d:13,e:16,f:45')
      tracer.add(`准备删除字符 ${char}`, [50, 51], { result: state.freq[char] ? `当前频次 ${state.freq[char]}` : '字符不存在', highlightNodes: [char] })
      delete state.freq[char]
      tracer.add(`字符 ${char} 已从频次表移除`, [52, 53], { result: '准备重建哈夫曼树' })
      rebuildStepByStep('删除字符并重建哈夫曼树')
      break
    }
    default:
      tracer.add('未实现的哈夫曼树操作', 1)
  }

  return { state, traces: tracer.done() }
}

function runHeap(action, rawInput, currentState) {
  const state = ensureHeapState(currentState)
  const tracer = makeTracer(state)
  const input = normalizeInput(rawInput, action.defaultInput)
  const heapSize = () => state.meta?.heapSize ?? state.items.length
  const activeItems = () => state.items.slice(0, heapSize())
  const updateHeapView = (size = heapSize()) => syncHeapVisualState(state, size)

  switch (action.key) {
    case 'create': {
      state.capacity = Math.max(1, Math.min(Number(state.capacity) || 10, 10))
      const values = ensureLimit(parseNumberList(input, action.defaultInput), state.capacity)
      state.items = []
      state.tree = null
      state.meta = { ...(state.meta || {}), heapSize: 0 }
      tracer.add('根据输入序列建堆', [60, 61], { result: `准备插入 ${values.length} 个元素` })
      values.forEach((value, index) => {
        state.items.push(value)
        state.meta.heapSize = state.items.length
        updateHeapView()
        tracer.add(`将元素 ${value} 放入堆尾`, [36, 38], {
          result: `建堆进度 ${index + 1} / ${values.length}`,
          highlightNodes: [value],
          highlightIndices: [state.items.length - 1],
        })
        let current = state.items.length - 1
        while (current > 0) {
          const parent = Math.floor((current - 1) / 2)
          tracer.add(`比较结点 ${state.items[current]} 与父结点 ${state.items[parent]}`, [29, 31], {
            result: '正在执行上滤操作',
            highlightNodes: [state.items[current], state.items[parent]],
            highlightIndices: [current, parent],
          })
          if (state.items[parent] >= state.items[current]) break
          const childValue = state.items[current]
          const parentValue = state.items[parent]
          ;[state.items[parent], state.items[current]] = [state.items[current], state.items[parent]]
          updateHeapView()
          tracer.add(`交换 ${childValue} 与 ${parentValue}`, [24, 26], {
            result: `${childValue} 上移以维持大顶堆`,
            highlightNodes: [childValue, parentValue],
            highlightIndices: [parent, current],
          })
          current = parent
        }
      })
      updateHeapView()
      tracer.add('建堆完成', [63, 64], {
        result: `堆顶元素为 ${state.items[0] ?? '空'}`,
        highlightNodes: state.items.length ? [state.items[0]] : [],
        highlightIndices: state.items.length ? [0] : [],
      })
      break
    }
    case 'insert': {
      if (!state.items.length) {
        state.items = buildMaxHeap(ensureLimit(parseNumberList(action.defaultInput, action.defaultInput), state.capacity || 10))
        state.meta = { ...(state.meta || {}), heapSize: state.items.length }
      }
      const heapItems = activeItems()
      updateHeapView(heapItems.length)
      const value = parseSingleNumber(input, 0)
      tracer.add(`开始向堆中插入元素 ${value}`, [30, 31], { result: '先追加到堆尾，再执行上滤' })
      heapItems.push(value)
      state.items = [...heapItems, ...state.items.slice(heapSize())]
      state.meta.heapSize = heapItems.length
      updateHeapView()
      tracer.add(`将元素 ${value} 放入堆尾`, [21, 23], {
        result: '准备执行上滤调整',
        highlightNodes: [value],
        highlightIndices: [heapItems.length - 1],
      })
      let current = heapItems.length - 1
      while (current > 0) {
        const parent = Math.floor((current - 1) / 2)
        tracer.add(`比较结点 ${state.items[current]} 与父结点 ${state.items[parent]}`, [17, 20], {
          result: '正在执行上滤操作',
          highlightNodes: [state.items[current], state.items[parent]],
          highlightIndices: [current, parent],
        })
        if (state.items[parent] >= state.items[current]) break
        const childValue = state.items[current]
        const parentValue = state.items[parent]
        ;[state.items[parent], state.items[current]] = [state.items[current], state.items[parent]]
        updateHeapView()
        tracer.add(`交换 ${childValue} 与 ${parentValue}`, [14, 16], {
          result: `${childValue} 上移以维持大顶堆`,
          highlightNodes: [childValue, parentValue],
          highlightIndices: [parent, current],
        })
        current = parent
      }
      updateHeapView()
      tracer.add('堆插入完成', [34, 35], {
        result: `已插入 ${value}`,
        highlightNodes: [value, state.items[0]],
        highlightIndices: [0],
      })
      break
    }
    case 'search': {
      updateHeapView()
      const value = parseSingleNumber(input, 0)
      tracer.add(`开始在堆中查找元素 ${value}`, [30, 31], { result: '按数组顺序逐个比对堆元素' })
      let found = -1
      for (let index = 0; index < heapSize(); index += 1) {
        tracer.add(`检查下标 ${index} 上的元素 ${state.items[index]}`, [36, 38], {
          result: state.items[index] === value ? `找到元素 ${value}` : `当前位置不是 ${value}`,
          highlightNodes: [state.items[index]],
          highlightIndices: [index],
        })
        if (state.items[index] === value) {
          found = index
          break
        }
      }
      tracer.add('堆查找结束', [34, 35], {
        result: found >= 0 ? `元素 ${value} 位于下标 ${found}` : `未找到元素 ${value}`,
        highlightNodes: found >= 0 ? [value] : [],
        highlightIndices: found >= 0 ? [found] : [],
      })
      break
    }
    case 'extract': {
      tracer.add('开始提取堆顶元素', [30, 31], {
        result: heapSize() ? `当前堆顶为 ${state.items[0]}` : '当前堆为空',
        highlightNodes: heapSize() ? [state.items[0]] : [],
        highlightIndices: heapSize() ? [0] : [],
      })
      if (!heapSize()) {
        tracer.add('当前堆为空', [36, 38], { result: '没有可提取的堆顶元素' })
      } else {
        const top = state.items[0]
        const lastIndex = heapSize() - 1
        ;[state.items[0], state.items[lastIndex]] = [state.items[lastIndex], state.items[0]]
        state.meta.heapSize = lastIndex
        updateHeapView()
        tracer.add(`将堆顶 ${top} 与当前堆尾交换`, [36, 38], {
          result: `原堆顶被放到位置 ${lastIndex} 的已排序区`,
          highlightNodes: [top],
          highlightIndices: [0, lastIndex],
        })
        if (!heapSize()) {
          tracer.add(`移除唯一的堆顶元素 ${top}`, [36, 38], { result: '提取后堆为空', highlightNodes: [top] })
          tracer.add('堆顶提取完成', [34, 35], { result: `提取出的堆顶元素为 ${top}`, last: top })
          break
        }
        tracer.add(`保留堆尾已排序元素 ${top}，对剩余堆区重新下滤`, [36, 38], {
          result: '准备执行下滤调整',
          highlightNodes: [state.items[0]],
          highlightIndices: [0],
        })
        let current = 0
        while (true) {
          const left = current * 2 + 1
          const right = current * 2 + 2
          let largest = current
          if (left < heapSize()) {
            tracer.add(`比较当前结点 ${state.items[current]} 与左孩子 ${state.items[left]}`, [36, 38], {
              result: '检查左孩子是否更大',
              highlightNodes: [state.items[current], state.items[left]],
              highlightIndices: [current, left],
            })
            if (state.items[left] > state.items[largest]) largest = left
          }
          if (right < heapSize()) {
            tracer.add(`比较当前结点 ${state.items[largest]} 与右孩子 ${state.items[right]}`, [36, 38], {
              result: '检查右孩子是否更大',
              highlightNodes: [state.items[largest], state.items[right]],
              highlightIndices: [largest, right],
            })
            if (state.items[right] > state.items[largest]) largest = right
          }
          if (largest === current) break
          const currentValue = state.items[current]
          const swapValue = state.items[largest]
          ;[state.items[current], state.items[largest]] = [state.items[largest], state.items[current]]
          updateHeapView()
          tracer.add(`交换 ${currentValue} 与 ${swapValue}`, [36, 38], {
            result: `${swapValue} 下滤后成为新的父结点`,
            highlightNodes: [currentValue, swapValue],
            highlightIndices: [current, largest],
          })
          current = largest
        }
        updateHeapView()
        tracer.add('堆顶提取完成', [34, 35], {
          result: `提取出的堆顶元素为 ${top}，有效堆区还剩 ${heapSize()} 个元素`,
          last: top,
          highlightNodes: heapSize() ? [state.items[0]] : [],
          highlightIndices: heapSize() ? [0] : [lastIndex],
        })
      }
      break
    }
    default:
      tracer.add('未实现的堆操作', 1)
  }

  return { state, traces: tracer.done() }
}
export function runOperation({ page, action, input, state, capacity, mode }) {
  switch (page.key) {
    case 'seq-stack':
      return runSeqStack(action, input, state, capacity)
    case 'circular-queue':
      return runSeqQueue(action, input, state, capacity)
    case 'priority-queue':
      return runPriorityQueue(action, input, state, capacity)
    case 'shared-stack':
      return runSharedStack(action, input, state, capacity)
    case 'graph-matrix':
      return runGraphMatrix(action, input, state)
    case 'graph-list':
      return runGraphList(action, input, state)
    case 'graph-traversal':
      return runGraphTraversal(action, input, state)
    case 'graph-mst':
      return runGraphMst(action, input, state)
    case 'linear-list':
    case 'linear-list-basic':
    case 'linear-list-sort':
    case 'linear-list-sort-bubble':
    case 'linear-list-sort-selection':
    case 'linear-list-sort-insertion':
    case 'linear-list-sort-quick':
    case 'linear-list-sort-heap':
    case 'linear-list-sort-shell':
    case 'linear-list-search-sequential':
    case 'linear-list-search-reverse':
    case 'linear-list-search-binary':
      return runLinearList(action, input, state, capacity, page.key)
    case 'singly-linked-list':
      return runSingleLinkedList(action, input, state)
    case 'singly-linked-list-head':
      return runHeadLinkedList(action, input, state)
    case 'doubly-linked-list':
      return runDoublyLinkedList(action, input, state)
    case 'circular-linked-list':
      return runCircularLinkedList(action, input, state)
    case 'binary-tree':
      return runBinaryTree(action, input, state)
    case 'bst':
      return runBstLike(action, input, state, false, mode)
    case 'avl':
      return runBstLike(action, input, state, true, mode)
    case 'huffman':
      return runHuffman(action, input, state)
    case 'heap':
      return runHeap(action, input, state)
    default:
      return { state: clone(state), traces: [{ message: '未实现的页面逻辑', line: 1, state: clone(state) }] }
  }
}

export { createInitialState }
