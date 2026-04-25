import {Component} from '@angular/core';
import {PaletteItem, PALETTE_ITEMS} from '../../models/rule.models';

@Component({
  selector: 'app-node-palette',
  templateUrl: './node-palette.component.html',
  styleUrls: ['./node-palette.component.scss'],
})
export class NodePaletteComponent {
  readonly triggerItems = PALETTE_ITEMS.filter(i => i.group === 'trigger');
  readonly logicItems = PALETTE_ITEMS.filter(i => i.group === 'logic');
  readonly actionItems = PALETTE_ITEMS.filter(i => i.group === 'action');

  onDragStart(event: DragEvent, item: PaletteItem): void {
    event.dataTransfer?.setData('application/json', JSON.stringify(item));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
}
