<template>
  <div class="layout-root" :class="{ collapsed: isCollapsed }">
    <aside class="sidebar">
      <RouterLink class="brand-block brand-link" to="/" title="返回首页">
        <div class="brand-mark">DS</div>
        <div class="brand-text">
          <h1 class="brand-title">数据结构可视化</h1>
          <p class="brand-subtitle">毕业设计演示平台</p>
        </div>
      </RouterLink>

      <nav class="nav-area">
        <section
          v-for="group in navigationGroups"
          :key="group.key"
          class="nav-group"
          :class="[`group-${group.key}`, { 'group-active': activeGroupKeys.has(group.key) }]"
        >
          <button
            class="group-button"
            :class="{ active: activeGroupKeys.has(group.key) }"
            type="button"
            @click="toggleGroup(group.key)"
            :title="isCollapsed ? group.label : ''"
          >
            <span class="group-icon">{{ group.icon }}</span>
            <span class="group-label">{{ group.label }}</span>
            <span class="group-arrow">{{ openGroups.has(group.key) ? '−' : '+' }}</span>
          </button>

          <div v-show="openGroups.has(group.key)" class="group-items">
            <template v-for="item in group.items" :key="item.key">
              <RouterLink
                v-if="!item.children"
                :to="item.path"
                class="nav-link level-one-link"
                :class="{ active: route.name === item.key }"
                :title="isCollapsed ? item.title : ''"
              >
                {{ item.title }}
              </RouterLink>

              <div v-else class="nav-subgroup">
                <button
                  class="subgroup-button level-one-link"
                  :class="{ active: item.children.some((child) => child.key === route.name) }"
                  type="button"
                  @click="toggleSubgroup(item.key)"
                  :title="isCollapsed ? item.title : ''"
                >
                  <span class="subgroup-label">{{ item.title }}</span>
                  <span class="subgroup-arrow">{{ openSubgroups.has(item.key) ? '−' : '+' }}</span>
                </button>
                <div v-show="openSubgroups.has(item.key)" class="subgroup-items">
                  <RouterLink
                    v-for="child in item.children"
                    :key="child.key"
                    :to="child.path"
                    class="nav-link child-link level-two-link"
                    :class="{
                      active: route.name === child.key,
                      'sort-basic-link': child.navGroupKey === 'linear-list-sort' && child.sortLevel === 'basic',
                      'sort-advanced-link': child.navGroupKey === 'linear-list-sort' && child.sortLevel === 'advanced',
                    }"
                    :title="isCollapsed ? child.title : ''"
                  >
                    {{ child.title }}
                  </RouterLink>
                </div>
              </div>
            </template>
          </div>
        </section>
      </nav>

      <div class="sidebar-footer">
        <p class="footer-text">数据结构算法可视化教学平台</p>
      </div>

      <!-- 侧边栏收缩箭头按钮 — 右侧边缘突出 -->
      <button class="collapse-btn" type="button" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'">
        <span class="collapse-arrow">{{ isCollapsed ? '›' : '‹' }}</span>
      </button>
    </aside>

    <main class="content-area">
      <RouterView />
    </main>

    <FloatingAiAssistant v-if="appConfig.enableAi" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import FloatingAiAssistant from '../components/FloatingAiAssistant.vue'
import { navigationGroups } from '../data/algorithmCatalog'
import { useAppConfigStore } from '../stores/appConfig'

const route = useRoute()
const appConfig = useAppConfigStore()
const openGroups = ref(new Set(navigationGroups.map((group) => group.key)))
const defaultSubgroups = navigationGroups
  .flatMap((group) => group.items.filter((item) => item.children).map((item) => item.key))
const openSubgroups = ref(new Set(defaultSubgroups))
const isCollapsed = ref(false)

const activeGroupKeys = computed(() => {
  const keys = new Set()
  navigationGroups.forEach((group) => {
    group.items.forEach((item) => {
      if (item.children?.some((child) => child.key === route.name)) {
        keys.add(group.key)
        keys.add(item.key)
      }
      if (item.key === route.name) {
        keys.add(group.key)
      }
    })
  })
  return keys
})

function toggleGroup(key) {
  const next = new Set(openGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openGroups.value = next
}

function toggleSubgroup(key) {
  const next = new Set(openSubgroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openSubgroups.value = next
}

onMounted(() => {
  appConfig.loadConfig()
})
</script>

<style scoped>
.layout-root {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  height: 100vh;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(46, 120, 233, 0.18), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #edf3fb 100%);
  transition: grid-template-columns 0.25s ease;
  overflow: hidden;
}

.layout-root.collapsed {
  grid-template-columns: 52px minmax(0, 1fr);
}

.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  padding: 14px 8px;
  background:
    linear-gradient(180deg, rgba(16, 33, 62, 0.98) 0%, rgba(10, 22, 42, 0.99) 100%);
  color: #e8f0fb;
  box-shadow: 8px 0 30px rgba(8, 20, 40, 0.28);
  overflow: hidden;
  transition: padding 0.25s ease;
}

.collapsed .sidebar {
  padding: 14px 4px;
}

.brand-block {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 7px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-link {
  color: inherit;
  text-decoration: none;
  border-radius: 14px;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.brand-link:hover {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(126, 220, 255, 0.12);
  transform: translateY(-1px);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #5ec8ff 0%, #4be1c3 100%);
  color: #07223d;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.08em;
  box-shadow: 0 12px 24px rgba(75, 225, 195, 0.2);
}

.brand-text {
  overflow: hidden;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.collapsed .brand-text {
  opacity: 0;
  width: 0;
}

.brand-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}

.brand-subtitle {
  margin: 2px 0 0;
  color: rgba(232, 240, 251, 0.68);
  font-size: 11px;
}

.nav-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 6px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.nav-area::-webkit-scrollbar {
  display: none;
}

.nav-group + .nav-group {
  margin-top: 10px;
}

.nav-group {
  --group-accent: #7edcff;
  --group-accent-soft: rgba(126, 220, 255, 0.16);
  --group-accent-border: rgba(126, 220, 255, 0.34);
  position: relative;
}

.group-linked-list {
  --group-accent: #6fe7c6;
  --group-accent-soft: rgba(111, 231, 198, 0.16);
  --group-accent-border: rgba(111, 231, 198, 0.34);
}

.group-stack-queue {
  --group-accent: #ffd166;
  --group-accent-soft: rgba(255, 209, 102, 0.15);
  --group-accent-border: rgba(255, 209, 102, 0.3);
}

.group-tree {
  --group-accent: #b9a5ff;
  --group-accent-soft: rgba(185, 165, 255, 0.16);
  --group-accent-border: rgba(185, 165, 255, 0.32);
}

.group-graph {
  --group-accent: #ff9d7a;
  --group-accent-soft: rgba(255, 157, 122, 0.15);
  --group-accent-border: rgba(255, 157, 122, 0.32);
}

.group-button {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(126, 220, 255, 0.16);
  border-radius: 12px;
  padding: 9px 8px;
  background:
    linear-gradient(135deg, rgba(30, 62, 105, 0.78) 0%, rgba(17, 39, 73, 0.92) 100%);
  color: #f2f7ff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 750;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 10px 22px rgba(5, 14, 28, 0.22);
  isolation: isolate;
}

.group-button::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: var(--group-accent);
  opacity: 0.78;
}

.group-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 24px 0, var(--group-accent-soft), transparent 38%);
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: -1;
}

.group-button:hover {
  background:
    linear-gradient(135deg, rgba(44, 96, 154, 0.98) 0%, rgba(21, 49, 91, 0.96) 100%);
  border-color: var(--group-accent-border);
}

.group-button:hover::after,
.group-button.active::after {
  opacity: 1;
}

.group-button.active {
  border-color: var(--group-accent-border);
  background:
    linear-gradient(135deg, rgba(38, 79, 126, 0.96) 0%, rgba(20, 49, 88, 0.98) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 12px 24px rgba(5, 14, 28, 0.28),
    0 0 0 1px var(--group-accent-soft);
}

.group-icon {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--group-accent-soft);
  color: var(--group-accent);
  font-weight: 700;
  text-align: center;
}

.group-label {
  flex: 1;
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.collapsed .group-label {
  opacity: 0;
  width: 0;
}

.group-arrow {
  color: rgba(255, 255, 255, 0.7);
  transition: opacity 0.2s ease;
}

.collapsed .group-arrow {
  opacity: 0;
}

.group-items {
  position: relative;
  display: grid;
  gap: 6px;
  padding: 7px 4px 0 12px;
  overflow: hidden;
  transition: opacity 0.2s ease, max-height 0.25s ease;
}

.group-items::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 8px;
  bottom: 2px;
  width: 1px;
  background: linear-gradient(180deg, var(--group-accent-border), rgba(126, 220, 255, 0.02));
}

.nav-subgroup {
  display: grid;
  gap: 4px;
}

.subgroup-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 7px 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(232, 240, 251, 0.92);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}

.subgroup-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.subgroup-label {
  overflow: hidden;
  white-space: nowrap;
}

.subgroup-arrow {
  color: rgba(255, 255, 255, 0.7);
}

.level-one-link {
  width: calc(100% - 10px);
  min-height: 34px;
  margin-left: 10px;
  padding-left: 14px;
  border-left: 2px solid var(--group-accent-border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.062) 0%, rgba(255, 255, 255, 0.032) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 6px 14px rgba(10, 22, 42, 0.14);
}

.subgroup-items {
  display: grid;
  gap: 4px;
  padding-top: 4px;
}

.nav-link.level-two-link {
  --level-accent: rgba(126, 220, 255, 0.34);
  position: relative;
  width: calc(100% - 22px);
  min-height: 32px;
  margin-left: 22px;
  padding-left: 18px;
  border: 1px solid rgba(126, 220, 255, 0.08);
  border-left: 2px solid rgba(126, 220, 255, 0.18);
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  color: rgba(232, 240, 251, 0.8);
  font-size: 11px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 6px 14px rgba(10, 22, 42, 0.14);
}

.nav-link.level-two-link::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 9px;
  width: 4px;
  height: calc(100% - 18px);
  border-radius: 999px;
  background: var(--level-accent);
}

.nav-link.level-two-link:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.035) 100%);
  border-color: rgba(126, 220, 255, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 18px rgba(10, 22, 42, 0.18);
}

.nav-link.level-two-link.active {
  color: #0c1d35;
  background: linear-gradient(135deg, #9ddcff 0%, #88f0d8 100%);
  border-color: transparent;
  box-shadow: 0 10px 20px rgba(76, 210, 202, 0.16);
}

.nav-link.level-two-link.sort-basic-link {
  color: #d9efff;
  background: linear-gradient(180deg, rgba(126, 220, 255, 0.12) 0%, rgba(126, 220, 255, 0.06) 100%);
  border-color: rgba(126, 220, 255, 0.18);
  border-left-color: rgba(126, 220, 255, 0.44);
  --level-accent: rgba(126, 220, 255, 0.5);
}

.nav-link.level-two-link.sort-basic-link:hover {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(126, 220, 255, 0.18) 0%, rgba(126, 220, 255, 0.09) 100%);
  border-color: rgba(126, 220, 255, 0.3);
}

.nav-link.level-two-link.sort-advanced-link {
  color: #e7f8ed;
  background: linear-gradient(180deg, rgba(75, 225, 195, 0.2) 0%, rgba(19, 166, 122, 0.11) 100%);
  border-color: rgba(75, 225, 195, 0.28);
  border-left-color: rgba(75, 225, 195, 0.62);
  --level-accent: rgba(75, 225, 195, 0.82);
}

.nav-link.level-two-link.sort-advanced-link:hover {
  color: #ffffff;
  background: linear-gradient(180deg, rgba(75, 225, 195, 0.28) 0%, rgba(19, 166, 122, 0.16) 100%);
  border-color: rgba(75, 225, 195, 0.42);
}

.nav-link.level-two-link.sort-basic-link.active {
  color: #0c1d35;
  background: linear-gradient(135deg, #bde9ff 0%, #94d8ff 100%);
  border-color: transparent;
  border-left-color: transparent;
  box-shadow: 0 10px 20px rgba(126, 220, 255, 0.18);
}

.nav-link.level-two-link.sort-advanced-link.active {
  color: #06271f;
  background: linear-gradient(135deg, #8af0db 0%, #39d5aa 100%);
  border-color: transparent;
  border-left-color: transparent;
  box-shadow: 0 10px 20px rgba(75, 225, 195, 0.22);
}

.nav-link.level-two-link.active::before {
  background: rgba(12, 29, 53, 0.45);
}

.collapsed .group-items {
  opacity: 0;
  max-height: 0 !important;
  padding: 0;
  overflow: hidden;
}

.collapsed .subgroup-items,
.collapsed .subgroup-label,
.collapsed .subgroup-arrow {
  opacity: 0;
  max-height: 0 !important;
  overflow: hidden;
}

.nav-link,
.subgroup-button {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  box-sizing: border-box;
  color: rgba(232, 240, 251, 0.84);
  text-decoration: none;
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.nav-link {
  justify-content: flex-start;
}

.nav-link.level-one-link,
.subgroup-button.level-one-link {
  width: calc(100% - 10px);
  min-height: 34px;
  margin-left: 10px;
  padding-left: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.084) 0%, rgba(255, 255, 255, 0.045) 100%);
  border-color: rgba(126, 220, 255, 0.14);
  border-left-color: var(--group-accent-border);
  color: rgba(232, 240, 251, 0.9);
  font-weight: 600;
}

.nav-link:hover,
.subgroup-button:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(126, 220, 255, 0.28);
  box-shadow: inset 0 0 0 1px rgba(126, 220, 255, 0.08);
  transform: translateX(2px);
}

.nav-link.active {
  color: #0c1d35;
  background: linear-gradient(135deg, #93d7ff 0%, #7bf0d0 100%);
  border-color: transparent;
  box-shadow: 0 10px 20px rgba(76, 210, 202, 0.18);
  font-weight: 700;
}

.subgroup-button {
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}

.subgroup-button.active {
  color: #0c1d35;
  background: linear-gradient(135deg, #93d7ff 0%, #7bf0d0 100%);
  border-color: transparent;
  box-shadow: 0 10px 20px rgba(76, 210, 202, 0.18);
  font-weight: 700;
}

.sidebar-footer {
  padding: 10px 6px 4px;
  color: rgba(232, 240, 251, 0.62);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.footer-text {
  margin: 0;
  font-size: 10px;
  white-space: nowrap;
  transition: opacity 0.2s ease;
}

.collapsed .footer-text {
  opacity: 0;
}

/* ── 收缩箭头按钮：右侧边缘突出 ── */
.collapse-btn {
  position: absolute;
  right: -1px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 48px;
  border: none;
  border-radius: 0 10px 10px 0;
  background: linear-gradient(135deg, #1e3a6e 0%, #1a3060 100%);
  color: #7edcff;
  cursor: pointer;
  box-shadow: 3px 0 12px rgba(8, 20, 40, 0.35);
  transition: background-color 0.2s ease, color 0.2s ease, width 0.2s ease;
  z-index: 10;
}

.collapse-btn:hover {
  background: linear-gradient(135deg, #2a4e8a 0%, #1e3a6e 100%);
  color: #ffffff;
  width: 24px;
}

.collapsed .collapse-btn {
  border-radius: 0 10px 10px 0;
}

.collapse-arrow {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  margin-left: 1px;
}

.content-area {
  position: relative;
  min-width: 0;
  height: 100vh;
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  border-left: 1px solid rgba(47, 119, 235, 0.08);
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.9) 0%, rgba(237, 243, 251, 0.92) 100%);
}

.content-area::before {
  content: '';
  position: fixed;
  inset: 0 0 0 230px;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(47, 119, 235, 0.045) 1px, transparent 1px),
    linear-gradient(180deg, rgba(47, 119, 235, 0.035) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.26;
  z-index: 0;
}

.content-area > :deep(*) {
  position: relative;
  z-index: 1;
}

.collapsed .content-area::before {
  inset: 0 0 0 52px;
}

@media (max-width: 720px) {
  .layout-root,
  .layout-root.collapsed {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .sidebar {
    min-height: auto;
    height: auto;
  }

  .content-area {
    height: auto;
    overflow: visible;
  }

  .content-area::before {
    display: none;
  }

  .collapse-btn {
    display: none;
  }
}
</style>
