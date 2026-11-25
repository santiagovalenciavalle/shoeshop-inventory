import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExhibicionesComponent } from './exhibiciones.component';

describe('ExhibicionesComponent', () => {
  let component: ExhibicionesComponent;
  let fixture: ComponentFixture<ExhibicionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExhibicionesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExhibicionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
