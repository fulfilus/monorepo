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
    path: "admin/dashboard",
    loadComponent: () =>
      import("./admin/components/dashboard.component").then(m => m.DashboardComponent),
  },
  {
    path: "admin/vendors/:id",
    loadComponent: () =>
      import("./admin/components/vendor-edit.component").then(m => m.VendorEditComponent),
  },
  // Quotation routes — /new must come before /:id to avoid param clash
  {
    path: "quotations",
    loadComponent: () =>
      import("./quotation/components/quotation-list.component").then(m => m.QuotationListComponent),
  },
  {
    path: "quotations/new",
    loadComponent: () =>
      import("./quotation/components/quotation-form.component").then(m => m.QuotationFormComponent),
  },
  {
    path: "quotations/:id",
    loadComponent: () =>
      import("./quotation/components/quotation-detail.component").then(m => m.QuotationDetailComponent),
  },
  {
    path: "quotations/:id/edit",
    loadComponent: () =>
      import("./quotation/components/quotation-form.component").then(m => m.QuotationFormComponent),
  },
  // Procurement routes — /new must come before /:id
  {
    path: "procurement",
    loadComponent: () =>
      import("./procurement/components/procurement-list.component").then(m => m.ProcurementListComponent),
  },
  {
    path: "procurement/new",
    loadComponent: () =>
      import("./procurement/components/procurement-form.component").then(m => m.ProcurementFormComponent),
  },
  {
    path: "procurement/:id",
    loadComponent: () =>
      import("./procurement/components/procurement-detail.component").then(m => m.ProcurementDetailComponent),
  },
  // Customer routes
  {
    path: "customers",
    loadComponent: () =>
      import("./customer/components/customer-list.component").then(m => m.CustomerListComponent),
  },
  {
    path: "customers/new",
    loadComponent: () =>
      import("./customer/components/customer-form.component").then(m => m.CustomerFormComponent),
  },
  {
    path: "customers/:id",
    loadComponent: () =>
      import("./customer/components/customer-form.component").then(m => m.CustomerFormComponent),
  },
  // Sourcing routes — /new must come before /:id
  {
    path: "sourcing",
    loadComponent: () =>
      import("./sourcing/components/sourcing-list.component").then(m => m.SourcingListComponent),
  },
  {
    path: "sourcing/new",
    loadComponent: () =>
      import("./sourcing/components/sourcing-form.component").then(m => m.SourcingFormComponent),
  },
  {
    path: "sourcing/:id",
    loadComponent: () =>
      import("./sourcing/components/sourcing-form.component").then(m => m.SourcingFormComponent),
  },
  // Inbound WhatsApp inbox
  {
    path: "inbox",
    loadComponent: () =>
      import("./inbound/components/inbound-inbox.component").then(m => m.InboundInboxComponent),
  },
  { path: "**", redirectTo: "" },
];
