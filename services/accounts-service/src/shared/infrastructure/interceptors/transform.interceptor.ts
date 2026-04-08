import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: res.statusCode ?? 200,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
