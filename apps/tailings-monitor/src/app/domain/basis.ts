import type {
  Anomaly,
  BasisRecord,
  DispositionPlan,
  FieldReview,
  MonitoringPoint,
  RawReading,
  Severity,
  TailingsDataset,
  Threshold
} from './models'

export interface BasisImpact {
  affectedPointIds: Set<string>
  thresholdIds: string[]
  source: BasisRecord['source']
}

/** 判断一条新依据影响哪些测点（全部 / 按监测类型 / 按补录读数所在测点） */
export function resolveImpact(dataset: TailingsDataset, record: BasisRecord): BasisImpact {
  const affectedPointIds = new Set<string>()
  if (record.scopeType === '全部') {
    dataset.points.forEach((point) => affectedPointIds.add(point.id))
  } else if (record.scopeType === '类型') {
    dataset.points.filter((point) => point.type === record.scope).forEach((point) => affectedPointIds.add(point.id))
  } else {
    const direct = dataset.points.find((point) => point.id === record.scope)
    if (direct) affectedPointIds.add(direct.id)
    dataset.readings
      .filter((reading) => record.readingIds.includes(reading.id))
      .forEach((reading) => affectedPointIds.add(reading.pointId))
  }
  return { affectedPointIds, thresholdIds: record.thresholdIds, source: record.source }
}

export function latestBasis(dataset: TailingsDataset): BasisRecord | undefined {
  return dataset.basisHistory[0]
}

export function basisAt(dataset: TailingsDataset, version: number): BasisRecord | undefined {
  return dataset.basisHistory.find((record) => record.version === version)
}

export function basisLabel(dataset: TailingsDataset, version: number): string {
  const record = basisAt(dataset, version)
  if (!record) return `依据 V${version}（未找到）`
  return `依据V${version} · ${record.source} · ${record.summary}`
}

/** 取某测点当前生效阈值（按该类型查找；多版本时只保留一条生效记录） */
export function thresholdForPoint(dataset: TailingsDataset, point: MonitoringPoint | undefined): Threshold | undefined {
  if (!point) return undefined
  return dataset.thresholds.find((threshold) => threshold.id === point.thresholdId && threshold.enabled)
}

/** 取测点最新有效读数（补录与自动采集同等参与重算） */
export function latestReadingForPoint(dataset: TailingsDataset, pointId: string): RawReading | undefined {
  return dataset.readings
    .filter((reading) => reading.pointId === pointId && reading.quality !== '无效')
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))[0]
}

export function evaluateSeverity(value: number, threshold: Threshold | undefined): { status: MonitoringPoint['status']; severity: Severity; level: string } {
  if (!threshold || !threshold.enabled) return { status: '正常', severity: '关注', level: '无生效阈值' }
  if (value >= threshold.alarm) return { status: '异常', severity: '重大', level: `超过报警值${threshold.alarm}${threshold.unit}` }
  if (value >= threshold.warning) return { status: '预警', severity: '较高', level: `超过预警值${threshold.warning}${threshold.unit}` }
  return { status: '正常', severity: '关注', level: `低于预警值${threshold.warning}${threshold.unit}` }
}

function invalidatePlan(plan: DispositionPlan): void {
  if (plan.approvedAt) {
    plan.approvalHistory.unshift({ at: plan.approvedAt, approver: plan.approvedBy, note: '会签通过', basisVersion: plan.basisVersion, superseded: true })
  }
  plan.approvedBy = ''
  plan.approvedAt = ''
  plan.superseded = true
}

export interface BasisApplyResult {
  dataset: TailingsDataset
  auditLines: Array<{ entityId: string; action: string; detail: string }>
}

/**
 * 新依据生效后的统一重算：
 * - 待处理/调查/审批/应急（含已会签）异常：旧复核与会签立即失效，状态转为“已失效待重算”，按新依据重算级别与观测描述；
 * - 已关闭异常：保留关闭时处置依据，仅标记需要复议。
 * 纯函数：返回新的数据集与审计条目（审计由批次层在写入成功时只追加一次）。
 */
export function applyBasisToAnomalies(dataset: TailingsDataset, record: BasisRecord): BasisApplyResult {
  const next: TailingsDataset = structuredClone(dataset)
  const impact = resolveImpact(next, record)
  const auditLines: Array<{ entityId: string; action: string; detail: string }> = []
  const now = record.createdAt

  // 先按新阈值/新读数刷新测点状态
  next.points.forEach((point) => {
    if (!impact.affectedPointIds.has(point.id)) return
    const reading = latestReadingForPoint(next, point.id)
    if (reading) point.currentValue = reading.value
    const threshold = thresholdForPoint(next, point)
    point.status = evaluateSeverity(point.currentValue, threshold).status
  })

  next.anomalies.forEach((anomaly) => {
    if (!impact.affectedPointIds.has(anomaly.pointId)) return
    const point = next.points.find((item) => item.id === anomaly.pointId)
    const threshold = thresholdForPoint(next, point)
    const reading = latestReadingForPoint(next, anomaly.pointId)
    const currentValue = reading?.value ?? point?.currentValue ?? 0
    const evaluation = evaluateSeverity(currentValue, threshold)

    if (anomaly.status === '已关闭') {
      // 已关闭：冻结处置依据不改写，只标记复议；新依据继续变化时复议原因随之更新
      const reason = `关闭依据V${anomaly.basisVersion}已被${record.source}（依据V${record.version}）覆盖，需按新依据复议`
      if (!anomaly.needsReview || anomaly.reviewReason !== reason) {
        anomaly.needsReview = true
        anomaly.reviewReason = reason
        auditLines.push({ entityId: anomaly.id, action: '标记复议', detail: `已关闭异常保留关闭依据V${anomaly.basisVersion}，新依据V${record.version}生效，列入复议` })
      }
      return
    }

    // 未关闭异常：旧复核、旧方案会签立即失效并重算
    const previousBasis = anomaly.basisVersion
    anomaly.fieldReviews.forEach((review: FieldReview) => { review.superseded = true })
    invalidatePlan(anomaly.plan)
    anomaly.superseded = true
    anomaly.basisVersion = record.version
    anomaly.severity = evaluation.severity
    if (reading) {
      anomaly.triggerReadingId = reading.id
      anomaly.observedValue = `${reading.value} ${reading.unit}（${reading.supplement ? '补录' : '自动'}读数，按依据V${record.version}重算，${evaluation.level}）`
    } else {
      anomaly.observedValue = `${anomaly.observedValue}（按依据V${record.version}重算，${evaluation.level}）`
    }
    anomaly.status = '已失效待重算'
    anomaly.version += 1
    anomaly.recomputeHistory.unshift({
      at: now,
      fromBasis: previousBasis,
      toBasis: record.version,
      reason: `${record.source}生效：${record.summary}`,
      result: `级别重算为「${evaluation.severity}」，状态转为已失效待重算，原有复核与会签失效`
    })
    auditLines.push({
      entityId: anomaly.id,
      action: '依据变更失效重算',
      detail: `依据V${previousBasis} → V${record.version}（${record.source}），待处理/已会签结论失效，已按新依据重算为${evaluation.severity}`
    })
  })

  return { dataset: next, auditLines }
}

/** 重新提交复核时清除失效标记（处置重新挂到当前依据上） */
export function rebaseAnomaly(anomaly: Anomaly, basisVersion: number): void {
  anomaly.superseded = false
  anomaly.basisVersion = basisVersion
  if (anomaly.status === '已失效待重算') anomaly.status = '原因调查中'
}

/** 页面/队列/导出统一使用的依据展示文本 */
export function anomalyBasisText(dataset: TailingsDataset, anomaly: Anomaly): string {
  if (anomaly.status === '已关闭' && anomaly.closedBasis) {
    return `关闭依据V${anomaly.closedBasis.basisVersion}（${anomaly.closedBasis.basisSummary}）`
  }
  return basisLabel(dataset, anomaly.basisVersion)
}
