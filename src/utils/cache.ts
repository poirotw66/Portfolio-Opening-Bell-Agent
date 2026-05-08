/**
 * 簡單的記憶體快取工具
 */

import { API_CONFIG } from '../constants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * 設定快取
   */
  set<T>(key: string, data: T, ttl: number = API_CONFIG.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000, // 轉換為毫秒
    });
  }

  /**
   * 取得快取
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 檢查是否過期
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 刪除快取
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清空所有快取
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 取得快取大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清理過期的快取項目
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// 建立全域快取實例
export const cache = new MemoryCache();

// 定期清理過期快取 (每 5 分鐘)
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * 快取包裝器函式
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 嘗試從快取取得
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 執行函式並快取結果
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}

/**
 * 產生快取鍵值
 */
export function generateCacheKey(prefix: string, ...args: any[]): string {
  return `${prefix}:${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(':')}`;
}

// Made with Bob
