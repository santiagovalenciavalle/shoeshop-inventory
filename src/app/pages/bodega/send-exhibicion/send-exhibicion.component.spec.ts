import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendExhibicionComponent } from './send-exhibicion.component';

describe('SendExhibicionComponent', () => {
  let component: SendExhibicionComponent;
  let fixture: ComponentFixture<SendExhibicionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendExhibicionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendExhibicionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
