import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, interval, Subject, switchMap, takeUntil } from "rxjs";
import { environment } from "../../../environments/environment";

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  entityType: string | null;
  readAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: "root" })
export class NotificationService implements OnDestroy {
  private readonly base = `${environment.apiUrl}/notifications`;
  private readonly destroy$ = new Subject<void>();

  readonly unreadCount$ = new BehaviorSubject<number>(0);

  constructor(private readonly http: HttpClient) {
    this.refreshUnreadCount();
    interval(30000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshUnreadCount());
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  refreshUnreadCount() {
    this.http.get<{ count: number }>(`${this.base}/unread-count`).subscribe({
      next: res => { this.unreadCount$.next(res.count); },
      error: () => {},
    });
  }

  list(unreadOnly = false, limit = 20) {
    const params = new HttpParams().set("limit", limit).set("unreadOnly", String(unreadOnly));
    return this.http.get<{ data: NotificationDto[]; total: number; unreadCount: number }>(this.base, { params });
  }

  markRead(id: string) {
    return this.http.patch<NotificationDto>(`${this.base}/${id}/read`, {});
  }

  markAllRead() {
    return this.http.patch<{ ok: boolean }>(`${this.base}/mark-all-read`, {}).pipe(
      switchMap(() => {
        this.unreadCount$.next(0);
        return this.list(false);
      }),
    );
  }
}
