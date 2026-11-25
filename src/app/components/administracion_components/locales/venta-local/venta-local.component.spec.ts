import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentaLocalComponent } from './venta-local.component';

describe('VentaLocalComponent', () => {
  let component: VentaLocalComponent;
  let fixture: ComponentFixture<VentaLocalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentaLocalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentaLocalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
