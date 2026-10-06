import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { MatTableModule } from '@angular/material/table'
import { Store } from '@ngrx/store'
import { map } from 'rxjs'
import { SpatialMapComponent } from '../components/spatial-map.component'
import { selectAnomalies, selectCurrentBasisVersion, selectDataset, selectPoints } from '../store/tailings.selectors'

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, MatTableModule, SpatialMapComponent],
  template: `
    <section class="page">
      <div class="metrics">
        <article><span>监测点</span><strong>{{ pointCount$ | async }}</strong><small>位移、水位、渗流、降雨</small></article>
        <article><span>异常点</span><strong>{{ abnormalCount$ | async }}</strong><small>阈值引擎按当前依据标记</small></article>
        <article><span>失效待重算/待复议</span><strong>{{ staleCount$ | async }}</strong><small>依据变更立即联动</small></article>
        <article><span>当前统一依据</span><strong class="basis">V{{ currentBasis$ | async }}</strong><small>计划、读数、异常、导出共用</small></article>
      </div>
      <app-spatial-map [points]="(points$ | async) ?? []" />
      <div class="threshold-band">
        <div class="band-head"><div><h2>阈值与版本依据</h2><p>报警阈值、变化速率按坝体分区执行；每次监测计划生效都形成新的统一依据版本。</p></div></div>
        <table mat-table [dataSource]="(dataset$ | async)?.thresholds ?? []">
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>类型</th><td mat-cell *matCellDef="let row">{{ row.type }}</td></ng-container>
          <ng-container matColumnDef="warning"><th mat-header-cell *matHeaderCellDef>预警</th><td mat-cell *matCellDef="let row">{{ row.warning }} {{ row.unit }}</td></ng-container>
          <ng-container matColumnDef="alarm"><th mat-header-cell *matHeaderCellDef>报警</th><td mat-cell *matCellDef="let row">{{ row.alarm }} {{ row.unit }}</td></ng-container>
          <ng-container matColumnDef="rate"><th mat-header-cell *matHeaderCellDef>变化率</th><td mat-cell *matCellDef="let row">{{ row.changeRate }} {{ row.unit }}</td></ng-container>
          <ng-container matColumnDef="basis"><th mat-header-cell *matHeaderCellDef>生效依据</th><td mat-cell *matCellDef="let row">阈值V{{ row.version }} · 依据V{{ row.basisVersion }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="thresholdColumns"></tr><tr mat-row *matRowDef="let row; columns: thresholdColumns"></tr>
        </table>
        <div class="basis-list">
          <h3>最近版本依据</h3>
          <article *ngFor="let basis of (dataset$ | async)?.basisHistory.slice(0, 4)">
            <b>V{{ basis.version }} · {{ basis.source }}</b><span>{{ basis.summary }}</span><small>{{ basis.createdAt.replace('T', ' ').slice(0, 16) }} · {{ basis.operator }}</small>
          </article>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); background: white; border: 1px solid #d9e1df; margin-bottom: 15px; }
    .metrics article { padding: 17px 19px; border-right: 1px solid #e2e8e6; } .metrics article:last-child { border: 0; }
    .metrics span, .metrics strong, .metrics small { display: block; } .metrics span { color: #72807d; font-size: 12px; } .metrics strong { font-size: 27px; color: #245060; margin: 6px 0; } .metrics strong.basis { color: #315d6e; } .metrics small { color: #98a4a0; font-size: 10px; }
    .threshold-band { background: white; border: 1px solid #d9e1df; margin-top: 15px; padding: 16px; } .band-head h2 { margin: 0 0 5px; font-size: 17px; } .band-head p { color: #72807d; font-size: 12px; margin: 0 0 12px; } table { width: 100%; }
    .basis-list { margin-top: 14px; border-top: 1px solid #e2e7e6; padding-top: 12px; } .basis-list h3 { font-size: 13px; margin: 0 0 8px; } .basis-list article { display: grid; grid-template-columns: 150px 1fr auto; gap: 12px; padding: 6px 0; border-bottom: 1px dashed #e7eceb; align-items: baseline; } .basis-list b { font-size: 11px; color: #245060; } .basis-list span { font-size: 11px; color: #46605f; } .basis-list small { font-size: 10px; color: #8a9793; }
  `]
})
export class DashboardPageComponent {
  private readonly store = inject(Store)
  readonly points$ = this.store.select(selectPoints)
  readonly anomalies$ = this.store.select(selectAnomalies)
  readonly dataset$ = this.store.select(selectDataset)
  readonly currentBasis$ = this.store.select(selectCurrentBasisVersion)
  readonly pointCount$ = this.points$.pipe(map((points) => points.length))
  readonly abnormalCount$ = this.points$.pipe(map((points) => points.filter((point) => point.status !== '正常').length))
  readonly staleCount$ = this.anomalies$.pipe(map((items) => items.filter((item) => item.status === '已失效待重算' || item.needsReview).length))
  readonly thresholdColumns = ['type', 'warning', 'alarm', 'rate', 'basis']
}
