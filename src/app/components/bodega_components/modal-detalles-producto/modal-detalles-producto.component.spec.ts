import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalDetallesProductoComponent } from './modal-detalles-producto.component';

describe('ModalDetallesProductoComponent', () => {
  let component: ModalDetallesProductoComponent;
  let fixture: ComponentFixture<ModalDetallesProductoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalDetallesProductoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalDetallesProductoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
