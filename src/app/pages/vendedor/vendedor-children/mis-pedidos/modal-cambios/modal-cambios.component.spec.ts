import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalCambiosComponent } from './modal-cambios.component';

describe('ModalCambiosComponent', () => {
  let component: ModalCambiosComponent;
  let fixture: ComponentFixture<ModalCambiosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalCambiosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalCambiosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
