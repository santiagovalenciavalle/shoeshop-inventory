import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentasCreditoComponent } from './ventas-credito.component';

describe('VentasCreditoComponent', () => {
  let component: VentasCreditoComponent;
  let fixture: ComponentFixture<VentasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentasCreditoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentasCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
