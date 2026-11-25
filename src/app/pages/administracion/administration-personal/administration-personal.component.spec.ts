import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdministrationPersonalComponent } from './administration-personal.component';

describe('AdministrationPersonalComponent', () => {
  let component: AdministrationPersonalComponent;
  let fixture: ComponentFixture<AdministrationPersonalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdministrationPersonalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdministrationPersonalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
