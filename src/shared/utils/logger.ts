import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for errors only
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// Export typed logger methods
export const log = {
  info: (message: string, meta?: Record<string, unknown>): void => {
    logger.info(message, meta);
  },

  warn: (message: string, meta?: Record<string, unknown>): void => {
    logger.warn(message, meta);
  },

  error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>): void => {
    const errorMeta: Record<string, unknown> = { ...meta };

    if (error instanceof Error) {
      errorMeta.errorName = error.name;
      errorMeta.errorMessage = error.message;
      errorMeta.stack = error.stack;
    } else if (error) {
      errorMeta.error = error;
    }

    logger.error(message, errorMeta);
  },

  debug: (message: string, meta?: Record<string, unknown>): void => {
    logger.debug(message, meta);
  },

  // Specialized logging for invoice processing
  invoiceProcessing: {
    start: (fileName: string): void => {
      logger.info('Starting invoice processing', { fileName, event: 'process_start' });
    },

    ocrComplete: (fileName: string, confidence: number): void => {
      logger.info('OCR processing complete', {
        fileName,
        confidence,
        event: 'ocr_complete',
      });
    },

    extractionComplete: (
      fileName: string,
      fieldsExtracted: number,
      warnings: string[]
    ): void => {
      logger.info('Data extraction complete', {
        fileName,
        fieldsExtracted,
        warnings,
        event: 'extraction_complete',
      });
    },

    validationComplete: (
      invoiceNumber: string,
      isValid: boolean,
      errorCount: number,
      warningCount: number
    ): void => {
      logger.info('Validation complete', {
        invoiceNumber,
        isValid,
        errorCount,
        warningCount,
        event: 'validation_complete',
      });
    },

    exportComplete: (filePath: string, rowCount: number, fileSize: number): void => {
      logger.info('CSV export complete', {
        filePath,
        rowCount,
        fileSize,
        event: 'export_complete',
      });
    },

    error: (fileName: string, stage: string, error: Error | string): void => {
      logger.error('Invoice processing error', {
        fileName,
        stage,
        error: error instanceof Error ? error.message : error,
        event: 'process_error',
      });
    },
  },

  // Performance logging
  performance: {
    measure: (operation: string, durationMs: number, meta?: Record<string, unknown>): void => {
      logger.info('Performance measurement', {
        operation,
        durationMs,
        ...meta,
        event: 'performance',
      });
    },

    startTimer: (operationName: string): () => void => {
      const startTime = Date.now();
      return (): void => {
        const duration = Date.now() - startTime;
        log.performance.measure(operationName, duration);
      };
    },
  },

  // AI Assistant logging
  ai: {
    requestSent: (prompt: string): void => {
      logger.debug('AI request sent', {
        promptLength: prompt.length,
        event: 'ai_request',
      });
    },

    responseReceived: (responseLength: number, durationMs: number): void => {
      logger.info('AI response received', {
        responseLength,
        durationMs,
        event: 'ai_response',
      });
    },

    error: (error: Error | string): void => {
      logger.error('AI assistant error', {
        error: error instanceof Error ? error.message : error,
        event: 'ai_error',
      });
    },
  },
};

export default log;
