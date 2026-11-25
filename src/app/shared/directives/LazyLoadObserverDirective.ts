import {
  Directive,
  ElementRef,
  EventEmitter,
  Output,
  OnDestroy,
  AfterViewInit,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appLazyLoadObserver]',
  standalone: true,
})
export class LazyLoadObserverDirective implements AfterViewInit, OnDestroy {
  @Output() visible = new EventEmitter<void>();

  private el = inject(ElementRef);
  private observer!: IntersectionObserver;

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        this.visible.emit();
        this.observer.unobserve(this.el.nativeElement);
      }
    });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
