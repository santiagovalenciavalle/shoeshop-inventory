import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExhibicionAdminComponent } from './exhibicion-admin.component';

describe('ExhibicionAdminComponent', () => {
  let component: ExhibicionAdminComponent;
  let fixture: ComponentFixture<ExhibicionAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExhibicionAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExhibicionAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
