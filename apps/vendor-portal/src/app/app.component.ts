import { Component } from "@angular/core";
import { VendorFormComponent } from "./vendor/components/vendor-form.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [VendorFormComponent],
  template: `<app-vendor-form />`,
})
export class AppComponent {}
