import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, Validators } from '@angular/forms';
import { Location } from '@angular/common';

interface Plan { id: string; name: string; fees: number }
interface Member {
  id: string;
  memberId: string;
  name: string;
  age: number;
  phone?: string;
  email?: string;
  startDate: string;
  endDate: string;
  feesPaid: number;
  status: string;
  membershipPlan: Plan;
  planFees?: number;
  dueAmount?: number;
}
interface Payment { id: string; amount: number; paidOn: string }
interface Checkin { id: string; checkinAt: string; checkoutAt?: string }
interface AttendanceRecord {
  id: string;
  checkinAt: string;
  checkoutAt?: string;
  duration?: number;
  hours?: number;
  date: string;
}
interface AttendanceStatistics {
  totalSessions: number;
  completedSessions: number;
  incompleteSessions: number;
  totalHours: number;
  averageHours: number;
}
interface PlanHistoryRow { changedAt: string; fromPlan?: Plan | null; toPlan: Plan }
interface MembershipPeriod { 
  id: string; 
  startDate: string; 
  endDate: string; 
  planFees: number; 
  feesPaid: number; 
  dueAmount: number; 
  status: string; 
  periodType: string; 
  membershipPlan: Plan;
  payments: Payment[];
}

@Component({
  selector: 'app-member-detail',
  templateUrl: './member-detail.component.html',
  styleUrls: ['./member-detail.component.scss']
})
export class MemberDetailComponent implements OnInit {
  baseUrl = '/api';
  memberId!: string;
  member?: Member;
  payments: Payment[] = [];
  checkins: Checkin[] = [];
  attendanceRecords: AttendanceRecord[] = [];
  attendanceStatistics?: AttendanceStatistics;
  attendanceFilterType = 'month';
  attendanceFilters = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    startDate: '',
    endDate: ''
  };
  membershipRows: Array<{label: string; value: any}> = [];
  plans: Plan[] = [];
  planHistory: PlanHistoryRow[] = [];
  membershipPeriods: MembershipPeriod[] = [];
  
  constructor(
    private route: ActivatedRoute, 
    private http: HttpClient, 
    private dialog: MatDialog, 
    private snack: MatSnackBar,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.memberId = this.route.snapshot.paramMap.get('id') as string;
    this.load();
  }

  load() {
    this.http.get<Member>(`${this.baseUrl}/members/${this.memberId}`).subscribe(m => {
      this.member = m;
      this.membershipRows = [
        { label: 'Plan', value: m.membershipPlan?.name },
        { label: 'Status', value: m.status },
        { label: 'Expiry', value: m.endDate },
        { label: 'Plan Fees', value: m.planFees ?? '' },
        { label: 'Fees Paid', value: m.feesPaid },
        { label: 'Due Amount', value: m.dueAmount ?? '' },
      ];
    });
    // Get payments history in descending order (newest first)
    this.http.get<Payment[]>(`${this.baseUrl}/payments/${this.memberId}?sort=desc`).subscribe(p => this.payments = p);
    this.http.get<Checkin[]>(`${this.baseUrl}/checkins/${this.memberId}/history`).subscribe(c => this.checkins = c);
    this.http.get<Plan[]>(`${this.baseUrl}/plans`).subscribe(pl => this.plans = pl);
    this.http.get<PlanHistoryRow[]>(`${this.baseUrl}/members/${this.memberId}/plan-history`).subscribe(h => this.planHistory = h);
    this.http.get<MembershipPeriod[]>(`${this.baseUrl}/members/${this.memberId}/membership-periods`).subscribe(periods => this.membershipPeriods = periods);
    this.loadAttendanceHistory();
  }

  checkIn() { this.http.post(`${this.baseUrl}/checkins/${this.memberId}/checkin`, {}).subscribe(() => { this.snack.open('Checked in', 'Close', { duration: 1500 }); this.load(); }); }
  checkOut() { this.http.post(`${this.baseUrl}/checkins/${this.memberId}/checkout`, {}).subscribe(() => { this.snack.open('Checked out', 'Close', { duration: 1500 }); this.load(); }); }

  loadAttendanceHistory() {
    let params = '';
    if (this.attendanceFilterType === 'month') {
      params = `?month=${this.attendanceFilters.month}&year=${this.attendanceFilters.year}`;
    } else if (this.attendanceFilterType === 'range' && this.attendanceFilters.startDate && this.attendanceFilters.endDate) {
      params = `?startDate=${this.attendanceFilters.startDate}&endDate=${this.attendanceFilters.endDate}`;
    }
    
    this.http.get<{records: AttendanceRecord[], statistics: AttendanceStatistics}>(`${this.baseUrl}/checkins/${this.memberId}/attendance-history${params}`)
      .subscribe(response => {
        this.attendanceRecords = response.records;
        this.attendanceStatistics = response.statistics;
      });
  }

  onAttendanceFilterChange() {
    this.loadAttendanceHistory();
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString();
  }

  calculateDuration(checkinStr: string, checkoutStr: string): string {
    const checkin = new Date(checkinStr);
    const checkout = new Date(checkoutStr);
    const diffMs = checkout.getTime() - checkin.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  exportAttendanceData() {
    if (!this.attendanceRecords || this.attendanceRecords.length === 0) {
      this.snack.open('No data to export', 'Close', { duration: 3000 });
      return;
    }
    
    const csvContent = this.generateCSV(this.attendanceRecords);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    // Create a download link and trigger it
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    
    // Generate filename with member name and date range
    const memberName = this.member?.name?.replace(/\s+/g, '_') || 'member';
    const now = new Date();
    const filename = `${memberName}_attendance_${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}.csv`;
    a.setAttribute('download', filename);
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    this.snack.open('Export successful', 'Close', { duration: 3000 });
  }

  private generateCSV(data: AttendanceRecord[]): string {
    const headers = ['Date', 'Check-in Time', 'Check-out Time', 'Duration (mins)', 'Hours'];
    const csvRows = [headers.join(',')];

    for (const record of data) {
      const row = [
        record.date,
        this.formatTime(record.checkinAt),
        record.checkoutAt ? this.formatTime(record.checkoutAt) : 'Not checked out',
        record.duration !== null && record.duration !== undefined ? record.duration.toString() : 'N/A',
        record.hours !== null && record.hours !== undefined ? record.hours.toString() : 'N/A'
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  goBack() {
    this.location.back();
  }
  addPayment() {
    const dueAmount = this.member?.dueAmount || 0;
    this.dialog.open(AddPaymentDialog, { data: { memberId: this.memberId, dueAmount }, width: '420px', maxWidth: '95vw' })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  openEdit() {
    if (!this.member) return;
    this.dialog.open(EditMemberDialog, { data: { member: this.member, plans: this.plans }, width: '700px', maxWidth: '95vw' }).afterClosed().subscribe(updated => {
      if (updated) this.load();
    });
  }

  getPeriodTabLabel(period: MembershipPeriod, index: number): string {
    const periodType = period.periodType === 'initial' ? 'Initial' : 
                      period.periodType === 'renewal' ? 'Renewal' : 
                      period.periodType === 'plan_switch' ? 'Plan Switch' : 'Period';
    const planName = period.membershipPlan.name;
    return `${periodType} - ${planName}`;
  }

  getDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
}

@Component({
  selector: 'app-edit-member-dialog',
  template: `
  <h3 mat-dialog-title>
    {{ isPlanSwitch ? 'Switch Plan' : 'Renew Membership' }}
    <span *ngIf="isPlanSwitch" class="badge bg-info text-white ms-2">Plan Switch</span>
    <span *ngIf="isRenewal" class="badge bg-success text-white ms-2">Renewal</span>
  </h3>
  <form [formGroup]="form" (ngSubmit)="save()" mat-dialog-content>
    <div class="row g-2">
      <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
      </div>
      <div class="col-md-3">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Age</mat-label>
          <input matInput type="number" formControlName="age" />
        </mat-form-field>
      </div>
      <div class="col-md-3">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Fees Paid (Read Only)</mat-label>
          <input matInput type="number" formControlName="feesPaid" readonly />
        </mat-form-field>
      </div>
      <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Phone</mat-label>
          <input matInput formControlName="phone" />
        </mat-form-field>
      </div>
      <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
      </div>

      <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Current Plan</mat-label>
          <input matInput formControlName="currentPlan" readonly disabled />
        </mat-form-field>
      </div>
    
      <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Start Date</mat-label>
          <input matInput [matDatepicker]="startPicker" formControlName="startDate" />
          <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>
      </div>
      <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>End Date</mat-label>
          <input matInput [matDatepicker]="endPicker" formControlName="endDate" />
          <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>
      </div>


        <div class="col-md-6">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Membership Plan</mat-label>
          <mat-select formControlName="membershipPlanId">
            <mat-option *ngFor="let plan of plans" [value]="plan.id">
              {{plan.name}}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <div class="small" [class.text-danger]="dueAmount > 0" [class.text-muted]="dueAmount === 0">
          <strong>Selected Plan Price:</strong> ₹{{ planPrice }} | 
          <strong>Current Due Amount:</strong> ₹{{ dueAmount }}
          <span *ngIf="dueAmount > 0" class="badge bg-warning text-dark ms-2">Payment Required</span>
        </div>
        <div *ngIf="dueAmount > 0" class="alert alert-warning mt-2 small">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>Note:</strong> You cannot change plans until the current due amount (₹{{ dueAmount }}) is cleared. 
          Please add a payment first to clear the outstanding balance.
        </div>
        <div *ngIf="dueAmount === 0 && form.value.membershipPlanId !== data.member.membershipPlan?.id" class="alert alert-info mt-2 small">
          <i class="fas fa-info-circle"></i>
          <strong>Plan Switch:</strong> You can switch to this plan. The new plan will start fresh with its own fees.
        </div>
        <div *ngIf="isRenewal && (form.value.startDate || form.value.endDate)" class="alert alert-warning mt-2 small">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>Renewal Notice:</strong> This will reset the fees paid to ₹0 and start fresh accounting for the new period. 
          Previous payment history will be preserved for audit purposes.
        </div>
      </div>
    </div>
  </form>
  <div mat-dialog-actions align="end">
    <button mat-button mat-dialog-close>Cancel</button>
    <button mat-raised-button color="primary" (click)="save()" [disabled]="dueAmount > 0">
      {{ isPlanSwitch ? 'Switch Plan' : 'Renew Membership' }}
    </button>
  </div>
  `
})
export class EditMemberDialog {
  baseUrl = '/api';
  form = this.fb.group({
    name: ['',[Validators.required]],
    age: [0,[Validators.required]],
    phone: [''],
    email: [''],
    currentPlan: [''],
    startDate: [null as unknown as Date,[Validators.required]],
    endDate: [null as unknown as Date,[Validators.required]],
    feesPaid: [0],
    membershipPlanId: ['']
  });
  plans: Plan[] = [];
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { member: Member; plans: Plan[] },
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditMemberDialog>,
    private snack: MatSnackBar,
  ) {
    const m = data.member;
    this.plans = data.plans || [];
    this.form.patchValue({
      name: m.name,
      age: m.age,
      phone: m.phone,
      email: m.email,
      currentPlan: m.membershipPlan?.name || '',
      startDate: new Date(m.startDate),
      endDate: new Date(m.endDate),
      feesPaid: m.feesPaid as number,
      membershipPlanId: m.membershipPlan?.id || ''
    });
  }

  get selectedPlan(): Plan | undefined {
    const id = this.form.value.membershipPlanId as string;
    return this.plans.find(p => p.id === id);
  }

  get planPrice(): number {
    return Number(this.selectedPlan?.fees ?? 0);
  }

  get isPlanSwitch(): boolean {
    const selectedPlanId = this.form.value.membershipPlanId as string;
    const currentPlanId = this.data.member.membershipPlan?.id;
    return selectedPlanId !== currentPlanId;
  }

  get isRenewal(): boolean {
    return !this.isPlanSwitch;
  }

  get dueAmount(): number {
    const paid = Number(this.form.value.feesPaid || 0);
    const currentPlanFees = Number(this.data.member.membershipPlan?.fees ?? 0);
    
    if (this.isRenewal) {
      // Same plan - this is a renewal, calculate based on current plan
      return Math.max(0, currentPlanFees - paid);
    } else {
      // Different plan - this is a plan switch
      // Show current plan dues (should be 0 if switching is allowed)
      const currentDues = Math.max(0, currentPlanFees - paid);
      return currentDues; // Backend will prevent switching if currentDues > 0
    }
  }
  save() {
    if (this.form.invalid) return;
    let v = this.form.value;
    console.log(v);
    v.feesPaid = Number(v.feesPaid);
    delete v.currentPlan;
    const payload = {
      ...v,
      startDate: this.toDateString(v.startDate),
      endDate: this.toDateString(v.endDate),
    };
    this.http.put(`${this.baseUrl}/members/${this.data.member.id}`, payload).subscribe(() => { this.snack.open('Member updated', 'Close', { duration: 1500 }); this.dialogRef.close(true); });
  }

  private toDateString(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

@Component({
  selector: 'app-add-payment-dialog',
  template: `
  <h3 mat-dialog-title>
    Add Payment
    <span *ngIf="data.dueAmount > 0" class="badge bg-warning text-dark ms-2">Due: ₹{{ data.dueAmount }}</span>
  </h3>
  <form [formGroup]="form" (ngSubmit)="save()" mat-dialog-content>
      <mat-form-field appearance="outline" class="w-100 mb-3">
        <mat-label>Amount</mat-label>
        <input matInput type="number" formControlName="amount" />
        <mat-hint *ngIf="data.dueAmount > 0">Due amount: ₹{{ data.dueAmount }} (pre-filled)</mat-hint>
        <mat-hint *ngIf="data.dueAmount === 0">Enter the payment amount</mat-hint>
      </mat-form-field>
    <mat-form-field appearance="outline" class="w-100 mb-3">
      <mat-label>Method</mat-label>
      <mat-select formControlName="method">
        <mat-option value="cash">Cash</mat-option>
        <mat-option value="digital">Digital</mat-option>
      </mat-select>
    </mat-form-field>
    <mat-form-field appearance="outline" class="w-100">
      <mat-label>Paid On</mat-label>
      <input matInput [matDatepicker]="pkr" formControlName="paidOn" />
      <mat-datepicker-toggle matSuffix [for]="pkr"></mat-datepicker-toggle>
      <mat-datepicker #pkr></mat-datepicker>
    </mat-form-field>
  </form>
  <div mat-dialog-actions align="end">
    <button mat-button mat-dialog-close>Cancel</button>
    <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid">Save</button>
  </div>
  `
})
export class AddPaymentDialog {
  baseUrl = '/api';
  form = this.fb.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    method: ['cash', [Validators.required]],
    paidOn: [new Date(), [Validators.required]],
  });
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { memberId: string; dueAmount: number },
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<AddPaymentDialog>,
  ) {
    // Set default amount to due amount if applicable
    if (this.data.dueAmount > 0) {
      this.form.patchValue({ amount: this.data.dueAmount });
    }
  }

  private toDateString(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.value as any;
    const payload = { amount: Number(v.amount), paidOn: this.toDateString(v.paidOn), method: v.method };
    this.http.post(`${this.baseUrl}/payments/${this.data.memberId}`, payload)
      .subscribe(() => this.dialogRef.close(true));
  }
}
