import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";

const REQUIRED_ENV = ["DATABASE_URL", "ANTHROPIC_API_KEY"] as const;
const OPTIONAL_ENV = ["GOOGLE_MAPS_SERVER_KEY", "ALLOWED_ORIGINS", "WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    process.stderr.write(`Missing required environment variables: ${missing.join(", ")}\n`);
    process.exit(1);
  }
  const absent = OPTIONAL_ENV.filter(key => !process.env[key]);
  if (absent.length > 0) {
    process.stderr.write(`Optional env vars not set (features will be limited): ${absent.join(", ")}\n`);
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const uploadsDir = join(process.cwd(), "uploads");
  mkdirSync(uploadsDir, { recursive: true });

  await app.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:4200")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle("Fulfilus Vendor API")
    .setDescription("Vendor Intelligence & Onboarding API")
    .setVersion("1.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  await app.listen(3000, "0.0.0.0");
}

bootstrap();
