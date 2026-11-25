import { TestBed } from '@angular/core/testing';

import { PrinterTemplateService } from './printer-template.service';

describe('PrinterTemplateService', () => {
  let service: PrinterTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrinterTemplateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
