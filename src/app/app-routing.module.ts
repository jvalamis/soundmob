import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AdminGuard } from "./auth/guards/admin.guard";
import { LandingComponent } from "./home/landing/landing.component";


const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
  },
  {
    path: "featured",
    loadChildren: "../app/featured/featured.module#FeaturedModule",
    canActivate: [AdminGuard]
  },
  {
    path: "listener",
    loadChildren: "../app/listener/listener.module#ListenerModule",
    canActivate: [AdminGuard]
  },
  {
    path: "dj",
    loadChildren: "../app/dj/dj.module#DjModule",
    canActivate: [AdminGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  providers: []
})
export class AppRoutingModule { }
