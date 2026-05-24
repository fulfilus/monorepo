import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { TestingModule } from "@nestjs/testing";
import fastifyMultipart from "@fastify/multipart";

export async function createTestApp(moduleRef: TestingModule): Promise<NestFastifyApplication> {
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

export const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
export const TEST_UUID_2 = "550e8400-e29b-41d4-a716-446655440001";
