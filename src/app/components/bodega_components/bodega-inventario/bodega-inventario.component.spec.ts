import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BodegaInventarioComponent } from './bodega-inventario.component';

describe('BodegaInventarioComponent', () => {
  let component: BodegaInventarioComponent;
  let fixture: ComponentFixture<BodegaInventarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BodegaInventarioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BodegaInventarioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
