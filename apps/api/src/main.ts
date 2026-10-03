import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { RequestMethod } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { APP_CONFIG, AppConfig } from "./config/configuration";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get<AppConfig>(APP_CONFIG);

  app.use(cookieParser());
  // Swagger UI dikecualikan dari prefix agar bisa diakses di /docs
  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "docs", method: RequestMethod.ALL },
      { path: "docs/{*path}", method: RequestMethod.ALL },
    ],
  });
  app.enableShutdownHooks();

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`eRapor API listening on port ${config.port} (${config.nodeEnv})`);
}

void bootstrap();
