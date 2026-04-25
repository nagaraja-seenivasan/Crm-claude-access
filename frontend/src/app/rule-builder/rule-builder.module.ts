import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

// PrimeNG
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {ConfirmDialogModule} from 'primeng/confirmdialog';
import {DialogModule} from 'primeng/dialog';
import {DividerModule} from 'primeng/divider';
import {DropdownModule} from 'primeng/dropdown';
import {InputSwitchModule} from 'primeng/inputswitch';
import {InputTextModule} from 'primeng/inputtext';
import {InputTextareaModule} from 'primeng/inputtextarea';
import {SelectButtonModule} from 'primeng/selectbutton';
import {TagModule} from 'primeng/tag';
import {ToastModule} from 'primeng/toast';
import {ToggleButtonModule} from 'primeng/togglebutton';
import {TooltipModule} from 'primeng/tooltip';

// Components
import {RuleBuilderRoutingModule} from './rule-builder-routing.module';
import {RuleBuilderPageComponent} from './components/rule-builder-page/rule-builder-page.component';
import {NodePaletteComponent} from './components/node-palette/node-palette.component';
import {RuleCanvasComponent} from './components/rule-canvas/rule-canvas.component';
import {NodePropertiesComponent} from './components/node-properties/node-properties.component';

const PRIMENG = [
  ButtonModule,
  CardModule,
  ConfirmDialogModule,
  DialogModule,
  DividerModule,
  DropdownModule,
  InputSwitchModule,
  InputTextModule,
  InputTextareaModule,
  SelectButtonModule,
  TagModule,
  ToastModule,
  ToggleButtonModule,
  TooltipModule,
];

@NgModule({
  declarations: [
    RuleBuilderPageComponent,
    NodePaletteComponent,
    RuleCanvasComponent,
    NodePropertiesComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RuleBuilderRoutingModule,
    ...PRIMENG,
  ],
})
export class RuleBuilderModule {}
