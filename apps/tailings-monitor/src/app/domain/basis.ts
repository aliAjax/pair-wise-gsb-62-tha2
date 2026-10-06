import type {
  Anomaly,
  ActivateBasisPayload,
  AuditEntry,
  BasisSnapshot,
  FieldReview,
  MonitoringPoint,
  RawReading,
  TailingsDataset,
  Threshold,
  WriteBatch
} from './models'

export class BasisConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BasisConflictError'
  }
}

const now = () => new Date().toISOString()

const sortedReadings = (dataset: TailingsDataset, pointId: string) =>
  dataset.readings
    .filter((reading) => reading.pointId === pointId && reading.quality !== '无效')
    .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))

const latestReading = (dataset: TailingsDataset, pointId: string) => sortedReadings(dataset, pointId)[0]

export const basisLabel = (version: number, activatedAt: string) => `V${version} · ${activatedAt.replace('T', ' ').slice(0, 16)} 生效`

export const formatBasis = (basis: BasisSnapshot) => basis.label || basisLabel(basis.basisVersion, basis.activatedAt)

const makeAudit = (batch: WriteBatch, entityId: string, action: string, detail: string, basisVersion: number, suffix = '1'): AuditEntry => ({
  id: `${batch.id}-AUD-${suffix}`,
  batchId: batch.id,
  entityId,
  basisVersion,
  action,
  operator: batch.operator,
  detail,
  createdAt: now()
})

const uniqueAudit = (dataset: TailingsDataset, entries: AuditEntry[]) => {
  const existing = new Set(dataset.audit.map((entry) => entry.id))
  dataset.audit = [...entries.filter((entry) => !existing.has(entry.id)), ...dataset.audit]
}

const pointThreshold = (dataset: TailingsDataset, point: MonitoringPoint): Threshold | undefined =>
  dataset.thresholds.find((threshold) => threshold.id === point.thresholdId && threshold.enabled)

const recalculatePoints = (dataset: TailingsDataset) => {
  dataset.points = dataset.points.map((point) => {
    const threshold = pointThreshold(dataset, point)
    const reading = latestReading(dataset, point.id)
    if (!threshold || !reading) return { ...point, status: '正常' as const }
    const status = reading.value >= threshold.alarm ? '异常' : reading.value >= threshold.warning ? '预警' : '正常'
    return { ...point, status, currentValue: reading.value, unit: reading.unit }
  })
}

const describeRate = (dataset: TailingsDataset, pointId: string, threshold: Threshold) => {
  const readings = sortedReadings(dataset, pointId).slice(0, 2)
  if (readings.length < 2) return '变化率需按新计划继续观测'
  const hours = Math.max((new Date(readings[0].capturedAt).getTime() - new Date(readings[1].capturedAt).getTime()) / 3_600_000, 1 / 60)
  return `${Math.abs(readings[0].value - readings[1].value) / hours >= threshold.changeRate ? '超过' : '未超过'}速率阈值${threshold.changeRate}${threshold.unit}`
}

const recalculateOpenAnomaly = (dataset: TailingsDataset, anomaly: Anomaly, nextVersion: number, thresholdChanged: boolean, readingChanged: boolean) => {
  const point = dataset.points.find((item) => item.id === anomaly.pointId)
  const threshold = point ? pointThreshold(dataset, point) : undefined
  const reading = latestReading(dataset, anomaly.pointId)
  if (!point || !threshold) return

  if (reading) {
    anomaly.triggerReadingId = reading.id
    anomaly.observedValue = `${reading.value} ${reading.unit}；${describeRate(dataset, point.id, threshold)}`
    anomaly.severity = reading.value >= threshold.alarm ? '重大' : reading.value >= threshold.warning ? '较高' : '关注'
  }

  const stillTriggered = reading ? reading.value >= threshold.warning : false
  const reasons = [
    thresholdChanged ? '阈值版本已更新' : '',
    readingChanged ? '存在补传/补录读数' : '',
    stillTriggered ? '按新依据仍触发异常' : '按新依据当前读数未再触发阈值'
  ].filter(Boolean)
  anomaly.recalculationNote = `已按V${nextVersion}重算：${reasons.join('，')}；原复核/会签内容保留，须重新现场复核。`
}

const invalidateOpenAnomaly = (anomaly: Anomaly, nextBasis: BasisSnapshot) => {
  const oldVersion = anomaly.basis.basisVersion
  anomaly.basis = structuredClone(nextBasis)
  anomaly.basisState = '已失效·待重算'
  anomaly.status = '待现场复核'
  anomaly.version += 1
  anomaly.conflict = ''
  anomaly.fieldReviews.forEach((review) => {
    review.basisState = '已失效·待重算'
    review.conflict = `原记录基于V${review.basisVersion}，当前依据为V${nextBasis.basisVersion}`
  })
  if (anomaly.plan.approvedBy) {
    anomaly.plan.conflict = `V${oldVersion}会签已失效，请按V${nextBasis.basisVersion}重新会签`
  }
  anomaly.plan.approvedBasisVersion = oldVersion
}

const activateBasis = (dataset: TailingsDataset, batch: WriteBatch<ActivateBasisPayload>) => {
  const nextVersion = dataset.currentBasisVersion + 1
  const payload = batch.payload
  const activatedAt = now()
  const planId = `MP-${new Date(activatedAt).toISOString().slice(0, 10).replaceAll('-', '')}-V${nextVersion}`

  dataset.plans = dataset.plans.map((plan) => ({ ...plan, active: false }))
  dataset.plans.unshift({
    id: planId,
    name: payload.planName,
    basisVersion: nextVersion,
    frequency: payload.frequency,
    effectiveAt: payload.effectiveAt,
    activatedAt,
    active: true,
    notes: payload.notes
  })

  const changedThresholdIds: string[] = []
  dataset.thresholds = dataset.thresholds.map((threshold) => {
    const change = payload.thresholds.find((item) => item.id === threshold.id)
    if (!change) return threshold
    const changed = change.warning !== threshold.warning || change.alarm !== threshold.alarm || change.changeRate !== threshold.changeRate
    if (changed) changedThresholdIds.push(threshold.id)
    return {
      ...threshold,
      ...change,
      version: changed ? threshold.version + 1 : threshold.version,
      basisVersion: nextVersion,
      enabled: true
    }
  })

  const newReadings: RawReading[] = payload.supplementalReadings
    .filter((item) => item.value !== null && item.value !== undefined && item.capturedAt)
    .map((item, index) => ({
      id: `${batch.id}-RD-${index + 1}`,
      basisVersion: nextVersion,
      deviceId: item.supplementType === '人工补录' ? 'MANUAL' : `DEV-${item.pointId}`,
      ...item
    }))
  if (newReadings.length) dataset.readings = [...newReadings, ...dataset.readings]

  recalculatePoints(dataset)
  const affectedPointIds = new Set(newReadings.map((item) => item.pointId))
  const affected = dataset.anomalies.filter((anomaly) => anomaly.status !== '已关闭')
  affected.forEach((anomaly) => {
    invalidateOpenAnomaly(anomaly, {
      basisVersion: nextVersion,
      planId,
      activatedAt,
      thresholdVersions: Object.fromEntries(dataset.thresholds.map((threshold) => [threshold.id, threshold.version])),
      readingIds: dataset.readings.filter((reading) => reading.basisVersion === nextVersion).map((reading) => reading.id),
      label: basisLabel(nextVersion, payload.effectiveAt || activatedAt)
    })
    recalculateOpenAnomaly(dataset, anomaly, nextVersion, changedThresholdIds.includes(findThresholdIdByPoint(dataset, anomaly.pointId)), affectedPointIds.has(anomaly.pointId))
  })

  dataset.anomalies = dataset.anomalies.map((anomaly) => {
    if (anomaly.status !== '已关闭') return anomaly
    return {
      ...anomaly,
      basisState: '已关闭·待复议',
      recalculationNote: `V${nextVersion}计划已生效；关闭结论和处置依据保留为V${anomaly.closedBasis?.basisVersion ?? anomaly.basis.basisVersion}，需按新依据复议。`
    }
  })
  dataset.currentBasisVersion = nextVersion

  const auditEntries = [
    makeAudit(batch, planId, '监测计划生效', `${payload.planName}生效为V${nextVersion}；更新${changedThresholdIds.length}项阈值，接入${newReadings.length}条补传/补录读数；${affected.length}条未关闭异常立即失效重算。`, nextVersion),
    ...affected.map((anomaly, index) => makeAudit(batch, anomaly.id, '依据失效并重算', anomaly.recalculationNote, nextVersion, `AN-${index + 1}`)),
    ...dataset.anomalies.filter((anomaly) => anomaly.status === '已关闭').map((anomaly, index) => makeAudit(batch, anomaly.id, '关闭结论待复议', `保留V${anomaly.closedBasis?.basisVersion ?? anomaly.basis.basisVersion}关闭依据，按V${nextVersion}标记复议。`, nextVersion, `CL-${index + 1}`))
  ]
  uniqueAudit(dataset, auditEntries)
  return dataset
}

const findThresholdIdByPoint = (dataset: TailingsDataset, pointId: string) => dataset.points.find((point) => point.id === pointId)?.thresholdId ?? ''

const submitFieldReview = (dataset: TailingsDataset, batch: WriteBatch<PendingFieldReviewPayload>) => {
  const anomaly = dataset.anomalies.find((item) => item.id === batch.payload.anomalyId)
  if (!anomaly) throw new Error('异常不存在')
  if (anomaly.status === '已关闭') throw new BasisConflictError('异常已关闭，不能追加复核')
  if (!['有效', '已失效·待重算'].includes(anomaly.basisState)) throw new BasisConflictError(`异常依据状态为${anomaly.basisState}，请先处理当前结论`)

  const form = batch.payload.review
  const review: FieldReview = {
    ...form,
    id: `${batch.id}-FR`,
    version: anomaly.fieldReviews.length + 1,
    basisVersion: dataset.currentBasisVersion,
    basisState: '有效',
    conflict: ''
  }
  anomaly.fieldReviews.unshift(review)
  anomaly.status = '原因调查中'
  anomaly.basisState = '有效'
  anomaly.recalculationNote = ''
  anomaly.conflict = ''
  anomaly.version += 1
  uniqueAudit(dataset, [makeAudit(batch, anomaly.id, review.kind === '负责人会签' ? '提交会签' : '提交现场复核', review.reassessment, dataset.currentBasisVersion)])
  return dataset
}

type PendingFieldReviewPayload = { anomalyId: string; review: FieldReview }

const approvePlan = (dataset: TailingsDataset, batch: WriteBatch<{ anomalyId: string; approver: string; note: string }>) => {
  const anomaly = dataset.anomalies.find((item) => item.id === batch.payload.anomalyId)
  if (!anomaly) throw new Error('异常不存在')
  if (anomaly.status === '已关闭') throw new BasisConflictError('异常已关闭，不能重复会签')
  if (anomaly.basisState !== '有效') throw new BasisConflictError(`会签依据已失效，当前为V${dataset.currentBasisVersion}`)
  if (anomaly.plan.approvedBasisVersion === dataset.currentBasisVersion && anomaly.plan.approvedAt && !anomaly.plan.approvedBy.includes('已失效')) {
    throw new BasisConflictError('另一窗口已先完成会签，填写内容已保留')
  }
  if (anomaly.severity === '重大' && !anomaly.plan.emergencyLinked) throw new Error('重大异常必须先启动应急联动')

  const sign: FieldReview = {
    id: `${batch.id}-SIGN`,
    kind: '负责人会签',
    inspector: batch.payload.approver,
    arrivedAt: now(),
    observed: '负责人按当前版本依据会签处置方案。',
    evidence: `V${dataset.currentBasisVersion}监测计划、阈值和原始读数`,
    reassessment: batch.payload.note || '同意执行',
    version: anomaly.fieldReviews.length + 1,
    basisVersion: dataset.currentBasisVersion,
    basisState: '有效'
  }
  anomaly.fieldReviews.unshift(sign)
  anomaly.plan = { ...anomaly.plan, approvedBy: batch.payload.approver, approvedAt: now(), approvedBasisVersion: dataset.currentBasisVersion, conflict: '' }
  anomaly.version += 1
  uniqueAudit(dataset, [makeAudit(batch, anomaly.id, '负责人会签', batch.payload.note || '同意执行', dataset.currentBasisVersion)])
  return dataset
}

export const commitWrite = (input: TailingsDataset, batch: WriteBatch): TailingsDataset => {
  const dataset = structuredClone(input)
  if (batch.expectedBasisVersion !== dataset.currentBasisVersion) {
    throw new BasisConflictError(`依据已从V${batch.expectedBasisVersion}更新为V${dataset.currentBasisVersion}，填写内容已保留`)
  }
  const anomalyId = batch.operation === 'activateBasis' ? '' : (batch.payload as { anomalyId?: string }).anomalyId
  const anomaly = anomalyId ? dataset.anomalies.find((item) => item.id === anomalyId) : undefined
  if (anomaly && batch.expectedAnomalyVersion !== undefined && batch.expectedAnomalyVersion !== anomaly.version) {
    throw new BasisConflictError('另一窗口已先完成提交，后到内容已保留；请查看冲突后基于当前版本重提')
  }

  if (batch.operation === 'activateBasis') return activateBasis(dataset, batch as WriteBatch<ActivateBasisPayload>)
  if (batch.operation === 'submitFieldReview') return submitFieldReview(dataset, batch as WriteBatch<PendingFieldReviewPayload>)
  if (batch.operation === 'approvePlan') return approvePlan(dataset, batch as WriteBatch<{ anomalyId: string; approver: string; note: string }>)
  throw new Error('未知写入类型')
}
