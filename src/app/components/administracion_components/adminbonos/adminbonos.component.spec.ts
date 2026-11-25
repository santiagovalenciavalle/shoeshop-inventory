import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminbonosComponent } from './adminbonos.component';

describe('AdminbonosComponent', () => {
  let component: AdminbonosComponent;
  let fixture: ComponentFixture<AdminbonosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminbonosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminbonosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
