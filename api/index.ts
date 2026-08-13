import "reflect-metadata";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../apps/api/src/app.module";

let cachedServer: express.Express | undefined;

async function createServer() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { logger: ["error", "warn", "log"] });
  const webOrigin = process.env.WEB_ORIGIN ?? "*";

  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: webOrigin === "*" ? true : webOrigin,
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("PJ&LJ Salon Manager API")
    .setDescription("API-first foundation for PJ&LJ Salao Unissex")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.init();
  return server;
}

export default async function handler(request: express.Request, response: express.Response) {
  cachedServer ??= await createServer();
  return cachedServer(request, response);
}
