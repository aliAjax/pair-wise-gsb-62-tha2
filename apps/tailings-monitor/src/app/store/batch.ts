import type {
  Anomaly,
  AuditEntry,
  BasisRecord,
  ConcurrencyConflict,
  DispositionPlan,
  ExpertOpinion,
  FieldReview,
  TailingsCommand,
  TailingsDataset
} from '../domain'
import { applyBasisToAnomalies, basisLabel, rebaseAnomaly } from '../domain/basis'

export interface AuditLine {
  entityId: string
  action: string
  operator: string
  detail: string
  basisVersion: number
}

export interface CommandOutput {
  auditLines: AuditLine[]
}

export type CommandResult = CommandOutput | { error: string }

const currentBasis = (dataset: TailingsDataset): number => dataset.basisHistory[0]?.version ?? 0

const commandLabelMap: Record<TailingsCommand['kind'], string> = {
  submitFieldReview: '提交现场复核',
  addExpertOpinion: '补充专业意见',
  saveDispositionPlan: '提交处置方案会签',
  approvePlan: '负责人会签',
  closeAnomaly: '关闭异常',
  createEmergencyLink: '启动应急联动',
  publishThreshold: '监测计划生效',
  supplementReading: '补录读数生效'
}

export function commandLabel(command: TailingsCommand): string {
  return commandLabelMap[command.kind]
}

export function commandEntityId(command: TailingsCommand): string {
  switch (command.kind) {
    case 'publishThreshold': return command.threshold.id
    case 'supplementReading': return command.reading.id
    default: return command.anomalyId
  }
}

/** 乐观锁：带 expectedVersion 的命令在写入前校验异常版本，后到者即冲突 */
export function detectConflict(dataset: TailingsDataset, command: TailingsCommand, batchId: string): ConcurrencyConflict | null {
  if (!('expectedVersion' in command)) return null
  const anomaly = dataset.anomalies.find((item) => item.id === command.anomalyId)
  if (!anomaly) {
    return { batchId, anomalyId: command.anomalyId, commandLabel: commandLabel(command), expectedVersion: command.expectedVersion, actualVersion: -1, message: '异常不存在或已被移除。', draft: command, at: new Date().toISOString() }
  }
  if (anomaly.version !== command.expectedVersion) {
    return {
      batchId,
      anomalyId: anomaly.id,
      commandLabel: commandLabel(command),
      expectedVersion: command.expectedVersion,
      actualVersion: anomaly.version,
      message: `该异常已由另一窗口先提交，版本从 V${command.expectedVersion} 变为 V${anomaly.version}（当前依据V${anomaly.basisVersion}）。本次${commandLabel(command)}未写入，填写内容已保留，可按新版本重新提交。`,
      draft: command,
      at: new Date().toISOString()
    }
  }
  return null
}

/**
 * 在已克隆的数据集上执行命令。审计行随批次一次性生成，
 * reducer 以 batchId 幂等落库，重试不会重复追加审计。
 */
export function executeCommand(dataset: TailingsDataset, command: TailingsCommand, batchId: string, at: string): CommandResult {
  switch (command.kind) {
    case 'submitFieldReview': return submitFieldReview(dataset, command.anomalyId, command.review, at)
    case 'addExpertOpinion': return addExpertOpinion(dataset, command.anomalyId, command.opinion, at)
    case 'saveDispositionPlan': return saveDispositionPlan(dataset, command.anomalyId, command.plan, at)
    case 'approvePlan': return approvePlan(dataset, command.anomalyId, command.approver, command.note, at)
    case 'closeAnomaly': return closeAnomaly(dataset, command.anomalyId, command.note, at)
    case 'createEmergencyLink': return createEmergencyLink(dataset, command.anomalyId, command.note, at)
    case 'publishThreshold': return publishThreshold(dataset, command, at)
    case 'supplementReading': return supplementReading(dataset, command, at)
  }
}

function findAnomaly(dataset: TailingsDataset, anomalyId: string): Anomaly | undefined {
  return dataset.anomalies.find((item) => item.id === anomalyId)
}

const hasError = (result: CommandResult): result is { error: string } => 'error' in result

function submitFieldReview(dataset: TailingsDataset, anomalyId: string, review: FieldReview, _at: string): CommandResult {
  const anomaly = findAnomaly(dataset, anomalyId)
  if (!anomaly) return { error: '异常不存在' }
  if (!review.observed.trim() || !review.evidence.trim() || !review.reassessment.trim()) return { error: '现场观察、证据清单和重新评估均为必填项' }
  const basis = currentBasis(dataset)
  const activeCount = anomaly.fieldReviews.filter((item) => !item.superseded).length
  anomaly.fieldReviews.unshift({ ...review, version: activeCount + 1, basisVersion: basis, superseded: false })
  rebaseAnomaly(anomaly, basis)
  anomaly.version += 1
  return { auditLines: [{ entityId: anomalyId, action: '提交现场复核', operator: review.inspector, detail: `依据V${basis}：${review.reassessment}`, basisVersion: basis }] }
}

function addExpertOpinion(dataset: TailingsDataset, anomalyId: string, opinion: ExpertOpinion, _at: string): CommandResult {
  const anomaly = findAnomaly(dataset, anomalyId)
  if (!anomaly) return { error: '异常不存在' }
  if (!opinion.content.trim()) return { error: '专业意见内容不能为空' }
  const basis = currentBasis(dataset)
  anomaly.opinions.unshift({ ...opinion, basisVersion: basis })
  anomaly.version += 1
  return { auditLines: [{ entityId: anomalyId, action: '补充专业意见', operator: opinion.specialist, detail: `依据V${basis} ${opinion.conclusion}：${opinion.content}`, basisVersion: basis }] }
}

function saveDispositionPlan(dataset: TailingsDataset, anomalyId: string, plan: DispositionPlan, _at: string): CommandResult {
  const anomaly = findAnomaly(dataset, anomalyId)
  if (!anomaly) return { error: '异常不存在' }
  if (!plan.owner.trim() || !plan.deadline || !plan.conditions.trim()) return { error: '责任方、截止时间和关闭条件均为必填项' }
  const basis = currentBasis(dataset)
  anomaly.plan = { ...plan, basisVersion: basis, superseded: false, approvedBy: '', approvedAt: '', approvalHistory: anomaly.plan.approvalHistory }
  anomaly.status = '待负责人审批'
  anomaly.superseded = false
  anomaly.basisVersion = basis
  anomaly.version += 1
  return { auditLines: [{ entityId: anomalyId, action: '提交处置方案', operator: '当前用户', detail: `依据V${basis}：${plan.action}，责任方${plan.owner}，送会签`, basisVersion: basis }] }
}

function approvePlan(dataset: TailingsDataset, anomalyId: string, approver: string, note: string, at: string): CommandResult {
  const anomaly = findAnomaly(dataset, anomalyId)
  if (!anomaly) return { error: '异常不存在' }
  if (anomaly.status !== '待负责人审批' && anomaly.status !== '应急联动') return { error: '当前异常不在待会签状态，可能已被新依据置为失效' }
  if (anomaly.severity === '重大' && !anomaly.plan.emergencyLinked) return { error: '重大异常必须先启动应急联动才能会签' }
  if (!anomaly.plan.owner) return { error: '尚无待会签的处置方案' }
  const basis = currentBasis(dataset)
  anomaly.plan.approvedBy = approver
  anomaly.plan.approvedAt = at
  anomaly.plan.basisVersion = basis
  anomaly.plan.superseded = false
  anomaly.plan.approvalHistory.unshift({ at, approver, note: note || '同意执行', basisVersion: basis, superseded: false })
  anomaly.version += 1
  return { auditLines: [{ entityId: anomalyId, action: '会签处置方案', operator: approver, detail: `依据V${basis}：${note || '同意执行'}`, basisVersion: basis }] }
}

function closeAnomaly(dataset: TailingsDataset, anomalyId: string, note: string, at: string): CommandResult {
  const anomaly = findAnomaly(dataset, anomalyId)
  if (!anomaly) return { error: '异常不存在' }
  if (anomaly.status !== '待负责人审批' && anomaly.status !== '应急联动') return { error: '异常已失效待重算或未处于可关闭状态' }
  if (!anomaly.plan.approvedBy) return { error: '处置方案尚未会签，不能关闭' }
  if (!anomaly.fieldReviews.some((review) => !review.superseded)) return { error: '缺少当前依据下的现场复核，不能关闭' }
  if (!note.trim()) return { error: '关闭说明不能为空' }
  const basis = anomaly.basisVersion
  anomaly.status = '已关闭'
  anomaly.closedAt = at
  anomaly.superseded = false
  anomaly.needsReview = false
  anomaly.reviewReason = ''
  anomaly.closedBasis = { basisVersion: basis, basisSummary: basisLabel(dataset, basis) }
  anomaly.version += 1
  return { auditLines: [{ entityId: anomalyId, action: '关闭异常', operator: anomaly.plan.approvedBy, detail: `关闭依据V${basis} 冻结：${note}`, basisVersion: basis }] }
}

function createEmergencyLink(dataset: TailingsDataset, anomalyId: string, note: string, _at: string): CommandResult {
  const anomaly = findAnomaly(dataset, anomalyId)
  if (!anomaly) return { error: '异常不存在' }
  if (anomaly.status === '已关闭') return { error: '已关闭异常不能启动应急联动' }
  if (anomaly.status === '已失效待重算') return { error: '异常已失效待重算，请先按新依据重新提交复核或方案' }
  const basis = currentBasis(dataset)
  anomaly.plan.emergencyLinked = true
  anomaly.status = '应急联动'
  anomaly.version += 1
  return { auditLines: [{ entityId: anomalyId, action: '启动应急联动', operator: '值班负责人', detail: `依据V${basis}：${note}`, basisVersion: basis }] }
}

function publishThreshold(dataset: TailingsDataset, command: Extract<TailingsCommand, { kind: 'publishThreshold' }>, at: string): CommandResult {
  const basis = currentBasis(dataset) + 1
  const previous = dataset.thresholds.find((item) => item.id === command.threshold.id)
  const threshold = { ...command.threshold, version: (previous?.version ?? 0) + 1, basisVersion: basis, effectiveAt: at }
  const index = dataset.thresholds.findIndex((item) => item.id === threshold.id)
  if (index >= 0) dataset.thresholds[index] = threshold
  else dataset.thresholds.push(threshold)

  const summary = `${threshold.type}阈值V${threshold.version}生效：预警${threshold.warning}、报警${threshold.alarm}、变化速率${threshold.changeRate}${threshold.unit}`
  const record: BasisRecord = {
    version: basis,
    source: '监测计划',
    scopeType: '类型',
    scope: threshold.type,
    thresholdIds: [threshold.id],
    readingIds: [],
    operator: command.operator,
    summary: command.note ? `${summary}；${command.note}` : summary,
    createdAt: at
  }
  // applyBasisToAnomalies 在克隆集上重算，再把受影响实体拷回本写入事务工作集
  const applied = applyBasisToAnomalies(dataset, record)
  dataset.points = applied.dataset.points
  dataset.anomalies = applied.dataset.anomalies
  dataset.basisHistory.unshift(record)

  return {
    auditLines: [
      { entityId: threshold.id, action: '监测计划生效', operator: command.operator, detail: summary + (command.note ? `；${command.note}` : ''), basisVersion: basis },
      ...applied.auditLines.map((line) => ({ ...line, operator: command.operator, basisVersion: basis }))
    ]
  }
}

function supplementReading(dataset: TailingsDataset, command: Extract<TailingsCommand, { kind: 'supplementReading' }>, at: string): CommandResult {
  const basis = currentBasis(dataset) + 1
  const point = dataset.points.find((item) => item.id === command.reading.pointId)
  if (!point) return { error: '补录读数的测点不存在' }
  if (dataset.readings.some((item) => item.id === command.reading.id)) return { error: '补录批次与已有读数编号冲突' }
  const reading = { ...command.reading, basisVersion: basis, supplement: true }
  dataset.readings.unshift(reading)

  const summary = `${point.name}（${point.id}）补录读数 ${reading.value}${reading.unit}，采集时间${reading.capturedAt.replace('T', ' ')}`
  const record: BasisRecord = {
    version: basis,
    source: '补录读数',
    scopeType: '测点',
    scope: point.id,
    thresholdIds: [point.thresholdId],
    readingIds: [reading.id],
    operator: command.operator,
    summary: command.note ? `${summary}；${command.note}` : summary,
    createdAt: at
  }
  const applied = applyBasisToAnomalies(dataset, record)
  dataset.points = applied.dataset.points
  dataset.anomalies = applied.dataset.anomalies
  dataset.basisHistory.unshift(record)

  return {
    auditLines: [
      { entityId: reading.id, action: '补录读数生效', operator: command.operator, detail: `${summary}；读数只读不可覆盖。${command.note}`, basisVersion: basis },
      ...applied.auditLines.map((line) => ({ ...line, operator: command.operator, basisVersion: basis }))
    ]
  }
}

export function toAuditEntry(line: AuditLine, batchId: string, at: string): AuditEntry {
  return {
    id: `AUD-${at.replace(/[-:.TZ]/g, '')}-${Math.random().toString(36).slice(2, 7)}`,
    entityId: line.entityId,
    action: line.action,
    operator: line.operator,
    detail: line.detail,
    createdAt: at,
    basisVersion: line.basisVersion,
    batchId
  }
}

/** 冲突后按当前版本重提：保留填写内容，仅刷新乐观锁基线 */
export function rebaseCommand(command: TailingsCommand, actualVersion: number): TailingsCommand {
  if (!('expectedVersion' in command)) return command
  return { ...command, expectedVersion: actualVersion }
}

export { hasError }
