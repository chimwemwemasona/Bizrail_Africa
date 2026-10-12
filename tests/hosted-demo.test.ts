import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { WorkspaceService } from '../apps/api/src/workspace/workspace.service';
afterEach(() => vi.unstubAllEnvs());
describe('hosted demo registration', () => {
  it('keeps registration disabled in production without explicit demo consent', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BIZRAIL_DEMO_MODE', 'false');
    const pool = { on: vi.fn() } as unknown as Pool;
    await expect(
      new WorkspaceService(pool).register({}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('permits sample workspace creation with the explicit demo flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BIZRAIL_DEMO_MODE', 'true');
    const sentinel = new Error('transaction reached');
    const connect = vi.fn().mockRejectedValue(sentinel);
    const pool = { on: vi.fn(), connect } as unknown as Pool;
    await expect(
      new WorkspaceService(pool).register({
        username: 'demo_user',
        password: 'Synthetic-test-only-123',
        name: 'Sample business',
      }),
    ).rejects.toBe(sentinel);
    expect(connect).toHaveBeenCalledOnce();
  });
});
