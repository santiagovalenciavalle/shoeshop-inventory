import { TestBed } from '@angular/core/testing';

import { LlegadasService } from './llegadas.service';

describe('LlegadasService', () => {
  let service: LlegadasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LlegadasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
