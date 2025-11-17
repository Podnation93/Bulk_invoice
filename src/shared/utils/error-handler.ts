import { log } from './logger';

/**
 * Custom error types for the application
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PDFProcessingError extends AppError {
  constructor(message: string, fileName: string, context?: Record<string, unknown>) {
    super(message, 'PDF_PROCESSING_ERROR', true, { fileName, ...context });
    this.name = 'PDFProcessingError';
  }
}

export class OCRError extends AppError {
  constructor(message: string, fileName: string, confidence?: number) {
    super(message, 'OCR_ERROR', true, { fileName, confidence });
    this.name = 'OCRError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', true, { field, value });
    this.name = 'ValidationError';
  }
}

export class ExportError extends AppError {
  constructor(message: string, filePath?: string) {
    super(message, 'EXPORT_ERROR', true, { filePath });
    this.name = 'ExportError';
  }
}

export class AIAssistantError extends AppError {
  constructor(message: string, operation: string) {
    super(message, 'AI_ASSISTANT_ERROR', true, { operation });
    this.name = 'AIAssistantError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', true);
    this.name = 'AuthenticationError';
  }
}

/**
 * Global error handler for the application
 */
export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      log.error('Uncaught Exception', error, { type: 'uncaughtException' });

      // Exit if non-operational error
      if (error instanceof AppError && !error.isOperational) {
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      log.error('Unhandled Rejection', reason as Error, {
        type: 'unhandledRejection',
      });
    });
  }

  /**
   * Handle an error and return a user-friendly message
   */
  handleError(error: unknown): { message: string; code: string; details?: unknown } {
    if (error instanceof AppError) {
      log.error(error.message, error, {
        code: error.code,
        context: error.context,
      });

      return {
        message: this.getUserFriendlyMessage(error),
        code: error.code,
        details: error.context,
      };
    }

    if (error instanceof Error) {
      log.error('Unexpected error', error);

      return {
        message: 'An unexpected error occurred. Please try again.',
        code: 'UNEXPECTED_ERROR',
        details: { originalMessage: error.message },
      };
    }

    log.error('Unknown error type', error as Error);

    return {
      message: 'An unknown error occurred.',
      code: 'UNKNOWN_ERROR',
    };
  }

  /**
   * Convert technical errors to user-friendly messages
   */
  private getUserFriendlyMessage(error: AppError): string {
    switch (error.code) {
      case 'PDF_PROCESSING_ERROR':
        return `Unable to process PDF file: ${error.message}. Please ensure the file is not corrupted.`;

      case 'OCR_ERROR':
        return `Text extraction failed: ${error.message}. The PDF may be of low quality or damaged.`;

      case 'VALIDATION_ERROR':
        return `Data validation failed: ${error.message}. Please check the extracted data.`;

      case 'EXPORT_ERROR':
        return `Export failed: ${error.message}. Please ensure you have write permissions.`;

      case 'AI_ASSISTANT_ERROR':
        return `AI assistant error: ${error.message}. Please check your authentication.`;

      case 'AUTHENTICATION_ERROR':
        return `Authentication failed: ${error.message}. Please log in again.`;

      default:
        return error.message;
    }
  }

  /**
   * Wrap an async function with error handling
   */
  wrapAsync<T, Args extends unknown[]>(
    fn: (...args: Args) => Promise<T>
  ): (...args: Args) => Promise<T> {
    return async (...args: Args): Promise<T> => {
      try {
        return await fn(...args);
      } catch (error) {
        const handled = this.handleError(error);
        throw new AppError(handled.message, handled.code, true, handled.details as Record<string, unknown>);
      }
    };
  }

  /**
   * Create a retry wrapper for operations that may fail transiently
   */
  withRetry<T>(
    fn: () => Promise<T>,
    options: { maxAttempts?: number; delayMs?: number; backoffMultiplier?: number } = {}
  ): () => Promise<T> {
    const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2 } = options;

    return async (): Promise<T> => {
      let lastError: Error | null = null;
      let currentDelay = delayMs;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          log.debug(`Attempt ${attempt}/${maxAttempts}`);
          return await fn();
        } catch (error) {
          lastError = error as Error;
          log.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms`, {
            attempt,
            maxAttempts,
            error: lastError.message,
          });

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= backoffMultiplier;
          }
        }
      }

      throw lastError;
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

/**
 * Helper function to safely execute and handle errors
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const handled = errorHandler.handleError(error);
    log.error(errorContext, error as Error);
    return { success: false, error: handled.message };
  }
}

export default errorHandler;
