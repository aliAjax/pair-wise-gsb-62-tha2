export type MonitoringType = '位移' | '水位' | '渗流' | '降雨'
export type PointStatus = '正常' | '预警' | '异常'
export type AnomalyStatus = '待现场复核' | '原因调查中' | '待负责人审批' | '应急联动' | '已关闭'
export type Severity = '关注' | '较高' | '重大'
export type BasisState = '有效' | '已失效·待重算' | '已关闭·待复议'
export type WriteOperation = 'activateBasis' | 'submitFieldReview' | 'approvePlan'

export interface MonitoringPoint {
  id: string
  name: string
  zone: string
  type: MonitoringType
  longitude: number
  latitude: number
  status: PointStatus
  currentValue: number
  unit: string
  thresholdId: string
  lastInspectionAt: string
}

export interface MonitoringPlan {
  id: string
  name: string
  basisVersion: number
  frequency: string
  effectiveAt: string
  activatedAt: string
  active: boolean
  notes: string
}

export interface Threshold {
  id: string
  type: MonitoringType
  warning: number
  alarm: number
  changeRate: number
  unit: string
  enabled: boolean
  version: number
  basisVersion: number
}

export interface RawReading {
  id: string
  pointId: string
  value: number
  unit: string
  capturedAt: string
  deviceId: string
  quality: '有效' | '可疑' | '无效'
  basisVersion: number
  supplementType?: '设备补传' | '人工补录'
  replacesReadingId?: string
}

export interface BasisSnapshot {
  basisVersion: number
  planId: string
  activatedAt: string
  thresholdVersions: Record<string, number>
  readingIds: string[]
  label: string
}

export interface ExpertOpinion {
  id: string
  specialist: string
  discipline: '坝体' | '水文' | '岩土' | '应急'
  content: string
  conclusion: '支持结论' | '提出异议' | '补充证据'
  createdAt: string
}

export interface FieldReview {
  id: string
  kind: '现场复核' | '负责人会签'
  inspector: string
  arrivedAt: string
  observed: string
  evidence: string
  reassessment: string
  version: number
  basisVersion: number
  basisState: BasisState
  conflict?: string
}

export interface DispositionPlan {
  id: string
  action: '加密监测' | '降低库水位' | '疏通排水' | '应急撤离准备' | '工程加固'
  owner: string
  deadline: string
  conditions: string
  emergencyLinked: boolean
  approvedBy: string
  approvedAt: string
  approvedBasisVersion?: number
  conflict?: string
}

export interface Anomaly {
  id: string
  pointId: string
  title: string
  severity: Severity
  status: AnomalyStatus
  openedAt: string
  owner: string
  triggerReadingId: string
  observedValue: string
  fieldReviews: FieldReview[]
  opinions: ExpertOpinion[]
  plan: DispositionPlan
  closedAt: string
  version: number
  basis: BasisSnapshot
  basisState: BasisState
  recalculationNote: string
  closedBasis?: BasisSnapshot
  conflict?: string
}

export interface AuditEntry {
  id: string
  batchId: string
  entityId: string
  basisVersion: number
  action: string
  operator: string
  detail: string
  createdAt: string
}

export interface ActivateBasisPayload {
  planName: string
  effectiveAt: string
  frequency: string
  notes: string
  thresholds: Array<Pick<Threshold, 'id' | 'warning' | 'alarm' | 'changeRate'>>
  supplementalReadings: Array<Pick<RawReading, 'pointId' | 'value' | 'unit' | 'capturedAt' | 'quality' | 'supplementType' | 'replacesReadingId'>>
}

export interface PendingFieldReview {
  anomalyId: string
  review: FieldReview
}

export interface PendingApproval {
  anomalyId: string
  approver: string
  note: string
}

export interface WriteBatch<TPayload = unknown> {
  id: string
  operation: WriteOperation
  entityId: string
  operator: string
  payload: TPayload
  expectedBasisVersion: number
  expectedAnomalyVersion?: number
  createdAt: string
  attempts: number
  lastError: string
}

export interface TailingsDataset {
  currentBasisVersion: number
  points: MonitoringPoint[]
  plans: MonitoringPlan[]
  thresholds: Threshold[]
  readings: RawReading[]
  anomalies: Anomaly[]
  audit: AuditEntry[]
}
