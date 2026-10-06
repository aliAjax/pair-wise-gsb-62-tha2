import { createActionGroup, emptyProps, props } from '@ngrx/store'
import type { ActivateBasisPayload, AuditEntry, DispositionPlan, ExpertOpinion, FieldReview, TailingsDataset, WriteBatch } from '../domain'

export const TailingsActions = createActionGroup({
  source: 'Tailings',
  events: {
    'Hydrate Dataset': props<{ dataset: TailingsDataset | null; pendingBatch: WriteBatch | null }>(),
    'Load Dataset Success': props<{ dataset: TailingsDataset }>(),
    'Load Dataset Failure': props<{ error: string }>(),
    'Request Write': props<{ batch: WriteBatch }>(),
    'Write Succeeded': props<{ batch: WriteBatch; dataset: TailingsDataset }>(),
    'Write Failed': props<{ batch: WriteBatch; error: string }>(),
    'Retry Pending Write': emptyProps(),
    'Discard Pending Write': emptyProps(),
    'Clear Write Conflict': emptyProps(),
    'Add Expert Opinion': props<{ anomalyId: string; opinion: ExpertOpinion }>(),
    'Save Disposition Plan': props<{ anomalyId: string; plan: DispositionPlan }>(),
    'Close Anomaly': props<{ anomalyId: string; note: string }>(),
    'Create Emergency Link': props<{ anomalyId: string; note: string }>(),
    'Select Anomaly': props<{ anomalyId: string }>(),
    'Update Keyword': props<{ keyword: string }>(),
    'Update Status': props<{ status: string }>(),
    'Add Audit': props<{ entry: AuditEntry }>(),
    'Reset Demo': emptyProps()
  }
})

export type ActivateBasisForm = ActivateBasisPayload
export type FieldReviewDraft = FieldReview
