/**
 * 統一錯誤處理工具
 */

import { ERROR_MESSAGES } from '../constants';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 判斷是否為配額超限錯誤
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('429') ||
    message.includes('resource_exhausted') ||
    message.includes('quota')
  );
}

/**
 * 判斷是否為逾時錯誤
 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('abort') || message.includes('timeout');
}

/**
 * 判斷是否為 Recitation 錯誤
 */
export function isRecitationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('RECITATION');
}

/**
 * 判斷是否為 JSON 解析錯誤
 */
export function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError ||
    (error instanceof Error &&
      (error.message.includes('Unexpected token') ||
        error.message.includes('Unterminated string') ||
        error.message.includes('JSON')))
  );
}

/**
 * 將錯誤轉換為使用者友善的訊息
 */
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return '發生未知錯誤,請稍後再試。';
  }

  // 檢查特定錯誤類型
  if (isQuotaError(error)) {
    return ERROR_MESSAGES.QUOTA_EXCEEDED;
  }

  if (isTimeoutError(error)) {
    return ERROR_MESSAGES.REQUEST_TIMEOUT;
  }

  if (isRecitationError(error)) {
    return ERROR_MESSAGES.RECITATION_BLOCKED;
  }

  if (isJsonParseError(error)) {
    return ERROR_MESSAGES.JSON_PARSE_ERROR;
  }

  // 返回原始錯誤訊息
  return error.message || '分析過程中發生錯誤。';
}

/**
 * 記錄錯誤到控制台 (開發環境)
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error${context ? ` - ${context}` : ''}]:`, error);
  }
}

/**
 * 安全地解析 JSON,失敗時返回 null
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * 重試函式包裝器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 如果是最後一次嘗試,直接拋出錯誤
      if (attempt === maxRetries) {
        throw error;
      }

      // 某些錯誤不應該重試
      if (isQuotaError(error) || isRecitationError(error)) {
        throw error;
      }

      // 等待後重試
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
      
      logError(error, `Retry attempt ${attempt}/${maxRetries}`);
    }
  }

  throw lastError;
}

// Made with Bob
