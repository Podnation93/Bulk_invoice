import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hash: string;
  version: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  hitCount: number;
  missCount: number;
}

/**
 * File-based caching system for OCR results and other expensive operations
 */
export class CacheManager {
  private cacheDir: string;
  private maxSizeBytes: number;
  private version: string;
  private stats: { hits: number; misses: number };

  constructor(maxSizeMB: number = 100, version: string = '1.0.0') {
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    this.cacheDir = path.join(userDataPath, 'ocr-cache');
    this.maxSizeBytes = maxSizeMB * 1024 * 1024;
    this.version = version;
    this.stats = { hits: 0, misses: 0 };

    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate cache key from file content
   */
  generateKey(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      return hash.substring(0, 32); // Use first 32 chars for reasonable key length
    } catch (error) {
      console.error('Failed to generate cache key:', error);
      return '';
    }
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    if (!key) {
      this.stats.misses++;
      return null;
    }

    const cacheFile = path.join(this.cacheDir, `${key}.json`);

    try {
      if (!fs.existsSync(cacheFile)) {
        this.stats.misses++;
        return null;
      }

      const content = fs.readFileSync(cacheFile, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      // Check version compatibility
      if (entry.version !== this.version) {
        this.stats.misses++;
        this.delete(key);
        return null;
      }

      // Update access time
      fs.utimesSync(cacheFile, new Date(), new Date());

      this.stats.hits++;
      return entry.data;
    } catch (error) {
      console.error('Cache read error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): boolean {
    if (!key) return false;

    const cacheFile = path.join(this.cacheDir, `${key}.json`);

    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        hash: key,
        version: this.version,
      };

      const content = JSON.stringify(entry, null, 2);
      fs.writeFileSync(cacheFile, content, 'utf-8');

      // Check if cache size exceeded
      this.enforceMaxSize();

      return true;
    } catch (error) {
      console.error('Cache write error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    if (!key) return false;
    const cacheFile = path.join(this.cacheDir, `${key}.json`);
    return fs.existsSync(cacheFile);
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    if (!key) return false;

    const cacheFile = path.join(this.cacheDir, `${key}.json`);

    try {
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        return true;
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }

    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
      this.stats = { hits: 0, misses: 0 };
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Enforce maximum cache size by removing oldest entries
   */
  private enforceMaxSize(): void {
    try {
      const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));

      if (files.length === 0) return;

      // Get file info with stats
      const fileInfos = files.map((file) => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        return {
          path: filePath,
          name: file,
          size: stats.size,
          accessed: stats.atime,
        };
      });

      // Calculate total size
      const totalSize = fileInfos.reduce((sum, f) => sum + f.size, 0);

      if (totalSize <= this.maxSizeBytes) return;

      // Sort by access time (oldest first)
      fileInfos.sort((a, b) => a.accessed.getTime() - b.accessed.getTime());

      // Remove oldest files until under limit
      let currentSize = totalSize;
      for (const fileInfo of fileInfos) {
        if (currentSize <= this.maxSizeBytes * 0.9) break; // Keep 10% buffer

        fs.unlinkSync(fileInfo.path);
        currentSize -= fileInfo.size;
        console.log(`Cache evicted: ${fileInfo.name} (${fileInfo.size} bytes)`);
      }
    } catch (error) {
      console.error('Cache size enforcement error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    try {
      const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));

      if (files.length === 0) {
        return {
          totalEntries: 0,
          totalSizeBytes: 0,
          oldestEntry: null,
          newestEntry: null,
          hitCount: this.stats.hits,
          missCount: this.stats.misses,
        };
      }

      let totalSize = 0;
      let oldest = new Date();
      let newest = new Date(0);

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        if (stats.mtime < oldest) oldest = stats.mtime;
        if (stats.mtime > newest) newest = stats.mtime;
      }

      return {
        totalEntries: files.length,
        totalSizeBytes: totalSize,
        oldestEntry: oldest,
        newestEntry: newest,
        hitCount: this.stats.hits,
        missCount: this.stats.misses,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalEntries: 0,
        totalSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null,
        hitCount: this.stats.hits,
        missCount: this.stats.misses,
      };
    }
  }

  /**
   * Format cache stats as readable text
   */
  formatStats(): string {
    const stats = this.getStats();
    let output = '📦 Cache Statistics\n';
    output += '─'.repeat(40) + '\n';
    output += `Total Entries: ${stats.totalEntries}\n`;
    output += `Total Size: ${this.formatBytes(stats.totalSizeBytes)}\n`;
    output += `Max Size: ${this.formatBytes(this.maxSizeBytes)}\n`;
    output += `Usage: ${((stats.totalSizeBytes / this.maxSizeBytes) * 100).toFixed(1)}%\n`;
    output += `Hit Rate: ${this.calculateHitRate()}%\n`;
    output += `Hits: ${stats.hitCount} | Misses: ${stats.missCount}\n`;

    if (stats.oldestEntry) {
      output += `Oldest Entry: ${stats.oldestEntry.toLocaleDateString()}\n`;
    }
    if (stats.newestEntry) {
      output += `Newest Entry: ${stats.newestEntry.toLocaleDateString()}\n`;
    }

    return output;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateHitRate(): string {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return '0.0';
    return ((this.stats.hits / total) * 100).toFixed(1);
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }
}

export default CacheManager;
