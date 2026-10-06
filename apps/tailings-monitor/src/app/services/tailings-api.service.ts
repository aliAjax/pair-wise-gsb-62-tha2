import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, catchError, from, of, throwError } from 'rxjs'
import { commitWrite } from '../domain/basis'
import type { TailingsDataset, WriteBatch } from '../domain'
import { seedDataset } from '../data/seed'

const DATASET_KEY = 'tailings-monitor.dataset.v2'
const PENDING_BATCH_KEY = 'tailings-monitor.pending-batch.v2'
const FAIL_NEXT_KEY = 'tailings-monitor.fail-next-write'
const CONFLICT_NEXT_KEY = 'tailings-monitor.conflict-next-write'

@Injectable({ providedIn: 'root' })
export class TailingsApiService {
  private readonly http = inject(HttpClient)
  private readonly baseUrl = (globalThis as { __TAILINGS_API__?: string }).__TAILINGS_API__ ?? '/api'

  loadDataset(): Observable<TailingsDataset> {
    return this.http.get<TailingsDataset>(`${this.baseUrl}/tailings/snapshot`).pipe(catchError(() => of(this.readStoredDataset() ?? structuredClone(seedDataset))))
  }

  write(batch: WriteBatch, fallbackDataset: TailingsDataset): Observable<TailingsDataset> {
    return this.http.post<TailingsDataset>(`${this.baseUrl}/tailings/commands/${batch.id}`, batch).pipe(
      catchError((error: { status?: number; error?: { message?: string } }) => {
        if (error?.status === 409) return throwError(() => new Error(error.error?.message ?? '版本冲突'))
        if (globalThis.localStorage?.getItem(FAIL_NEXT_KEY) === 'true') {
          globalThis.localStorage.removeItem(FAIL_NEXT_KEY)
          return throwError(() => new Error('模拟网络写入失败：未完成批次已保留，可重试'))
        }
        if (globalThis.localStorage?.getItem(CONFLICT_NEXT_KEY) === 'true') {
          globalThis.localStorage.removeItem(CONFLICT_NEXT_KEY)
          return throwError(() => new Error('另一窗口已先完成提交，后到内容已保留并显示冲突'))
        }
        return from(this.commitLocally(batch, fallbackDataset))
      })
    )
  }

  private async commitLocally(batch: WriteBatch, fallbackDataset: TailingsDataset): Promise<TailingsDataset> {
    if (!globalThis.navigator?.locks) {
      const current = this.readStoredDataset() ?? fallbackDataset
      const committed = commitWrite(current, batch)
      this.saveDataset(committed)
      this.clearPendingBatch()
      return committed
    }

    return globalThis.navigator.locks.request('tailings-monitor.write', async () => {
      const current = this.readStoredDataset() ?? fallbackDataset
      const committed = commitWrite(current, batch)
      this.saveDataset(committed)
      this.clearPendingBatch()
      return committed
    })
  }

  exportPackage(payload: TailingsDataset): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/tailings/export`, payload, { responseType: 'blob' }).pipe(catchError(() => of(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))))
  }

  readStoredDataset(): TailingsDataset | null {
    if (!globalThis.localStorage) return null
    const raw = globalThis.localStorage.getItem(DATASET_KEY)
    return raw ? JSON.parse(raw) as TailingsDataset : null
  }

  saveDataset(dataset: TailingsDataset): void {
    globalThis.localStorage?.setItem(DATASET_KEY, JSON.stringify(dataset))
  }

  readPendingBatch(): WriteBatch | null {
    if (!globalThis.localStorage) return null
    const raw = globalThis.localStorage.getItem(PENDING_BATCH_KEY)
    return raw ? JSON.parse(raw) as WriteBatch : null
  }

  savePendingBatch(batch: WriteBatch): void {
    globalThis.localStorage?.setItem(PENDING_BATCH_KEY, JSON.stringify(batch))
  }

  clearPendingBatch(): void {
    globalThis.localStorage?.removeItem(PENDING_BATCH_KEY)
  }

  setFailNextWrite(enabled: boolean): void {
    if (enabled) globalThis.localStorage?.setItem(FAIL_NEXT_KEY, 'true')
    else globalThis.localStorage?.removeItem(FAIL_NEXT_KEY)
  }

  setConflictNextWrite(enabled: boolean): void {
    if (enabled) globalThis.localStorage?.setItem(CONFLICT_NEXT_KEY, 'true')
    else globalThis.localStorage?.removeItem(CONFLICT_NEXT_KEY)
  }

  clearDemoStorage(): void {
    globalThis.localStorage?.removeItem(DATASET_KEY)
    globalThis.localStorage?.removeItem(PENDING_BATCH_KEY)
    globalThis.localStorage?.removeItem(FAIL_NEXT_KEY)
    globalThis.localStorage?.removeItem(CONFLICT_NEXT_KEY)
  }
}
