import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VisibilityService {
  private _reconectando = new BehaviorSubject<boolean>(false);

  readonly reconectando$ = this._reconectando.asObservable();

  marcarReconectando(): void {
    this._reconectando.next(true);
  }

  marcarListo(): void {
    this._reconectando.next(false);
  }

  get estaReconectando(): boolean {
    return this._reconectando.getValue();
  }
}
