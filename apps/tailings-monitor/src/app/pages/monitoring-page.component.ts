import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatTableModule } from '@angular/material/table'
import { Store } from '@ngrx/store'
import { map } from 'rxjs'
import { selectCurrentBasisVersion, selectDataset } from '../store/tailings.selectors'

@Component({
  selector: 'app-monitoring-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, MatTableModule],
  template: `
    <section class="page">
      <div class="page-head"><div><h2>测点与原始读数</h2><p>原始读数只读展示，自动读数与人工补录均形成统一依据版本；现场复核以独立版本保存。</p></div><mat-form-field appearance="outline"><mat-label>搜索测点</mat-label><input matInput [(ngModel)]="keyword" /></mat-form-field></div>
      <div class="basis-chip">当前统一版本依据：<b>V{{ currentBasis$ | async }}</b> · 读数、阈值、异常处置共用同一依据时间线</div>
      <div class="split">
        <table mat-table [dataSource]="filteredPoints$ | async" class="panel">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>测点</th><td mat-cell *matCellDef="let row">{{ row.name }}</td></ng-container>
          <ng-container matColumnDef="zone"><th mat-header-cell *matHeaderCellDef>分区</th><td mat-cell *matCellDef="let row">{{ row.zone }}</td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>类型</th><td mat-cell *matCellDef="let row">{{ row.type }}</td></ng-container>
          <ng-container matColumnDef="value"><th mat-header-cell *matHeaderCellDef>当前值</th><td mat-cell *matCellDef="let row"><b>{{ row.currentValue }} {{ row.unit }}</b></td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>状态</th><td mat-cell *matCellDef="let row"><span class="status" [class.danger]="row.status === '异常'" [class.warning]="row.status === '预警'">{{ row.status }}</span></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="pointColumns"></tr><tr mat-row *matRowDef="let row; columns: pointColumns"></tr>
        </table>
        <div class="panel readings">
          <h3>最近原始读数 <small>只读 · 含补录</small></h3>
          <article *ngFor="let reading of (dataset$ | async)?.readings" [class.supplement]="reading.supplement">
            <div><b>{{ reading.pointId }} <i class="tag" *ngIf="reading.supplement">补录</i></b><span>{{ reading.quality }} · 依据V{{ reading.basisVersion }}</span></div>
            <strong>{{ reading.value }} {{ reading.unit }}</strong>
            <small>{{ reading.capturedAt.replace('T', ' ') }} · 设备{{ reading.deviceId }}</small>
          </article>
          <p>读数一经写入（含人工补录）即只读不可覆盖；补录会生成新的统一依据并立即触发受影响异常失效重算。</p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }.page-head h2 { margin: 0 0 5px; font-size: 20px; }.page-head p { margin: 0; color: #72807d; font-size: 12px; }
    .basis-chip { background: white; border: 1px solid #d9e1df; border-left: 4px solid #315d6e; padding: 9px 14px; margin-bottom: 12px; font-size: 12px; color: #46605f; }.basis-chip b { color: #245060; font-size: 14px; }
    .split { display: grid; grid-template-columns: 1fr 330px; gap: 14px; align-items: start; }.panel { background: white; border: 1px solid #d9e1df; } table { width: 100%; }
    .readings { padding: 15px; } .readings h3 { font-size: 14px; margin: 0 0 12px; } .readings h3 small { color: #98a4a0; font-size: 10px; } .readings article { border-bottom: 1px solid #e2e7e6; padding: 10px 0; display: grid; gap: 4px; }.readings article.supplement { background: #f5f9fb; padding-left: 8px; border-left: 3px solid #4f8194; }.readings article div { display: flex; justify-content: space-between; color: #667572; font-size: 11px; }.readings small, .readings p { color: #7a8784; font-size: 10px; }.tag { font-style: normal; background: #e3eef3; color: #2f6477; border-radius: 3px; padding: 1px 5px; font-size: 10px; }.status { padding: 3px 7px; background: #e7f3ee; color: #2e765a; border-radius: 3px; font-size: 11px; }.status.warning { background: #f8efd9; color: #936d20; }.status.danger { background: #fae8e6; color: #a43c35; }
  `]
})
export class MonitoringPageComponent {
  private readonly store = inject(Store)
  keyword = ''
  readonly pointColumns = ['name', 'zone', 'type', 'value', 'status']
  readonly dataset$ = this.store.select(selectDataset)
  readonly currentBasis$ = this.store.select(selectCurrentBasisVersion)
  readonly filteredPoints$ = this.dataset$.pipe(map((dataset) => dataset.points.filter((point) => !this.keyword || `${point.name} ${point.zone} ${point.type} ${point.id}`.includes(this.keyword))))
}
