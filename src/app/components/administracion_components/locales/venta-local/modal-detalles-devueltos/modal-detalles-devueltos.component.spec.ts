import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalDetallesDevueltosComponent } from './modal-detalles-devueltos.component';

describe('ModalDetallesDevueltosComponent', () => {
  let component: ModalDetallesDevueltosComponent;
  let fixture: ComponentFixture<ModalDetallesDevueltosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalDetallesDevueltosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalDetallesDevueltosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
