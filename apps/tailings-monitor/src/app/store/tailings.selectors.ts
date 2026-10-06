import { createFeatureSelector, createSelector } from '@ngrx/store'
import type { TailingsState } from './tailings.reducer'
import { anomalyBasisText } from '../domain/basis'

export const selectTailings = createFeatureSelector<TailingsState>('tailings')
export type TailingsStateSlice = TailingsState

export const selectDataset = createSelector(selectTailings, (state) => state.dataset)
export const selectPoints = createSelector(selectDataset, (dataset) => dataset.points)
export const selectAnomalies = createSelector(selectDataset, (dataset) => dataset.anomalies)
export const selectBasisHistory = createSelector(selectDataset, (dataset) => dataset.basisHistory)
export const selectCurrentBasisVersion = createSelector(selectDataset, (dataset) => dataset.basisHistory[0]?.version ?? 0)
export const selectPendingBatches = createSelector(selectTailings, (state) => state.pendingBatches)
export const selectConflicts = createSelector(selectTailings, (state) => state.conflicts)
export const selectFailureSwitch = createSelector(selectTailings, (state) => state.failureSwitch)

export interface AnomalyRow {
  id: string
  title: string
  pointId: string
  pointName: string
  severity: string
  status: string
  version: number
  basisVersion: number
  basisText: string
  superseded: boolean
  needsReview: boolean
  reviewReason: string
}

/** 异常队列：页面、队列列表、导出统一使用同一版本依据字段 */
export const selectAnomalyRows = createSelector(selectTailings, (state): AnomalyRow[] =>
  state.dataset.anomalies.map((item) => {
    const point = state.dataset.points.find((value) => value.id === item.pointId)
    return {
      id: item.id,
      title: item.title,
      pointId: item.pointId,
      pointName: point?.name ?? '',
      severity: item.severity,
      status: item.status,
      version: item.version,
      basisVersion: item.closedBasis?.basisVersion ?? item.basisVersion,
      basisText: anomalyBasisText(state.dataset, item),
      superseded: item.superseded,
      needsReview: item.needsReview,
      reviewReason: item.reviewReason
    }
  })
)

export const selectSelectedAnomaly = createSelector(selectTailings, (state) => state.dataset.anomalies.find((item) => item.id === state.selectedAnomalyId) ?? state.dataset.anomalies[0])

export const selectFilteredAnomalies = createSelector(selectTailings, (state) => state.dataset.anomalies.filter((item) => {
  const point = state.dataset.points.find((value) => value.id === item.pointId)
  const text = `${item.id} ${item.title} ${item.owner} ${point?.name ?? ''}`.toLowerCase()
  return (!state.keyword || text.includes(state.keyword.toLowerCase())) && (state.status === '全部' || item.status === state.status)
}))
