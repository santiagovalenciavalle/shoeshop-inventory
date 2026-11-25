import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CuadriculasComponent } from './cuadriculas.component';

describe('CuadriculasComponent', () => {
  let component: CuadriculasComponent;
  let fixture: ComponentFixture<CuadriculasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuadriculasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CuadriculasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
