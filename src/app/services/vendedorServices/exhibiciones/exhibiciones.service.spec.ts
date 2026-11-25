import { TestBed } from '@angular/core/testing';

import { ExhibicionesService } from './exhibiciones.service';

describe('ExhibicionesService', () => {
  let service: ExhibicionesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExhibicionesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
