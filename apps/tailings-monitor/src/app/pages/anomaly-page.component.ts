import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatTableModule } from '@angular/material/table'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { Store } from '@ngrx/store'
import type { Anomaly, ConcurrencyConflict, DispositionPlan, ExpertOpinion, FieldReview, Threshold, TailingsCommand } from '../domain'
import { TailingsActions } from '../store/tailings.actions'
import { selectConflicts, selectCurrentBasisVersion, selectDataset, selectFailureSwitch, selectFilteredAnomalies, selectPendingBatches, selectSelectedAnomaly } from '../store/tailings.selectors'

@Component({
  selector: 'app-anomaly-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule, MatSlideToggleModule],
  template: `
    <section class="page">
      <div class="metrics">
        <article><span>待现场/调查</span><strong>{{ count(['待现场复核', '原因调查中']) }}</strong><small>未会签处置中</small></article>
        <article><span>待会签/应急</span><strong>{{ count(['待负责人审批', '应急联动']) }}</strong><small>会签携带依据版本</small></article>
        <article><span>失效待重算</span><strong class="danger">{{ count(['已失效待重算']) }}</strong><small>新依据生效后立即失效</small></article>
        <article><span>已关闭/需复议</span><strong>{{ count(['已关闭']) }}</strong><small>冻结关闭依据 · {{ reviewCount() }} 条待复议</small></article>
      </div>

      <div class="basis-band">
        <div><b>当前统一版本依据</b><span>页面、异常队列、审计与导出共用同一依据时间线</span></div>
        <strong class="basis-v">V{{ currentBasis$ | async }}</strong>
        <div class="basis-timeline" *ngIf="dataset$ | async as dataset">
          <article *ngFor="let basis of dataset.basisHistory.slice(0, 4)">
            <b>V{{ basis.version }} · {{ basis.source }}</b>
            <span>{{ basis.summary }}</span>
            <small>{{ basis.createdAt.replace('T', ' ').slice(0, 16) }} · {{ basis.operator }}</small>
          </article>
        </div>
      </div>

      <div class="ops-row">
        <div class="panel ops-panel">
          <h3>监测计划生效（新阈值）</h3>
          <div class="grid3">
            <mat-form-field appearance="outline"><mat-label>类型</mat-label><mat-select [(ngModel)]="thresholdForm.type" (ngModelChange)="syncThresholdUnit($event)"><mat-option *ngFor="let item of types" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>预警值</mat-label><input matInput type="number" [(ngModel)]="thresholdForm.warning" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>报警值</mat-label><input matInput type="number" [(ngModel)]="thresholdForm.alarm" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>变化速率</mat-label><input matInput type="number" [(ngModel)]="thresholdForm.changeRate" /></mat-form-field>
            <mat-form-field appearance="outline" class="wide"><mat-label>生效说明</mat-label><input matInput [(ngModel)]="thresholdForm.note" placeholder="例如：汛期收紧位移报警值" /></mat-form-field>
          </div>
          <button mat-flat-button color="primary" (click)="publishThreshold()">发布并立即重算受影响异常</button>
        </div>
        <div class="panel ops-panel">
          <h3>补录读数（只读、形成新依据）</h3>
          <div class="grid3">
            <mat-form-field appearance="outline"><mat-label>测点</mat-label><mat-select [(ngModel)]="readingForm.pointId"><mat-option *ngFor="let point of (dataset$ | async)?.points" [value]="point.id">{{ point.id }} · {{ point.name }}</mat-option></mat-select></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>读数</mat-label><input matInput type="number" [(ngModel)]="readingForm.value" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>采集时间</mat-label><input matInput type="datetime-local" [(ngModel)]="readingForm.capturedAt" /></mat-form-field>
            <mat-form-field appearance="outline" class="wide"><mat-label>补录说明</mat-label><input matInput [(ngModel)]="readingForm.note" placeholder="例如：设备离线期间人工比测补录" /></mat-form-field>
          </div>
          <button mat-flat-button color="primary" (click)="supplementReading()">补录并重算该测点异常</button>
        </div>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline"><mat-label>搜索异常</mat-label><input matInput [(ngModel)]="localKeyword" (ngModelChange)="updateKeyword($event)" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>状态</mat-label><mat-select [(ngModel)]="localStatus" (ngModelChange)="updateStatus($event)"><mat-option value="全部">全部</mat-option><mat-option *ngFor="let item of statuses" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field>
      </div>

      <div class="split">
        <table mat-table [dataSource]="filtered$ | async" class="panel">
          <ng-container matColumnDef="title"><th mat-header-cell *matHeaderCellDef>异常</th><td mat-cell *matCellDef="let row"><b>{{ row.title }}</b><small class="sub">{{ row.id }} · {{ row.pointId }}</small></td></ng-container>
          <ng-container matColumnDef="severity"><th mat-header-cell *matHeaderCellDef>级别</th><td mat-cell *matCellDef="let row"><span class="severity" [class.major]="row.severity === '重大'">{{ row.severity }}</span></td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>状态 / 依据</th><td mat-cell *matCellDef="let row"><span class="status-chip" [class.invalid]="row.status === '已失效待重算'" [class.review]="row.needsReview">{{ row.status }}</span><small class="sub" [class.stale]="row.superseded">V{{ row.version }} · {{ row.basisText }}</small></td></ng-container>
          <ng-container matColumnDef="open"><th mat-header-cell *matHeaderCellDef></th><td mat-cell *matCellDef="let row"><button mat-button (click)="select(row.id)">审阅</button></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr><tr mat-row *matRowDef="let row; columns: columns" [class.selected]="row.id === (selected$ | async)?.id" [class.row-invalid]="row.status === '已失效待重算'" [class.row-review]="row.needsReview"></tr>
        </table>

        <div class="panel detail" *ngIf="selected$ | async as selected">
          <div class="detail-head">
            <div>
              <span>{{ selected.id }} · 异常V{{ selected.version }}</span>
              <h2>{{ selected.title }}</h2>
              <p>{{ selected.observedValue }}</p>
              <p class="basis-line" [class.stale]="selected.superseded">
                <ng-container *ngIf="selected.status === '已关闭' && selected.closedBasis">关闭依据：{{ selected.closedBasis.basisSummary }}</ng-container>
                <ng-container *ngIf="!(selected.status === '已关闭' && selected.closedBasis)">处置依据：V{{ selected.basisVersion }}</ng-container>
              </p>
            </div>
            <span class="severity" [class.major]="selected.severity === '重大'">{{ selected.severity }}</span>
          </div>

          <div class="alert invalid-alert" *ngIf="selected.status === '已失效待重算'">
            <b>该异常已按新依据失效并重算</b>
            <span *ngFor="let item of selected.recomputeHistory.slice(0, 1)">{{ item.result }}（{{ item.reason }}）</span>
            <small>原有复核与会签已置为失效版本，保留可追溯；请按当前依据重新复核或重提方案。</small>
          </div>
          <div class="alert review-alert" *ngIf="selected.needsReview">
            <b>已关闭 · 需要复议</b>
            <span>{{ selected.reviewReason }}</span>
            <small>关闭时处置依据已冻结保留（{{ selected.closedBasis?.basisSummary }}），历史结论不按旧依据继续执行，等待复议。</small>
          </div>

          <h3>现场复核 <small class="hint">提交时校验异常版本（乐观锁）</small></h3>
          <div class="review-form">
            <mat-form-field appearance="outline" class="wide"><mat-label>现场观察</mat-label><textarea matInput rows="2" [(ngModel)]="fieldForm.observed"></textarea></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>证据清单</mat-label><input matInput [(ngModel)]="fieldForm.evidence" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>重新评估</mat-label><input matInput [(ngModel)]="fieldForm.reassessment" /></mat-form-field>
          </div>
          <div class="concurrent-row">
            <button mat-flat-button color="primary" (click)="submitReview(selected, 'A')">窗口A 提交复核（基线V{{ baselineA }}）</button>
            <button mat-flat-button color="accent" (click)="submitReview(selected, 'B')">窗口B 同时提交复核（基线V{{ baselineB }}）</button>
            <button mat-button (click)="syncBaselines(selected)">两窗口刷新到V{{ selected.version }}</button>
          </div>
          <div class="records" *ngFor="let review of selected.fieldReviews" [class.superseded-record]="review.superseded">
            <b>{{ review.inspector }} · 复核V{{ review.version }} · 依据V{{ review.basisVersion }} <i *ngIf="review.superseded">已失效（新依据后保留）</i></b>
            <p>{{ review.observed }}</p>
            <span>{{ review.reassessment }} · {{ review.evidence }}</span>
          </div>

          <h3>专业意见</h3>
          <div class="opinion-form"><mat-form-field appearance="outline"><mat-label>专业</mat-label><mat-select [(ngModel)]="opinionForm.discipline"><mat-option *ngFor="let item of disciplines" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline" class="wide"><mat-label>意见</mat-label><input matInput [(ngModel)]="opinionForm.content" /></mat-form-field><button mat-button (click)="addOpinion(selected)">补充意见</button></div>
          <div class="opinions"><article *ngFor="let opinion of selected.opinions"><b>{{ opinion.discipline }}专家 {{ opinion.specialist }}</b><span>{{ opinion.conclusion }} · 依据V{{ opinion.basisVersion }}</span><p>{{ opinion.content }}</p></article></div>

          <h3>处置方案与会签</h3>
          <div class="plan-form"><mat-form-field appearance="outline"><mat-label>措施</mat-label><mat-select [(ngModel)]="planForm.action"><mat-option *ngFor="let item of actions" [value]="item">{{ item }}</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>责任方</mat-label><input matInput [(ngModel)]="planForm.owner" /></mat-form-field><mat-form-field appearance="outline" class="wide"><mat-label>关闭条件</mat-label><textarea matInput rows="2" [(ngModel)]="planForm.conditions"></textarea></mat-form-field><mat-form-field appearance="outline"><mat-label>截止</mat-label><input matInput type="datetime-local" [(ngModel)]="planForm.deadline" /></mat-form-field><button mat-button (click)="savePlan(selected)" [disabled]="selected.status === '已关闭'">重提方案（依据V{{ selected.basisVersion }}）</button></div>
          <div class="approval-band">
            <div><b>{{ selected.plan.approvedBy || '尚未会签' }}</b><span>{{ selected.plan.conditions || '无待会签方案' }}</span><small class="hint">方案依据V{{ selected.plan.basisVersion }}<i *ngIf="selected.plan.superseded"> · 该会签依据已失效</i></small></div>
            <button mat-flat-button color="primary" [disabled]="(selected.severity === '重大' && !selected.plan.emergencyLinked) || selected.status === '已关闭' || selected.status === '已失效待重算'" (click)="approve(selected)">窗口A 会签（基线V{{ baselineA }}）</button>
            <button mat-stroked-button color="accent" [disabled]="(selected.severity === '重大' && !selected.plan.emergencyLinked) || selected.status === '已关闭' || selected.status === '已失效待重算'" (click)="approveB(selected)">窗口B 同时会签（基线V{{ baselineB }}）</button>
            <button mat-button color="warn" [disabled]="selected.status === '已关闭' || selected.status === '已失效待重算'" (click)="emergency(selected)">应急联动</button>
            <button mat-button [disabled]="(selected.status !== '待负责人审批' && selected.status !== '应急联动')" (click)="close(selected)">关闭并冻结依据</button>
          </div>
          <div class="approval-history" *ngIf="selected.plan.approvalHistory.length">
            <small>历史会签：</small>
            <span *ngFor="let item of selected.plan.approvalHistory" [class.stale]="item.superseded">{{ item.approver }} · 依据V{{ item.basisVersion }}<i *ngIf="item.superseded">（已失效）</i>；</span>
          </div>
        </div>
      </div>

      <div class="panels-row">
        <div class="panel queue-panel">
          <h3>未完成写入批次 <small class="hint">写入失败保留批次，重试不重复追加审计</small></h3>
          <div class="switch-row">
            <mat-slide-toggle [checked]="failureSwitch$ | async" (change)="toggleFailure($event.checked)">模拟写入服务故障</mat-slide-toggle>
            <small>{{ (failureSwitch$ | async) ? '故障中：提交将进入未完成批次' : '恢复后重试可成功写入' }}</small>
          </div>
          <article *ngFor="let batch of pendingBatches$ | async" [class.failed]="!!batch.lastError">
            <div><b>{{ batch.label }}</b><small>{{ batch.batchId }} · 已尝试 {{ batch.attempts }} 次</small></div>
            <span class="error" *ngIf="batch.lastError">{{ batch.lastError }}</span>
            <div class="queue-actions"><button mat-button color="primary" (click)="retry(batch.batchId)">重试该批次</button><button mat-button (click)="discard(batch.batchId)">放弃</button></div>
          </article>
          <p *ngIf="(pendingBatches$ | async)?.length === 0" class="empty">暂无未完成批次</p>
        </div>
        <div class="panel queue-panel">
          <h3>并发冲突（后到者） <small class="hint">先到者已生效，填写内容保留在此</small></h3>
          <article *ngFor="let conflict of conflicts$ | async" class="conflict">
            <div><b>{{ conflict.commandLabel }} · {{ conflict.anomalyId }}</b><small>期望 V{{ conflict.expectedVersion }}，实际 V{{ conflict.actualVersion }}</small></div>
            <span>{{ conflict.message }}</span>
            <div class="queue-actions"><button mat-button color="primary" (click)="resubmit(conflict)">按 V{{ conflict.actualVersion }} 重新提交（保留填写内容）</button><button mat-button (click)="discardConflict(conflict.batchId)">放弃</button></div>
          </article>
          <p *ngIf="(conflicts$ | async)?.length === 0" class="empty">暂无冲突；可用上方“窗口A/窗口B”按钮模拟同时提交复核或会签。</p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .page { padding: 22px 28px 45px; }.metrics { display: grid; grid-template-columns: repeat(4, 1fr); background: white; border: 1px solid #d9e1df; margin-bottom: 14px; }.metrics article { padding: 16px 18px; border-right: 1px solid #e2e7e6; }.metrics article:last-child { border: 0; }.metrics span, .metrics strong, .metrics small { display: block; }.metrics span { color: #72807d; font-size: 12px; }.metrics strong { font-size: 26px; color: #245060; margin: 6px 0; }.metrics strong.danger { color: #a23b34; }.metrics small { color: #98a4a0; font-size: 10px; }
    .basis-band { background: white; border: 1px solid #d9e1df; border-left: 4px solid #315d6e; padding: 12px 16px; margin-bottom: 14px; display: grid; grid-template-columns: auto 70px 1fr; gap: 14px; align-items: center; }.basis-band b, .basis-band span { display: block; }.basis-band span { color: #72807d; font-size: 10px; margin-top: 3px; }.basis-v { color: #315d6e; font-size: 26px; text-align: center; }.basis-timeline { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 18px; }.basis-timeline article { display: grid; gap: 1px; border-left: 2px solid #cdd8d5; padding-left: 8px; }.basis-timeline b { font-size: 11px; color: #245060; }.basis-timeline span, .basis-timeline small { font-size: 10px; color: #667572; }
    .ops-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }.ops-panel { padding: 12px 14px; }.ops-panel h3 { margin: 0 0 8px; font-size: 13px; }.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }.grid3 .wide { grid-column: 1 / -1; }
    .toolbar { display: flex; gap: 10px; margin-bottom: 10px; }.split { display: grid; grid-template-columns: minmax(560px,1fr) 560px; gap: 14px; align-items: start; }.panel { background: white; border: 1px solid #d9e1df; } table { width: 100%; }.selected { background: #eef5f4; }.row-invalid { background: #fdf2f0; }.row-review { background: #fdf8e9; }.sub { display: block; color: #7c8986; font-size: 10px; margin-top: 3px; }.sub.stale { color: #a23b34; }.severity { padding: 3px 7px; border-radius: 3px; background: #f7edd6; color: #8e681d; font-size: 11px; }.severity.major { background: #fae7e5; color: #a23b34; }.status-chip { padding: 2px 7px; border-radius: 3px; background: #e7f0ee; color: #2e5a66; font-size: 11px; }.status-chip.invalid { background: #fae7e5; color: #a23b34; }.status-chip.review { background: #f8efd9; color: #936d20; }
    .detail { padding: 16px; }.detail-head { display: flex; justify-content: space-between; align-items: start; border-bottom: 1px solid #e1e6e5; padding-bottom: 12px; }.detail-head span { color: #74827f; font-size: 10px; }.detail-head h2 { margin: 4px 0; font-size: 18px; }.detail-head p { margin: 0; color: #65736f; font-size: 12px; }.basis-line { color: #315d6e !important; font-weight: 600; margin-top: 4px !important; }.basis-line.stale { color: #a23b34 !important; }.detail h3 { font-size: 13px; margin: 16px 0 8px; } .hint { color: #98a4a0; font-weight: 400; }
    .alert { display: grid; gap: 4px; padding: 10px 12px; margin-top: 10px; font-size: 11px; }.alert b { font-size: 12px; }.alert span, .alert small { color: #6b5b4f; }.invalid-alert { background: #fdf0ee; border-left: 3px solid #c0554b; }.review-alert { background: #fbf6e7; border-left: 3px solid #c99f3d; }
    .review-form, .opinion-form, .plan-form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.review-form .wide, .opinion-form .wide, .plan-form .wide { grid-column: 1 / -1; }.concurrent-row { display: flex; gap: 8px; align-items: center; margin: 4px 0 8px; flex-wrap: wrap; }.records { border-left: 3px solid #315d6e; background: #f5f8f7; padding: 9px; margin-top: 7px; display: grid; gap: 4px; }.records.superseded-record { border-left-color: #c4a09a; background: #faf3f2; opacity: .8; }.records i, .approval-history i { color: #a23b34; font-style: normal; font-size: 10px; }.records p { margin: 0; font-size: 12px; }.records span { color: #72807d; font-size: 10px; }
    .opinions article { border-bottom: 1px solid #e2e7e6; padding: 9px 0; display: grid; grid-template-columns: 1fr auto; gap: 4px; }.opinions p { grid-column: 1 / -1; margin: 0; font-size: 12px; }.opinions span { color: #8a6720; font-size: 10px; }
    .approval-band { display: grid; grid-template-columns: 2fr auto auto auto auto; align-items: center; gap: 7px; background: #f6f0df; border-left: 3px solid #c99f3d; padding: 10px; margin-top: 12px; }.approval-band b, .approval-band span { display: block; }.approval-band span { color: #746c55; font-size: 10px; margin-top: 4px; }.approval-band .hint { display: block; }.approval-history { margin-top: 8px; font-size: 10px; color: #72807d; display: flex; flex-wrap: wrap; gap: 6px; }.approval-history .stale { color: #a23b34; }
    .panels-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }.queue-panel { padding: 12px 14px; }.queue-panel h3 { margin: 0 0 8px; font-size: 13px; }.queue-panel article { border: 1px solid #e2e7e6; padding: 9px; margin-bottom: 8px; display: grid; gap: 4px; }.queue-panel article.failed, .queue-panel article.conflict { border-color: #e0b3ae; background: #fdf5f4; }.queue-panel article div { display: flex; justify-content: space-between; align-items: baseline; }.queue-panel small { color: #8a9793; font-size: 10px; }.queue-panel .error { color: #a23b34; font-size: 11px; }.queue-actions { display: flex; gap: 6px; justify-content: flex-end; }.switch-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }.switch-row small { color: #8a9793; font-size: 10px; }.empty { color: #98a4a0; font-size: 11px; }
  `]
})
export class AnomalyPageComponent {
  private readonly store = inject(Store)
  readonly filtered$ = this.store.select(selectFilteredAnomalies)
  readonly selected$ = this.store.select(selectSelectedAnomaly)
  readonly dataset$ = this.store.select(selectDataset)
  readonly pendingBatches$ = this.store.select(selectPendingBatches)
  readonly conflicts$ = this.store.select(selectConflicts)
  readonly failureSwitch$ = this.store.select(selectFailureSwitch)
  readonly currentBasis$ = this.store.select(selectCurrentBasisVersion)

  readonly columns = ['title', 'severity', 'status', 'open']
  readonly statuses: Anomaly['status'][] = ['待现场复核', '原因调查中', '待负责人审批', '应急联动', '已失效待重算', '已关闭']
  readonly types: Threshold['type'][] = ['位移', '水位', '渗流', '降雨']
  readonly disciplines: ExpertOpinion['discipline'][] = ['坝体', '水文', '岩土', '应急']
  readonly actions: DispositionPlan['action'][] = ['加密监测', '降低库水位', '疏通排水', '应急撤离准备', '工程加固']

  localKeyword = ''
  localStatus: Anomaly['status'] | '全部' = '全部'
  fieldForm = { observed: '', evidence: '', reassessment: '' }
  opinionForm = { discipline: '坝体' as ExpertOpinion['discipline'], content: '' }
  planForm = { action: '加密监测' as DispositionPlan['action'], owner: '坝体安全组', conditions: '', deadline: '2026-10-08T18:00' }
  thresholdForm = { id: 'T-D', type: '位移' as Threshold['type'], warning: 9, alarm: 15, changeRate: 2.5, unit: 'mm/d', note: '' }
  readingForm = { pointId: 'P-D01', value: 17.2, capturedAt: '2026-10-06T09:00', note: '' }

  /** 两个窗口各自缓存的乐观锁基线；初次加载时与当前异常版本一致，之后各自独立（模拟两个窗口） */
  baselineA = 0
  baselineB = 0
  private baselinesInitialized = false

  constructor() {
    // 仅用当前异常版本初始化两个窗口的基线一次；之后提交成功不会自动刷新，便于模拟并发
    this.selected$.subscribe((anomaly) => {
      if (!this.baselinesInitialized && anomaly) {
        this.baselineA = anomaly.version
        this.baselineB = anomaly.version
        this.baselinesInitialized = true
      }
    })
  }

  private unitByType: Record<Threshold['type'], { id: string; unit: string }> = {
    位移: { id: 'T-D', unit: 'mm/d' },
    水位: { id: 'T-W', unit: 'm/h' },
    渗流: { id: 'T-S', unit: 'L/s' },
    降雨: { id: 'T-R', unit: 'mm/h' }
  }

  count(statuses: Anomaly['status'][]): number {
    let value = 0
    this.dataset$.subscribe((dataset) => { value = dataset.anomalies.filter((item) => statuses.includes(item.status)).length }).unsubscribe()
    return value
  }

  reviewCount(): number {
    let value = 0
    this.dataset$.subscribe((dataset) => { value = dataset.anomalies.filter((item) => item.needsReview).length }).unsubscribe()
    return value
  }

  updateKeyword(value: string): void { this.store.dispatch(TailingsActions.updateKeyword({ keyword: value })) }
  updateStatus(value: Anomaly['status'] | '全部'): void { this.store.dispatch(TailingsActions.updateStatus({ status: value })) }

  select(id: string): void {
    this.store.dispatch(TailingsActions.selectAnomaly({ anomalyId: id }))
    this.selected$.subscribe((anomaly) => { if (anomaly && anomaly.id === id) this.syncBaselines(anomaly) }).unsubscribe()
  }

  syncBaselines(anomaly: Anomaly): void {
    this.baselineA = anomaly.version
    this.baselineB = anomaly.version
  }

  private dispatch(command: TailingsCommand): void {
    this.store.dispatch(TailingsActions.submitBatch({ batchId: `B-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, command }))
  }

  submitReview(anomaly: Anomaly, window: 'A' | 'B'): void {
    const expectedVersion = window === 'A' ? this.baselineA : this.baselineB
    const review: FieldReview = {
      id: `FR-${Date.now()}${window}`,
      inspector: window === 'A' ? '宋立（窗口A）' : '宋立（窗口B）',
      arrivedAt: new Date().toISOString(),
      ...this.fieldForm,
      version: 0,
      basisVersion: anomaly.basisVersion,
      superseded: false
    }
    this.dispatch({ kind: 'submitFieldReview', anomalyId: anomaly.id, review, expectedVersion })
  }

  addOpinion(anomaly: Anomaly): void {
    this.dispatch({
      kind: 'addExpertOpinion',
      anomalyId: anomaly.id,
      opinion: { id: `OP-${Date.now()}`, specialist: '当前用户', ...this.opinionForm, conclusion: '补充证据', createdAt: new Date().toISOString(), basisVersion: anomaly.basisVersion }
    })
  }

  savePlan(anomaly: Anomaly): void {
    this.dispatch({
      kind: 'saveDispositionPlan',
      anomalyId: anomaly.id,
      plan: { id: anomaly.plan.id, ...this.planForm, emergencyLinked: anomaly.plan.emergencyLinked, approvedBy: '', approvedAt: '', basisVersion: anomaly.basisVersion, superseded: false, approvalHistory: anomaly.plan.approvalHistory },
      expectedVersion: anomaly.version
    })
  }

  approve(anomaly: Anomaly): void {
    this.dispatch({ kind: 'approvePlan', anomalyId: anomaly.id, approver: '负责人 何清（窗口A）', note: '同意执行，严格执行关闭条件。', expectedVersion: this.baselineA })
  }

  approveB(anomaly: Anomaly): void {
    this.dispatch({ kind: 'approvePlan', anomalyId: anomaly.id, approver: '负责人 何清（窗口B）', note: '窗口B并行会签意见。', expectedVersion: this.baselineB })
  }

  emergency(anomaly: Anomaly): void {
    this.dispatch({ kind: 'createEmergencyLink', anomalyId: anomaly.id, note: '重大异常联动应急值班，通知下游巡查。' })
  }

  close(anomaly: Anomaly): void {
    this.dispatch({ kind: 'closeAnomaly', anomalyId: anomaly.id, note: '复测数据稳定，关闭条件已满足，冻结当前处置依据。', expectedVersion: anomaly.version })
  }

  syncThresholdUnit(type: Threshold['type']): void {
    this.thresholdForm.type = type
    this.thresholdForm.id = this.unitByType[type].id
    this.thresholdForm.unit = this.unitByType[type].unit
  }

  publishThreshold(): void {
    this.dispatch({
      kind: 'publishThreshold',
      operator: '当前用户',
      note: this.thresholdForm.note,
      threshold: {
        id: this.thresholdForm.id,
        type: this.thresholdForm.type,
        warning: Number(this.thresholdForm.warning),
        alarm: Number(this.thresholdForm.alarm),
        changeRate: Number(this.thresholdForm.changeRate),
        unit: this.thresholdForm.unit,
        enabled: true,
        version: 0,
        basisVersion: 0,
        effectiveAt: ''
      }
    })
  }

  supplementReading(): void {
    this.dispatch({
      kind: 'supplementReading',
      operator: '当前用户',
      note: this.readingForm.note,
      reading: {
        id: `RD-S-${Date.now()}`,
        pointId: this.readingForm.pointId,
        value: Number(this.readingForm.value),
        unit: this.readingForm.pointId.includes('W') ? 'm' : this.readingForm.pointId.includes('S') ? 'L/s' : this.readingForm.pointId.includes('R') ? 'mm/h' : 'mm',
        capturedAt: this.readingForm.capturedAt.length === 16 ? `${this.readingForm.capturedAt}:00` : this.readingForm.capturedAt,
        deviceId: '人工补录',
        quality: '有效',
        basisVersion: 0,
        supplement: true
      }
    })
  }

  retry(batchId: string): void { this.store.dispatch(TailingsActions.retryBatch({ batchId })) }
  discard(batchId: string): void { this.store.dispatch(TailingsActions.discardBatch({ batchId })) }
  resubmit(conflict: ConcurrencyConflict): void {
    this.store.dispatch(TailingsActions.resubmitConflict({ conflict }))
  }
  discardConflict(batchId: string): void { this.store.dispatch(TailingsActions.discardConflict({ batchId })) }
  toggleFailure(enabled: boolean): void { this.store.dispatch(TailingsActions.toggleFailureSwitch({ enabled })) }
}
