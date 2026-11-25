import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  Renderer2,
} from '@angular/core';

@Directive({
  selector: '[appAppendToBody]',
  standalone: true,
})
export class AppendToBodyDirective implements OnInit, OnDestroy {
  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    this.renderer.appendChild(document.body, this.el.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.el.nativeElement.parentNode) {
      this.renderer.removeChild(document.body, this.el.nativeElement);
    }
  }
}
