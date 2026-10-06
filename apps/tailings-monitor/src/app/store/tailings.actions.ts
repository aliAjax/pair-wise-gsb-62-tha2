import { createActionGroup, emptyProps, props } from '@ngrx/store'
import type { ConcurrencyConflict, PendingBatch, TailingsCommand, TailingsDataset } from '../domain'

export const TailingsActions = createActionGroup({
  source: 'Tailings',
  events: {
    'Load Dataset': emptyProps(),
    'Load Dataset Success': props<{ dataset: TailingsDataset }>(),
    'Load Dataset Failure': props<{ error: string }>(),

    /** 提交一个写入批次（复核/会签/计划生效/补录读数等统一入口） */
    'Submit Batch': props<{ batchId: string; command: TailingsCommand }>(),
    /** 批次写入服务失败：保留未完成批次，等待重试 */
    'Batch Failed': props<{ batchId: string; error: string }>(),
    /** 重试未完成批次（batchId 不变，审计按 batchId 幂等，绝不重复追加） */
    'Retry Batch': props<{ batchId: string }>(),
    'Discard Batch': props<{ batchId: string }>(),
    /** 乐观锁冲突：不写入，保留填写内容供按新版本重提 */
    'Batch Conflict': props<{ conflict: ConcurrencyConflict }>(),
    'Discard Conflict': props<{ batchId: string }>(),
    /** 按冲突后实际版本重新提交（填写内容来自保留的批次） */
    'Resubmit Conflict': props<{ conflict: ConcurrencyConflict }>(),

    'Toggle Failure Switch': props<{ enabled: boolean }>(),

    'Select Anomaly': props<{ anomalyId: string }>(),
    'Update Keyword': props<{ keyword: string }>(),
    'Update Status': props<{ status: string }>(),
    'Reset Demo': emptyProps()
  }
})

export type BatchRef = Pick<PendingBatch, 'batchId'>
