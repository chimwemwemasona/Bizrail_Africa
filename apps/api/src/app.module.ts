import {
  Controller,
  Get,
  Inject,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RuntimeHealth } from './runtime/runtime-health';
import { Pool } from 'pg';
import { WorkspaceService } from './workspace/workspace.service';
import { WorkspaceController } from './workspace/workspace.controller';

@Controller('health')
export class HealthController {
  constructor(@Inject(RuntimeHealth) private readonly runtime: RuntimeHealth) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'bizrail-api' };
  }

  @Get('ready')
  async ready() {
    const result = await this.runtime.readiness();
    if (result.status !== 'ready')
      throw new ServiceUnavailableException(result);
    return result;
  }
}

@Module({
  controllers: [HealthController, WorkspaceController],
  providers: [
    { provide: RuntimeHealth, useFactory: () => new RuntimeHealth() },
    {
      provide: WorkspaceService,
      useFactory: () =>
        new WorkspaceService(
          new Pool({
            connectionString:
              process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL,
            max: 10,
            connectionTimeoutMillis: 3000,
          }),
        ),
    },
  ],
})
export class AppModule {}
