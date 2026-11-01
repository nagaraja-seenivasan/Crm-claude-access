import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

/**
 * Inline SVG icons (24×24, stroke-based). Shapes adapted from Feather Icons
 * (MIT). The markup is a fixed internal map — never user input — so it is
 * safe to bypass sanitization.
 */
const ICONS: Record<string, string> = {
  'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  circle: '<circle cx="12" cy="12" r="10"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  'exclamation-triangle':
    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  minus: '<path d="M5 12h14"/>',
  pencil: '<path d="M17 3l4 4L8 20H4v-4L17 3z"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  sitemap: '<rect x="9" y="2" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/><path d="M12 8v4M5 16v-4h14v4"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.22-8.56"/>',
  'stop-circle': '<circle cx="12" cy="12" r="10"/><rect x="9" y="9" width="6" height="6"/>',
  times: '<path d="M18 6L6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
};

const cache = new Map<string, SafeHtml>();

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {class: 'ui-icon', 'aria-hidden': 'true', '[class.ui-icon--spin]': "name === 'spinner'"},
  template: '<span class="ui-icon__svg" [innerHTML]="svg"></span>',
})
export class IconComponent {
  @Input({required: true}) name = 'circle';

  constructor(private sanitizer: DomSanitizer) {}

  get svg(): SafeHtml {
    const key = ICONS[this.name] ? this.name : 'circle';
    let html = cache.get(key);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(
        '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[key] + '</svg>',
      );
      cache.set(key, html);
    }
    return html;
  }
}
