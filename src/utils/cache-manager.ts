/**
 * Cache management utilities for the SEO plugin
 * Provides intelligent caching with size limits and expiration
 */

import { SEOResults } from "../types";

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
	value: T;
	timestamp: number;
	accessCount: number;
	lastAccessed: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
	maxSize: number;
	maxAge: number; // in milliseconds
	cleanupInterval: number; // in milliseconds
}

/**
 * Generic cache manager with LRU eviction and TTL
 */
export class CacheManager<T> {
	private cache = new Map<string, CacheEntry<T>>();
	private config: CacheConfig;
	private cleanupTimer: NodeJS.Timeout | null = null;

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = {
			maxSize: config.maxSize || 100,
			maxAge: config.maxAge || 30 * 60 * 1000, // 30 minutes
			cleanupInterval: config.cleanupInterval || 5 * 60 * 1000, // 5 minutes
		};

		this.startCleanupTimer();
	}

	/**
	 * Get a value from cache
	 * @param key - Cache key
	 * @returns Cached value or undefined
	 */
	get(key: string): T | undefined {
		const entry = this.cache.get(key);
		if (!entry) {
			return undefined;
		}

		// Check if entry has expired
		if (this.isExpired(entry)) {
			this.cache.delete(key);
			return undefined;
		}

		// Update access statistics
		entry.accessCount++;
		entry.lastAccessed = Date.now();

		return entry.value;
	}

	/**
	 * Set a value in cache
	 * @param key - Cache key
	 * @param value - Value to cache
	 */
	set(key: string, value: T): void {
		// Remove existing entry if it exists
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}

		// Check if we need to evict entries
		if (this.cache.size >= this.config.maxSize) {
			this.evictLRU();
		}

		// Add new entry
		this.cache.set(key, {
			value,
			timestamp: Date.now(),
			accessCount: 1,
			lastAccessed: Date.now(),
		});
	}

	/**
	 * Check if a key exists in cache
	 * @param key - Cache key
	 * @returns True if key exists and is not expired
	 */
	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) {
			return false;
		}

		if (this.isExpired(entry)) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	/**
	 * Delete a specific key from cache
	 * @param key - Cache key
	 */
	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		const entries = Array.from(this.cache.values());
		
		return {
			size: this.cache.size,
			maxSize: this.config.maxSize,
			hitRate: this.calculateHitRate(),
			oldestEntry: Math.min(...entries.map(e => e.timestamp)),
			newestEntry: Math.max(...entries.map(e => e.timestamp)),
			expiredEntries: entries.filter(e => this.isExpired(e)).length,
		};
	}

	/**
	 * Clean up expired entries
	 */
	cleanup(): void {
		const expiredKeys: string[] = [];

		for (const [key, entry] of this.cache.entries()) {
			if (this.isExpired(entry)) {
				expiredKeys.push(key);
			}
		}

		expiredKeys.forEach(key => this.cache.delete(key));
	}

	/**
	 * Destroy the cache manager and cleanup resources
	 */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.clear();
	}

	/**
	 * Check if an entry has expired
	 */
	private isExpired(entry: CacheEntry<T>): boolean {
		return Date.now() - entry.timestamp > this.config.maxAge;
	}

	/**
	 * Evict least recently used entry
	 */
	private evictLRU(): void {
		let oldestKey = '';
		let oldestTime = Date.now();

		for (const [key, entry] of this.cache.entries()) {
			if (entry.lastAccessed < oldestTime) {
				oldestTime = entry.lastAccessed;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
		}
	}

	/**
	 * Calculate cache hit rate
	 */
	private calculateHitRate(): number {
		const entries = Array.from(this.cache.values());
		const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
		return totalAccesses > 0 ? entries.length / totalAccesses : 0;
	}

	/**
	 * Start the cleanup timer
	 */
	private startCleanupTimer(): void {
		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.config.cleanupInterval);
	}
}

/**
 * SEO-specific cache manager for scan results
 */
export class SEOCacheManager {
	private resultsCache: CacheManager<SEOResults[]>;
	private fileCache: CacheManager<string>; // For file content caching

	constructor() {
		this.resultsCache = new CacheManager<SEOResults[]>({
			maxSize: 50, // Store up to 50 scan results
			maxAge: 60 * 60 * 1000, // 1 hour
			cleanupInterval: 10 * 60 * 1000, // 10 minutes
		});

		this.fileCache = new CacheManager<string>({
			maxSize: 200, // Store up to 200 file contents
			maxAge: 30 * 60 * 1000, // 30 minutes
			cleanupInterval: 5 * 60 * 1000, // 5 minutes
		});
	}

	/**
	 * Get cached scan results
	 * @param key - Cache key (usually scan type + timestamp)
	 * @returns Cached results or undefined
	 */
	getResults(key: string): SEOResults[] | undefined {
		return this.resultsCache.get(key);
	}

	/**
	 * Cache scan results
	 * @param key - Cache key
	 * @param results - Results to cache
	 */
	setResults(key: string, results: SEOResults[]): void {
		this.resultsCache.set(key, results);
	}

	/**
	 * Get cached file content
	 * @param filePath - File path
	 * @returns Cached content or undefined
	 */
	getFileContent(filePath: string): string | undefined {
		return this.fileCache.get(filePath);
	}

	/**
	 * Cache file content
	 * @param filePath - File path
	 * @param content - Content to cache
	 */
	setFileContent(filePath: string, content: string): void {
		this.fileCache.set(filePath, content);
	}

	/**
	 * Clear all caches
	 */
	clearAll(): void {
		this.resultsCache.clear();
		this.fileCache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		return {
			results: this.resultsCache.getStats(),
			files: this.fileCache.getStats(),
		};
	}

	/**
	 * Clean up expired entries
	 */
	cleanup(): void {
		this.resultsCache.cleanup();
		this.fileCache.cleanup();
	}

	/**
	 * Destroy cache managers
	 */
	destroy(): void {
		this.resultsCache.destroy();
		this.fileCache.destroy();
	}
}

/**
 * Global cache manager instance
 */
export const seoCache = new SEOCacheManager();

/**
 * Clear all SEO caches
 */
export function clearAllCache(): void {
	seoCache.clearAll();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
	return seoCache.getStats();
}
