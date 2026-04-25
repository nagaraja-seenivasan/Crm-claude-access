import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

const routes: Routes = [
  {path: '', redirectTo: 'rules', pathMatch: 'full'},
  {
    path: 'rules',
    loadChildren: () =>
      import('./rule-builder/rule-builder.module').then(m => m.RuleBuilderModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
