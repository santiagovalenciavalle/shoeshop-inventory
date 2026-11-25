import { TestBed } from '@angular/core/testing';

import { SinActivacionService } from './sin-activacion.service';

describe('SinActivacionService', () => {
  let service: SinActivacionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SinActivacionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
