import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalEnviarExhibicionComponent } from './modal-enviar-exhibicion.component';

describe('ModalEnviarExhibicionComponent', () => {
  let component: ModalEnviarExhibicionComponent;
  let fixture: ComponentFixture<ModalEnviarExhibicionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalEnviarExhibicionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalEnviarExhibicionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
