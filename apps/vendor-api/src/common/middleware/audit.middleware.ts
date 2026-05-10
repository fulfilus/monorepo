import { Injectable, NestMiddleware } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void) {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      process.stdout.write(
        JSON.stringify({
          level: "info",
          time: new Date().toISOString(),
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          durationMs: duration,
        }) + "\n",
      );
    });
    next();
  }
}
