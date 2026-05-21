<template>
  <div class="layout-root" :class="{ collapsed: isCollapsed }">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">DS</div>
        <div class="brand-text">
          <h1 class="brand-title">数据结构可视化</h1>
          <p class="brand-subtitle">毕业设计演示平台</p>
        </div>
      </div>

      <nav class="nav-area">
        <section v-for="group in navigationGroups" :key="group.key" class="nav-group">
          <button class="group-button" type="button" @click="toggleGroup(group.key)" :title="isCollapsed ? group.label : ''">
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

    <FloatingAiAssistant />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import FloatingAiAssistant from '../components/FloatingAiAssistant.vue'
import { navigationGroups } from '../data/algorithmCatalog'

const route = useRoute()
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
  background: linear-gradient(180deg, #10213e 0%, #0a162a 100%);
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
  padding: 8px 6px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #46a2ff 0%, #4be1c3 100%);
  color: #07223d;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.08em;
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
  margin-top: 8px;
}

.group-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  padding: 8px 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #f2f7ff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  overflow: hidden;
  white-space: nowrap;
}

.group-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.group-icon {
  width: 22px;
  flex-shrink: 0;
  color: #7edcff;
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
  display: grid;
  gap: 6px;
  padding: 6px 4px 0 4px;
  overflow: hidden;
  transition: opacity 0.2s ease, max-height 0.25s ease;
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
  width: calc(100% - 12px);
  min-height: 34px;
  margin-left: 12px;
  padding-left: 14px;
  border-left: 2px solid rgba(126, 220, 255, 0.28);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.03) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 6px 14px rgba(10, 22, 42, 0.14);
}

.subgroup-items {
  display: grid;
  gap: 4px;
  padding-top: 4px;
}

.nav-link.level-two-link {
  width: calc(100% - 24px);
  min-height: 32px;
  margin-left: 24px;
  padding-left: 12px;
  border: 1px solid rgba(126, 220, 255, 0.08);
  border-left: 2px solid rgba(126, 220, 255, 0.18);
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
  color: rgba(232, 240, 251, 0.8);
  font-size: 11px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 6px 14px rgba(10, 22, 42, 0.14);
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
  min-width: 0;
  height: 100vh;
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
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

  .collapse-btn {
    display: none;
  }
}
</style>
