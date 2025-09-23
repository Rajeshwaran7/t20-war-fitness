import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

interface MembershipPlan { id: string; name: string; fees?: number; }
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
  balanceDays: number;
  status: 'active' | 'expired' | 'soon_to_expire';
  membershipPlan: MembershipPlan;
  planFees?: number;
  dueAmount?: number;
}

@Component({
  selector: 'app-members',
  templateUrl: './members.component.html',
  styleUrls: ['./members.component.scss']
})
export class MembersComponent implements OnInit {
  baseUrl = '/api';
  displayedColumns = ['memberId','name','plan','status','endDate','feesPaid','planFees','dueAmount','actions'];
  page = 1;
  pageSize = 10;
  total = 0;
  data: Member[] = [];
  loading = false;
  plans: MembershipPlan[] = [];
  showAdd = false;
  searchQuery = '';
  selectedStatus = '';

  form = this.fb.group({
    name: ['', Validators.required],
    age: [18, [Validators.required]],
    phone: [''],
    email: [''],
    startDate: [null as unknown as Date, Validators.required],
    endDate: [null as unknown as Date, Validators.required],
    feesPaid: [0],
    membershipPlanId: ['', Validators.required]
  });

  constructor(private http: HttpClient, private fb: FormBuilder, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadMembers();
    this.http.get<MembershipPlan[]>(`${this.baseUrl}/plans`).subscribe(plans => this.plans = plans);
  }

  loadMembers(page = 1, limit = this.pageSize, q?: string, status?: string) {
    this.loading = true;
    
    // Store search parameters
    if (q !== undefined) this.searchQuery = q;
    if (status !== undefined) this.selectedStatus = status;
    
    const params: any = { 
      page, 
      limit 
    };
    
    if (this.searchQuery) { 
      params.name = this.searchQuery; 
      params.email = this.searchQuery; 
      params.phone = this.searchQuery; 
      params.id = this.searchQuery;
      params.memberId = this.searchQuery;
    }
    
    if (this.selectedStatus) {
      params.status = this.selectedStatus;
    }
    
    this.http.get<any>(`${this.baseUrl}/members`, { params }).subscribe({
      next: (res) => { 
        this.data = res.data || res; 
        this.total = res.total || this.data.length; 
        this.page = res.page || page;
        this.pageSize = limit; 
        this.loading = false; 
      },
      error: () => { 
        this.loading = false; 
      }
    });
  }
  
  onPageChange(event: any) {
    const page = event.pageIndex + 1;
    const limit = event.pageSize;
    this.loadMembers(page, limit);
  }
  
  clearSearch() {
    this.searchQuery = '';
    this.loadMembers(1);
  }
  
  applyFilters() {
    this.loadMembers(1, this.pageSize, this.searchQuery, this.selectedStatus);
  }

  toggleAdd() { this.showAdd = !this.showAdd; }
  openAddDialog() {
    this.dialog.open(AddMemberDialog, { data: { plans: this.plans }, width: '700px', maxWidth: '95vw' }).afterClosed().subscribe(ok => { if (ok) this.loadMembers(); });
  }

  private toDateString(d: Date | null | undefined): string | null {
    if (!d) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  addMember() {
    if (this.form.invalid) return;
    const v = this.form.value as any;
    const payload = {
      ...v,
      startDate: this.toDateString(v.startDate) as string,
      endDate: this.toDateString(v.endDate) as string,
    };
    this.http.post(`${this.baseUrl}/members`, payload).subscribe({
      next: () => { this.showAdd = false; this.form.reset(); this.loadMembers(); },
      error: () => {}
    });
  }

  viewMember(m: Member) {
    this.dialog.open(MemberQuickViewDialog, { data: m, width: '600px', maxWidth: '95vw' });
  }
}

import { Inject } from '@angular/core';

@Component({
  selector: 'app-member-quick-view',
  template: `
  <h3 mat-dialog-title>{{ data.name }}</h3>
  <div mat-dialog-content>
    <div class="row">
      <div class="col-6"><strong>Plan</strong><div>{{ data.membershipPlan?.name }}</div></div>
      <div class="col-6"><strong>Status</strong><div>{{ data.status }}</div></div>
      <div class="col-6 mt-2"><strong>Expiry</strong><div>{{ data.endDate }}</div></div>
      <div class="col-6 mt-2"><strong>Balance Days</strong><div>{{ data.balanceDays }}</div></div>
      <div class="col-6 mt-2"><strong>Phone</strong><div>{{ data.phone || '-' }}</div></div>
      <div class="col-6 mt-2"><strong>Email</strong><div>{{ data.email || '-' }}</div></div>
    </div>
  </div>
  <div mat-dialog-actions align="end">
    <a mat-stroked-button color="primary" [routerLink]="['/member', data.id]" mat-dialog-close>Open Profile</a>
    <button mat-button mat-dialog-close>Close</button>
  </div>
  `
})
export class MemberQuickViewDialog { constructor(@Inject(MAT_DIALOG_DATA) public data: Member) {} }

@Component({
  selector: 'app-add-member-dialog',
  template: `
  <h3 mat-dialog-title>Add Member</h3>
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
          <mat-label>Fees Paid</mat-label>
          <input matInput type="number" formControlName="feesPaid" />
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
      <div class="col-md-4">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Start Date</mat-label>
          <input matInput [matDatepicker]="startPicker" formControlName="startDate" />
          <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>
      </div>
      <div class="col-md-4">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>End Date</mat-label>
          <input matInput [matDatepicker]="endPicker" formControlName="endDate" />
          <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>
      </div>
      <div class="col-md-4">
        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Membership Plan</mat-label>
          <mat-select formControlName="membershipPlanId">
            <mat-option *ngFor="let p of plans" [value]="p.id">{{ p.name }}</mat-option>
          </mat-select>
        </mat-form-field>
        <div class="small text-muted">
          Plan Price: {{ planPrice }} | Due: {{ dueAmount }}
        </div>
      </div>
    </div>
  </form>
  <div mat-dialog-actions align="end">
    <button mat-button mat-dialog-close>Cancel</button>
    <button mat-raised-button color="primary" (click)="save()">Save</button>
  </div>
  `
})
export class AddMemberDialog {
  baseUrl = '/api';
  plans: MembershipPlan[] = [];
  form = this.fb.group({
    name: ['', Validators.required],
    age: [18, Validators.required],
    phone: [''],
    email: [''],
    startDate: [null as unknown as Date, Validators.required],
    endDate: [null as unknown as Date, Validators.required],
    feesPaid: [0],
    membershipPlanId: ['', Validators.required]
  });
  constructor(@Inject(MAT_DIALOG_DATA) data: any, private fb: FormBuilder, private http: HttpClient, private dialogRef: MatDialogRef<AddMemberDialog>) {
    this.plans = data?.plans || [];
  }
  get selectedPlan(): MembershipPlan | undefined {
    const id = this.form.value.membershipPlanId as string;
    return this.plans.find(p => p.id === id);
  }
  get planPrice(): number {
    return Number(this.selectedPlan?.fees ?? 0);
  }
  get dueAmount(): number {
    const paid = Number(this.form.value.feesPaid || 0);
    return Math.max(0, this.planPrice - paid);
  }
  private toDateString(d: Date): string { const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
  save() {
    if (this.form.invalid) return;
    const v = this.form.value as any;
    const payload = { ...v, startDate: this.toDateString(v.startDate), endDate: this.toDateString(v.endDate), feesPaid: parseInt(v.feesPaid, 10) || 0 };
    this.http.post(`${this.baseUrl}/members`, payload).subscribe(() => this.dialogRef.close(true));
  }
}
