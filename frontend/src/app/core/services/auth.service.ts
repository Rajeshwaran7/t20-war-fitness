import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface LoginResponse {
  accessToken: string;
}

interface JwtPayload { sub: string; email: string; role: 'admin'|'gym_manager'|'member'; exp: number }

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = '/api';
  private tokenKey = 't20_token';

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { email, password });
  }

  storeToken(token: string) { localStorage.setItem(this.tokenKey, token); }
  getToken(): string | null { 
    const token = localStorage.getItem(this.tokenKey);
    console.log('Auth Service getToken called, token exists:', !!token);
    return token;
  }
  
  isAuthenticated(): boolean { 
    const isAuth = !!this.getToken();
    console.log('Auth Service isAuthenticated called:', isAuth);
    return isAuth;
  }

  getRole(): JwtPayload['role'] | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as JwtPayload;
      return payload.role;
    } catch { return null; }
  }

  logout() { localStorage.removeItem(this.tokenKey); this.router.navigate(['/auth']); }
}
