import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from "../core/services/auth.service";

type TwoFaStep = "idle" | "setup" | "verify-enable" | "verify-disable";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-page">
      <h2 class="page-title">Account Settings</h2>

      <!-- 2FA Section -->
      <section class="card">
        <h3>Two-Factor Authentication</h3>
        <p class="desc">
          {{ auth.user()?.twoFaEnabled ? '2FA is enabled on your account.' : '2FA is not enabled. Add an extra layer of security.' }}
        </p>

        @if (twoFaStep() === 'idle') {
          @if (auth.user()?.twoFaEnabled) {
            <button class="btn btn-danger" (click)="startDisable()">Disable 2FA</button>
          } @else {
            <button class="btn btn-primary" (click)="startSetup()" [disabled]="twoFaLoading()">
              {{ twoFaLoading() ? 'Loading...' : 'Set up 2FA' }}
            </button>
          }
        }

        @if (twoFaStep() === 'setup') {
          <div class="qr-wrap">
            <p class="hint">Scan this QR code with Google Authenticator, Authy, or 1Password.</p>
            <img [src]="qrCode()" alt="2FA QR Code" class="qr-img" />
            <p class="hint">Or enter the secret manually: <code>{{ secret() }}</code></p>
            <button class="btn btn-primary" (click)="twoFaStep.set('verify-enable')">I've scanned it</button>
            <button class="btn btn-ghost" (click)="cancelTwoFa()">Cancel</button>
          </div>
        }

        @if (twoFaStep() === 'verify-enable') {
          <form [formGroup]="codeForm" (ngSubmit)="confirmEnable()" class="inline-form">
            <p class="hint">Enter the 6-digit code from your authenticator app to confirm.</p>
            <div class="field-row">
              <input type="text" formControlName="code" inputmode="numeric" maxlength="6"
                     autocomplete="one-time-code" placeholder="000000" class="code-input" />
              <button type="submit" class="btn btn-primary" [disabled]="codeForm.invalid || twoFaLoading()">
                {{ twoFaLoading() ? 'Verifying...' : 'Enable' }}
              </button>
              <button type="button" class="btn btn-ghost" (click)="cancelTwoFa()">Cancel</button>
            </div>
            @if (twoFaError()) { <p class="error">{{ twoFaError() }}</p> }
          </form>
        }

        @if (twoFaStep() === 'verify-disable') {
          <form [formGroup]="codeForm" (ngSubmit)="confirmDisable()" class="inline-form">
            <p class="hint">Enter the 6-digit code from your authenticator app to disable 2FA.</p>
            <div class="field-row">
              <input type="text" formControlName="code" inputmode="numeric" maxlength="6"
                     autocomplete="one-time-code" placeholder="000000" class="code-input" />
              <button type="submit" class="btn btn-danger" [disabled]="codeForm.invalid || twoFaLoading()">
                {{ twoFaLoading() ? 'Disabling...' : 'Confirm Disable' }}
              </button>
              <button type="button" class="btn btn-ghost" (click)="cancelTwoFa()">Cancel</button>
            </div>
            @if (twoFaError()) { <p class="error">{{ twoFaError() }}</p> }
          </form>
        }

        @if (twoFaSuccess()) { <p class="success">{{ twoFaSuccess() }}</p> }
      </section>

      <!-- Change Password Section -->
      <section class="card">
        <h3>Change Password</h3>
        <form [formGroup]="pwForm" (ngSubmit)="changePassword()">
          <div class="field">
            <label>Current password</label>
            <input type="password" formControlName="currentPassword" name="current-password"
                   autocomplete="current-password" />
          </div>
          <div class="field">
            <label>New password</label>
            <input type="password" formControlName="newPassword" name="new-password"
                   autocomplete="new-password" />
            <span class="hint">Min 15 characters with uppercase, lowercase, digit, and symbol.</span>
          </div>
          <div class="field">
            <label>Confirm new password</label>
            <input type="password" formControlName="confirmPassword" name="new-password"
                   autocomplete="new-password" />
          </div>
          @if (pwError()) { <p class="error">{{ pwError() }}</p> }
          @if (pwSuccess()) { <p class="success">{{ pwSuccess() }}</p> }
          <button type="submit" class="btn btn-primary"
                  [disabled]="pwForm.invalid || pwLoading() || passwordMismatch">
            {{ pwLoading() ? 'Saving...' : 'Update password' }}
          </button>
          @if (passwordMismatch && pwForm.get('confirmPassword')?.dirty) {
            <p class="error">Passwords do not match.</p>
          }
        </form>
      </section>
    </div>
  `,
  styles: [`
    .settings-page { max-width: 560px; margin: 40px auto; padding: 0 16px; }
    .page-title { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
    .card {
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 20px;
    }
    h3 { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
    .desc { font-size: 13px; color: var(--text-muted, #6b7280); margin: 0 0 16px; }
    .hint { font-size: 12px; color: var(--text-muted, #6b7280); margin: 0 0 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
    label { font-size: 12px; font-weight: 500; color: var(--text-muted, #6b7280); }
    input {
      border: 1px solid var(--border, #d1d5db);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 14px;
      outline: none;
      &:focus { border-color: #2563eb; }
    }
    .btn {
      padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: none; transition: opacity .15s;
      &:disabled { opacity: .55; cursor: not-allowed; }
    }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-ghost {
      background: none; border: 1px solid var(--border, #e5e7eb);
      color: var(--text-muted, #6b7280);
    }
    .inline-form { margin-top: 8px; }
    .field-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .code-input { width: 110px; letter-spacing: 4px; font-size: 18px; text-align: center; }
    .qr-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
    .qr-img { width: 180px; height: 180px; border: 1px solid var(--border, #e5e7eb); border-radius: 6px; }
    code { background: var(--surface-raised, #f3f4f6); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .error { color: #dc2626; font-size: 12px; margin: 4px 0 0; }
    .success { color: #16a34a; font-size: 12px; margin: 8px 0 0; }
  `],
})
export class SettingsComponent implements OnInit {
  readonly twoFaStep = signal<TwoFaStep>("idle");
  readonly twoFaLoading = signal(false);
  readonly twoFaError = signal<string | null>(null);
  readonly twoFaSuccess = signal<string | null>(null);
  readonly qrCode = signal<string>("");
  readonly secret = signal<string>("");

  readonly pwLoading = signal(false);
  readonly pwError = signal<string | null>(null);
  readonly pwSuccess = signal<string | null>(null);

  readonly codeForm = this.fb.nonNullable.group({
    code: ["", [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  readonly pwForm = this.fb.nonNullable.group({
    currentPassword: ["", Validators.required],
    newPassword: ["", [Validators.required, Validators.minLength(15)]],
    confirmPassword: ["", Validators.required],
  });

  constructor(readonly auth: AuthService, private readonly fb: FormBuilder) {}

  ngOnInit(): void {
    this.auth.loadCurrentUser().subscribe();
  }

  get passwordMismatch(): boolean {
    const { newPassword, confirmPassword } = this.pwForm.getRawValue();
    return newPassword !== confirmPassword;
  }

  startSetup(): void {
    this.twoFaLoading.set(true);
    this.twoFaError.set(null);
    this.auth.setup2Fa().subscribe({
      next: res => {
        this.qrCode.set(res.qrCode);
        this.secret.set(res.secret);
        this.twoFaStep.set("setup");
        this.twoFaLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.twoFaError.set(err.error?.message ?? "Failed to start 2FA setup");
        this.twoFaLoading.set(false);
      },
    });
  }

  startDisable(): void {
    this.twoFaStep.set("verify-disable");
    this.twoFaError.set(null);
    this.codeForm.reset();
  }

  cancelTwoFa(): void {
    this.twoFaStep.set("idle");
    this.twoFaError.set(null);
    this.codeForm.reset();
  }

  confirmEnable(): void {
    if (this.codeForm.invalid) return;
    this.twoFaLoading.set(true);
    this.twoFaError.set(null);
    this.auth.enable2Fa(this.codeForm.getRawValue().code).subscribe({
      next: () => {
        this.twoFaLoading.set(false);
        this.twoFaStep.set("idle");
        this.twoFaSuccess.set("2FA enabled successfully.");
        this.codeForm.reset();
        setTimeout(() => this.twoFaSuccess.set(null), 4000);
      },
      error: (err: HttpErrorResponse) => {
        this.twoFaLoading.set(false);
        this.twoFaError.set(err.error?.message ?? "Invalid code");
      },
    });
  }

  confirmDisable(): void {
    if (this.codeForm.invalid) return;
    this.twoFaLoading.set(true);
    this.twoFaError.set(null);
    this.auth.disable2Fa(this.codeForm.getRawValue().code).subscribe({
      next: () => {
        this.twoFaLoading.set(false);
        this.twoFaStep.set("idle");
        this.twoFaSuccess.set("2FA disabled.");
        this.codeForm.reset();
        setTimeout(() => this.twoFaSuccess.set(null), 4000);
      },
      error: (err: HttpErrorResponse) => {
        this.twoFaLoading.set(false);
        this.twoFaError.set(err.error?.message ?? "Invalid code");
      },
    });
  }

  changePassword(): void {
    if (this.pwForm.invalid || this.passwordMismatch) return;
    this.pwLoading.set(true);
    this.pwError.set(null);
    this.pwSuccess.set(null);
    const { currentPassword, newPassword } = this.pwForm.getRawValue();
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.pwLoading.set(false);
        this.pwForm.reset();
        this.pwSuccess.set("Password updated. All other sessions have been signed out.");
        setTimeout(() => this.pwSuccess.set(null), 6000);
      },
      error: (err: HttpErrorResponse) => {
        this.pwLoading.set(false);
        this.pwError.set(err.error?.message ?? "Failed to change password");
      },
    });
  }
}
