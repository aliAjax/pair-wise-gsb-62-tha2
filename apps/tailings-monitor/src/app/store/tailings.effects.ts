import { Injectable, inject } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { Action } from '@ngrx/store'
import { Store } from '@ngrx/store'
import { catchError, concatMap, first, map, of, withLatestFrom } from 'rxjs'
import type { TailingsCommand } from '../domain'
import { TailingsApiService } from '../services/tailings-api.service'
import { detectConflict, executeCommand, hasError, rebaseCommand } from './batch'
import { TailingsActions } from './tailings.actions'
import { batchCommitted } from './tailings.reducer'
import { selectTailings, type TailingsStateSlice } from './tailings.selectors'

interface BatchRequest {
  batchId: string
  command: TailingsCommand | null
}

@Injectable()
export class TailingsEffects {
  private readonly actions$ = inject(Actions)
  private readonly api = inject(TailingsApiService)
  private readonly store = inject(Store)

  loadDataset$ = createEffect(() => this.actions$.pipe(
    ofType(TailingsActions.loadDataset),
    concatMap(() => this.api.loadDataset().pipe(
      map((dataset) => TailingsActions.loadDatasetSuccess({ dataset })),
      catchError((error: Error) => of(TailingsActions.loadDatasetFailure({ error: error.message })))
    ))
  ))

  /**
   * 所有写操作进入同一串行管线（外层 concatMap）：先进入队列的批次先完成写入。
   * 两个窗口同时提交复核与会签时，先到者写入并抬升版本，后到者在轮到自己时
   * 读到新版本 → 乐观锁冲突，不写入、保留填写内容。
   */
  batchPipeline$ = createEffect(() => this.actions$.pipe(
    ofType(TailingsActions.submitBatch, TailingsActions.retryBatch, TailingsActions.resubmitConflict),
    withLatestFrom(this.store.select(selectTailings)),
    concatMap(([action, state]): Array<BatchRequest> => {
      if (action.type === TailingsActions.retryBatch.type) {
        const pending = state.pendingBatches.find((batch) => batch.batchId === action.batchId)
        return [pending ? { batchId: pending.batchId, command: pending.command } : { batchId: action.batchId, command: null }]
      }
      if (action.type === TailingsActions.resubmitConflict.type) {
        return [{
          batchId: `B-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          command: rebaseCommand(action.conflict.draft, action.conflict.actualVersion)
        }]
      }
      return [{ batchId: action.batchId, command: action.command }]
    }),
    // 重试时批次可能已被丢弃：空命令直接放行，不阻塞后续批次
    concatMap((request) => request.command ? this.runBatch(request.batchId, request.command) : of<Action>())
  ))

  private runBatch(batchId: string, command: TailingsCommand) {
    const at = new Date().toISOString()
    return this.store.select(selectTailings).pipe(
      // 只取串行管线轮到本批次那一刻的最新状态（此时先到者已落库抬升版本）
      first(),
      concatMap((state: TailingsStateSlice) => {
        // 1) 乐观锁：后到者冲突，不写入、保留填写内容
        const conflict = detectConflict(state.dataset, command, batchId)
        if (conflict) return of(TailingsActions.batchConflict({ conflict }))

        // 2) 在工作集上执行命令（纯函数），服务确认成功后才落库与追加审计
        const working = structuredClone(state.dataset)
        const result = executeCommand(working, command, batchId, at)
        if (hasError(result)) return of(TailingsActions.batchFailed({ batchId, error: result.error }))

        // 3) 写入失败：批次留在未完成列表，可重试，审计尚未追加
        return this.api.commitBatch(batchId, command, state.failureSwitch).pipe(
          map(() => batchCommitted({ batchId, dataset: working, auditLines: result.auditLines, at })),
          catchError((error: Error) => of(TailingsActions.batchFailed({ batchId, error: error.message })))
        )
      })
    )
  }
}
