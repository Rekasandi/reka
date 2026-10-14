import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    this.logger.error(
      `HTTP ${status} on ${request.method} ${request.path} (${exception instanceof Error ? exception.name : 'Error'})`,
      // SQL stacks can include session tokens; query URLs can include OAuth
      // codes/invitation secrets. Keep operational logs free of those values.
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      // Preserve the legacy error envelope while exposing the conventional
      // message field consumed by existing browser mutation helpers.
      message: typeof message === 'string' ? message : (message as { message?: unknown }).message ?? 'Request failed',
      error: typeof message === 'string' ? { message } : message,
    });
  }
}
