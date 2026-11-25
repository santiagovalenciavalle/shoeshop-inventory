import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private previousUrl: string = '/home';

  setPreviousUrl(url: string): void {
    this.previousUrl = url;
  }

  getPreviousUrl(): string | null {
    return this.previousUrl;
  }
}
