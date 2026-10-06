import type { TailingsDataset } from '../domain'

/**
 * 统一版本依据时间线（basisHistory[0] 为当前生效依据）：
 * 监测计划生效、自动读数、补录读数都挂账为一条依据；
 * 阈值、读数、复核、意见、方案、会签、关闭快照全部引用具体依据版本。
 */
export const seedDataset: TailingsDataset = {
  basisHistory: [
    { version: 9, source: '原始读数', scopeType: '测点', scope: 'P-W01', thresholdIds: ['T-W'], readingIds: ['RD-4'], operator: '采集系统', summary: '库内水位计W01自动读数 873.4 m，1小时上升0.6 m', createdAt: '2026-09-29T07:55:00' },
    { version: 8, source: '原始读数', scopeType: '测点', scope: 'P-D01', thresholdIds: ['T-D'], readingIds: ['RD-1', 'RD-2', 'RD-3'], operator: '采集系统', summary: '主坝顶部位移点D01自动读数 18.7 mm，昨日变化4.2 mm/d', createdAt: '2026-09-29T08:20:00' },
    { version: 7, source: '监测计划', scopeType: '类型', scope: '水位', thresholdIds: ['T-W'], readingIds: [], operator: '监测中心 高岚', summary: '水位阈值V3生效：预警871m、报警873m、变化速率0.5m/h；汛期来临收紧速率限值', createdAt: '2026-09-28T09:00:00' },
    { version: 6, source: '原始读数', scopeType: '测点', scope: 'P-S01', thresholdIds: ['T-S'], readingIds: ['RS-0'], operator: '采集系统', summary: '主坝渗流计S01自动读数 1.8 L/s，复测回落', createdAt: '2026-09-27T16:00:00' },
    { version: 5, source: '监测计划', scopeType: '类型', scope: '渗流', thresholdIds: ['T-S'], readingIds: [], operator: '监测中心 高岚', summary: '渗流阈值V5生效：预警2.2、报警3.0 L/s、变化速率0.4 L/s（替代V4的预警2.5）', createdAt: '2026-09-25T10:00:00' },
    { version: 4, source: '监测计划', scopeType: '类型', scope: '位移', thresholdIds: ['T-D'], readingIds: [], operator: '监测中心 高岚', summary: '位移阈值V4生效：预警10mm、报警16mm、变化速率3mm/d', createdAt: '2026-09-24T09:30:00' },
    { version: 3, source: '监测计划', scopeType: '类型', scope: '渗流', thresholdIds: ['T-S'], readingIds: [], operator: '监测中心 高岚', summary: '渗流阈值V4生效：预警2.5、报警3.2 L/s、变化速率0.5 L/s（关闭S01异常时的生效计划）', createdAt: '2026-09-22T10:00:00' },
    { version: 2, source: '监测计划', scopeType: '类型', scope: '降雨', thresholdIds: ['T-R'], readingIds: [], operator: '监测中心 高岚', summary: '降雨阈值V2生效：预警30、报警50 mm/h', createdAt: '2026-09-20T09:00:00' },
    { version: 1, source: '监测计划', scopeType: '全部', scope: '全部', thresholdIds: ['T-D', 'T-W', 'T-S', 'T-R'], readingIds: [], operator: '系统初始化', summary: '尾矿库监测计划基线发布，四类测点阈值与频率生效', createdAt: '2026-09-15T08:00:00' }
  ],
  points: [
    { id: 'P-D01', name: '主坝顶部位移点 D01', zone: '主坝', type: '位移', longitude: 112.832, latitude: 40.116, status: '异常', currentValue: 18.7, unit: 'mm', thresholdId: 'T-D', lastInspectionAt: '2026-09-29T08:20:00' },
    { id: 'P-D02', name: '主坝下游位移点 D02', zone: '主坝', type: '位移', longitude: 112.837, latitude: 40.111, status: '预警', currentValue: 12.4, unit: 'mm', thresholdId: 'T-D', lastInspectionAt: '2026-09-29T08:10:00' },
    { id: 'P-W01', name: '库内水位计 W01', zone: '库区', type: '水位', longitude: 112.846, latitude: 40.121, status: '预警', currentValue: 873.4, unit: 'm', thresholdId: 'T-W', lastInspectionAt: '2026-09-29T07:55:00' },
    { id: 'P-S01', name: '主坝渗流计 S01', zone: '主坝', type: '渗流', longitude: 112.827, latitude: 40.106, status: '正常', currentValue: 1.8, unit: 'L/s', thresholdId: 'T-S', lastInspectionAt: '2026-09-29T07:40:00' },
    { id: 'P-R01', name: '库区雨量站 R01', zone: '库区', type: '降雨', longitude: 112.861, latitude: 40.132, status: '正常', currentValue: 24.6, unit: 'mm/h', thresholdId: 'T-R', lastInspectionAt: '2026-09-29T08:00:00' }
  ],
  thresholds: [
    { id: 'T-D', type: '位移', warning: 10, alarm: 16, changeRate: 3, unit: 'mm/d', enabled: true, version: 4, basisVersion: 4, effectiveAt: '2026-09-24T09:30:00' },
    { id: 'T-W', type: '水位', warning: 871, alarm: 873, changeRate: 0.5, unit: 'm/h', enabled: true, version: 3, basisVersion: 7, effectiveAt: '2026-09-28T09:00:00' },
    { id: 'T-S', type: '渗流', warning: 2.2, alarm: 3, changeRate: 0.4, unit: 'L/s', enabled: true, version: 5, basisVersion: 5, effectiveAt: '2026-09-25T10:00:00' },
    { id: 'T-R', type: '降雨', warning: 30, alarm: 50, changeRate: 10, unit: 'mm/h', enabled: true, version: 2, basisVersion: 2, effectiveAt: '2026-09-20T09:00:00' }
  ],
  readings: [
    { id: 'RD-1', pointId: 'P-D01', value: 18.7, unit: 'mm', capturedAt: '2026-09-29T08:20:00', deviceId: 'GNSS-D01', quality: '有效', basisVersion: 8, supplement: false },
    { id: 'RD-2', pointId: 'P-D01', value: 16.2, unit: 'mm', capturedAt: '2026-09-29T07:20:00', deviceId: 'GNSS-D01', quality: '有效', basisVersion: 8, supplement: false },
    { id: 'RD-3', pointId: 'P-D01', value: 13.8, unit: 'mm', capturedAt: '2026-09-29T06:20:00', deviceId: 'GNSS-D01', quality: '有效', basisVersion: 8, supplement: false },
    { id: 'RD-4', pointId: 'P-W01', value: 873.4, unit: 'm', capturedAt: '2026-09-29T07:55:00', deviceId: 'WL-W01', quality: '有效', basisVersion: 9, supplement: false },
    { id: 'RS-0', pointId: 'P-S01', value: 1.8, unit: 'L/s', capturedAt: '2026-09-27T16:00:00', deviceId: 'SEEP-S01', quality: '有效', basisVersion: 6, supplement: false }
  ],
  anomalies: [
    {
      id: 'AN-260929-01', pointId: 'P-D01', title: '主坝D01累计位移超过报警阈值', severity: '重大', status: '待负责人审批', openedAt: '2026-09-29T08:25:00', owner: '坝体安全组', triggerReadingId: 'RD-1', observedValue: '18.7 mm，昨日变化4.2 mm/d', version: 7, closedAt: '',
      basisVersion: 8, superseded: false, needsReview: false, reviewReason: '', closedBasis: null, recomputeHistory: [],
      fieldReviews: [{ id: 'FR-1', inspector: '宋立', arrivedAt: '2026-09-29T09:10:00', observed: '坝顶排水沟未见明显开裂，D01附近无新增裂缝，基准点稳定。', evidence: 'D01近景照片、基准点复核记录、GNSS原始观测文件', reassessment: '读数有效，位移趋势仍上升，建议立即降低库水位并加密监测。', version: 2, basisVersion: 8, superseded: false }],
      opinions: [
        { id: 'OP-1', specialist: '周岩', discipline: '岩土', content: '近三日位移速率持续高于阈值，需结合孔隙水压力分析潜在滑面。', conclusion: '支持结论', createdAt: '2026-09-29T10:20:00', basisVersion: 8 },
        { id: 'OP-2', specialist: '许洁', discipline: '水文', content: '库水位仍接近警戒线，建议优先降低库水位并核对上游来水。', conclusion: '补充证据', createdAt: '2026-09-29T10:45:00', basisVersion: 9 }
      ],
      plan: {
        id: 'PL-1', action: '降低库水位', owner: '库区调度班', deadline: '2026-09-29T18:00:00', conditions: '每2小时复测D01、D02和W01；位移速率恢复至3mm/d以下并稳定12小时后，负责人可关闭异常。', emergencyLinked: true, approvedBy: '', approvedAt: '', basisVersion: 8, superseded: false, approvalHistory: []
      }
    },
    {
      id: 'AN-260929-02', pointId: 'P-W01', title: '库水位短时上升速率超预警值', severity: '较高', status: '原因调查中', openedAt: '2026-09-29T08:00:00', owner: '库区调度班', triggerReadingId: 'RD-4', observedValue: '873.4 m，1小时上升0.6 m', version: 4, closedAt: '',
      basisVersion: 9, superseded: false, needsReview: false, reviewReason: '', closedBasis: null, recomputeHistory: [],
      fieldReviews: [], opinions: [{ id: 'OP-3', specialist: '许洁', discipline: '水文', content: '上游降雨汇流导致入湖量增加，需核实泄洪闸状态。', conclusion: '支持结论', createdAt: '2026-09-29T09:00:00', basisVersion: 9 }],
      plan: {
        id: 'PL-2', action: '加密监测', owner: '库区调度班', deadline: '2026-09-29T14:00:00', conditions: '每小时记录水位与入库流量，达到874.0m时启动应急联动。', emergencyLinked: false, approvedBy: '', approvedAt: '', basisVersion: 9, superseded: false, approvalHistory: []
      }
    },
    {
      // 已关闭异常：冻结关闭时依据（V3 渗流阈值V4）；V5 渗流阈值V5随后生效，标出需要复议但不改写历史结论
      id: 'AN-260925-03', pointId: 'P-S01', title: '主坝S01渗流量阶段性升高', severity: '关注', status: '已关闭', openedAt: '2026-09-23T11:00:00', owner: '排水运维班', triggerReadingId: 'RS-0', observedValue: '关闭时2.6 L/s，复测回落至1.8 L/s', version: 5, closedAt: '2026-09-24T17:30:00',
      basisVersion: 3, superseded: false, needsReview: true, reviewReason: '关闭依据V3（渗流阈值V4：预警2.5 L/s）已被V5监测计划（渗流阈值V5：预警2.2 L/s）覆盖，需按新依据复议历史结论',
      closedBasis: { basisVersion: 3, basisSummary: '依据V3 · 监测计划 · 渗流阈值V4（预警2.5、报警3.2 L/s），关闭时生效' }, recomputeHistory: [],
      fieldReviews: [{ id: 'FR-9', inspector: '宋立', arrivedAt: '2026-09-24T15:00:00', observed: '排水棱体出水清澈，浑浊度无异常。', evidence: 'S01量水堰读数照片、水质浊度记录', reassessment: '渗流复测1.8 L/s，低于当时预警值2.5 L/s，趋势回落，建议关闭。', version: 1, basisVersion: 3, superseded: false }],
      opinions: [],
      plan: {
        id: 'PL-9', action: '疏通排水', owner: '排水运维班', deadline: '2026-09-24T16:00:00', conditions: '渗流量连续两次复测低于预警值且水体清澈。', emergencyLinked: false, approvedBy: '负责人 何清', approvedAt: '2026-09-24T16:40:00', basisVersion: 3, superseded: false,
        approvalHistory: [{ at: '2026-09-24T16:40:00', approver: '负责人 何清', note: '同意关闭，继续按计划复测。', basisVersion: 3, superseded: false }]
      }
    }
  ],
  audit: [
    { id: 'A-3', entityId: 'AN-260929-01', action: '补充专业意见', operator: '周岩', detail: '依据V8 支持结论：建议结合孔隙水压力分析潜在滑面', createdAt: '2026-09-29T10:20:00', basisVersion: 8, batchId: 'SEED-A3' },
    { id: 'A-2', entityId: 'AN-260929-01', action: '提交现场复核', operator: '宋立', detail: '依据V8：原始读数有效，位移趋势仍上升', createdAt: '2026-09-29T09:25:00', basisVersion: 8, batchId: 'SEED-A2' },
    { id: 'A-1', entityId: 'P-D01', action: '生成异常', operator: '阈值引擎', detail: '依据V8：累计位移18.7mm超过位移阈值V4报警值16mm', createdAt: '2026-09-29T08:25:00', basisVersion: 8, batchId: 'SEED-A1' }
  ]
}
