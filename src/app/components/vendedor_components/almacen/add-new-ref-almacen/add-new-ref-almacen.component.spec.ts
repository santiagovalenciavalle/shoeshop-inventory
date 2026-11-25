import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddNewRefAlmacenComponent } from './add-new-ref-almacen.component';

describe('AddNewRefAlmacenComponent', () => {
  let component: AddNewRefAlmacenComponent;
  let fixture: ComponentFixture<AddNewRefAlmacenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddNewRefAlmacenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddNewRefAlmacenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
