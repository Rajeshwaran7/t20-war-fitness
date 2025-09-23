import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-test-auth',
  template: `
    <div class="container mt-4">
      <h3>API Authentication Test</h3>
      
      <div class="row mt-4">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header bg-primary text-white">
              Test Endpoints
            </div>
            <div class="card-body">
              <button mat-raised-button color="primary" (click)="testMembersApi()" class="me-2">
                Test Members API
              </button>
              
              <button mat-raised-button color="accent" (click)="testCheckinsApi()" class="me-2">
                Test Checkins API
              </button>
              
              <button mat-raised-button color="warn" (click)="testHistoryApi()">
                Test History API
              </button>
            </div>
          </div>
        </div>
        
        <div class="col-md-6">
          <div class="card">
            <div class="card-header bg-info text-white">
              Results
            </div>
            <div class="card-body">
              <pre>{{ results }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TestAuthComponent implements OnInit {
  baseUrl = '/api';
  results = 'No tests run yet';

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Check if auth token exists
    const token = localStorage.getItem('t20_token');
    this.results = `Auth token exists: ${!!token}\n`;
    if (token) {
      this.results += `Token prefix: ${token.substring(0, 15)}...\n`;
    }
  }

  testMembersApi(): void {
    this.results = 'Testing Members API...\n';
    this.http.get(`${this.baseUrl}/members?limit=1`).subscribe({
      next: (response) => {
        this.results += `SUCCESS: Members API returned data\n${JSON.stringify(response, null, 2).substring(0, 300)}...\n`;
        this.snackBar.open('Members API test successful', 'Close', { duration: 3000 });
      },
      error: (error) => {
        this.results += `ERROR: ${error.status} ${error.statusText}\n${JSON.stringify(error, null, 2)}\n`;
        this.snackBar.open(`Members API error: ${error.status}`, 'Close', { duration: 3000 });
      }
    });
  }

  testCheckinsApi(): void {
    this.results = 'Testing Checkins API...\n';
    this.http.get(`${this.baseUrl}/checkins`).subscribe({
      next: (response) => {
        this.results += `SUCCESS: Checkins API returned data\n${JSON.stringify(response, null, 2).substring(0, 300)}...\n`;
        this.snackBar.open('Checkins API test successful', 'Close', { duration: 3000 });
      },
      error: (error) => {
        this.results += `ERROR: ${error.status} ${error.statusText}\n${JSON.stringify(error, null, 2)}\n`;
        this.snackBar.open(`Checkins API error: ${error.status}`, 'Close', { duration: 3000 });
      }
    });
  }

  testHistoryApi(): void {
    this.results = 'Testing History API...\n';
    
    // First, log the auth token
    const token = localStorage.getItem('t20_token');
    this.results += `Auth token for history request: ${token ? 'exists' : 'missing'}\n`;
    
    // Test with direct headers
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    this.results += `Using headers: ${JSON.stringify(headers)}\n`;
    
    // Test the authenticated endpoint
    this.http.get(`${this.baseUrl}/checkins/history?page=1&limit=10`, { headers }).subscribe({
      next: (response) => {
        this.results += `SUCCESS: Auth History API returned data\n${JSON.stringify(response, null, 2).substring(0, 300)}...\n`;
        this.snackBar.open('Auth History API test successful', 'Close', { duration: 3000 });
      },
      error: (error) => {
        this.results += `ERROR (Auth): ${error.status} ${error.statusText}\n${JSON.stringify(error.error, null, 2)}\n`;
        
        // If the authenticated endpoint fails, try the public one
        this.results += `\nTrying public endpoint instead...\n`;
        this.http.get(`${this.baseUrl}/public/checkins/history?page=1&limit=10`).subscribe({
          next: (response) => {
            this.results += `SUCCESS: Public History API returned data\n${JSON.stringify(response, null, 2).substring(0, 300)}...\n`;
            this.snackBar.open('Public History API test successful', 'Close', { duration: 3000 });
          },
          error: (error) => {
            this.results += `ERROR (Public): ${error.status} ${error.statusText}\n${JSON.stringify(error.error, null, 2)}\n`;
            this.snackBar.open(`Public History API error: ${error.status}`, 'Close', { duration: 3000 });
          }
        });
      }
    });
  }
}
