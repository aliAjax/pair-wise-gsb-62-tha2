import { CommonModule } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatTableModule } from '@angular/material/table'
import { Store } from '@ngrx/store'
import { map } from 'rxjs'
import { WriteBannerComponent } from '../components/write-banner.component'
import type { ActivateBasisPayload, RawReading, WriteBatch } from '../domain'
import { TailingsApiService } from '../services/tailings-api.service'
import { TailingsActions } from '../store/tailings.actions'
import { selectDataset, selectPendingBatch } from '../store/tailings.selectors'

@Component({
  selector: 'app-monitoring-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule, WriteBannerComponent],
  template: `
    <section class="page">
      <app-write-banner />
      <div class="page-head">
        <div><h2>监测计划、阈值与原始读数</h2><p>三类记录共用当前版本依据；补传/补录不覆盖原记录，随计划生效形成新版本。</p></div>
        <div class="basis">当前依据 <b>V{{ (dataset$ | async)?.currentBasisVersion }}</b></div>
      </div>
      <div class="split">
        <div class="panel stack">
          <h3>生效中的监测计划</h3>
          <article *ngFor="let plan of (dataset$ | async)?.plans" [class.active]="plan.active">
            <div><b>{{ plan.name }}</b><span>V{{ plan.basisVersion }} · {{ plan.active ? '生效中' : '已归档' }}</span></div>
            <p>{{ plan.frequency }}</p><small>{{ plan.effectiveAt.replace('T', ' ') }} 生效 · {{ plan.notes }}</small>
          </article>
          <h3>阈值版本</h3>
          <table mat-table [dataSource]="(dataset$ | async)?.thresholds ?? []">
            <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>类型</th><td mat-cell *matCellDef="let row">{{ row.type }}</td></ng-container>
            <ng-container matColumnDef="warning"><th mat-header-cell *matHeaderCellDef>预警</th><td mat-cell *matCellDef="let row">{{ row.warning }} {{ row.unit }}</td></ng-container>
            <ng-container matColumnDef="alarm"><th mat-header-cell *matHeaderCellDef>报警</th><td mat-cell *matCellDef="let row">{{ row.alarm }} {{ row.unit }}</td></ng-container>
            <ng-container matColumnDef="rate"><th mat-header-cell *matHeaderCellDef>速率</th><td mat-cell *matCellDef="let row">{{ row.changeRate }} {{ row.unit }}</td></ng-container>
            <ng-container matColumnDef="basis"><th mat-header-cell *matHeaderCellDef>依据</th><td mat-cell *matCellDef="let row">T V{{ row.version }} / 总V{{ row.basisVersion }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="thresholdColumns"></tr><tr mat-row *matRowDef="let row; columns: thresholdColumns"></tr>
          </table>
        </div>
        <div class="panel activate">
          <h3>提交下一版监测计划</h3>
          <div class="form"><mat-form-field appearance="outline"><mat-label>计划名称</mat-label><input matInput [(ngModel)]="form.planName" /></mat-form-field><mat-form-field appearance="outline"><mat-label>生效时间</mat-label><input matInput type="datetime-local" [(ngModel)]="form.effectiveAt" /></mat-form-field><mat-form-field appearance="outline" class="wide"><mat-label>监测频率</mat-label><input matInput [(ngModel)]="form.frequency" /></mat-form-field><mat-form-field appearance="outline" class="wide"><mat-label>计划说明</mat-label><textarea matInput rows="2" [(ngModel)]="form.notes"></textarea></mat-form-field></div>
          <h4>随计划调整阈值</h4>
          <div class="threshold-form" *ngFor="let item of form.thresholds">
            <b>{{ thresholdName(item.id) }}</b><mat-form-field appearance="outline"><mat-label>预警</mat-label><input matInput type="number" [(ngModel)]="item.warning" /></mat-form-field><mat-form-field appearance="outline"><mat-label>报警</mat-label><input matInput type="number" [(ngModel)]="item.alarm" /></mat-form-field><mat-form-field appearance="outline"><mat-label>速率</mat-label><input matInput type="number" [(ngModel)]="item.changeRate" /></mat-form-field>
          </div>
          <h4>追加补传/补录读数</h4>
          <div class="reading-form"><mat-form-field appearance="outline"><mat-label>测点</mat-label><mat-select [(ngModel)]="supplementalPointId"><mat-option *ngFor="let point of (dataset$ | async)?.points" [value]="point.id">{{ point.id }} {{ point.name }}</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>读数</mat-label><input matInput type="number" [(ngModel)]="supplementalValue" /></mat-form-field><mat-form-field appearance="outline"><mat-label>单位</mat-label><input matInput [(ngModel)]="supplementalUnit" /></mat-form-field><mat-form-field appearance="outline"><mat-label>采集时间</mat-label><input matInput type="datetime-local" [(ngModel)]="supplementalAt" /></mat-form-field><mat-form-field appearance="outline"><mat-label>类型</mat-label><mat-select [(ngModel)]="supplementalType"><mat-option value="设备补传">设备补传</mat-option><mat-option value="人工补录">人工补录</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>质量</mat-label><mat-select [(ngModel)]="supplementalQuality"><mat-option value="有效">有效</mat-option><mat-option value="可疑">可疑</mat-option><mat-option value="无效">无效</mat-option></mat-select></mat-form-field><button mat-button type="button" (click)="addSupplemental()">加入批次</button></div>
          <div class="supplement" *ngFor="let item of form.supplementalReadings; let index = index"><b>{{ item.pointId }}</b><span>{{ item.value }} {{ item.unit }} · {{ item.supplementType }} · {{ item.quality }}</span><button mat-button (click)="removeSupplemental(index)">移除</button></div>
          <div class="test-flags"><mat-checkbox [(ngModel)]="failNext">模拟下一次写入失败</mat-checkbox><mat-checkbox [(ngModel)]="conflictNext">模拟下一次并发冲突</mat-checkbox></div>
          <button mat-flat-button color="primary" (click)="activate()">生效并重算异常</button>
        </div>
      </div>
      <div class="panel readings">
        <h3>原始读数（追加式留痕）</h3>
        <article *ngFor="let reading of (dataset$ | async)?.readings">
          <div><b>{{ reading.pointId }}</b><span>V{{ reading.basisVersion }} · {{ reading.quality }} · {{ reading.supplementType || '自动采集' }}</span></div>
          <strong>{{ reading.value }} {{ reading.unit }}</strong>
          <small>{{ reading.capturedAt.replace('T', ' ') }} · 设备{{ reading.deviceId }}<ng-container *ngIf="reading.replacesReadingId"> · 关联原记录{{ reading.replacesReadingId }}</ng-container></small>
        </article>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }.page-head h2 { margin: 0 0 5px; font-size: 20px; }.page-head p { margin: 0; color: #72807d; font-size: 12px; }.basis { background: #213a44; color: white; padding: 9px 13px; border-radius: 3px; font-size: 11px; }.basis b { color: #e4bd58; font-size: 16px; margin-left: 5px; }
    .split { display: grid; grid-template-columns: minmax(520px, 1fr) 570px; gap: 14px; align-items: start; }.panel { background: white; border: 1px solid #d9e1df; }.stack { padding: 15px; }.stack h3, .activate h3 { margin: 0 0 10px; }.stack article { border-left: 3px solid #cbd6d3; background: #f6f8f7; padding: 10px; margin-bottom: 9px; }.stack article.active { border-color: #c99f3d; background: #fbf4e2; }.stack article div { display: flex; justify-content: space-between; font-size: 12px; }.stack p { margin: 7px 0; font-size: 12px; }.stack small, article small { color: #75827f; font-size: 10px; }
    .activate { padding: 15px; }.form, .reading-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.wide { grid-column: 1 / -1; }.activate h4 { margin: 14px 0 8px; font-size: 12px; }.threshold-form { display: grid; grid-template-columns: 90px 1fr 1fr 1fr; gap: 7px; align-items: center; margin-bottom: 7px; }.threshold-form mat-form-field { width: 100%; }.reading-form { grid-template-columns: 1fr .8fr .8fr 1.1fr 1fr .8fr auto; align-items: center; }.supplement { display: grid; grid-template-columns: 80px 1fr auto; gap: 8px; padding: 6px 0; border-bottom: 1px solid #e4e9e7; font-size: 11px; }.test-flags { display: flex; gap: 16px; margin: 10px 0; font-size: 11px; }
    .readings { margin-top: 14px; padding: 15px; display: grid; grid-template-columns: repeat(auto-fill,minmax(250px,1fr)); gap: 10px; }.readings h3 { grid-column: 1 / -1; font-size: 14px; margin: 0; }.readings article { border-left: 3px solid #315d6e; background: #f5f8f7; padding: 10px; display: grid; gap: 4px; }.readings article div { display: flex; justify-content: space-between; color: #667572; font-size: 10px; }.readings small { color: #7a8784; font-size: 10px; }
  `]
})
export class MonitoringPageComponent implements OnInit {
  private readonly store = inject(Store)
  private readonly api = inject(TailingsApiService)
  readonly dataset$ = this.store.select(selectDataset)
  readonly pending$ = this.store.select(selectPendingBatch)
  readonly thresholdColumns = ['type', 'warning', 'alarm', 'rate', 'basis']
  supplementalPointId = 'P-D01'
  supplementalValue = 17.5
  supplementalUnit = 'mm'
  supplementalAt = '2026-09-29T10:20'
  supplementalType: RawReading['supplementType'] = '设备补传'
  supplementalQuality: RawReading['quality'] = '有效'
  failNext = false
  conflictNext = false
  form: ActivateBasisPayload = {
    planName: '汛期第十轮计划',
    effectiveAt: '2026-09-29T12:00',
    frequency: '位移/水位每30分钟；渗流每1小时；降雨连续记录',
    notes: '依据最新补传读数收紧主坝位移观测。',
    thresholds: [],
    supplementalReadings: []
  }

  ngOnInit(): void {
    this.dataset$.subscribe((dataset) => {
      if (!this.form.thresholds.length) this.form.thresholds = dataset.thresholds.map(({ id, warning, alarm, changeRate }) => ({ id, warning, alarm, changeRate }))
    }).unsubscribe()
    this.pending$.subscribe((batch) => {
      if (batch?.operation === 'activateBasis') this.form = structuredClone(batch.payload as ActivateBasisPayload)
    }).unsubscribe()
  }

  thresholdName(id: string): string {
    let name = id
    this.dataset$.pipe(map((dataset) => dataset.thresholds.find((item) => item.id === id)?.type ?? id)).subscribe((value) => { name = value }).unsubscribe()
    return name
  }

  addSupplemental(): void {
    this.form.supplementalReadings.push({
      pointId: this.supplementalPointId,
      value: this.supplementalValue,
      unit: this.supplementalUnit,
      capturedAt: this.supplementalAt,
      quality: this.supplementalQuality,
      supplementType: this.supplementalType,
      replacesReadingId: ''
    })
  }

  removeSupplemental(index: number): void {
    this.form.supplementalReadings.splice(index, 1)
  }

  activate(): void {
    const batch: WriteBatch<ActivateBasisPayload> = {
      id: `BASIS-${Date.now()}`,
      operation: 'activateBasis',
      entityId: '',
      operator: '计划管理员',
      payload: structuredClone(this.form),
      expectedBasisVersion: this.currentVersion(),
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: ''
    }
    this.api.setFailNextWrite(this.failNext)
    this.api.setConflictNextWrite(this.conflictNext)
    this.store.dispatch(TailingsActions.requestWrite({ batch }))
    this.failNext = false
    this.conflictNext = false
  }

  private currentVersion(): number {
    let version = 0
    this.dataset$.subscribe((dataset) => { version = dataset.currentBasisVersion }).unsubscribe()
    return version
  }
}
