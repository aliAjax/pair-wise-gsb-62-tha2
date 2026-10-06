import { createAction, createReducer, on } from '@ngrx/store'
import type { Anomaly, AuditEntry, ConcurrencyConflict, PendingBatch, TailingsDataset } from '../domain'
import { seedDataset } from '../data/seed'
import { type AuditLine, commandLabel, toAuditEntry } from './batch'
import { TailingsActions } from './tailings.actions'

/** effect 完成服务写入后提交的实际落库动作（审计在此时一次性追加） */
export const batchCommitted = createAction(
  '[Tailings] Batch Committed (internal)',
  (payload: { batchId: string; dataset: TailingsDataset; auditLines: AuditLine[]; at: string }) => ({ payload })
)

export interface TailingsState {
  dataset: TailingsDataset
  loading: boolean
  error: string
  selectedAnomalyId: string
  keyword: string
  status: Anomaly['status'] | '全部'
  /** 写入中或写入失败、待重试的未完成批次 */
  pendingBatches: PendingBatch[]
  /** 乐观锁冲突后保留的填写内容 */
  conflicts: ConcurrencyConflict[]
  failureSwitch: boolean
}

export const initialTailingsState: TailingsState = {
  dataset: structuredClone(seedDataset),
  loading: false,
  error: '',
  selectedAnomalyId: seedDataset.anomalies[0]?.id ?? '',
  keyword: '',
  status: '全部',
  pendingBatches: [],
  conflicts: [],
  failureSwitch: false
}

export const tailingsReducer = createReducer(
  initialTailingsState,
  on(TailingsActions.loadDataset, (state) => ({ ...state, loading: true, error: '' })),
  on(TailingsActions.loadDatasetSuccess, (state, { dataset }) => ({ ...state, dataset, loading: false, pendingBatches: [], conflicts: [], selectedAnomalyId: dataset.anomalies[0]?.id ?? '' })),
  on(TailingsActions.loadDatasetFailure, (state, { error }) => ({ ...state, loading: false, error })),

  on(TailingsActions.submitBatch, (state, { batchId, command }) => {
    if (state.pendingBatches.some((batch) => batch.batchId === batchId)) return state
    const pending: PendingBatch = { batchId, label: commandLabel(command), command, createdAt: new Date().toISOString(), attempts: 1, lastError: '' }
    return { ...state, pendingBatches: [...state.pendingBatches, pending] }
  }),
  on(TailingsActions.retryBatch, (state, { batchId }) => ({
    ...state,
    pendingBatches: state.pendingBatches.map((batch) => batch.batchId === batchId ? { ...batch, attempts: batch.attempts + 1 } : batch)
  })),
  on(TailingsActions.batchFailed, (state, { batchId, error }) => ({
    ...state,
    pendingBatches: state.pendingBatches.map((batch) => batch.batchId === batchId ? { ...batch, lastError: error } : batch)
  })),
  on(TailingsActions.discardBatch, (state, { batchId }) => ({
    ...state,
    pendingBatches: state.pendingBatches.filter((batch) => batch.batchId !== batchId)
  })),
  on(TailingsActions.batchConflict, (state, { conflict }) => {
    if (state.conflicts.some((item) => item.batchId === conflict.batchId)) return state
    return {
      ...state,
      pendingBatches: state.pendingBatches.filter((batch) => batch.batchId !== conflict.batchId),
      conflicts: [conflict, ...state.conflicts]
    }
  }),
  on(TailingsActions.discardConflict, (state, { batchId }) => ({
    ...state,
    conflicts: state.conflicts.filter((conflict) => conflict.batchId !== batchId)
  })),
  on(TailingsActions.resubmitConflict, (state, { conflict }) => ({
    ...state,
    conflicts: state.conflicts.filter((item) => item.batchId !== conflict.batchId)
  })),
  on(batchCommitted, (state, { payload }) => {
    const { batchId, dataset, auditLines, at } = payload
    // 幂等：同一批次已经落过审计（重试竞态）则不再追加，只清理暂存
    const alreadyCommitted = state.dataset.audit.some((entry: AuditEntry) => entry.batchId === batchId)
    if (alreadyCommitted) {
      return { ...state, pendingBatches: state.pendingBatches.filter((batch) => batch.batchId !== batchId) }
    }
    const entries: AuditEntry[] = auditLines.map((line) => toAuditEntry(line, batchId, at))
    const committed: TailingsDataset = { ...dataset, audit: [...entries, ...dataset.audit] }
    return {
      ...state,
      dataset: committed,
      pendingBatches: state.pendingBatches.filter((batch) => batch.batchId !== batchId)
    }
  }),
  on(TailingsActions.toggleFailureSwitch, (state, { enabled }) => ({ ...state, failureSwitch: enabled })),

  on(TailingsActions.selectAnomaly, (state, { anomalyId }) => ({ ...state, selectedAnomalyId: anomalyId })),
  on(TailingsActions.updateKeyword, (state, { keyword }) => ({ ...state, keyword })),
  on(TailingsActions.updateStatus, (state, { status }) => ({ ...state, status: status as TailingsState['status'] })),
  on(TailingsActions.resetDemo, () => ({
    ...initialTailingsState,
    dataset: structuredClone(seedDataset),
    selectedAnomalyId: seedDataset.anomalies[0]?.id ?? ''
  }))
)
