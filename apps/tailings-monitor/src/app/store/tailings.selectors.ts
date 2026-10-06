import { createFeatureSelector, createSelector } from '@ngrx/store'
import type { TailingsState } from './tailings.reducer'

export const selectTailings = createFeatureSelector<TailingsState>('tailings')
export const selectDataset = createSelector(selectTailings, (state) => state.dataset)
export const selectPoints = createSelector(selectDataset, (dataset) => dataset.points)
export const selectAnomalies = createSelector(selectDataset, (dataset) => dataset.anomalies)
export const selectCurrentBasisVersion = createSelector(selectDataset, (dataset) => dataset.currentBasisVersion)
export const selectActivePlan = createSelector(selectDataset, (dataset) => dataset.plans.find((plan) => plan.active) ?? dataset.plans[0])
export const selectPendingBatch = createSelector(selectTailings, (state) => state.pendingBatch)
export const selectWriteStatus = createSelector(selectTailings, (state) => ({
  writeInFlight: state.writeInFlight,
  writeError: state.writeError,
  writeConflict: state.writeConflict,
  writeNotice: state.writeNotice
}))
export const selectSelectedAnomaly = createSelector(selectTailings, (state) => state.dataset.anomalies.find((item) => item.id === state.selectedAnomalyId) ?? state.dataset.anomalies[0])
export const selectFilteredAnomalies = createSelector(selectTailings, (state) => state.dataset.anomalies.filter((item) => {
  const point = state.dataset.points.find((value) => value.id === item.pointId)
  const text = `${item.id} ${item.title} ${item.owner} ${point?.name ?? ''} V${item.basis.basisVersion} ${item.basisState}`.toLowerCase()
  return (!state.keyword || text.includes(state.keyword.toLowerCase())) && (state.status === '全部' || item.status === state.status)
}))
