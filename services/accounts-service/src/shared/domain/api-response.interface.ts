export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
  message?: string | string[];
  error?: string;
  statusCode: number;
  timestamp: string;
}
