import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  @Input() isLoading = false;
  @Input() fullScreen = false;
  @Input() overlay = true;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() message = '';
  @Input() transparent = false;
}
