import { TestBed } from '@angular/core/testing';

import { HistorialBodegaService } from './historial-bodega.service';

describe('HistorialBodegaService', () => {
  let service: HistorialBodegaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HistorialBodegaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
