import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { LoaderService } from './shared/services/loader.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'frontend';
  isLoading = false;
  loaderMessage = '';
  private loaderSubscription: Subscription | null = null;

  constructor(
    public auth: AuthService,
    private loaderService: LoaderService
  ) {}

  ngOnInit(): void {
    // Subscribe to loader state changes
    this.loaderSubscription = this.loaderService.getLoaderState().subscribe(state => {
      this.isLoading = state.isLoading;
      this.loaderMessage = state.message || '';
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.loaderSubscription) {
      this.loaderSubscription.unsubscribe();
    }
  }

  logout() { 
    this.auth.logout(); 
  }
}
