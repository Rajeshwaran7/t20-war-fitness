import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpResponse
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable()
export class DebugInterceptor implements HttpInterceptor {
  constructor() {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Log the request URL and headers
    console.log(`🔍 DEBUG REQUEST: ${request.method} ${request.url}`);
    console.log('🔑 Headers:', request.headers.keys().map(key => `${key}: ${request.headers.get(key)}`));
    
    // Check specifically for Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      console.log('✅ Auth header present:', authHeader);
    } else {
      console.log('❌ No Auth header found!');
    }

    return next.handle(request).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          console.log(`🔍 DEBUG RESPONSE: ${request.method} ${request.url}`);
          console.log('📋 Status:', event.status);
        }
      })
    );
  }
}
