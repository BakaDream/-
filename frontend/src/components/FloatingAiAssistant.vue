<template>
  <div class="ai-assistant-layer" aria-live="polite">
    <section v-if="isOpen" class="ai-panel" :class="{ minimized: isMinimized }">
      <header class="ai-panel-header">
        <div class="ai-title-block">
          <span class="ai-orb">AI</span>
          <div>
            <h2>AI 教学助手</h2>
            <p>当前识别页面：{{ aiContext.pageTitle }}</p>
          </div>
        </div>
        <div class="ai-header-actions">
          <button type="button" class="icon-button" :title="isMinimized ? '展开' : '收起'" @click="isMinimized = !isMinimized">
            {{ isMinimized ? '□' : '—' }}
          </button>
          <button type="button" class="icon-button" title="关闭" @click="isOpen = false">×</button>
        </div>
      </header>

      <div class="ai-service-bar" :class="serviceStatusClass">
        <span class="service-dot"></span>
        <span class="service-text">{{ serviceStatusText }}</span>
        <button
          v-if="serviceStatus !== 'online'"
          type="button"
          class="service-action"
          :disabled="isCheckingHealth"
          @click="retryConnection"
        >
          {{ isCheckingHealth ? '检测中' : '重新连接' }}
        </button>
      </div>

      <template v-if="!isMinimized">
        <div ref="messageListRef" class="ai-messages">
          <div
            v-for="message in displayMessages"
            :key="message.id"
            class="ai-message"
            :class="[`role-${message.role}`, { local: message.local }]"
          >
            <span class="message-role">{{ roleLabel(message) }}</span>
            <p>{{ renderMessageContent(message.content) }}</p>
          </div>
        </div>

        <div class="quick-questions">
          <button
            v-for="question in quickQuestions"
            :key="question"
            type="button"
            class="quick-chip"
            :disabled="isSending || isCheckingHealth"
            @click="sendMessage(question)"
          >
            {{ question }}
          </button>
        </div>

        <form class="ai-input-area" @submit.prevent="sendMessage(draftMessage)">
          <textarea
            v-model="draftMessage"
            rows="2"
            placeholder="问问当前页面的算法步骤、复杂度或执行结果"
            :disabled="isSending || isCheckingHealth"
            @keydown.enter.exact.prevent="sendMessage(draftMessage)"
          ></textarea>
          <div class="input-actions">
            <button type="button" class="ghost-button" :disabled="isSending || !messages.length" @click="clearMessages">清空</button>
            <button type="submit" class="send-button" :disabled="isSending || isCheckingHealth || !draftMessage.trim()">
              {{ sendButtonText }}
            </button>
          </div>
        </form>
      </template>
    </section>

    <button
      type="button"
      class="ai-float-button"
      :style="buttonStyle"
      title="AI 教学助手"
      @click="togglePanel"
      @pointerdown="startDrag"
    >
      <span>AI</span>
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAiContextStore } from '../stores/aiContext'

const STORAGE_MESSAGES = 'ds-ai-chat-messages-v2'
const STORAGE_SESSION = 'ds-ai-session-id-v2'
const STORAGE_POSITION = 'ds-ai-button-position-v2'
const MAX_HISTORY_MESSAGES = 40
const AI_API_BASE = '/api/ai'
const HEALTH_CHECK_INTERVAL = 15000

const quickQuestions = [
  '这个算法在做什么？',
  '为什么这一步这样做？',
  '时间复杂度和空间复杂度是什么？',
  '给我一个简单例子说明',
]

const aiContext = useAiContextStore()
const isOpen = ref(false)
const isMinimized = ref(false)
const isSending = ref(false)
const draftMessage = ref('')
const messages = ref([])
const messageListRef = ref(null)
const buttonPosition = ref({ x: 0, y: 0 })
const dragState = ref(null)
const serviceStatus = ref('checking')
const serviceMessage = ref('正在检测 AI 服务')
const isCheckingHealth = ref(false)
let healthTimer = null
let activeHealthCheckToken = 0

const createSessionId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const sessionId = ref(localStorage.getItem(STORAGE_SESSION) || createSessionId())
localStorage.setItem(STORAGE_SESSION, sessionId.value)

const displayMessages = computed(() => messages.value)
const buttonStyle = computed(() => ({
  left: `${buttonPosition.value.x}px`,
  top: `${buttonPosition.value.y}px`,
}))
const serviceStatusClass = computed(() => `status-${serviceStatus.value}`)
const serviceStatusText = computed(() => serviceMessage.value)
const sendButtonText = computed(() => {
  if (isSending.value) return '发送中'
  if (isCheckingHealth.value) return '检测中'
  return '发送'
})

function createMessage(role, content, options = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    local: Boolean(options.local),
  }
}

function roleLabel(message) {
  if (message.local) return '系统'
  return message.role === 'user' ? '我' : '助手'
}

function renderMessageContent(content) {
  return String(content || '')
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ''))
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

function loadMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_MESSAGES) || '[]')
    if (Array.isArray(parsed)) {
      messages.value = parsed
        .filter((item) => item && ['user', 'assistant', 'system'].includes(item.role) && typeof item.content === 'string')
        .slice(-MAX_HISTORY_MESSAGES)
    }
  } catch {
    messages.value = []
  }
}

function persistMessages() {
  localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages.value.slice(-MAX_HISTORY_MESSAGES)))
}

function scrollToBottom() {
  nextTick(() => {
    const list = messageListRef.value
    if (list) list.scrollTop = list.scrollHeight
  })
}

function clearMessages() {
  messages.value = []
  persistMessages()
}

function appendLocalNotice(content) {
  messages.value.push(createMessage('system', content, { local: true }))
  messages.value = messages.value.slice(-MAX_HISTORY_MESSAGES)
  persistMessages()
  scrollToBottom()
}

function setServiceStatus(status, message) {
  serviceStatus.value = status
  serviceMessage.value = message
}

async function runHealthCheck(options = {}) {
  const { silent = false, force = false } = options
  if (isCheckingHealth.value && !force) return serviceStatus.value === 'online'

  const checkToken = ++activeHealthCheckToken
  isCheckingHealth.value = true
  if (!silent) {
    setServiceStatus('checking', '正在检测 AI 服务')
  }

  try {
    await axios.get(`${AI_API_BASE}/health`, { timeout: 3000 })
    if (checkToken !== activeHealthCheckToken) return serviceStatus.value === 'online'
    setServiceStatus('online', 'AI 服务在线')
    return true
  } catch (error) {
    if (checkToken !== activeHealthCheckToken) return serviceStatus.value === 'online'
    const detail = error.response?.data?.error || error.message || 'AI 服务不可用'
    setServiceStatus('offline', `AI 服务离线：${detail}`)
    return false
  } finally {
    if (checkToken === activeHealthCheckToken) {
      isCheckingHealth.value = false
    }
  }
}

async function retryConnection() {
  const ok = await runHealthCheck({ silent: false, force: true })
  if (ok) {
    ElMessage.success('AI 服务已恢复连接')
  } else {
    ElMessage.error('重新连接失败，请确认后端和外部模型服务可用')
  }
}

function startHealthPolling() {
  stopHealthPolling()
  healthTimer = window.setInterval(() => {
    runHealthCheck({ silent: true })
  }, HEALTH_CHECK_INTERVAL)
}

function stopHealthPolling() {
  if (healthTimer) {
    window.clearInterval(healthTimer)
    healthTimer = null
  }
}

async function sendMessage(rawText) {
  const content = rawText.trim()
  if (!content || isSending.value) return

  const isOnline = await runHealthCheck({ silent: true })
  if (!isOnline) {
    ElMessage.error('AI 服务当前离线，请先恢复后端或外部模型服务')
    return
  }

  const userMessage = createMessage('user', content)
  messages.value.push(userMessage)
  draftMessage.value = ''
  persistMessages()
  scrollToBottom()
  isSending.value = true

  try {
    const payloadMessages = messages.value
      .filter((item) => ['user', 'assistant'].includes(item.role))
      .slice(-MAX_HISTORY_MESSAGES)
      .map((item) => ({ role: item.role, content: item.content }))

    const { data } = await axios.post(`${AI_API_BASE}/chat`, {
      sessionId: sessionId.value,
      messages: payloadMessages,
      context: aiContext.snapshot,
    }, {
      timeout: 35000,
    })

    sessionId.value = data.sessionId || sessionId.value
    localStorage.setItem(STORAGE_SESSION, sessionId.value)
    messages.value.push(createMessage('assistant', data.reply || '我暂时没有拿到有效回复。'))
    setServiceStatus('online', 'AI 服务在线')
  } catch (error) {
    const detail = error.response?.data?.error || error.message || 'AI 服务暂时不可用'
    setServiceStatus('offline', `AI 服务离线：${detail}`)
    messages.value.push(createMessage('assistant', `请求失败：${detail}`))
    ElMessage.error('AI 助手请求失败，会话记录已保留')
  } finally {
    isSending.value = false
    messages.value = messages.value.slice(-MAX_HISTORY_MESSAGES)
    persistMessages()
    scrollToBottom()
  }
}

function togglePanel() {
  if (dragState.value?.moved) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    isMinimized.value = false
    runHealthCheck({ silent: false })
    scrollToBottom()
  }
}

function loadPosition() {
  const fallback = {
    x: Math.max(18, window.innerWidth - 82),
    y: Math.max(18, window.innerHeight - 104),
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_POSITION) || 'null')
    buttonPosition.value = clampPosition(saved || fallback)
  } catch {
    buttonPosition.value = fallback
  }
}

function clampPosition(position) {
  const size = 58
  return {
    x: Math.min(Math.max(Number(position.x) || 18, 18), window.innerWidth - size - 18),
    y: Math.min(Math.max(Number(position.y) || 18, 18), window.innerHeight - size - 18),
  }
}

function savePosition() {
  localStorage.setItem(STORAGE_POSITION, JSON.stringify(buttonPosition.value))
}

function startDrag(event) {
  const start = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    originX: buttonPosition.value.x,
    originY: buttonPosition.value.y,
    moved: false,
  }
  dragState.value = start
  event.currentTarget.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function onDragMove(event) {
  if (!dragState.value) return
  const dx = event.clientX - dragState.value.x
  const dy = event.clientY - dragState.value.y
  if (Math.abs(dx) + Math.abs(dy) > 4) dragState.value.moved = true
  buttonPosition.value = clampPosition({
    x: dragState.value.originX + dx,
    y: dragState.value.originY + dy,
  })
}

function stopDrag() {
  if (!dragState.value) return
  const size = 58
  const snapLeft = buttonPosition.value.x < window.innerWidth / 2
  buttonPosition.value = clampPosition({
    x: snapLeft ? 18 : window.innerWidth - size - 18,
    y: buttonPosition.value.y,
  })
  savePosition()
  window.removeEventListener('pointermove', onDragMove)
  window.setTimeout(() => {
    dragState.value = null
  }, 0)
}

function handleResize() {
  buttonPosition.value = clampPosition(buttonPosition.value)
  savePosition()
}

watch(
  () => aiContext.switchNoticeId,
  () => {
    if (aiContext.lastSwitchNotice) appendLocalNotice(aiContext.lastSwitchNotice)
  },
)

watch(messages, persistMessages, { deep: true })

onMounted(() => {
  loadMessages()
  loadPosition()
  runHealthCheck({ silent: true })
  startHealthPolling()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  stopHealthPolling()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('pointermove', onDragMove)
})
</script>

<style scoped>
.ai-assistant-layer {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.ai-panel,
.ai-float-button {
  pointer-events: auto;
}

.ai-panel {
  position: fixed;
  right: 24px;
  bottom: 96px;
  display: flex;
  flex-direction: column;
  width: min(390px, calc(100vw - 32px));
  max-height: min(680px, calc(100vh - 130px));
  border: 1px solid rgba(27, 52, 93, 0.14);
  border-radius: 8px;
  background: rgba(252, 254, 255, 0.96);
  box-shadow: 0 22px 55px rgba(8, 25, 55, 0.22);
  overflow: hidden;
  backdrop-filter: blur(18px);
}

.ai-panel.minimized {
  max-height: 70px;
}

.ai-service-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(27, 52, 93, 0.08);
  font-size: 12px;
}

.ai-service-bar.status-online {
  background: #edf9f4;
  color: #1d6b45;
}

.ai-service-bar.status-offline {
  background: #fff1f1;
  color: #9a2f2f;
}

.ai-service-bar.status-checking {
  background: #eef5ff;
  color: #2b5f97;
}

.service-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentColor;
}

.service-text {
  flex: 1;
  min-width: 0;
}

.service-action {
  border: 0;
  border-radius: 6px;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.82);
  color: inherit;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 12px;
  background: linear-gradient(135deg, #122544 0%, #1b4e78 100%);
  color: #f6fbff;
}

.ai-title-block {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.ai-orb {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #8cf2d4;
  color: #0b2137;
  font-size: 12px;
  font-weight: 800;
}

.ai-title-block h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.2;
}

.ai-title-block p {
  margin: 4px 0 0;
  max-width: 230px;
  overflow: hidden;
  color: rgba(246, 251, 255, 0.78);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-header-actions {
  display: flex;
  gap: 6px;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
  font-size: 16px;
}

.ai-messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 220px;
  max-height: 360px;
  padding: 14px;
  overflow-y: auto;
  background:
    linear-gradient(90deg, rgba(16, 38, 72, 0.04) 1px, transparent 1px),
    linear-gradient(180deg, #f8fbff 0%, #edf5fb 100%);
  background-size: 22px 22px, auto;
}

.ai-message {
  width: fit-content;
  max-width: 86%;
}

.ai-message p {
  margin: 4px 0 0;
  padding: 9px 11px;
  border-radius: 8px;
  color: #12233c;
  background: #ffffff;
  box-shadow: 0 8px 18px rgba(26, 55, 92, 0.08);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-message.role-user {
  align-self: flex-end;
}

.ai-message.role-user p {
  color: #062238;
  background: #9cebd9;
}

.ai-message.local {
  align-self: center;
  max-width: 92%;
}

.ai-message.local p {
  color: #47617e;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: none;
  font-size: 12px;
  text-align: center;
}

.message-role {
  display: block;
  padding: 0 3px;
  color: #71859f;
  font-size: 11px;
}

.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 10px 12px;
  border-top: 1px solid rgba(27, 52, 93, 0.08);
  background: #ffffff;
}

.quick-chip {
  border: 1px solid rgba(47, 119, 235, 0.16);
  border-radius: 999px;
  padding: 6px 9px;
  background: #f3f8ff;
  color: #21456f;
  cursor: pointer;
  font-size: 12px;
}

.quick-chip:disabled,
.ghost-button:disabled,
.send-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.ai-input-area {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid rgba(27, 52, 93, 0.08);
  background: #fbfdff;
}

.ai-input-area textarea {
  width: 100%;
  resize: none;
  border: 1px solid rgba(33, 69, 111, 0.18);
  border-radius: 8px;
  padding: 9px 10px;
  box-sizing: border-box;
  color: #12233c;
  background: #ffffff;
  font: inherit;
  line-height: 1.45;
  outline: none;
}

.ai-input-area textarea:focus {
  border-color: rgba(47, 119, 235, 0.55);
  box-shadow: 0 0 0 3px rgba(47, 119, 235, 0.1);
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ghost-button,
.send-button {
  border: 0;
  border-radius: 7px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
}

.ghost-button {
  background: #e8eef7;
  color: #31506f;
}

.send-button {
  background: #18365d;
  color: #ffffff;
}

.ai-float-button {
  position: fixed;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #1d4f7c 0%, #25d2ae 100%);
  color: #ffffff;
  cursor: grab;
  box-shadow: 0 16px 34px rgba(16, 45, 78, 0.3);
  touch-action: none;
}

.ai-float-button:active {
  cursor: grabbing;
}

.ai-float-button span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  font-weight: 900;
  letter-spacing: 0;
}

@media (max-width: 720px) {
  .ai-panel {
    right: 12px;
    bottom: 84px;
    width: calc(100vw - 24px);
    max-height: calc(100vh - 110px);
  }

  .ai-messages {
    max-height: 310px;
  }
}
</style>
