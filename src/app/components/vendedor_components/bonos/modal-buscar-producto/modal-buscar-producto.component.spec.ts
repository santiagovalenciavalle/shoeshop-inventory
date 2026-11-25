import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalBuscarProductoComponent } from './modal-buscar-producto.component';

describe('ModalBuscarProductoComponent', () => {
  let component: ModalBuscarProductoComponent;
  let fixture: ComponentFixture<ModalBuscarProductoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalBuscarProductoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalBuscarProductoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
