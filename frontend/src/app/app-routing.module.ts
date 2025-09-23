import { NgModule, Component } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

@Component({ template: '<div class="container py-5"><h2>404 - Page not found</h2></div>' })
class NotFoundComponent {}

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  { path: 'members', loadChildren: () => import('./features/members/members.module').then(m => m.MembersModule) },
  { path: 'plans', loadChildren: () => import('./features/plans/plans.module').then(m => m.PlansModule) },
  { path: 'member/:id', loadChildren: () => import('./features/member-detail/member-detail.module').then(m => m.MemberDetailModule) },
  { path: 'users', loadChildren: () => import('./features/users/users.module').then(m => m.UsersModule) },
  { path: 'attendance', loadChildren: () => import('./features/attendance/attendance.module').then(m => m.AttendanceModule) },
  { path: '', redirectTo: 'attendance', pathMatch: 'full' },
  { path: '**', component: NotFoundComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
export { NotFoundComponent };
