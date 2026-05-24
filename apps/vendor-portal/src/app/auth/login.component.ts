import { CommonModule } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../core/services/auth.service";

type Step = "credentials" | "totp";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <h1 class="login-brand">Ful<span>FilUs</span></h1>

        @if (step() === 'credentials') {
          <form [formGroup]="credForm" (ngSubmit)="submitCredentials()">
            <div class="field">
              <label>Username</label>
              <input type="text" formControlName="username" autocomplete="username" />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" formControlName="password" autocomplete="current-password" />
            </div>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button type="submit" [disabled]="credForm.invalid || loading()">
              {{ loading() ? 'Signing in...' : 'Sign in' }}
            </button>
          </form>
        }

        @if (step() === 'totp') {
          <form [formGroup]="totpForm" (ngSubmit)="submitTotp()">
            <p class="totp-hint">Enter the 6-digit code from your authenticator app.</p>
            <div class="field">
              <label>2FA Code</label>
              <input type="text" formControlName="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" />
            </div>
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button type="submit" [disabled]="totpForm.invalid || loading()">
              {{ loading() ? 'Verifying...' : 'Verify' }}
            </button>
            <button type="button" class="link-btn" (click)="backToCredentials()">Back</button>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
    .login-card {
      background: #fff;
      border-radius: 12px;
      padding: 40px 36px;
      width: 360px;
      box-shadow: 0 4px 24px rgba(0,0,0,.10);
    }
    .login-brand {
      font-size: 26px;
      font-weight: 700;
      margin: 0 0 28px;
      color: #111;
      span { color: #2563eb; }
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }
    label { font-size: 13px; font-weight: 500; color: #444; }
    input {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 15px;
      outline: none;
      transition: border-color .15s;
      &:focus { border-color: #2563eb; }
    }
    button[type=submit] {
      width: 100%;
      padding: 10px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 4px;
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .link-btn {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 13px;
      cursor: pointer;
      margin-top: 10px;
      display: block;
      width: 100%;
      text-align: center;
      &:hover { color: #111; }
    }
    .error { color: #dc2626; font-size: 13px; margin: -8px 0 8px; }
    .totp-hint { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
  `],
})
export class LoginComponent {
  readonly step = signal<Step>("credentials");
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private tempToken = "";

  readonly credForm = this.fb.nonNullable.group({
    username: ["", Validators.required],
    password: ["", Validators.required],
  });

  readonly totpForm = this.fb.nonNullable.group({
    code: ["", [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  submitCredentials(): void {
    if (this.credForm.invalid) return;
    const { username, password } = this.credForm.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(username, password).subscribe({
      next: res => {
        this.loading.set(false);
        if ("requiresTwoFa" in res) {
          this.tempToken = res.tempToken;
          this.step.set("totp");
        } else {
          this.router.navigate(["/"]);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? "Login failed");
      },
    });
  }

  submitTotp(): void {
    if (this.totpForm.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.confirmTwoFa(this.tempToken, this.totpForm.getRawValue().code).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(["/"]);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? "Invalid code");
      },
    });
  }

  backToCredentials(): void {
    this.step.set("credentials");
    this.error.set(null);
    this.totpForm.reset();
  }
}
