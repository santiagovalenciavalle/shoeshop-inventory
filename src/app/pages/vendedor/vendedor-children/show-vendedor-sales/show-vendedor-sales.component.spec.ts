import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowVendedorSalesComponent } from './show-vendedor-sales.component';

describe('ShowVendedorSalesComponent', () => {
  let component: ShowVendedorSalesComponent;
  let fixture: ComponentFixture<ShowVendedorSalesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowVendedorSalesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowVendedorSalesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
