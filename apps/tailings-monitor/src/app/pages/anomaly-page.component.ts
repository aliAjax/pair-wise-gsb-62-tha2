import { CommonModule } from '@angular/common'
import { Component, OnInit, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatTableModule } from '@angular/material/table'
import { Store } from '@ngrx/store'
import { map } from 'rxjs'
import { WriteBannerComponent } from '../components/write-banner.component'
import type { Anomaly, BasisSnapshot, DispositionPlan, ExpertOpinion, FieldReview, WriteBatch } from '../domain'
import { formatBasis } from '../domain/basis'
import { TailingsActions } from '../store/tailings.actions'
import { selectAnomalies, selectCurrentBasisVersion, selectDataset, selectFilteredAnomalies, selectPendingBatch, selectSelectedAnomaly } from '../store/tailings.selectors'

@Component({
  selector: 'app-anomaly-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule, WriteBannerComponent],
  template: `
    <section class="page">
      <app-write-banner />
      <div class="metrics">
        <article><span>待现场复核</span><strong>{{ count('待现场复核') }}</strong><small>依据失效后回到此状态</small></article>
        <article><span>调查与审批</span><strong>{{ count('原因调查中') + count('待负责人审批') }}</strong><small>多专业意见并存</small></article>
        <article><span>应急联动</span><strong>{{ count('应急联动') }}</strong><small>重大异常强制联动</small></article>
        <article><span>已关闭/待复议</span><strong>{{ closedCount$ | async }}</strong><small>保留原处置依据</small></article>
      </div>
      <div class="toolbar"><mat-form-field appearance="outline"><mat-label>搜索异常</mat-label><input matInput [(ngModel)]="localKeyword" (ngModelChange)="updateKeyword($event)" /></mat-form-field><mat-form-field appearance="outline"><mat-label>状态</mat-label><mat-select [(ngModel)]="localStatus" (ngModelChange)="updateStatus($event)"><mat-option value="全部">全部</mat-option><mat-option *ngFor="let item of statuses" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field><div class="basis-pill">当前统一依据 <b>V{{ currentBasis$ | async }}</b></div></div>
      <div class="split">
        <table mat-table [dataSource]="filtered$ | async" class="panel">
          <ng-container matColumnDef="title"><th mat-header-cell *matHeaderCellDef>异常</th><td mat-cell *matCellDef="let row"><b>{{ row.title }}</b><small class="sub">{{ row.id }} · {{ row.pointId }}</small></td></ng-container>
          <ng-container matColumnDef="severity"><th mat-header-cell *matHeaderCellDef>级别</th><td mat-cell *matCellDef="let row"><span class="severity" [class.major]="row.severity === '重大'">{{ row.severity }}</span></td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>状态</th><td mat-cell *matCellDef="let row"><b>{{ row.status }}</b><small [class.stale]="row.basisState !== '有效'">{{ row.basisState }}</small></td></ng-container>
          <ng-container matColumnDef="basis"><th mat-header-cell *matHeaderCellDef>版本依据</th><td mat-cell *matCellDef="let row"><b>{{ basis(row) }}</b><small *ngIf="row.closedBasis">关闭依据 {{ basis(row.closedBasis) }}</small></td></ng-container>
          <ng-container matColumnDef="open"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let row"><button mat-button (click)="select(row.id)">审阅</button></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns" [class.selected]="row.id === (selected$ | async)?.id" [class.stale-row]="row.basisState !== '有效'"></tr>
        </table>
        <div class="panel detail" *ngIf="selected$ | async as selected">
          <div class="detail-head"><div><span>{{ selected.id }} · 异常V{{ selected.version }} · {{ basis(selected.basis) }}</span><h2>{{ selected.title }}</h2><p>{{ selected.observedValue }}</p><small [class.stale]="selected.basisState !== '有效'">{{ selected.basisState }}</small></div><span class="severity" [class.major]="selected.severity === '重大'">{{ selected.severity }}</span></div>
          <div class="recalc" *ngIf="selected.recalculationNote"><b>{{ selected.basisState === '已关闭·待复议' ? '需要复议' : '已失效并重算' }}</b><p>{{ selected.recalculationNote }}</p></div>
          <h3>现场复核</h3>
          <div class="review-form"><mat-form-field appearance="outline" class="wide"><mat-label>现场观察</mat-label><textarea matInput rows="2" [(ngModel)]="fieldForm.observed"></textarea></mat-form-field><mat-form-field appearance="outline"><mat-label>证据清单</mat-label><input matInput [(ngModel)]="fieldForm.evidence" /></mat-form-field><mat-form-field appearance="outline"><mat-label>重新评估</mat-label><input matInput [(ngModel)]="fieldForm.reassessment" /></mat-form-field><button mat-flat-button color="primary" [disabled]="!canSubmitReview(selected)" (click)="submitReview(selected)">提交复核</button></div>
          <div class="records" *ngFor="let review of selected.fieldReviews" [class.invalid]="review.basisState !== '有效'"><b>{{ review.inspector }} · {{ review.kind }} · {{ basisVersion(review) }}</b><p>{{ review.observed }}</p><span>{{ review.reassessment }} · {{ review.evidence }}</span><small [class.stale]="review.basisState !== '有效'">{{ review.basisState }} {{ review.conflict ?? '' }}</small></div>
          <h3>专业意见</h3>
          <div class="opinion-form"><mat-form-field appearance="outline"><mat-label>专业</mat-label><mat-select [(ngModel)]="opinionForm.discipline"><mat-option *ngFor="let item of disciplines" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline" class="wide"><mat-label>意见</mat-label><input matInput [(ngModel)]="opinionForm.content" /></mat-form-field><button mat-button [disabled]="!canWrite(selected)" (click)="addOpinion(selected)">补充意见</button></div>
          <div class="opinions"><article *ngFor="let opinion of selected.opinions"><b>{{ opinion.discipline }}专家 {{ opinion.specialist }}</b><span>{{ opinion.conclusion }}</span><p>{{ opinion.content }}</p></article></div>
          <h3>处置方案与会签</h3>
          <div class="plan-form"><mat-form-field appearance="outline"><mat-label>措施</mat-label><mat-select [(ngModel)]="planForm.action"><mat-option *ngFor="let item of actions" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>责任方</mat-label><input matInput [(ngModel)]="planForm.owner" /></mat-form-field><mat-form-field appearance="outline" class="wide"><mat-label>关闭条件</mat-label><textarea matInput rows="2" [(ngModel)]="planForm.conditions"></textarea></mat-form-field><mat-form-field appearance="outline"><mat-label>截止</mat-label><input matInput type="datetime-local" [(ngModel)]="planForm.deadline" /></mat-form-field><button mat-button [disabled]="!canWrite(selected)" (click)="savePlan(selected)">保存方案</button></div>
          <div class="approval-band" [class.closed]="selected.status === '已关闭'"><div><b>{{ selected.plan.approvedBy || '尚未会签' }}</b><span>{{ selected.plan.conditions }}</span><small *ngIf="selected.plan.approvedBasisVersion">会签依据 V{{ selected.plan.approvedBasisVersion }}</small><small class="conflict-text" *ngIf="selected.plan.conflict">{{ selected.plan.conflict }}</small></div><button mat-flat-button color="primary" [disabled]="!canApprove(selected)" (click)="approve(selected)">负责人会签</button><button mat-button color="warn" [disabled]="!canWrite(selected)" (click)="emergency(selected)">应急联动</button><button mat-button [disabled]="!canClose(selected)" (click)="close(selected)">关闭异常</button></div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }.metrics { display: grid; grid-template-columns: repeat(4, 1fr); background: white; border: 1px solid #d9e1df; margin-bottom: 14px; }.metrics article { padding: 16px 18px; border-right: 1px solid #e2e7e6; }.metrics article:last-child { border: 0; }.metrics span, .metrics strong, .metrics small { display: block; }.metrics span { color: #72807d; font-size: 12px; }.metrics strong { font-size: 26px; color: #245060; margin: 6px 0; }.metrics small { color: #98a4a0; font-size: 10px; }
    .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }.basis-pill { margin-left: auto; background: #213a44; color: #d6e1e3; padding: 9px 12px; font-size: 10px; }.basis-pill b { color: #e4bd58; font-size: 14px; margin-left: 5px; }.split { display: grid; grid-template-columns: minmax(600px,1fr) 560px; gap: 14px; align-items: start; }.panel { background: white; border: 1px solid #d9e1df; } table { width: 100%; }.selected { background: #eef5f4; }.stale-row { background: #fff8ed; }.sub, td small { display: block; color: #7c8986; font-size: 10px; margin-top: 3px; }.severity { padding: 3px 7px; border-radius: 3px; background: #f7edd6; color: #8e681d; font-size: 11px; }.severity.major { background: #fae7e5; color: #a23b34; }.stale { color: #a64a36 !important; font-weight: 700; }
    .detail { padding: 16px; }.detail-head { display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid #e1e6e5; padding-bottom: 12px; }.detail-head span { color: #74827f; font-size: 10px; }.detail-head h2 { margin: 4px 0; font-size: 18px; }.detail-head p { margin: 0 0 4px; color: #65736f; font-size: 12px; }.detail h3 { font-size: 13px; margin: 16px 0 8px; }.recalc { background: #fff3df; border-left: 4px solid #c98e25; padding: 10px; margin-top: 12px; }.recalc p { margin: 4px 0 0; font-size: 11px; color: #70531f; }
    .review-form, .opinion-form, .plan-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.review-form .wide, .opinion-form .wide, .plan-form .wide { grid-column: 1 / -1; }.review-form button, .plan-form button { align-self: center; }.records { border-left: 3px solid #315d6e; background: #f5f8f7; padding: 9px; margin-top: 7px; display: grid; gap: 4px; }.records.invalid { border-color: #b65b36; background: #fff6ef; }.records p { margin: 0; font-size: 12px; }.records span { color: #72807d; font-size: 10px; }.records small { font-size: 10px; }
    .opinions article { border-bottom: 1px solid #e2e7e6; padding: 9px 0; display: grid; grid-template-columns: 1fr auto; gap: 4px; }.opinions p { grid-column: 1 / -1; margin: 0; font-size: 12px; }.opinions span { color: #8a6720; font-size: 10px; }
    .approval-band { display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 7px; background: #f6f0df; border-left: 3px solid #c99f3d; padding: 10px; margin-top: 12px; }.approval-band.closed { background: #edf3f1; border-color: #617f78; }.approval-band b, .approval-band span, .approval-band small { display: block; }.approval-band span { color: #746c55; font-size: 10px; margin-top: 4px; }.approval-band small { font-size: 9px; color: #65736f; margin-top: 2px; }.conflict-text { color: #a23b34 !important; font-weight: 700; }
  `]
})
export class AnomalyPageComponent implements OnInit {
  private readonly store = inject(Store)
  readonly filtered$ = this.store.select(selectFilteredAnomalies)
  readonly selected$ = this.store.select(selectSelectedAnomaly)
  readonly all$ = this.store.select(selectAnomalies)
  readonly dataset$ = this.store.select(selectDataset)
  readonly currentBasis$ = this.store.select(selectCurrentBasisVersion)
  readonly pending$ = this.store.select(selectPendingBatch)
  readonly closedCount$ = this.all$.pipe(map((items) => items.filter((item) => item.status === '已关闭').length))
  readonly columns = ['title', 'severity', 'status', 'basis', 'open']
  readonly statuses: Anomaly['status'][] = ['待现场复核', '原因调查中', '待负责人审批', '应急联动', '已关闭']
  readonly disciplines: ExpertOpinion['discipline'][] = ['坝体', '水文', '岩土', '应急']
  readonly actions: DispositionPlan['action'][] = ['加密监测', '降低库水位', '疏通排水', '应急撤离准备', '工程加固']
  localKeyword = ''
  localStatus: Anomaly['status'] | '全部' = '全部'
  fieldForm = { observed: '', evidence: '', reassessment: '' }
  opinionForm = { discipline: '坝体' as ExpertOpinion['discipline'], content: '' }
  planForm = { action: '加密监测' as DispositionPlan['action'], owner: '坝体安全组', conditions: '', deadline: '2026-09-29T18:00' }

  ngOnInit(): void {
    this.pending$.subscribe((batch) => {
      if (!batch || batch.operation !== 'submitFieldReview') return
      const payload = batch.payload as { anomalyId: string; review: FieldReview }
      this.fieldForm = { observed: payload.review.observed, evidence: payload.review.evidence, reassessment: payload.review.reassessment }
    }).unsubscribe()
  }

  count(status: Anomaly['status']): number { let value = 0; this.all$.subscribe((items) => { value = items.filter((item) => item.status === status).length }).unsubscribe(); return value }
  basis(anomaly: Anomaly | BasisSnapshot): string { return formatBasis('basis' in anomaly ? anomaly.basis : anomaly) }
  basisVersion(review: FieldReview): string { return `V${review.basisVersion}` }
  updateKeyword(value: string): void { this.store.dispatch(TailingsActions.updateKeyword({ keyword: value })) }
  updateStatus(value: Anomaly['status'] | '全部'): void { this.store.dispatch(TailingsActions.updateStatus({ status: value })) }
  select(id: string): void { this.store.dispatch(TailingsActions.selectAnomaly({ anomalyId: id })) }
  canWrite(anomaly: Anomaly): boolean { return anomaly.status !== '已关闭' && anomaly.basisState === '有效' }
  canSubmitReview(anomaly: Anomaly): boolean { return anomaly.status !== '已关闭' && ['有效', '已失效·待重算'].includes(anomaly.basisState) }
  canApprove(anomaly: Anomaly): boolean { return this.canWrite(anomaly) && (anomaly.severity !== '重大' || anomaly.plan.emergencyLinked) }
  canClose(anomaly: Anomaly): boolean {
    return anomaly.status !== '已关闭' && anomaly.basisState === '有效' && !!anomaly.plan.approvedBy && anomaly.plan.approvedBasisVersion === anomaly.basis.basisVersion && anomaly.fieldReviews.some((review) => review.kind === '现场复核' && review.basisVersion === anomaly.basis.basisVersion)
  }

  submitReview(anomaly: Anomaly): void {
    const review: FieldReview = {
      id: `FR-${Date.now()}`,
      kind: '现场复核',
      inspector: '宋立',
      arrivedAt: new Date().toISOString(),
      ...this.fieldForm,
      version: 0,
      basisVersion: anomaly.basis.basisVersion,
      basisState: '有效'
    }
    this.dispatchWrite<{ anomalyId: string; review: FieldReview }>('FR', 'submitFieldReview', anomaly, { anomalyId: anomaly.id, review }, !!(review.observed && review.evidence && review.reassessment))
  }

  addOpinion(anomaly: Anomaly): void {
    this.store.dispatch(TailingsActions.addExpertOpinion({ anomalyId: anomaly.id, opinion: { id: `OP-${Date.now()}`, specialist: '当前用户', ...this.opinionForm, conclusion: '补充证据', createdAt: new Date().toISOString() } }))
  }

  savePlan(anomaly: Anomaly): void {
    this.store.dispatch(TailingsActions.saveDispositionPlan({ anomalyId: anomaly.id, plan: { ...anomaly.plan, ...this.planForm } }))
  }

  approve(anomaly: Anomaly): void {
    this.dispatchWrite<{ anomalyId: string; approver: string; note: string }>('SIGN', 'approvePlan', anomaly, { anomalyId: anomaly.id, approver: '负责人 何清', note: '同意执行，严格执行关闭条件。' }, true)
  }

  emergency(anomaly: Anomaly): void { this.store.dispatch(TailingsActions.createEmergencyLink({ anomalyId: anomaly.id, note: '重大异常联动应急值班，通知下游巡查。' })) }
  close(anomaly: Anomaly): void { this.store.dispatch(TailingsActions.closeAnomaly({ anomalyId: anomaly.id, note: '复测数据稳定，关闭条件已满足。' })) }

  private dispatchWrite<TPayload>(prefix: string, operation: WriteBatch['operation'], anomaly: Anomaly, payload: TPayload, valid: boolean): void {
    if (!valid) return
    let basisVersion = 0
    let anomalyVersion = 0
    this.dataset$.subscribe((dataset) => { basisVersion = dataset.currentBasisVersion }).unsubscribe()
    anomalyVersion = anomaly.version
    const batch: WriteBatch<TPayload> = {
      id: `${prefix}-${Date.now()}`,
      operation,
      entityId: anomaly.id,
      operator: prefix === 'SIGN' ? '负责人 何清' : '宋立',
      payload,
      expectedBasisVersion: basisVersion,
      expectedAnomalyVersion: anomalyVersion,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: ''
    }
    this.store.dispatch(TailingsActions.requestWrite({ batch }))
  }
}
