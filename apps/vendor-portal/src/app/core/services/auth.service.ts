import { HttpClient } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Observable, tap } from "rxjs";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  twoFaEnabled: boolean;
  createdAt: string;
}

interface LoginResponse {
  accessToken: string;
}

interface RequiresTwoFaResponse {
  requiresTwoFa: true;
  tempToken: string;
}

const BASE = "/auth";
const TOKEN_KEY = "access_token";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(null);
  readonly user = this._user.asReadonly();

  private _token: string | null = sessionStorage.getItem(TOKEN_KEY);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  get token(): string | null {
    return this._token;
  }

  get isLoggedIn(): boolean {
    return this._token !== null;
  }

  login(username: string, password: string): Observable<LoginResponse | RequiresTwoFaResponse> {
    return this.http.post<LoginResponse | RequiresTwoFaResponse>(`${BASE}/login`, { username, password }).pipe(
      tap(res => {
        if ("accessToken" in res) this.storeToken(res.accessToken);
      }),
    );
  }

  confirmTwoFa(tempToken: string, code: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE}/2fa/confirm`, { tempToken, code }).pipe(
      tap(res => this.storeToken(res.accessToken)),
    );
  }

  refresh(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE}/refresh`, {}, { withCredentials: true }).pipe(
      tap(res => this.storeToken(res.accessToken)),
    );
  }

  logout(): void {
    this.http.post(`${BASE}/logout`, {}, { withCredentials: true }).subscribe({
      complete: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  loadCurrentUser(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${BASE}/me`).pipe(
      tap(u => this._user.set(u)),
    );
  }

  private storeToken(token: string): void {
    this._token = token;
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  private clearSession(): void {
    this._token = null;
    this._user.set(null);
    sessionStorage.removeItem(TOKEN_KEY);
    this.router.navigate(["/login"]);
  }
}
