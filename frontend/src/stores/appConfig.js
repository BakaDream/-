import { defineStore } from 'pinia'
import axios from 'axios'

export const useAppConfigStore = defineStore('appConfig', {
  state: () => ({
    enableAi: false,
    loaded: false,
    loading: false,
  }),
  actions: {
    async loadConfig(force = false) {
      if (this.loading || (this.loaded && !force)) {
        return this.enableAi
      }

      this.loading = true
      try {
        const { data } = await axios.get('/api/config', { timeout: 3000 })
        this.enableAi = Boolean(data?.enableAi)
      } catch {
        this.enableAi = false
      } finally {
        this.loaded = true
        this.loading = false
      }

      return this.enableAi
    },
  },
})
