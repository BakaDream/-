<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { navigationGroups } from '../data/algorithmCatalog'

const flattenItems = (items) =>
  items.flatMap((item) => (item.children?.length ? item.children : item))

const moduleCards = computed(() =>
  navigationGroups.map((group) => {
    const pages = flattenItems(group.items)
    return {
      key: group.key,
      icon: group.icon,
      label: group.label,
      count: pages.length,
      path: pages[0]?.path || '/',
      items: pages.slice(0, 4).map((page) => page.title),
    }
  }),
)

const featuredLinks = [
  {
    title: '先从顺序表开始',
    text: '适合快速建立“连续存储、下标、移动元素”的基础认识。',
    to: '/linear-list/basic',
    tag: '基础入口',
  },
  {
    title: '再看栈和队列',
    text: '把受限线性表、队列指针和堆实现优先队列串起来。',
    to: '/stack-queue/priority-queue',
    tag: '核心结构',
  },
  {
    title: '最后进入树和图',
    text: '用于理解层次结构、路径关系、遍历和最小生成树。',
    to: '/tree/binary-tree',
    tag: '进阶专题',
  },
]

const studySteps = [
  '顺序表和链表：先分清连续存储与链式存储',
  '栈和队列：理解受限操作与典型应用场景',
  '树：掌握递归结构、遍历和查找关系',
  '图：观察顶点、边、矩阵、邻接表和路径算法',
]
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <div class="hero-copy">
        <span class="eyebrow">数据结构算法可视化教学平台</span>
        <h2>先看主线，再进算法。</h2>
        <p>
          首页把算法按学习路径重新组织。需要练基础时从顺序表进入，需要看抽象结构时走栈、队列、树和图。
        </p>
        <div class="hero-actions">
          <RouterLink class="primary-link" to="/linear-list/basic">开始学习</RouterLink>
          <RouterLink class="secondary-link" to="/graph/traversal">查看图遍历</RouterLink>
        </div>
      </div>

      <div class="hero-panel">
        <div class="panel-title">推荐顺序</div>
        <ol class="study-list">
          <li v-for="step in studySteps" :key="step">{{ step }}</li>
        </ol>
      </div>
    </section>

    <section class="featured-grid" aria-label="推荐入口">
      <RouterLink v-for="link in featuredLinks" :key="link.to" class="feature-card" :to="link.to">
        <span>{{ link.tag }}</span>
        <strong>{{ link.title }}</strong>
        <small>{{ link.text }}</small>
      </RouterLink>
    </section>

    <section class="module-section">
      <div class="section-heading">
        <span>全部模块</span>
        <p>按知识结构进入，而不是在算法列表里乱找。</p>
      </div>

      <div class="module-grid">
        <RouterLink
          v-for="card in moduleCards"
          :key="card.key"
          class="module-card"
          :class="`module-${card.key}`"
          :to="card.path"
        >
          <div class="module-topline">
            <span class="module-icon">{{ card.icon }}</span>
            <span class="module-count">{{ card.count }} 个页面</span>
          </div>
          <h3>{{ card.label }}</h3>
          <ul>
            <li v-for="item in card.items" :key="item">{{ item }}</li>
          </ul>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100%;
  padding: 22px;
  color: #172741;
  background:
    radial-gradient(circle at 12% 0, rgba(47, 119, 235, 0.12), transparent 30%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0));
}

.home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.8fr);
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.hero-copy,
.hero-panel,
.feature-card,
.module-card {
  border: 1px solid rgba(51, 101, 164, 0.14);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 16px 36px rgba(21, 47, 84, 0.08);
}

.hero-copy {
  padding: 32px;
  background:
    linear-gradient(135deg, rgba(234, 246, 255, 0.96) 0%, rgba(255, 255, 255, 0.9) 55%, rgba(235, 252, 247, 0.94) 100%);
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 12px;
  color: #2f77eb;
  font-size: 13px;
  font-weight: 700;
}

.hero-copy h2 {
  margin: 0;
  color: #10213e;
  font-size: 42px;
  line-height: 1.1;
  letter-spacing: 0;
}

.hero-copy p {
  max-width: 680px;
  margin: 16px 0 0;
  color: #60708a;
  font-size: 16px;
  line-height: 1.8;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.primary-link,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.primary-link {
  background: #2f77eb;
  color: #ffffff;
  box-shadow: 0 12px 22px rgba(47, 119, 235, 0.22);
}

.secondary-link {
  border: 1px solid rgba(47, 119, 235, 0.18);
  color: #285eaf;
  background: #f5f9ff;
}

.hero-panel {
  position: relative;
  padding: 24px;
  overflow: hidden;
}

.hero-panel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #2f77eb 0%, #4be1c3 100%);
}

.panel-title {
  margin-bottom: 14px;
  color: #10213e;
  font-size: 16px;
  font-weight: 800;
}

.study-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 20px;
  color: #596a83;
  line-height: 1.6;
}

.study-list li::marker {
  color: #2f77eb;
  font-weight: 800;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.feature-card {
  display: grid;
  gap: 8px;
  min-height: 138px;
  padding: 20px;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.feature-card:hover,
.module-card:hover {
  transform: translateY(-2px);
  border-color: rgba(47, 119, 235, 0.26);
  box-shadow: 0 18px 42px rgba(21, 47, 84, 0.12);
}

.feature-card span {
  color: #13a67a;
  font-size: 12px;
  font-weight: 800;
}

.feature-card strong {
  color: #10213e;
  font-size: 18px;
}

.feature-card small {
  color: #66758d;
  font-size: 13px;
  line-height: 1.7;
}

.module-section {
  padding-bottom: 16px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.section-heading span {
  color: #10213e;
  font-size: 22px;
  font-weight: 800;
}

.section-heading p {
  margin: 0;
  color: #718098;
  font-size: 13px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.module-card {
  --module-accent: #2f77eb;
  --module-soft: rgba(47, 119, 235, 0.12);
  position: relative;
  min-height: 210px;
  padding: 18px;
  color: inherit;
  text-decoration: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  overflow: hidden;
}

.module-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 18px;
  width: 4px;
  border-radius: 0 999px 999px 0;
  background: var(--module-accent);
}

.module-linked-list {
  --module-accent: #13a67a;
  --module-soft: rgba(19, 166, 122, 0.12);
}

.module-stack-queue {
  --module-accent: #c97a15;
  --module-soft: rgba(201, 122, 21, 0.13);
}

.module-tree {
  --module-accent: #7665d8;
  --module-soft: rgba(118, 101, 216, 0.13);
}

.module-graph {
  --module-accent: #de5a4f;
  --module-soft: rgba(222, 90, 79, 0.12);
}

.module-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.module-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--module-soft);
  color: var(--module-accent);
  font-weight: 800;
}

.module-count {
  color: #7b8aa1;
  font-size: 12px;
}

.module-card h3 {
  margin: 16px 0 12px;
  color: #10213e;
  font-size: 20px;
}

.module-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: #66758d;
  font-size: 13px;
  line-height: 1.5;
}

.module-card li {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .home-hero,
  .featured-grid {
    grid-template-columns: 1fr;
  }

  .module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .home-page {
    padding: 14px;
  }

  .hero-copy {
    padding: 22px;
  }

  .hero-copy h2 {
    font-size: 30px;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }
}
</style>
