import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrestamosPropiosComponent } from './prestamos-propios.component';

describe('PrestamosPropiosComponent', () => {
  let component: PrestamosPropiosComponent;
  let fixture: ComponentFixture<PrestamosPropiosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrestamosPropiosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrestamosPropiosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
