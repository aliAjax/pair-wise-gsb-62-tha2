export type MonitoringType = '位移' | '水位' | '渗流' | '降雨'
export type PointStatus = '正常' | '预警' | '异常'
export type AnomalyStatus = '待现场复核' | '原因调查中' | '待负责人审批' | '应急联动' | '已失效待重算' | '已关闭'
export type Severity = '关注' | '较高' | '重大'
export type BasisSource = '监测计划' | '原始读数' | '补录读数'
export type BasisScopeType = '全部' | '类型' | '测点'

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

export interface Threshold {
  id: string
  type: MonitoringType
  warning: number
  alarm: number
  changeRate: number
  unit: string
  enabled: boolean
  /** 与统一依据版本对齐：阈值每次生效都对应一条依据记录 */
  version: number
  basisVersion: number
  effectiveAt: string
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
  /** 人工补录的读数，写入后同样只读，单独标出 */
  supplement: boolean
}

export interface BasisRecord {
  version: number
  source: BasisSource
  scopeType: BasisScopeType
  /** '全部' 或类型名（位移/水位/渗流/降雨）或测点编号 */
  scope: string
  thresholdIds: string[]
  readingIds: string[]
  operator: string
  summary: string
  createdAt: string
}

export interface ExpertOpinion {
  id: string
  specialist: string
  discipline: '坝体' | '水文' | '岩土' | '应急'
  content: string
  conclusion: '支持结论' | '提出异议' | '补充证据'
  createdAt: string
  basisVersion: number
}

export interface FieldReview {
  id: string
  inspector: string
  arrivedAt: string
  observed: string
  evidence: string
  reassessment: string
  version: number
  basisVersion: number
  /** 依据变更后，旧复核版本对当前处置失效，但内容保留可追溯 */
  superseded: boolean
}

export interface ApprovalHistoryEntry {
  at: string
  approver: string
  note: string
  basisVersion: number
  /** 会签后又被新依据冲掉时保留的历史记录 */
  superseded: boolean
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
  basisVersion: number
  /** 方案/会签所依据的版本已落后时为 true，需要重新会签 */
  superseded: boolean
  approvalHistory: ApprovalHistoryEntry[]
}

/** 关闭时冻结的处置依据快照 */
export interface FrozenBasis {
  basisVersion: number
  basisSummary: string
}

export interface RecomputeRecord {
  at: string
  fromBasis: number
  toBasis: number
  reason: string
  result: string
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
  /** 当前处置所基于的统一依据版本 */
  basisVersion: number
  /** 受依据变更影响、处置已失效待重算 */
  superseded: boolean
  /** 已关闭异常的旧依据被新依据覆盖，需要复议 */
  needsReview: boolean
  reviewReason: string
  /** 关闭时保留的当时处置依据 */
  closedBasis: FrozenBasis | null
  recomputeHistory: RecomputeRecord[]
}

export interface AuditEntry {
  id: string
  entityId: string
  action: string
  operator: string
  detail: string
  createdAt: string
  basisVersion: number
  batchId: string
}

/** 复核/会签乐观并发：后到者看到的冲突记录，填写内容随批次保留 */
export interface ConcurrencyConflict {
  batchId: string
  anomalyId: string
  commandLabel: string
  expectedVersion: number
  actualVersion: number
  message: string
  draft: TailingsCommand
  at: string
}

export interface PendingBatch {
  batchId: string
  label: string
  command: TailingsCommand
  createdAt: string
  attempts: number
  lastError: string
}

export type TailingsCommand =
  | { kind: 'submitFieldReview'; anomalyId: string; review: FieldReview; expectedVersion: number }
  | { kind: 'addExpertOpinion'; anomalyId: string; opinion: ExpertOpinion }
  | { kind: 'saveDispositionPlan'; anomalyId: string; plan: DispositionPlan; expectedVersion: number }
  | { kind: 'approvePlan'; anomalyId: string; approver: string; note: string; expectedVersion: number }
  | { kind: 'closeAnomaly'; anomalyId: string; note: string; expectedVersion: number }
  | { kind: 'createEmergencyLink'; anomalyId: string; note: string }
  | { kind: 'publishThreshold'; threshold: Threshold; operator: string; note: string }
  | { kind: 'supplementReading'; reading: RawReading; operator: string; note: string }

export interface TailingsDataset {
  points: MonitoringPoint[]
  thresholds: Threshold[]
  readings: RawReading[]
  anomalies: Anomaly[]
  /** 统一版本依据时间线：监测计划生效、原始读数、补录读数都在此挂账 */
  basisHistory: BasisRecord[]
  audit: AuditEntry[]
}
