import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get("spend")
  getSpend() {
    return this.dashboardService.getSpendAnalytics();
  }
}
