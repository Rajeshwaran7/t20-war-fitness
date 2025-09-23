import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';

interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  checkinAt: string;
  checkoutAt: string | null;
  duration: number | null;
  hours: number | null;
  date: string;
}

interface AttendanceResponse {
  data: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
}

@Component({
  selector: 'app-attendance-history',
  templateUrl: './attendance-history.component.html',
  styleUrls: ['./attendance-history.component.scss']
})
export class AttendanceHistoryComponent implements OnInit {
  baseUrl = '/api';
  attendanceRecords: AttendanceRecord[] = [];
  filterForm: FormGroup;
  loading = false;
  totalRecords = 0;
  pageSize = 10;
  pageIndex = 0;
  displayedColumns: string[] = ['memberId', 'memberName', 'date', 'checkinTime', 'checkoutTime', 'duration', 'hours'];
  
  dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'custom', label: 'Custom Range' }
  ];

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.filterForm = this.fb.group({
      dateRangeType: ['today'],
      startDate: [null],
      endDate: [null],
      memberId: ['']
    });
  }

  ngOnInit(): void {
    this.loadAttendanceHistory();
    
    // Listen for date range type changes
    this.filterForm.get('dateRangeType')?.valueChanges.subscribe(value => {
      if (value !== 'custom') {
        this.setDateRangeFromOption(value);
      }
    });
  }

  loadAttendanceHistory(): void {
    this.loading = true;
    
    const filters = this.getFilters();
    const params = {
      ...filters,
      page: (this.pageIndex + 1).toString(),
      limit: this.pageSize.toString()
    };

    // Make sure we're using the right URL
    console.log('Fetching attendance history with params:', params);
    
    // Try the authenticated endpoint first
    this.http.get<AttendanceResponse>(`${this.baseUrl}/checkins/history`, { params })
      .subscribe({
        next: (response) => {
          console.log('Auth endpoint success:', response);
          this.attendanceRecords = response.data;
          this.totalRecords = response.total;
          this.loading = false;
        },
        error: (authError) => {
          console.error('Error with authenticated endpoint:', authError);
          
          // If auth fails, try the public endpoint as fallback
          console.log('Trying public endpoint instead');
          this.http.get<AttendanceResponse>(`${this.baseUrl}/public/checkins/history`, { params })
            .subscribe({
              next: (response) => {
                console.log('Public endpoint success:', response);
                this.attendanceRecords = response.data;
                this.totalRecords = response.total;
                this.loading = false;
              },
              error: (publicError) => {
                console.error('Error with public endpoint:', publicError);
                this.snackBar.open('Failed to load attendance history', 'Close', { duration: 3000 });
                this.loading = false;
              }
            });
        }
      });
  }

  getFilters(): any {
    const filters: any = {};
    const formValue = this.filterForm.value;
    
    if (formValue.dateRangeType === 'custom') {
      if (formValue.startDate) {
        filters.startDate = this.formatDate(formValue.startDate);
      }
      if (formValue.endDate) {
        filters.endDate = this.formatDate(formValue.endDate);
      }
    } else {
      const dateRange = this.getDateRangeFromOption(formValue.dateRangeType);
      filters.startDate = this.formatDate(dateRange.startDate);
      filters.endDate = this.formatDate(dateRange.endDate);
    }
    
    if (formValue.memberId) {
      filters.memberId = formValue.memberId;
    }
    
    return filters;
  }

  setDateRangeFromOption(option: string): void {
    const dateRange = this.getDateRangeFromOption(option);
    
    this.filterForm.patchValue({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }, { emitEvent: false });
  }

  getDateRangeFromOption(option: string): { startDate: Date, endDate: Date } {
    const today = new Date();
    const endDate = new Date(today);
    let startDate = new Date(today);
    
    switch (option) {
      case 'today':
        // Start and end are both today
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'yesterday':
        // Yesterday
        startDate.setDate(today.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(today.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'last_week':
        // Last 7 days
        startDate.setDate(today.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'last_month':
        // Last 30 days
        startDate.setDate(today.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      default:
        // Default to today
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }
    
    return { startDate, endDate };
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString();
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadAttendanceHistory();
  }

  applyFilters(): void {
    this.pageIndex = 0; // Reset to first page when filters change
    this.loadAttendanceHistory();
  }

  resetFilters(): void {
    this.filterForm.reset({
      dateRangeType: 'today',
      startDate: null,
      endDate: null,
      memberId: ''
    });
    
    this.pageIndex = 0;
    this.loadAttendanceHistory();
  }
}
