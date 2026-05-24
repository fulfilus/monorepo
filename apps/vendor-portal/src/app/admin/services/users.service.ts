import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  twoFaEnabled: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: string;
}

@Injectable({ providedIn: "root" })
export class UsersService {
  private readonly base = "/users";

  constructor(private readonly http: HttpClient) {}

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.base);
  }

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.base, dto);
  }

  updateRole(id: string, role: string): Observable<User> {
    return this.http.patch<User>(`${this.base}/${id}/role`, { role });
  }

  unlock(id: string): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/unlock`, {});
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/reset-password`, { newPassword });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
