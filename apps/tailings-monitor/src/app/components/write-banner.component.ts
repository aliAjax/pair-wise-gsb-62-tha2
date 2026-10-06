import { CommonModule } from '@angular/common'
import { Component, inject } from '@angular/core'
import { MatButtonModule } from '@angular/material/button'
import { Store } from '@ngrx/store'
import { TailingsActions } from '../store/tailings.actions'
import { selectPendingBatch, selectWriteStatus } from '../store/tailings.selectors'

@Component({
  selector: 'app-write-banner',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="banner success" *ngIf="(status$ | async)?.writeNotice as notice">
      <b>{{ notice }}</b>
      <span></span>
      <button mat-button (click)="clear()">知道了</button>
    </div>
    <div class="banner conflict" *ngIf="(status$ | async)?.writeConflict as conflict">
      <div><b>提交冲突</b><p>{{ conflict }}</p><small>先到者已经生效；本窗口填写内容和未提交批次保留，可刷新预期版本后重提。</small></div>
      <span></span>
      <button mat-flat-button color="primary" (click)="retry()">按当前版本重提</button>
    </div>
    <div class="banner pending" *ngIf="pending$ | async as pending">
      <div>
        <b>未完成写入批次 {{ pending.id }}</b>
        <p>{{ pending.operation }} · 实体 {{ pending.entityId || '新版本依据' }} · 已尝试 {{ pending.attempts }} 次</p>
        <small>{{ pending.lastError || '等待服务确认，提交内容未重复追加审计。' }}</small>
      </div>
      <button mat-flat-button color="primary" [disabled]="(status$ | async)?.writeInFlight" (click)="retry()">重试</button>
      <button mat-button (click)="discard()">丢弃批次</button>
    </div>
  `,
  styles: [`
    .banner { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 12px; margin: 0 0 12px; padding: 11px 14px; border-left: 4px solid; }
    .banner p, .banner small { margin: 3px 0 0; } .banner p { font-size: 12px; } .banner small { font-size: 10px; color: #687470; }
    .success { background: #eaf6ef; border-color: #3d835c; color: #245b3b; }
    .conflict { background: #fff3df; border-color: #cf8b20; color: #795010; grid-template-columns: 1fr auto; }
    .pending { background: #fdecea; border-color: #b6453e; color: #84312c; grid-template-columns: 1fr auto auto; }
  `]
})
export class WriteBannerComponent {
  private readonly store = inject(Store)
  readonly pending$ = this.store.select(selectPendingBatch)
  readonly status$ = this.store.select(selectWriteStatus)
  retry(): void { this.store.dispatch(TailingsActions.retryPendingWrite()) }
  discard(): void { this.store.dispatch(TailingsActions.discardPendingWrite()) }
  clear(): void { this.store.dispatch(TailingsActions.clearWriteConflict()) }
}
