import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CheckInOutResponse {
  id: string;
  checkinAt: string;
  checkoutAt?: string;
  member: {
    id: string;
    name: string;
  };
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  checkinAt: string;
  checkoutAt?: string;
  duration?: number;
}

export interface AttendanceSummary {
  periodLabel: string;
  totalCheckins: number;
  uniqueMembers: number;
  averageDurationMinutes: number;
  completedCheckouts: number;
  incompleteCheckouts: number;
  mostActiveDays: Array<{ day: string; count: number }>;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Public endpoints (no auth required)
  verifyMember(identifier: string): Observable<any> {
    const url = `${this.apiUrl}/public/attendance/verify`;
    console.log('Making API call to:', url, 'with identifier:', identifier);
    return this.http.get(url, {
      params: { identifier }
    });
  }

  publicCheckIn(identifier: string): Observable<CheckInOutResponse> {
    return this.http.post<CheckInOutResponse>(`${this.apiUrl}/public/attendance/check-in`, { identifier });
  }

  publicCheckOut(identifier: string): Observable<CheckInOutResponse> {
    return this.http.post<CheckInOutResponse>(`${this.apiUrl}/public/attendance/check-out`, { identifier });
  }

  // Admin endpoints (auth required)
  getAttendanceRecords(filters?: {
    month?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<AttendanceRecord[]> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.month) params = params.set('month', filters.month);
      if (filters.year) params = params.set('year', filters.year);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
    }
    
    return this.http.get<AttendanceRecord[]>(`${this.apiUrl}/attendance-dashboard`, { params });
  }

  getAttendanceSummary(filters?: {
    month?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<AttendanceSummary> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.month) params = params.set('month', filters.month);
      if (filters.year) params = params.set('year', filters.year);
      if (filters.startDate) params = params.set('startDate', filters.startDate);
      if (filters.endDate) params = params.set('endDate', filters.endDate);
    }
    
    return this.http.get<AttendanceSummary>(`${this.apiUrl}/attendance-dashboard/summary`, { params });
  }

  // Helper function to export data as CSV
  exportAttendanceAsCSV(data: AttendanceRecord[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = ['Member ID', 'Member Name', 'Check-in Time', 'Check-out Time', 'Duration (mins)'];
    const csvRows = [headers.join(',')];

    for (const record of data) {
      const row = [
        record.memberId,
        `"${record.memberName}"`, // Wrap name in quotes to handle commas
        new Date(record.checkinAt).toLocaleString(),
        record.checkoutAt ? new Date(record.checkoutAt).toLocaleString() : 'Not checked out',
        record.duration !== null ? record.duration : 'N/A'
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
