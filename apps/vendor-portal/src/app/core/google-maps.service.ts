import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class GoogleMapsService {
  private loaded = false;
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => { this.loaded = true; resolve(); };
      script.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(script);
    });

    return this.loading;
  }
}
