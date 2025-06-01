import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthGuard } from './guards/auth.guard';
import { ProfileComponent } from './components/profile/profile.component';
import { PendingOrdersComponent } from './components/pendingOrders/pending-orders.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: '', component: DashboardComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
   /* {
     path: 'profile/password',
     component: ChangePasswordComponent,
     canActivate: [AuthGuard],
   }, */
  {
    path: 'meus-pedidos',
    component: PendingOrdersComponent,
    canActivate: [AuthGuard],
  },
  { path: 'checkout', component: CheckoutComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' },
];
