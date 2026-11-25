import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalBonoComponent } from './modal-bono.component';

describe('ModalBonoComponent', () => {
  let component: ModalBonoComponent;
  let fixture: ComponentFixture<ModalBonoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalBonoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalBonoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
