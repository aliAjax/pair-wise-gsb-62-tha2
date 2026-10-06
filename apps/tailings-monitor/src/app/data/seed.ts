import type { BasisSnapshot, TailingsDataset } from '../domain'

const basis8: BasisSnapshot = {
  basisVersion: 8,
  planId: 'MP-2609-08',
  activatedAt: '2026-09-28T18:00:00',
  thresholdVersions: { 'T-D': 4, 'T-W': 3, 'T-S': 5, 'T-R': 2 },
  readingIds: ['RD-1', 'RD-2', 'RD-3', 'RD-4'],
  label: 'V8 · 2026-09-28 18:00 生效'
}

const basis7: BasisSnapshot = {
  basisVersion: 7,
  planId: 'MP-2609-07',
  activatedAt: '2026-09-27T18:00:00',
  thresholdVersions: { 'T-D': 4, 'T-W': 3, 'T-S': 4, 'T-R': 2 },
  readingIds: ['RD-S1'],
  label: 'V7 · 2026-09-27 18:00 生效'
}

export const seedDataset: TailingsDataset = {
  currentBasisVersion: 8,
  points: [
    { id: 'P-D01', name: '主坝顶部位移点 D01', zone: '主坝', type: '位移', longitude: 112.832, latitude: 40.116, status: '异常', currentValue: 18.7, unit: 'mm', thresholdId: 'T-D', lastInspectionAt: '2026-09-29T08:20:00' },
    { id: 'P-D02', name: '主坝下游位移点 D02', zone: '主坝', type: '位移', longitude: 112.837, latitude: 40.111, status: '预警', currentValue: 12.4, unit: 'mm', thresholdId: 'T-D', lastInspectionAt: '2026-09-29T08:10:00' },
    { id: 'P-W01', name: '库内水位计 W01', zone: '库区', type: '水位', longitude: 112.846, latitude: 40.121, status: '预警', currentValue: 873.4, unit: 'm', thresholdId: 'T-W', lastInspectionAt: '2026-09-29T07:55:00' },
    { id: 'P-S01', name: '主坝渗流计 S01', zone: '主坝', type: '渗流', longitude: 112.827, latitude: 40.106, status: '正常', currentValue: 1.8, unit: 'L/s', thresholdId: 'T-S', lastInspectionAt: '2026-09-29T07:40:00' },
    { id: 'P-R01', name: '库区雨量站 R01', zone: '库区', type: '降雨', longitude: 112.861, latitude: 40.132, status: '正常', currentValue: 24.6, unit: 'mm/h', thresholdId: 'T-R', lastInspectionAt: '2026-09-29T08:00:00' }
  ],
  plans: [
    { id: 'MP-2609-08', name: '汛期第九轮加密监测计划', basisVersion: 8, frequency: '位移/水位每1小时；渗流每2小时；降雨连续记录', effectiveAt: '2026-09-28T18:00:00', activatedAt: '2026-09-28T17:30:00', active: true, notes: '上游持续降雨，主坝位移与库水位联动研判。' },
    { id: 'MP-2609-07', name: '汛期第八轮常规监测计划', basisVersion: 7, frequency: '位移/水位每2小时；渗流每4小时；降雨连续记录', effectiveAt: '2026-09-27T18:00:00', activatedAt: '2026-09-27T17:20:00', active: false, notes: '常规雨后巡查计划。' }
  ],
  thresholds: [
    { id: 'T-D', type: '位移', warning: 10, alarm: 16, changeRate: 3, unit: 'mm/d', enabled: true, version: 4, basisVersion: 8 },
    { id: 'T-W', type: '水位', warning: 871, alarm: 873, changeRate: 0.5, unit: 'm/h', enabled: true, version: 3, basisVersion: 8 },
    { id: 'T-S', type: '渗流', warning: 2.2, alarm: 3, changeRate: 0.4, unit: 'L/s', enabled: true, version: 5, basisVersion: 8 },
    { id: 'T-R', type: '降雨', warning: 30, alarm: 50, changeRate: 10, unit: 'mm/h', enabled: true, version: 2, basisVersion: 8 }
  ],
  readings: [
    { id: 'RD-1', pointId: 'P-D01', value: 18.7, unit: 'mm', capturedAt: '2026-09-29T08:20:00', deviceId: 'GNSS-D01', quality: '有效', basisVersion: 8 },
    { id: 'RD-2', pointId: 'P-D01', value: 16.2, unit: 'mm', capturedAt: '2026-09-29T07:20:00', deviceId: 'GNSS-D01', quality: '有效', basisVersion: 8 },
    { id: 'RD-3', pointId: 'P-D01', value: 13.8, unit: 'mm', capturedAt: '2026-09-29T06:20:00', deviceId: 'GNSS-D01', quality: '有效', basisVersion: 8 },
    { id: 'RD-4', pointId: 'P-W01', value: 873.4, unit: 'm', capturedAt: '2026-09-29T07:55:00', deviceId: 'WL-W01', quality: '有效', basisVersion: 8 },
    { id: 'RD-S1', pointId: 'P-S01', value: 3.2, unit: 'L/s', capturedAt: '2026-09-28T09:20:00', deviceId: 'SEEP-S01', quality: '有效', basisVersion: 7 }
  ],
  anomalies: [
    {
      id: 'AN-260929-01', pointId: 'P-D01', title: '主坝D01累计位移超过报警阈值', severity: '重大', status: '待负责人审批', openedAt: '2026-09-29T08:25:00', owner: '坝体安全组', triggerReadingId: 'RD-1', observedValue: '18.7 mm，昨日变化4.2 mm/d', version: 7, closedAt: '',
      basis: structuredClone(basis8), basisState: '有效', recalculationNote: '',
      fieldReviews: [{ id: 'FR-1', kind: '现场复核', inspector: '宋立', arrivedAt: '2026-09-29T09:10:00', observed: '坝顶排水沟未见明显开裂，D01附近无新增裂缝，基准点稳定。', evidence: 'D01近景照片、基准点复核记录、GNSS原始观测文件', reassessment: '读数有效，位移趋势仍上升，建议立即降低库水位并加密监测。', version: 2, basisVersion: 8, basisState: '有效' }],
      opinions: [
        { id: 'OP-1', specialist: '周岩', discipline: '岩土', content: '近三日位移速率持续高于阈值，需结合孔隙水压力分析潜在滑面。', conclusion: '支持结论', createdAt: '2026-09-29T10:20:00' },
        { id: 'OP-2', specialist: '许洁', discipline: '水文', content: '库水位仍接近警戒线，建议优先降低库水位并核对上游来水。', conclusion: '补充证据', createdAt: '2026-09-29T10:45:00' }
      ],
      plan: { id: 'PL-1', action: '降低库水位', owner: '库区调度班', deadline: '2026-09-29T18:00:00', conditions: '每2小时复测D01、D02和W01；位移速率恢复至3mm/d以下并稳定12小时后，负责人可关闭异常。', emergencyLinked: true, approvedBy: '', approvedAt: '' }
    },
    {
      id: 'AN-260929-02', pointId: 'P-W01', title: '库水位短时上升速率超预警值', severity: '较高', status: '原因调查中', openedAt: '2026-09-29T08:00:00', owner: '库区调度班', triggerReadingId: 'RD-4', observedValue: '873.4 m，1小时上升0.6 m', version: 4, closedAt: '',
      basis: structuredClone(basis8), basisState: '有效', recalculationNote: '',
      fieldReviews: [],
      opinions: [{ id: 'OP-3', specialist: '许洁', discipline: '水文', content: '上游降雨汇流导致入湖量增加，需核实泄洪闸状态。', conclusion: '支持结论', createdAt: '2026-09-29T09:00:00' }],
      plan: { id: 'PL-2', action: '加密监测', owner: '库区调度班', deadline: '2026-09-29T14:00:00', conditions: '每小时记录水位与入库流量，达到874.0m时启动应急联动。', emergencyLinked: false, approvedBy: '', approvedAt: '' }
    },
    {
      id: 'AN-260928-03', pointId: 'P-S01', title: 'S01渗流量雨后瞬时超报警值', severity: '较高', status: '已关闭', openedAt: '2026-09-28T09:25:00', owner: '坝体安全组', triggerReadingId: 'RD-S1', observedValue: '3.2 L/s，持续20分钟后回落', version: 6, closedAt: '2026-09-28T16:10:00',
      basis: structuredClone(basis7), basisState: '已关闭·待复议', recalculationNote: 'V8计划已生效；关闭结论保留V7依据，需按新依据复议。', closedBasis: structuredClone(basis7),
      fieldReviews: [{ id: 'FR-3', kind: '现场复核', inspector: '宋立', arrivedAt: '2026-09-28T10:00:00', observed: '排水棱体出水清澈，周边无浑水和新增塌陷。', evidence: '渗流量复测记录、现场视频、排水棱体照片', reassessment: '瞬时峰值与雨后表层汇水有关，复测回落至2.0L/s以下。', version: 1, basisVersion: 7, basisState: '有效' }],
      opinions: [{ id: 'OP-4', specialist: '周岩', discipline: '坝体', content: '未见渗透破坏迹象，按关闭条件继续观察一个班次。', conclusion: '支持结论', createdAt: '2026-09-28T13:20:00' }],
      plan: { id: 'PL-3', action: '疏通排水', owner: '坝体维护班', deadline: '2026-09-28T15:00:00', conditions: '排水沟疏通完成，渗流量连续3小时低于2.2L/s且水质清澈。', emergencyLinked: false, approvedBy: '负责人 何清', approvedAt: '2026-09-28T14:10:00', approvedBasisVersion: 7 }
    }
  ],
  audit: [
    { id: 'A-1', batchId: 'SEED-1', entityId: 'P-D01', basisVersion: 8, action: '生成异常', operator: '阈值引擎', detail: '累计位移18.7mm超过报警阈值16mm', createdAt: '2026-09-29T08:25:00' },
    { id: 'A-2', batchId: 'SEED-2', entityId: 'AN-260929-01', basisVersion: 8, action: '提交现场复核', operator: '宋立', detail: '原始读数有效，位移趋势仍上升', createdAt: '2026-09-29T09:25:00' },
    { id: 'A-3', batchId: 'SEED-3', entityId: 'AN-260929-01', basisVersion: 8, action: '补充专业意见', operator: '周岩', detail: '建议结合孔隙水压力分析潜在滑面', createdAt: '2026-09-29T10:20:00' },
    { id: 'A-4', batchId: 'SEED-4', entityId: 'AN-260928-03', basisVersion: 7, action: '关闭异常', operator: '负责人 何清', detail: '按V7阈值和复测记录关闭；V8生效后待复议', createdAt: '2026-09-28T16:10:00' }
  ]
}
