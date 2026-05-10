import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./vendor/components/vendor-form.component").then(m => m.VendorFormComponent),
  },
  {
    path: "admin",
    loadComponent: () =>
      import("./admin/components/vendor-list.component").then(m => m.VendorListComponent),
  },
  {
    path: "admin/vendors/:id",
    loadComponent: () =>
      import("./admin/components/vendor-edit.component").then(m => m.VendorEditComponent),
  },
  { path: "**", redirectTo: "" },
];
