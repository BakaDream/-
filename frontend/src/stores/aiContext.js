import { defineStore } from 'pinia'

const defaultContext = {
  routeName: '',
  title: '未识别页面',
  category: '',
  description: '',
  currentActionLabel: '',
  inputValue: '',
  statusText: '',
  resultText: '',
  recentTraces: [],
}

const cleanString = (value) => (typeof value === 'string' ? value.trim() : '')

function normalizeContext(payload = {}) {
  return {
    routeName: cleanString(payload.routeName),
    title: cleanString(payload.title) || '未识别页面',
    category: cleanString(payload.category),
    description: cleanString(payload.description),
    currentActionLabel: cleanString(payload.currentActionLabel),
    inputValue: cleanString(payload.inputValue),
    statusText: cleanString(payload.statusText),
    resultText: cleanString(payload.resultText),
    recentTraces: Array.isArray(payload.recentTraces)
      ? payload.recentTraces.map((item) => cleanString(item)).filter(Boolean).slice(-5)
      : [],
  }
}

export const useAiContextStore = defineStore('aiContext', {
  state: () => ({
    context: { ...defaultContext },
    contextVersion: 0,
    switchNoticeId: 0,
    lastSwitchNotice: '',
  }),
  getters: {
    pageTitle: (state) => state.context.title || '未识别页面',
    snapshot: (state) => ({
      ...state.context,
      recentTraces: [...state.context.recentTraces],
    }),
  },
  actions: {
    setContext(payload) {
      const next = normalizeContext(payload)
      const previous = this.context
      const hasPreviousPage = Boolean(previous.routeName || previous.title !== defaultContext.title)
      const switchedPage =
        hasPreviousPage &&
        Boolean(next.routeName || next.title) &&
        (previous.routeName !== next.routeName || previous.title !== next.title)

      this.context = next
      this.contextVersion += 1

      if (switchedPage) {
        this.switchNoticeId += 1
        this.lastSwitchNotice = `已切换到「${next.title}」页面，后续回答将优先结合该页面内容。`
      }
    },
  },
})
