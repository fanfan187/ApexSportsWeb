<template>
  <div class="schedule-detail-page">
    <!-- Breadcrumb -->
    <a-breadcrumb class="breadcrumb">
      <a-breadcrumb-item>
        <router-link to="/schedule">赛程管理</router-link>
      </a-breadcrumb-item>
      <a-breadcrumb-item>场次详情</a-breadcrumb-item>
    </a-breadcrumb>

    <!-- Header: 项目名称 + 轮次 + 组别 -->
    <div class="page-header">
      <a-spin :spinning="loading">
        <h2 v-if="competition" class="title">
          <span class="title-name">{{ competition.eventName }}</span>
          <a-divider type="vertical" />
          <span class="title-meta">{{ roundText }}</span>
          <a-divider type="vertical" />
          <span class="title-meta">第 {{ competition.groupNo }} 组</span>
          <a-tag
            v-if="competition"
            class="title-status"
            :color="STATUS_COLOR_MAP[competition.status]"
          >
            {{ STATUS_MAP[competition.status] }}
          </a-tag>
        </h2>
        <a-skeleton v-else :title="{ width: '40%' }" :paragraph="false" active />
      </a-spin>
    </div>

    <!-- Tabs -->
    <a-tabs
      v-model:activeKey="activeTab"
      class="detail-tabs"
      destroy-inactive-tab-panes
    >
      <a-tab-pane key="basic" tab="基本信息">
        <BasicInfoTab :competition-id="competitionId" />
      </a-tab-pane>
      <a-tab-pane key="athlete" tab="运动员编排">
        <component
          :is="AthleteArrangeTab"
          v-if="activeTab === 'athlete'"
          :competition-id="competitionId"
        />
      </a-tab-pane>
      <a-tab-pane key="team" tab="团体编排">
        <component
          :is="TeamArrangeTab"
          v-if="activeTab === 'team'"
          :competition-id="competitionId"
        />
      </a-tab-pane>
      <a-tab-pane key="referee" tab="裁判分配">
        <component
          :is="RefereeTab"
          v-if="activeTab === 'referee'"
          :competition-id="competitionId"
        />
      </a-tab-pane>
      <a-tab-pane key="equipment" tab="器材分配">
        <component
          :is="EquipmentTab"
          v-if="activeTab === 'equipment'"
          :competition-id="competitionId"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BasicInfoTab from './components/BasicInfoTab.vue'
import { getCompetition } from '@/api/competition'
import { STATUS_MAP, STATUS_COLOR_MAP, ROUND_MAP } from './constants'
import type { Competition } from './types'

// === Route ===
const route = useRoute()

/** 路径参数 id → number（路由未注册时兜底 NaN→0） */
const competitionId = computed<number>(() => {
  const raw = route.params.id
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) ? n : 0
})

// === Tab state ===
const activeTab = ref<'basic' | 'athlete' | 'team' | 'referee' | 'equipment'>('basic')

// T19 / T20 组件尚未创建，采用懒加载（Vite 字符串路径动态 import，tsc --noEmit 不报错；
// 运行时若文件未创建则点击对应 Tab 才会抛加载错误，符合分阶段交付预期）
const AthleteArrangeTab = () => import('./components/AthleteArrangeTab.vue')
const TeamArrangeTab = () => import('./components/TeamArrangeTab.vue')
const RefereeTab = () => import('./components/RefereeTab.vue')
const EquipmentTab = () => import('./components/EquipmentTab.vue')

// === Detail data ===
const loading = ref(false)
const competition = ref<Competition | null>(null)

const roundText = computed(() => {
  if (!competition.value) return ''
  return ROUND_MAP[competition.value.round] ?? `第${competition.value.round}轮`
})

async function loadDetail() {
  if (!competitionId.value) return
  loading.value = true
  try {
    const detail = await getCompetition(competitionId.value)
    competition.value = detail.competition
  } catch {
    // 拦截器统一弹窗，此处仅终止 loading
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped lang="less">
.schedule-detail-page {
  .breadcrumb {
    margin-bottom: @space-md;
  }

  .page-header {
    margin-bottom: @space-lg;

    .title {
      margin: 0;
      font-size: @font-size-h2;
      line-height: 1.4;

      .title-name {
        font-weight: 600;
      }

      .title-meta {
        color: @text-secondary;
        font-weight: 400;
      }

      .title-status {
        margin-left: @space-sm;
      }
    }
  }

  .detail-tabs {
    :deep(.ant-tabs-content) {
      padding-top: @space-md;
    }
  }
}
</style>
