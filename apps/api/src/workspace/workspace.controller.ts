import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  ForbiddenException,
  UseFilters,
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { WorkspaceService } from './workspace.service';

@Catch()
export class WorkspaceErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof ZodError
          ? 400
          : 500;
    response.status(status).json({
      message:
        error instanceof HttpException
          ? error.message
          : status === 400
            ? 'Check the supplied fields'
            : 'The request could not be completed. Try again.',
    });
  }
}
@Controller('workspace')
@UseFilters(WorkspaceErrors)
export class WorkspaceController {
  constructor(
    @Inject(WorkspaceService) private readonly service: WorkspaceService,
  ) {}
  private session(req: Request) {
    return (
      (req.headers.cookie ?? '')
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('bizrail_session='))
        ?.slice('bizrail_session='.length) ?? ''
    );
  }
  private token(req: Request) {
    return req.header('x-device-token') ?? '';
  }
  private mutation(req: Request) {
    if (req.header('x-bizrail-request') !== '1')
      throw new ForbiddenException('Same-origin request required');
  }
  private cookie(res: Response, token: string) {
    res.cookie('bizrail_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/workspace',
      maxAge: 12 * 60 * 60 * 1000,
    });
  }
  @Post('register') async register(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ) {
    this.mutation(req);
    const result = await this.service.register(body);
    this.cookie(res, result.token);
    return result.identity;
  }
  @Post('login') async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ) {
    this.mutation(req);
    const result = await this.service.login(body);
    this.cookie(res, result.token);
    return result.identity;
  }
  @Get('session') async identity(@Req() req: Request) {
    return this.service.identity(this.session(req));
  }
  @Post('logout') async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.mutation(req);
    const result = await this.service.logout(
      this.session(req),
      this.token(req),
    );
    res.clearCookie('bizrail_session', { path: '/api/workspace' });
    return result;
  }
  @Post('enrol') async enrol(@Req() req: Request, @Body() body: unknown) {
    this.mutation(req);
    return this.service.enrol(
      await this.service.identity(this.session(req)),
      body,
      this.token(req),
    );
  }
  @Post('push') async push(@Req() req: Request, @Body() body: unknown) {
    this.mutation(req);
    const { events } = z
      .object({ events: z.array(z.unknown()).max(100) })
      .strict()
      .parse(body);
    return this.service.sync.push(
      await this.service.device(this.token(req)),
      events,
    );
  }
  @Get('pull') async pull(@Req() req: Request) {
    return this.service.sync.pull(
      await this.service.device(this.token(req)),
      String(req.query.after ?? '0'),
    );
  }
  @Get('snapshot') async snapshot(@Req() req: Request) {
    return this.service.snapshot(await this.service.device(this.token(req)));
  }
  @Get('administration') async administration(@Req() req: Request) {
    return this.service.administration(
      await this.service.identity(this.session(req)),
    );
  }
  @Post('reviewer') async reviewer(@Req() req: Request, @Body() body: unknown) {
    this.mutation(req);
    return this.service.addReviewer(
      await this.service.identity(this.session(req)),
      body,
    );
  }
  @Post('revoke') async revoke(@Req() req: Request, @Body() body: unknown) {
    this.mutation(req);
    const identity = await this.service.identity(this.session(req));
    const data = z
      .object({ deviceId: z.uuid(), reason: z.string().trim().min(3).max(500) })
      .strict()
      .parse(body);
    await this.service.authority.revoke(
      identity.tenantId,
      data.deviceId,
      identity.actorId,
      data.reason,
    );
    return { ok: true };
  }
  @Post('review') async review(@Req() req: Request, @Body() body: unknown) {
    this.mutation(req);
    return this.service.review(
      await this.service.identity(this.session(req)),
      body,
    );
  }
}
