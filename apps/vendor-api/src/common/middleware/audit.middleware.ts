import { Injectable, NestMiddleware } from "@nestjs/common";
import { IncomingMessage, ServerResponse } from "node:http";

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const start = Date.now();
    res.on("finish", () => {
      process.stdout.write(
        JSON.stringify({
          level: "info",
          time: new Date().toISOString(),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          durationMs: Date.now() - start,
        }) + "\n",
      );
    });
    next();
  }
}
