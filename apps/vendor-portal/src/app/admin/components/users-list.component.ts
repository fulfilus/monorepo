import { CommonModule, DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { CreateUserDto, User, UsersService } from "../services/users.service";

@Component({
  selector: "app-users-list",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>User Management</h2>
        <div class="admin-header-actions">
          <button (click)="toggleAddForm()" class="btn-secondary">
            {{ showAddForm ? "Cancel" : "+ Add User" }}
          </button>
        </div>
      </div>

      <div *ngIf="errorMessage" class="alert alert-error" style="margin-bottom:16px;">{{ errorMessage }}</div>

      <!-- Add User Form -->
      <div *ngIf="showAddForm" class="panel" style="margin-bottom:20px;">
        <div class="panel-header"><h3>New User</h3></div>
        <div class="panel-body">
          <div *ngIf="addError" class="alert alert-error" style="margin-bottom:12px;">{{ addError }}</div>
          <div class="form-row">
            <label>
              Username
              <input type="text" [(ngModel)]="addForm.username" placeholder="username" [disabled]="adding" />
            </label>
            <label>
              Email
              <input type="email" [(ngModel)]="addForm.email" placeholder="user@example.com" [disabled]="adding" />
            </label>
            <label>
              Password
              <input type="password" [(ngModel)]="addForm.password" placeholder="password" [disabled]="adding" />
            </label>
            <label>
              Role
              <select [(ngModel)]="addForm.role" [disabled]="adding">
                <option value="STAFF">STAFF</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <button (click)="createUser()" [disabled]="adding || !addForm.username || !addForm.email || !addForm.password" class="btn-primary">
              {{ adding ? "Creating..." : "Create User" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="table-wrapper">
        <table *ngIf="users.length; else empty">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>2FA</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users">
              <td><strong>{{ u.username }}</strong></td>
              <td>{{ u.email }}</td>
              <td>
                <span class="badge" [class.admin]="u.role === 'ADMIN'">{{ u.role }}</span>
              </td>
              <td>
                <span [style.color]="u.twoFaEnabled ? 'var(--green)' : 'var(--text-faint)'">
                  {{ u.twoFaEnabled ? "Enabled" : "Off" }}
                </span>
              </td>
              <td>
                <span *ngIf="isLocked(u)" class="badge locked">Locked</span>
                <span *ngIf="!isLocked(u)" style="color:var(--green); font-size:12px;">Active</span>
              </td>
              <td>{{ u.createdAt | date:'dd MMM yy' }}</td>
              <td class="row-actions">
                <button *ngIf="isLocked(u)" (click)="unlockUser(u)" class="btn-link" style="color:var(--primary);">Unlock</button>
                <button (click)="toggleRole(u)" [disabled]="roleWorking === u.id" class="btn-link">
                  Make {{ u.role === "ADMIN" ? "STAFF" : "ADMIN" }}
                </button>
                <button (click)="toggleResetForm(u.id)" class="btn-link">Reset PW</button>
                <button (click)="deleteUser(u)" class="btn-link" style="color:var(--red);">Delete</button>
              </td>
            </tr>
            <!-- Inline Reset Password Row -->
            <tr *ngIf="resetUserId" class="reset-row">
              <td colspan="7">
                <div class="reset-inline">
                  <span style="font-size:12px; color:var(--text-muted);">New password for {{ getUserName(resetUserId) }}:</span>
                  <input type="password" [(ngModel)]="resetPassword" placeholder="new password" [disabled]="resetting" style="width:200px;" />
                  <button (click)="doResetPassword()" [disabled]="resetting || !resetPassword" class="btn-secondary">
                    {{ resetting ? "Saving..." : "Save" }}
                  </button>
                  <button (click)="cancelReset()" class="btn-ghost">Cancel</button>
                  <span *ngIf="resetError" style="color:var(--red); font-size:12px;">{{ resetError }}</span>
                  <span *ngIf="resetSuccess" style="color:var(--green); font-size:12px;">Password updated.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="empty-state">{{ loading ? "Loading..." : "No users found." }}</p>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .form-row {
      display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;
      label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-muted); }
      input, select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; background: var(--surface); color: var(--text); }
    }
    .btn-primary {
      padding: 6px 14px; background: var(--primary); color: #fff; border: none; border-radius: 6px;
      font-size: 13px; cursor: pointer;
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }
    .badge.admin { background: var(--primary-bg, #e8f0fe); color: var(--primary); }
    .badge.locked { background: #fef3c7; color: #b45309; }
    .row-actions { white-space: nowrap; display: flex; gap: 8px; align-items: center; }
    .reset-row td { padding: 0; background: var(--surface-raised, var(--surface)); }
    .reset-inline {
      display: flex; gap: 10px; align-items: center; padding: 10px 16px;
      border-top: 1px solid var(--border); flex-wrap: wrap;
    }
    .reset-inline input { padding: 5px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; background: var(--surface); color: var(--text); }
  `],
})
export class UsersListComponent implements OnInit, OnDestroy {
  users: User[] = [];
  loading = false;
  errorMessage = "";

  showAddForm = false;
  adding = false;
  addError = "";
  addForm: CreateUserDto = { username: "", email: "", password: "", role: "STAFF" };

  roleWorking: string | null = null;

  resetUserId: string | null = null;
  resetPassword = "";
  resetting = false;
  resetError = "";
  resetSuccess = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly usersService: UsersService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isLocked(u: User): boolean {
    return u.lockedUntil !== null && new Date(u.lockedUntil) > new Date();
  }

  getUserName(id: string): string {
    return this.users.find(u => u.id === id)?.username ?? id;
  }

  loadUsers() {
    this.loading = true;
    this.errorMessage = "";
    this.usersService.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.errorMessage = (err as { error?: { message?: string } })?.error?.message ?? "Failed to load users.";
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    this.addError = "";
    this.addForm = { username: "", email: "", password: "", role: "STAFF" };
  }

  createUser() {
    if (!this.addForm.username || !this.addForm.email || !this.addForm.password) return;
    this.adding = true;
    this.addError = "";
    this.usersService.create(this.addForm).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.adding = false;
        this.showAddForm = false;
        this.addForm = { username: "", email: "", password: "", role: "STAFF" };
        this.loadUsers();
      },
      error: (err: unknown) => {
        this.addError = (err as { error?: { message?: string } })?.error?.message ?? "Failed to create user.";
        this.adding = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleRole(u: User) {
    const newRole = u.role === "ADMIN" ? "STAFF" : "ADMIN";
    if (!confirm(`Change ${u.username}'s role to ${newRole}?`)) return;
    this.roleWorking = u.id;
    this.usersService.updateRole(u.id, newRole).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        const idx = this.users.findIndex(x => x.id === u.id);
        if (idx >= 0) this.users[idx] = updated;
        this.roleWorking = null;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.errorMessage = (err as { error?: { message?: string } })?.error?.message ?? "Failed to update role.";
        this.roleWorking = null;
        this.cdr.markForCheck();
      },
    });
  }

  unlockUser(u: User) {
    this.usersService.unlock(u.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        const idx = this.users.findIndex(x => x.id === u.id);
        if (idx >= 0) this.users[idx] = updated;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.errorMessage = (err as { error?: { message?: string } })?.error?.message ?? "Failed to unlock user.";
        this.cdr.markForCheck();
      },
    });
  }

  toggleResetForm(id: string) {
    if (this.resetUserId === id) {
      this.cancelReset();
    } else {
      this.resetUserId = id;
      this.resetPassword = "";
      this.resetError = "";
      this.resetSuccess = false;
    }
  }

  doResetPassword() {
    if (!this.resetUserId || !this.resetPassword) return;
    this.resetting = true;
    this.resetError = "";
    this.resetSuccess = false;
    this.usersService.resetPassword(this.resetUserId, this.resetPassword).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.resetting = false;
        this.resetSuccess = true;
        this.resetPassword = "";
        this.cdr.markForCheck();
        setTimeout(() => {
          this.resetUserId = null;
          this.resetSuccess = false;
          this.cdr.markForCheck();
        }, 1500);
      },
      error: (err: unknown) => {
        this.resetError = (err as { error?: { message?: string } })?.error?.message ?? "Failed to reset password.";
        this.resetting = false;
        this.cdr.markForCheck();
      },
    });
  }

  cancelReset() {
    this.resetUserId = null;
    this.resetPassword = "";
    this.resetError = "";
    this.resetSuccess = false;
  }

  deleteUser(u: User) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    this.usersService.remove(u.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.loadUsers(); },
      error: (err: unknown) => {
        this.errorMessage = (err as { error?: { message?: string } })?.error?.message ?? "Failed to delete user.";
        this.cdr.markForCheck();
      },
    });
  }
}
