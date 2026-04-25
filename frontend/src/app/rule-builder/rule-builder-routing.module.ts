import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RuleBuilderPageComponent} from './components/rule-builder-page/rule-builder-page.component';

const routes: Routes = [
  {path: '', redirectTo: 'new', pathMatch: 'full'},
  {path: ':id', component: RuleBuilderPageComponent},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RuleBuilderRoutingModule {}
