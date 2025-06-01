import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestaurantLocatorComponent } from './restaurant-locator.component';

describe('RestaurantLocatorComponent', () => {
  let component: RestaurantLocatorComponent;
  let fixture: ComponentFixture<RestaurantLocatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestaurantLocatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RestaurantLocatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
