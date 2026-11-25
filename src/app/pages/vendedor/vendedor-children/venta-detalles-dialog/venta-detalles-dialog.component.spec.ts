import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentaDetallesDialogComponent } from './venta-detalles-dialog.component';

describe('VentaDetallesDialogComponent', () => {
  let component: VentaDetallesDialogComponent;
  let fixture: ComponentFixture<VentaDetallesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentaDetallesDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentaDetallesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
