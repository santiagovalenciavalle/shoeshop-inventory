import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistorialBodegaComponent } from './historial-bodega.component';

describe('HistorialBodegaComponent', () => {
  let component: HistorialBodegaComponent;
  let fixture: ComponentFixture<HistorialBodegaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistorialBodegaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistorialBodegaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
