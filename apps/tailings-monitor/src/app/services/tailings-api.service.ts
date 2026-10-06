import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { Observable, catchError, delay, map, of, throwError } from 'rxjs'
import type { TailingsCommand, TailingsDataset } from '../domain'
import { seedDataset } from '../data/seed'
import { commandEntityId, commandLabel } from '../store/batch'

export interface ReviewExportEnvelope {
  exportName: string
  exportedAt: string
  currentBasisVersion: number
  /** 页面、异常队列、导出共用的版本依据视图 */
  basisTimeline: TailingsDataset['basisHistory']
  dataset: TailingsDataset
}

@Injectable({ providedIn: 'root' })
export class TailingsApiService {
  private readonly http = inject(HttpClient)
  private readonly baseUrl = (globalThis as { __TAILINGS_API__?: string }).__TAILINGS_API__ ?? '/api'

  loadDataset(): Observable<TailingsDataset> {
    return this.http.get<TailingsDataset>(`${this.baseUrl}/tailings/snapshot`).pipe(catchError(() => of(structuredClone(seedDataset))))
  }

  /**
   * 批次写入：一个批次 = 一次写入事务。
   * 无后端时本地模拟网络往返；forceFailure 为 true 时模拟写入失败，
   * 由调用方保留未完成批次并重试，审计行只在真正成功后才会生成。
   */
  commitBatch(batchId: string, command: TailingsCommand, forceFailure: boolean): Observable<{ batchId: string; entityId: string }> {
    type CommitResult = { batchId: string; entityId: string }
    if (forceFailure) {
      return this.http.post<CommitResult>(`${this.baseUrl}/tailings/batches/${batchId}`, command).pipe(
        catchError(() => throwError(() => new Error(`写入服务不可用（批次 ${batchId}：${commandLabel(command)}），批次已保留，可稍后重试`))),
        delay(650)
      )
    }
    return this.http.post<{ batchId?: string }>(`${this.baseUrl}/tailings/batches/${batchId}`, command).pipe(
      catchError(() => of({})),
      delay(650),
      map((): CommitResult => ({ batchId, entityId: commandEntityId(command) }))
    )
  }

  exportPackage(payload: ReviewExportEnvelope): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/tailings/export`, payload, { responseType: 'blob' }).pipe(
      catchError(() => of(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })))
    )
  }
}
