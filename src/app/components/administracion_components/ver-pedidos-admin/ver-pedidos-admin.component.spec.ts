import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerPedidosAdminComponent } from './ver-pedidos-admin.component';

describe('VerPedidosAdminComponent', () => {
  let component: VerPedidosAdminComponent;
  let fixture: ComponentFixture<VerPedidosAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerPedidosAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VerPedidosAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
