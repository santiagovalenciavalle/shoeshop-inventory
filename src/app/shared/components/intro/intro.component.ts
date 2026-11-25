import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-intro',
  imports: [],
  templateUrl: './intro.component.html',
  styleUrl: './intro.component.css',
})
export class IntroComponent {
  @Output() introFinished = new EventEmitter<void>();

  ngOnInit() {
    setTimeout(() => {
      this.introFinished.emit();
    }, 4000);
  }
}
