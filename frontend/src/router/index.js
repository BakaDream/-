import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../layout/MainLayout.vue'
import AlgorithmPage from '../views/AlgorithmPage.vue'
import { routes } from '../data/algorithmCatalog'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          redirect: routes[0].path,
        },
        ...routes.map((route) => ({
          path: route.path,
          name: route.name,
          component: AlgorithmPage,
        })),
      ],
    },
  ],
})

export default router
