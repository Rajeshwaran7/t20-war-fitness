import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AttendanceService } from '../attendance.service';

@Component({
  selector: 'app-public-check-in',
  templateUrl: './public-check-in.component.html',
  styleUrls: ['./public-check-in.component.scss']
})
export class PublicCheckInComponent implements OnInit {
  form: FormGroup;
  loading = false;
  memberFound = false;
  memberName = '';
  memberId = '';
  memberDisplayId = '';
  memberStatus = '';
  isCheckedIn = false;
  currentCheckin: any = null;
  recentActivity: any[] = [];
  
  constructor(
    private fb: FormBuilder,
    private attendanceService: AttendanceService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      identifier: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Initialize the component
  }

  resetForm(): void {
    this.form.reset();
    this.memberFound = false;
    this.memberName = '';
    this.memberId = '';
    this.memberDisplayId = '';
    this.memberStatus = '';
    this.isCheckedIn = false;
    this.currentCheckin = null;
    this.recentActivity = [];
  }

  verifyMember(): void {
    if (this.form.invalid) {
      return;
    }

    this.loading = true;
    const identifier = this.form.get('identifier')?.value;
    console.log('Verifying member with identifier:', identifier);

    this.attendanceService.verifyMember(identifier).subscribe({
      next: (response) => {
        console.log('Verify member response:', response);
        this.loading = false;
        if (response.success) {
          this.memberFound = true;
          this.memberName = response.member.name;
          this.memberId = response.member.id;
          this.memberDisplayId = response.member.memberId || response.member.id;
          this.memberStatus = response.member.status;
          this.isCheckedIn = response.member.isCheckedIn || false;
          this.currentCheckin = response.member.currentCheckin || null;
          this.recentActivity = response.member.recentActivity || [];
        } else {
          this.snackBar.open('Member not found. Please check your ID/phone/email/name.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('Error verifying member:', error);
        this.loading = false;
        this.snackBar.open('Error verifying member: ' + (error.error?.message || error.message || 'Unknown error'), 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  checkIn(): void {
    if (!this.memberFound) {
      return;
    }

    this.loading = true;
    const identifier = this.form.get('identifier')?.value;

    this.attendanceService.publicCheckIn(identifier).subscribe({
      next: (response) => {
        this.loading = false;
        this.isCheckedIn = true;
        this.currentCheckin = response;
        this.snackBar.open(`Welcome, ${this.memberName}! You've been checked in successfully.`, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        // Refresh member data to get updated status
        this.verifyMember();
        
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open('Error checking in: ' + (error.error?.message || error.message || 'Unknown error'), 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  checkOut(): void {
    if (!this.memberFound) {
      return;
    }

    this.loading = true;
    const identifier = this.form.get('identifier')?.value;

    this.attendanceService.publicCheckOut(identifier).subscribe({
      next: (response) => {
        this.loading = false;
        this.isCheckedIn = false;
        this.currentCheckin = null;
        this.snackBar.open(`Goodbye, ${this.memberName}! You've been checked out successfully.`, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        // Refresh member data to get updated status
        this.verifyMember();
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open('Error checking out: ' + (error.error?.message || error.message || 'Unknown error'), 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  getStatusIcon(): string {
    switch (this.memberStatus) {
      case 'active': return 'check_circle';
      case 'expired': return 'cancel';
      case 'soon_to_expire': return 'warning';
      default: return 'help';
    }
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString();
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
  
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
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
}
