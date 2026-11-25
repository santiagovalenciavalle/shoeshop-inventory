import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroprestamosComponent } from './registroprestamos.component';

describe('RegistroprestamosComponent', () => {
  let component: RegistroprestamosComponent;
  let fixture: ComponentFixture<RegistroprestamosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroprestamosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroprestamosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
