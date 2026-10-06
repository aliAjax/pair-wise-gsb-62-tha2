import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatTableModule } from '@angular/material/table'
import { Store } from '@ngrx/store'
import { map } from 'rxjs'
import { WriteBannerComponent } from '../components/write-banner.component'
import { TailingsApiService } from '../services/tailings-api.service'
import { selectDataset } from '../store/tailings.selectors'

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatTableModule, WriteBannerComponent],
  template: `
    <section class="page">
      <app-write-banner />
      <div class="head"><div><h2>审计与版本追溯</h2><p>每条审计事件带批次号和版本依据；失败重试按批次幂等，不重复追加审计。</p></div><div class="basis"><span>导出版本依据</span><b>V{{ (dataset$ | async)?.currentBasisVersion }}</b><button mat-flat-button color="primary" (click)="exportPackage()">导出审阅包</button></div></div>
      <div class="toolbar"><mat-form-field appearance="outline"><mat-label>搜索实体、动作、操作人、批次</mat-label><input matInput [(ngModel)]="keyword" /></mat-form-field><span>共{{ (filtered$ | async)?.length }}条事件</span></div>
      <table mat-table [dataSource]="filtered$ | async" class="panel">
        <ng-container matColumnDef="time"><th mat-header-cell *matHeaderCellDef>时间</th><td mat-cell *matCellDef="let row">{{ row.createdAt.replace('T', ' ').slice(0, 16) }}</td></ng-container>
        <ng-container matColumnDef="basis"><th mat-header-cell *matHeaderCellDef>版本依据</th><td mat-cell *matCellDef="let row">V{{ row.basisVersion }}</td></ng-container>
        <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>实体</th><td mat-cell *matCellDef="let row">{{ row.entityId || '全局' }}</td></ng-container>
        <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>动作</th><td mat-cell *matCellDef="let row">{{ row.action }}</td></ng-container>
        <ng-container matColumnDef="operator"><th mat-header-cell *matHeaderCellDef>操作人</th><td mat-cell *matCellDef="let row">{{ row.operator }}</td></ng-container>
        <ng-container matColumnDef="detail"><th mat-header-cell *matHeaderCellDef>说明</th><td mat-cell *matCellDef="let row">{{ row.detail }}<small>批次 {{ row.batchId }}</small></td></ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }.head h2 { margin: 0 0 5px; font-size: 20px; }.head p { margin: 0; color: #72807d; font-size: 12px; }.basis { display: flex; align-items: center; gap: 10px; background: white; border: 1px solid #d9e1df; padding: 8px 12px; }.basis span { font-size: 10px; color: #72807d; }.basis b { color: #214854; }.toolbar { display: flex; align-items: center; gap: 12px; }.toolbar span { color: #74827f; font-size: 11px; }.panel { width: 100%; background: white; border: 1px solid #d9e1df; }td small { display: block; color: #8d9996; font-size: 9px; margin-top: 3px; }
  `]
})
export class AuditPageComponent {
  private readonly store = inject(Store)
  private readonly api = inject(TailingsApiService)
  keyword = ''
  readonly columns = ['time', 'basis', 'entity', 'action', 'operator', 'detail']
  readonly dataset$ = this.store.select(selectDataset)
  readonly filtered$ = this.store.select(selectDataset).pipe(map((dataset) => dataset.audit.filter((item) => !this.keyword || `${item.entityId} ${item.action} ${item.operator} ${item.detail} ${item.batchId} V${item.basisVersion}`.includes(this.keyword))))
  exportPackage(): void {
    this.store.select(selectDataset).subscribe((dataset) => {
      const payload = {
        ...dataset,
        exportedAt: new Date().toISOString(),
        packageBasisVersion: dataset.currentBasisVersion,
        reconciliation: dataset.anomalies.map((anomaly) => ({
          anomalyId: anomaly.id,
          status: anomaly.status,
          basisLabel: anomaly.basis.label,
          basisState: anomaly.basisState,
          closedBasisLabel: anomaly.closedBasis?.label ?? null,
          reviewRequired: anomaly.basisState !== '有效'
        }))
      }
      this.api.exportPackage(payload).subscribe((blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `尾矿库监测审阅包-V${dataset.currentBasisVersion}.json`; anchor.click(); URL.revokeObjectURL(url)
      })
    }).unsubscribe()
  }
}
