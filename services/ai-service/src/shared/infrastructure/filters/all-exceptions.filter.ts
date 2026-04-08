import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        if (Array.isArray(body.message)) message = body.message as string[];
        else if (typeof body.message === 'string') message = body.message;
        if (typeof body.error === 'string') error = body.error;
      }
      error = exception.name;
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack ?? exception.message);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      data: null,
      message,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
