import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface LoaderState {
  isLoading: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loaderSubject = new BehaviorSubject<LoaderState>({ isLoading: false });
  private activeRequests = 0;
  private timeoutIds: { [key: string]: any } = {};

  constructor() {}

  /**
   * Get the loader state as an observable
   */
  getLoaderState(): Observable<LoaderState> {
    return this.loaderSubject.asObservable();
  }

  /**
   * Show the loader
   * @param message Optional message to display
   * @param timeout Optional timeout to automatically hide the loader (in ms)
   * @param requestId Optional request ID for tracking specific requests
   */
  show(message?: string, timeout?: number, requestId?: string): void {
    this.activeRequests++;
    
    this.loaderSubject.next({
      isLoading: true,
      message: message || this.loaderSubject.value.message
    });

    // Set timeout to automatically hide the loader
    if (timeout && requestId) {
      this.clearTimeout(requestId);
      this.timeoutIds[requestId] = setTimeout(() => {
        this.hide(requestId);
      }, timeout);
    }
  }

  /**
   * Hide the loader
   * @param requestId Optional request ID for tracking specific requests
   */
  hide(requestId?: string): void {
    if (requestId) {
      this.clearTimeout(requestId);
    }

    this.activeRequests = Math.max(0, this.activeRequests - 1);
    
    if (this.activeRequests === 0) {
      this.loaderSubject.next({
        isLoading: false,
        message: ''
      });
    }
  }

  /**
   * Clear all loaders
   */
  clearAll(): void {
    // Clear all timeouts
    Object.keys(this.timeoutIds).forEach(key => {
      this.clearTimeout(key);
    });
    
    this.activeRequests = 0;
    this.loaderSubject.next({
      isLoading: false,
      message: ''
    });
  }

  /**
   * Clear a specific timeout
   * @param requestId The request ID
   */
  private clearTimeout(requestId: string): void {
    if (this.timeoutIds[requestId]) {
      clearTimeout(this.timeoutIds[requestId]);
      delete this.timeoutIds[requestId];
    }
  }
}
