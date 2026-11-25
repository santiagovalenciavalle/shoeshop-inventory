import { TestBed } from '@angular/core/testing';

import { BluetoothPrinterService } from './bluetooth-printer.service';

describe('BluetoothPrinterService', () => {
  let service: BluetoothPrinterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BluetoothPrinterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
