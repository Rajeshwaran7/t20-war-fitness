import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { LoaderService } from '../services/loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  constructor(private loaderService: LoaderService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Generate a unique request ID
    const requestId = this.generateRequestId();
    
    // Skip loader for specific requests if needed
    if (this.shouldSkipLoader(request)) {
      return next.handle(request);
    }

    // Important: Do not clone the request here, as it might overwrite the auth token
    // from the AuthInterceptor. We're only showing/hiding the loader.
    
    // Show loader with a timeout of 30 seconds (to handle hanging requests)
    this.loaderService.show(undefined, 30000, requestId);

    return next.handle(request).pipe(
      map((event: HttpEvent<any>) => {
        return event;
      }),
      catchError((error: HttpErrorResponse) => {
        // Handle error if needed
        return throwError(() => error);
      }),
      finalize(() => {
        // Hide loader when request completes (success or error)
        this.loaderService.hide(requestId);
      })
    );
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * Check if loader should be skipped for this request
   * @param request The HTTP request
   */
  private shouldSkipLoader(request: HttpRequest<unknown>): boolean {
    // Skip loader for specific endpoints if needed
    const skipUrls = [
      // Add URLs to skip here
      // Example: '/api/health-check'
    ];

    return skipUrls.some(url => request.url.includes(url));
  }
}
