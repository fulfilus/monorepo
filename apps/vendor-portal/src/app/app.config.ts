import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { ApplicationConfig } from "@angular/core";
import { provideRouter, withInMemoryScrolling, withRouterConfig } from "@angular/router";
import { authInterceptor } from "./core/interceptors/auth.interceptor";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withRouterConfig({ onSameUrlNavigation: "reload" }),
      withInMemoryScrolling({ scrollPositionRestoration: "top" }),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
