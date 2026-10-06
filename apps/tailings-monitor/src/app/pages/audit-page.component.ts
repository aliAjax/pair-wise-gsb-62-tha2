import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatTableModule } from '@angular/material/table'
import { Store } from '@ngrx/store'
import { map } from 'rxjs'
import { type ReviewExportEnvelope, TailingsApiService } from '../services/tailings-api.service'
import { selectCurrentBasisVersion, selectDataset } from '../store/tailings.selectors'

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatTableModule],
  template: `
    <section class="page">
      <div class="head"><div><h2>审计与版本追溯</h2><p>监测计划生效、读数补录、异常创建、复核、意见、方案、会签和关闭全部挂到统一依据版本，并按写入批次留痕（重试不重复追加）。</p></div><button mat-flat-button color="primary" (click)="exportPackage()">导出审阅包（含版本依据）</button></div>
      <div class="basis-strip">当前统一依据 <b>V{{ currentBasis$ | async }}</b> · 页面、异常队列与导出共用同一依据视图</div>
      <div class="toolbar"><mat-form-field appearance="outline"><mat-label>搜索实体、动作、操作人</mat-label><input matInput [(ngModel)]="keyword" /></mat-form-field><span>共{{ (filtered$ | async)?.length }}条事件</span></div>
      <table mat-table [dataSource]="filtered$ | async" class="panel">
        <ng-container matColumnDef="time"><th mat-header-cell *matHeaderCellDef>时间</th><td mat-cell *matCellDef="let row">{{ row.createdAt.replace('T', ' ').slice(0, 16) }}</td></ng-container>
        <ng-container matColumnDef="basis"><th mat-header-cell *matHeaderCellDef>依据</th><td mat-cell *matCellDef="let row"><span class="basis-tag">V{{ row.basisVersion }}</span><small class="batch">{{ row.batchId }}</small></td></ng-container>
        <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>实体</th><td mat-cell *matCellDef="let row">{{ row.entityId }}</td></ng-container>
        <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>动作</th><td mat-cell *matCellDef="let row">{{ row.action }}</td></ng-container>
        <ng-container matColumnDef="operator"><th mat-header-cell *matHeaderCellDef>操作人</th><td mat-cell *matCellDef="let row">{{ row.operator }}</td></ng-container>
        <ng-container matColumnDef="detail"><th mat-header-cell *matHeaderCellDef>说明</th><td mat-cell *matCellDef="let row">{{ row.detail }}</td></ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }.head h2 { margin: 0 0 5px; font-size: 20px; }.head p { margin: 0; color: #72807d; font-size: 12px; max-width: 760px; }
    .basis-strip { background: white; border: 1px solid #d9e1df; border-left: 4px solid #315d6e; padding: 9px 14px; margin-bottom: 10px; font-size: 12px; color: #46605f; }.basis-strip b { color: #245060; }
    .toolbar { display: flex; align-items: center; gap: 12px; }.toolbar span { color: #72807d; font-size: 11px; }.panel { width: 100%; background: white; border: 1px solid #d9e1df; }
    .basis-tag { display: inline-block; background: #e7f0ef; color: #245060; border-radius: 3px; padding: 2px 6px; font-size: 11px; font-weight: 600; } .batch { display: block; color: #a1acaa; font-size: 9px; margin-top: 3px; }
  `]
})
export class AuditPageComponent {
  private readonly store = inject(Store)
  private readonly api = inject(TailingsApiService)
  keyword = ''
  readonly columns = ['time', 'basis', 'entity', 'action', 'operator', 'detail']
  readonly currentBasis$ = this.store.select(selectCurrentBasisVersion)
  readonly filtered$ = this.store.select(selectDataset).pipe(map((dataset) => dataset.audit.filter((item) => !this.keyword || `${item.entityId} ${item.action} ${item.operator} ${item.detail} ${item.batchId}`.includes(this.keyword))))

  exportPackage(): void {
    this.store.select(selectDataset).pipe(map((dataset): ReviewExportEnvelope => {
      // 导出包与页面、队列使用同一套版本依据：依据时间线 + 每条异常携带的依据版本/关闭冻结快照/复议标记
      return {
        exportName: '尾矿库监测审阅包',
        exportedAt: new Date().toISOString(),
        currentBasisVersion: dataset.basisHistory[0]?.version ?? 0,
        basisTimeline: dataset.basisHistory,
        dataset
      }
    })).subscribe((envelope) => {
      this.api.exportPackage(envelope).subscribe((blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `尾矿库监测审阅包-依据V${envelope.currentBasisVersion}.json`
        anchor.click()
        URL.revokeObjectURL(url)
      })
    })
  }
}
