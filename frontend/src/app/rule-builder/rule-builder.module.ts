import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';

// Components
import {RuleBuilderRoutingModule} from './rule-builder-routing.module';
import {RuleBuilderPageComponent} from './components/rule-builder-page/rule-builder-page.component';
import {NodePaletteComponent} from './components/node-palette/node-palette.component';
import {RuleCanvasComponent} from './components/rule-canvas/rule-canvas.component';
import {NodePropertiesComponent} from './components/node-properties/node-properties.component';
import {IconComponent} from '../shared/icon.component';

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
    IconComponent,
  ],
})
export class RuleBuilderModule {}
