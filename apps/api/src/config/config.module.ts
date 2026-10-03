import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, loadConfig } from "./configuration";

/**
 * Global configuration module. Loads and validates environment variables
 * once at startup; inject with @Inject(APP_CONFIG).
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
