import { Injectable, inject } from '@angular/core'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { catchError, filter, fromEvent, map, of, switchMap, tap, withLatestFrom } from 'rxjs'
import { TailingsApiService } from '../services/tailings-api.service'
import { TailingsActions } from './tailings.actions'
import { selectDataset } from './tailings.selectors'
import type { TailingsState } from './tailings.reducer'
import type { WriteBatch } from '../domain'

const SYNC_KEYS = ['tailings-monitor.dataset.v2', 'tailings-monitor.pending-batch.v2']
const isConflict = (message: string) => message.includes('另一窗口') || message.includes('依据已') || message.includes('正在按')

@Injectable()
export class TailingsEffects {
  private readonly actions$ = inject(Actions)
  private readonly api = inject(TailingsApiService)
  private readonly store = inject(Store)

  requestWrite$ = createEffect(() => this.actions$.pipe(
    ofType(TailingsActions.requestWrite),
    tap(({ batch }) => this.api.savePendingBatch(batch)),
    withLatestFrom(this.store.select(selectDataset)),
    switchMap(([{ batch }, dataset]) => this.api.write(batch, dataset).pipe(
      tap((committed) => this.api.saveDataset(committed)),
      map((committed) => TailingsActions.writeSucceeded({ batch, dataset: committed })),
      catchError((error: Error) => {
        const failedBatch = { ...batch, attempts: batch.attempts + 1, lastError: error.message }
        this.api.savePendingBatch(failedBatch)
        return of(TailingsActions.writeFailed({ batch, error: error.message }))
      })
    ))
  ))

  retryPendingWrite$ = createEffect(() => this.actions$.pipe(
    ofType(TailingsActions.retryPendingWrite),
    withLatestFrom(this.store),
    map(([, rootState]) => {
      const state: TailingsState = (rootState as { tailings: TailingsState }).tailings
      const pending = state.pendingBatch
      if (!pending) return TailingsActions.clearWriteConflict()
      const retryBatch: WriteBatch = isConflict(pending.lastError)
        ? {
            ...pending,
            expectedBasisVersion: state.dataset.currentBasisVersion,
            expectedAnomalyVersion: pending.operation === 'activateBasis'
              ? undefined
              : state.dataset.anomalies.find((item) => item.id === pending.entityId)?.version
          }
        : pending
      return TailingsActions.requestWrite({ batch: retryBatch })
    })
  ))

  discardPendingWrite$ = createEffect(() => this.actions$.pipe(
    ofType(TailingsActions.discardPendingWrite),
    tap(() => this.api.clearPendingBatch())
  ), { dispatch: false })

  persistLocalMutation$ = createEffect(() => this.actions$.pipe(
    ofType(
      TailingsActions.addExpertOpinion,
      TailingsActions.saveDispositionPlan,
      TailingsActions.closeAnomaly,
      TailingsActions.createEmergencyLink,
      TailingsActions.addAudit
    ),
    withLatestFrom(this.store.select(selectDataset)),
    tap(([, dataset]) => this.api.saveDataset(dataset))
  ), { dispatch: false })

  resetDemo$ = createEffect(() => this.actions$.pipe(
    ofType(TailingsActions.resetDemo),
    tap(() => this.api.clearDemoStorage())
  ), { dispatch: false })

  syncAcrossWindows$ = createEffect(() => fromEvent<StorageEvent>(globalThis, 'storage').pipe(
    filter((event) => SYNC_KEYS.includes(event.key ?? '')),
    map(() => TailingsActions.hydrateDataset({ dataset: this.api.readStoredDataset(), pendingBatch: this.api.readPendingBatch() }))
  ))
}
