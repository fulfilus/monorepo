import { AsyncPipe, CommonModule, DatePipe } from "@angular/common";
import { Component, HostListener, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "./core/services/auth.service";
import { NotificationDto, NotificationService } from "./core/services/notification.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AsyncPipe, DatePipe],
  template: `
    <nav class="app-nav" *ngIf="auth.isLoggedIn">
      <span class="app-nav-brand">Ful<span>FilUs</span></span>
      <div class="nav-links">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Add Vendor</a>
        <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Vendors</a>
        <a routerLink="/procurement" routerLinkActive="active">Procurement</a>
        <a routerLink="/quotations" routerLinkActive="active">Quotations</a>
        <a routerLink="/sourcing" routerLinkActive="active">Sourcing</a>
        <a routerLink="/customers" routerLinkActive="active">Customers</a>
        <a routerLink="/contracts" routerLinkActive="active">Contracts</a>
        <a routerLink="/inbox" routerLinkActive="active">Inbox</a>
        <a routerLink="/admin/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/admin/users" routerLinkActive="active">Users</a>
      </div>
      <div class="nav-actions" style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        <ng-container *ngIf="auth.user() as u">
          <span class="nav-user">{{ u.username }} <span class="role-badge" [class.admin]="u.role === 'ADMIN'">{{ u.role }}</span></span>
        </ng-container>
        <a routerLink="/settings" class="logout-btn" title="Settings">Settings</a>
        <button class="logout-btn" (click)="logout()" title="Sign out">Sign out</button>
      <div class="nav-bell" style="position:relative;">
        <button (click)="toggleNotifications()" class="bell-btn"
                [class.has-unread]="(notificationService.unreadCount$ | async) ?? 0 > 0"
                title="Notifications">
          &#9899;
          <span *ngIf="(notificationService.unreadCount$ | async) ?? 0 as count" class="badge-dot">
            {{ count > 0 ? count : '' }}
          </span>
        </button>
        <div *ngIf="showNotifications" class="notif-panel" (click)="$event.stopPropagation()">
          <div class="notif-header">
            <strong>Notifications</strong>
            <button (click)="markAllRead()" style="font-size:11px; color:var(--primary); background:none; border:none; cursor:pointer; padding:0;">Mark all read</button>
          </div>
          <div *ngIf="!notifications.length" class="empty-state" style="padding:16px; font-size:12px;">No notifications</div>
          <div *ngFor="let n of notifications" class="notif-item" [class.unread]="!n.readAt" (click)="markRead(n)">
            <div style="font-size:12px; font-weight:600; color:var(--text);">{{ n.title }}</div>
            <div *ngIf="n.body" style="font-size:11px; color:var(--text-muted);">{{ n.body }}</div>
            <div style="font-size:10px; color:var(--text-faint); margin-top:2px;">{{ n.createdAt | date:'dd MMM, HH:mm' }}</div>
          </div>
        </div>
      </div>
      </div>
    </nav>
    <router-outlet />
  `,
  styles: [`
    .nav-user {
      font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 5px;
    }
    .role-badge {
      display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 7px;
      border-radius: 99px; background: var(--border); color: var(--text-muted);
      &.admin { background: #dbeafe; color: #1d4ed8; }
    }
    .logout-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      padding: 4px 10px; font-size: 12px; color: var(--text-muted); cursor: pointer;
      &:hover { color: var(--text); border-color: var(--text-muted); }
    }
    .bell-btn {
      background: none; border: none; cursor: pointer;
      font-size: 18px; color: var(--text-muted); padding: 4px 8px;
      position: relative; line-height: 1;
    }
    .bell-btn.has-unread { color: var(--primary); }
    .badge-dot {
      position: absolute; top: 0; right: 0;
      background: var(--red); color: #fff;
      font-size: 9px; border-radius: 99px; padding: 1px 4px;
      font-weight: 700; min-width: 14px; text-align: center;
    }
    .notif-panel {
      position: absolute; right: 0; top: calc(100% + 6px); z-index: 1000;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--r-xl); box-shadow: 0 8px 32px rgba(0,0,0,0.14);
      width: 320px; max-height: 480px; overflow-y: auto;
    }
    .notif-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 14px 8px; border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .notif-item {
      padding: 10px 14px; border-bottom: 1px solid var(--border-light, var(--border));
      cursor: pointer; transition: background 0.15s;
    }
    .notif-item:hover { background: var(--surface-raised); }
    .notif-item.unread { background: var(--primary-bg, var(--surface-raised)); border-left: 3px solid var(--primary); }
  `],
})
export class AppComponent implements OnInit {
  showNotifications = false;
  notifications: NotificationDto[] = [];

  constructor(
    readonly notificationService: NotificationService,
    readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    if (this.auth.isLoggedIn) {
      this.auth.loadCurrentUser().subscribe();
    }
    this.loadNotifications();
  }

  loadNotifications() {
    this.notificationService.list(false, 20).subscribe({
      next: res => { this.notifications = res.data; },
      error: () => {},
    });
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) this.loadNotifications();
  }

  markRead(n: NotificationDto) {
    if (n.readAt) return;
    this.notificationService.markRead(n.id).subscribe({
      next: updated => {
        const idx = this.notifications.findIndex(x => x.id === n.id);
        if (idx >= 0) this.notifications[idx] = updated;
        this.notificationService.refreshUnreadCount();
      },
      error: () => {},
    });
  }

  markAllRead() {
    this.notificationService.markAllRead().subscribe({
      next: res => { this.notifications = res.data; },
      error: () => {},
    });
  }

  logout() { this.auth.logout(); }

  @HostListener("document:click")
  onDocumentClick() { this.showNotifications = false; }

  @HostListener("window:pageshow", ["$event"])
  onPageShow(event: PageTransitionEvent) {
    if (!event.persisted) return;
    // bfcache restore: re-navigate through the router so Angular recreates the
    // route component tree and triggers fresh data loading in ngOnInit.
    const url = this.router.url;
    this.router.navigateByUrl("/", { skipLocationChange: true }).then(() =>
      this.router.navigateByUrl(url),
    );
  }
}
