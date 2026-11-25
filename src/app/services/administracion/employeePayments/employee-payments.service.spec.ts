import { TestBed } from '@angular/core/testing';

import { EmployeePaymentsService } from './employee-payments.service';

describe('EmployeePaymentsService', () => {
  let service: EmployeePaymentsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmployeePaymentsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
