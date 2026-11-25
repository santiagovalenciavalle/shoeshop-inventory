import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrincipalOptionsComponent } from './principal-options.component';

describe('PrincipalOptionsComponent', () => {
  let component: PrincipalOptionsComponent;
  let fixture: ComponentFixture<PrincipalOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrincipalOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrincipalOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
