import { createReducer, on } from '@ngrx/store'
import type { Anomaly, AuditEntry, TailingsDataset, WriteBatch } from '../domain'
import { seedDataset } from '../data/seed'
import { TailingsActions } from './tailings.actions'

export interface TailingsState {
  dataset: TailingsDataset
  loading: boolean
  error: string
  selectedAnomalyId: string
  keyword: string
  status: Anomaly['status'] | '全部'
  pendingBatch: WriteBatch | null
  writeInFlight: boolean
  writeError: string
  writeConflict: string
  writeNotice: string
}

const buildInitialState = (): TailingsState => ({
  dataset: structuredClone(seedDataset),
  loading: false,
  error: '',
  selectedAnomalyId: seedDataset.anomalies[0]?.id ?? '',
  keyword: '',
  status: '全部',
  pendingBatch: null,
  writeInFlight: false,
  writeError: '',
  writeConflict: '',
  writeNotice: ''
})

export const initialTailingsState: TailingsState = buildInitialState()

let idSeed = 50
const audit = (entityId: string, action: string, operator: string, detail: string, basisVersion: number): AuditEntry => ({
  id: `AUD-${Date.now()}-${idSeed++}`, batchId: `LOCAL-${Date.now()}`, entityId, basisVersion, action, operator, detail, createdAt: new Date().toISOString()
})

const conflictMessage = (message: string) => message.includes('另一窗口') || message.includes('依据已') || message.includes('正在按') ? message : ''

export const tailingsReducer = createReducer(
  initialTailingsState,
  on(TailingsActions.hydrateDataset, (state, { dataset, pendingBatch }) => {
    const nextDataset = dataset ?? structuredClone(seedDataset)
    return {
      ...state,
      dataset: nextDataset,
      pendingBatch,
      writeInFlight: false,
      writeError: pendingBatch?.lastError ?? '',
      writeConflict: pendingBatch ? conflictMessage(pendingBatch.lastError) : '',
      selectedAnomalyId: nextDataset.anomalies.some((item) => item.id === state.selectedAnomalyId) ? state.selectedAnomalyId : nextDataset.anomalies[0]?.id ?? ''
    }
  }),
  on(TailingsActions.loadDatasetSuccess, (state, { dataset }) => ({
    ...state,
    dataset,
    loading: false,
    selectedAnomalyId: dataset.anomalies.some((item) => item.id === state.selectedAnomalyId) ? state.selectedAnomalyId : dataset.anomalies[0]?.id ?? ''
  })),
  on(TailingsActions.loadDatasetFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(TailingsActions.requestWrite, (state, { batch }) => ({ ...state, writeInFlight: true, writeError: '', writeConflict: '', writeNotice: '', pendingBatch: batch })),
  on(TailingsActions.writeSucceeded, (state, { batch, dataset }) => ({
    ...state,
    dataset,
    pendingBatch: null,
    writeInFlight: false,
    writeError: '',
    writeConflict: '',
    writeNotice: `${batch.id} 已按同一版本依据提交成功`,
    selectedAnomalyId: dataset.anomalies.some((item) => item.id === state.selectedAnomalyId) ? state.selectedAnomalyId : dataset.anomalies[0]?.id ?? ''
  })),
  on(TailingsActions.writeFailed, (state, { batch, error }) => ({
    ...state,
    pendingBatch: { ...batch, attempts: batch.attempts + 1, lastError: error },
    writeInFlight: false,
    writeError: error,
    writeConflict: conflictMessage(error)
  })),
  on(TailingsActions.retryPendingWrite, (state) => state.pendingBatch ? { ...state, writeInFlight: true, writeError: '', writeConflict: '', writeNotice: '' } : state),
  on(TailingsActions.discardPendingWrite, (state) => ({ ...state, pendingBatch: null, writeInFlight: false, writeError: '', writeConflict: '', writeNotice: '未完成批次已丢弃，填写内容不再自动重试' })),
  on(TailingsActions.clearWriteConflict, (state) => ({ ...state, writeConflict: '' })),
  on(TailingsActions.addExpertOpinion, (state, { anomalyId, opinion }) => {
    const dataset = structuredClone(state.dataset)
    const anomaly = dataset.anomalies.find((item) => item.id === anomalyId)
    if (!anomaly || !opinion.content || anomaly.basisState !== '有效') return state
    anomaly.opinions.unshift(opinion)
    anomaly.version += 1
    dataset.audit.unshift(audit(anomalyId, '补充专业意见', opinion.specialist, `${opinion.conclusion}：${opinion.content}`, dataset.currentBasisVersion))
    return { ...state, dataset }
  }),
  on(TailingsActions.saveDispositionPlan, (state, { anomalyId, plan }) => {
    const dataset = structuredClone(state.dataset)
    const anomaly = dataset.anomalies.find((item) => item.id === anomalyId)
    if (!anomaly || !plan.owner || !plan.deadline || !plan.conditions || anomaly.basisState !== '有效' || anomaly.status === '已关闭') return state
    anomaly.plan = { ...anomaly.plan, ...plan, id: anomaly.plan.id, approvedBy: '', approvedAt: '', approvedBasisVersion: undefined, conflict: '' }
    anomaly.status = anomaly.severity === '重大' && anomaly.plan.emergencyLinked ? '应急联动' : '待负责人审批'
    anomaly.version += 1
    dataset.audit.unshift(audit(anomalyId, '提交处置方案', '当前用户', `${plan.action}，责任方${plan.owner}`, dataset.currentBasisVersion))
    return { ...state, dataset }
  }),
  on(TailingsActions.closeAnomaly, (state, { anomalyId, note }) => {
    const dataset = structuredClone(state.dataset)
    const anomaly = dataset.anomalies.find((item) => item.id === anomalyId)
    if (!anomaly || !anomaly.plan.approvedBy || anomaly.plan.approvedBasisVersion !== dataset.currentBasisVersion || !anomaly.fieldReviews.some((review) => review.kind === '现场复核' && review.basisVersion === dataset.currentBasisVersion) || !note.trim() || anomaly.basisState !== '有效') return state
    anomaly.status = '已关闭'
    anomaly.closedAt = new Date().toISOString()
    anomaly.basisState = '有效'
    anomaly.closedBasis = structuredClone(anomaly.basis)
    anomaly.version += 1
    dataset.audit.unshift(audit(anomalyId, '关闭异常', anomaly.plan.approvedBy, note, dataset.currentBasisVersion))
    return { ...state, dataset }
  }),
  on(TailingsActions.createEmergencyLink, (state, { anomalyId, note }) => {
    const dataset = structuredClone(state.dataset)
    const anomaly = dataset.anomalies.find((item) => item.id === anomalyId)
    if (!anomaly || anomaly.basisState !== '有效' || anomaly.status === '已关闭') return state
    anomaly.plan.emergencyLinked = true
    anomaly.status = '应急联动'
    anomaly.version += 1
    dataset.audit.unshift(audit(anomalyId, '启动应急联动', '值班负责人', note, dataset.currentBasisVersion))
    return { ...state, dataset }
  }),
  on(TailingsActions.selectAnomaly, (state, { anomalyId }) => ({ ...state, selectedAnomalyId: anomalyId, writeConflict: '', writeNotice: '' })),
  on(TailingsActions.updateKeyword, (state, { keyword }) => ({ ...state, keyword })),
  on(TailingsActions.updateStatus, (state, { status }) => ({ ...state, status: status as TailingsState['status'] })),
  on(TailingsActions.addAudit, (state, { entry }) => ({ ...state, dataset: { ...state.dataset, audit: [entry, ...state.dataset.audit] } })),
  on(TailingsActions.resetDemo, () => buildInitialState())
)
