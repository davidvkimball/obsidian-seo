/**
 * Performance optimization utilities
 * Provides debouncing, throttling, and progress tracking
 */

interface PerformanceMemory {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
	memory?: PerformanceMemory;
}

/**
 * Debounce function - delays execution until after wait time has passed
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @param immediate - Execute immediately on first call
 * @returns Debounced function
 */
export function debounce<T extends unknown[]>(
	func: (...args: T) => void,
	wait: number,
	immediate: boolean = false
): (...args: T) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return function executedFunction(...args: T) {
		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};

		const callNow = immediate && !timeout;

		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) {
			func(...args);
		}
	};
}

/**
 * Throttle function - limits execution to once per wait time
 * @param func - Function to throttle
 * @param wait - Wait time in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends unknown[]>(
	func: (...args: T) => void,
	wait: number
): (...args: T) => void {
	let inThrottle: boolean = false;

	return function executedFunction(this: unknown, ...args: T) {
		if (!inThrottle) {
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), wait);
		}
	};
}

/**
 * Progress tracker for long-running operations
 */
export class ProgressTracker {
	private total: number = 0;
	private current: number = 0;
	private startTime: number = 0;
	private callbacks: ((progress: ProgressInfo) => void)[] = [];

	/**
	 * Start tracking progress
	 * @param total - Total number of items to process
	 */
	start(total: number): void {
		this.total = total;
		this.current = 0;
		this.startTime = Date.now();
		this.notifyCallbacks();
	}

	/**
	 * Update current progress
	 * @param current - Current number of items processed
	 */
	update(current: number): void {
		this.current = current;
		this.notifyCallbacks();
	}

	/**
	 * Increment progress by 1
	 */
	increment(): void {
		this.current++;
		this.notifyCallbacks();
	}

	/**
	 * Complete the progress tracking
	 */
	complete(): void {
		this.current = this.total;
		this.notifyCallbacks();
	}

	/**
	 * Add a callback for progress updates
	 * @param callback - Callback function
	 */
	onProgress(callback: (progress: ProgressInfo) => void): void {
		this.callbacks.push(callback);
	}

	/**
	 * Remove a progress callback
	 * @param callback - Callback function to remove
	 */
	offProgress(callback: (progress: ProgressInfo) => void): void {
		const index = this.callbacks.indexOf(callback);
		if (index > -1) {
			this.callbacks.splice(index, 1);
		}
	}

	/**
	 * Notify all callbacks of progress update
	 */
	private notifyCallbacks(): void {
		const progress = this.getProgressInfo();
		this.callbacks.forEach(callback => callback(progress));
	}

	/**
	 * Get current progress information
	 */
	getProgressInfo(): ProgressInfo {
		const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
		const elapsed = Date.now() - this.startTime;
		const estimatedTotal = this.current > 0 ? (elapsed / this.current) * this.total : 0;
		const remaining = Math.max(0, estimatedTotal - elapsed);

		return {
			current: this.current,
			total: this.total,
			percentage: Math.round(percentage * 100) / 100,
			elapsed,
			remaining,
			estimatedTotal,
		};
	}
}

/**
 * Progress information interface
 */
export interface ProgressInfo {
	current: number;
	total: number;
	percentage: number;
	elapsed: number;
	remaining: number;
	estimatedTotal: number;
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
	private initialMemory: number = 0;
	private peakMemory: number = 0;
	private samples: number[] = [];

	constructor() {
		this.initialMemory = this.getCurrentMemory();
		this.peakMemory = this.initialMemory;
	}

	/**
	 * Get current memory usage (approximate)
	 */
	getCurrentMemory(): number {
		const perf = performance as PerformanceWithMemory;
		if (perf.memory) {
			return perf.memory.usedJSHeapSize;
		}
		return 0;
	}

	/**
	 * Sample current memory usage
	 */
	sample(): void {
		const current = this.getCurrentMemory();
		this.samples.push(current);
		this.peakMemory = Math.max(this.peakMemory, current);

		// Keep only last 100 samples
		if (this.samples.length > 100) {
			this.samples.shift();
		}
	}

	/**
	 * Get memory statistics
	 */
	getStats(): MemoryStats {
		const current = this.getCurrentMemory();
		const average = this.samples.length > 0 
			? this.samples.reduce((sum, sample) => sum + sample, 0) / this.samples.length 
			: current;

		return {
			initial: this.initialMemory,
			current,
			peak: this.peakMemory,
			average,
			growth: current - this.initialMemory,
			samples: this.samples.length,
		};
	}

	/**
	 * Check if memory usage is concerning
	 */
	isMemoryUsageConcerning(): boolean {
		const stats = this.getStats();
		const threshold = 100 * 1024 * 1024; // 100MB
		return stats.current > threshold || stats.growth > 50 * 1024 * 1024; // 50MB growth
	}
}

/**
 * Memory statistics interface
 */
export interface MemoryStats {
	initial: number;
	current: number;
	peak: number;
	average: number;
	growth: number;
	samples: number;
}

/**
 * Batch processor for handling large datasets
 */
export class BatchProcessor<T> {
	private batchSize: number;
	private delay: number;
	private processor: (batch: T[]) => Promise<void>;
	private queue: T[] = [];
	private isProcessing: boolean = false;

	constructor(
		processor: (batch: T[]) => Promise<void>,
		batchSize: number = 10,
		delay: number = 100
	) {
		this.processor = processor;
		this.batchSize = batchSize;
		this.delay = delay;
	}

	/**
	 * Add item to processing queue
	 * @param item - Item to process
	 */
	add(item: T): void {
		this.queue.push(item);
		void this.processIfNeeded();
	}

	/**
	 * Add multiple items to processing queue
	 * @param items - Items to process
	 */
	addBatch(items: T[]): void {
		this.queue.push(...items);
		void this.processIfNeeded();
	}

	/**
	 * Process queue if not already processing
	 */
	private async processIfNeeded(): Promise<void> {
		if (this.isProcessing || this.queue.length === 0) {
			return;
		}

		this.isProcessing = true;

		try {
			while (this.queue.length > 0) {
				const batch = this.queue.splice(0, this.batchSize);
				await this.processor(batch);
				
				if (this.delay > 0) {
					await new Promise(resolve => setTimeout(resolve, this.delay));
				}
			}
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Get current queue length
	 */
	getQueueLength(): number {
		return this.queue.length;
	}

	/**
	 * Check if processor is currently working
	 */
	isBusy(): boolean {
		return this.isProcessing;
	}
}

/**
 * Global performance utilities
 */
export const performanceUtils = {
	/**
	 * Create a debounced function with default settings
	 */
	createDebounced: <T extends unknown[]>(func: (...args: T) => void, wait: number = 300) => 
		debounce(func, wait),

	/**
	 * Create a throttled function with default settings
	 */
	createThrottled: <T extends unknown[]>(func: (...args: T) => void, wait: number = 100) => 
		throttle(func, wait),

	/**
	 * Format memory size in human-readable format
	 */
	formatMemorySize(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(1)} ${units[unitIndex]}`;
	},

	/**
	 * Format time duration in human-readable format
	 */
	formatDuration(ms: number): string {
		if (ms < 1000) {
			return `${ms}ms`;
		} else if (ms < 60000) {
			return `${(ms / 1000).toFixed(1)}s`;
		} else {
			return `${(ms / 60000).toFixed(1)}m`;
		}
	},
};
