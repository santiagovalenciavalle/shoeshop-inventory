import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddNumeracionComponent } from './add-numeracion.component';

describe('AddNumeracionComponent', () => {
  let component: AddNumeracionComponent;
  let fixture: ComponentFixture<AddNumeracionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddNumeracionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddNumeracionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
