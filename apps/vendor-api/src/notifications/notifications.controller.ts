import { Controller, Get, HttpCode, HttpStatus, Param, ParseBoolPipe, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 30,
    @Query("unreadOnly", new ParseBoolPipe({ optional: true })) unreadOnly = false,
  ) {
    return this.notificationsService.list(page, limit, unreadOnly);
  }

  @Get("unread-count")
  unreadCount() {
    return this.notificationsService.unreadCount();
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  markRead(@Param("id") id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch("mark-all-read")
  @HttpCode(HttpStatus.OK)
  markAllRead() {
    return this.notificationsService.markAllRead();
  }
}
