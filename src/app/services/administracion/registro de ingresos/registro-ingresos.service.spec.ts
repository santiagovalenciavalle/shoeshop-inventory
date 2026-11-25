import { TestBed } from '@angular/core/testing';

import { RegistroIngresosService } from './registro-ingresos.service';

describe('RegistroIngresosService', () => {
  let service: RegistroIngresosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RegistroIngresosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
