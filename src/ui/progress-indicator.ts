/**
 * Progress indicator component for SEO operations
 * Provides visual feedback for long-running operations
 */

import { Component } from "obsidian";
import { ProgressInfo } from "../utils/performance";

/**
 * Progress indicator component
 */
export class ProgressIndicator extends Component {
	private container: HTMLElement;
	private progressBar!: HTMLElement;
	private progressText!: HTMLElement;
	private isVisible: boolean = false;

	constructor(container: HTMLElement) {
		super();
		this.container = container;
		this.createProgressIndicator();
	}

	/**
	 * Create the progress indicator DOM elements
	 */
	private createProgressIndicator(): void {
		// Create progress container
		const progressContainer = this.container.createDiv('seo-progress-container');

		// Create progress text
		this.progressText = progressContainer.createDiv('seo-progress-text');

		// Create progress bar container
		const progressBarContainer = progressContainer.createDiv('seo-progress-bar-container');

		// Create progress bar
		this.progressBar = progressBarContainer.createDiv('seo-progress-bar');

		// Create cancel button
		const cancelButton = progressContainer.createEl('button', {
			text: 'Cancel',
			cls: 'seo-progress-cancel'
		});

		// Store reference to container
		this.container = progressContainer;
	}

	/**
	 * Show progress indicator
	 * @param message - Initial message to display
	 */
	show(message: string = 'Processing...'): void {
		this.progressText.textContent = message;
		this.container.removeClass('seo-progress-container-hidden');
		this.container.addClass('seo-progress-container-visible');
		this.isVisible = true;
	}

	/**
	 * Hide progress indicator
	 */
	hide(): void {
		this.container.removeClass('seo-progress-container-visible');
		this.container.addClass('seo-progress-container-hidden');
		this.isVisible = false;
	}

	/**
	 * Update progress
	 * @param progress - Progress information
	 */
	updateProgress(progress: ProgressInfo): void {
		if (!this.isVisible) {
			this.show();
		}

		// Update progress bar using CSS custom property
		this.progressBar.style.setProperty('--seo-progress-width', `${progress.percentage}%`);

		// Update progress text
		const elapsed = this.formatDuration(progress.elapsed);
		const remaining = this.formatDuration(progress.remaining);
		
		this.progressText.textContent = 
			`${progress.current}/${progress.total} (${progress.percentage.toFixed(1)}%) - ` +
			`Elapsed: ${elapsed}, Remaining: ${remaining}`;
	}

	/**
	 * Set progress message
	 * @param message - Message to display
	 */
	setMessage(message: string): void {
		this.progressText.textContent = message;
	}

	/**
	 * Set cancel callback
	 * @param callback - Function to call when cancel is clicked
	 */
	setCancelCallback(callback: () => void): void {
		const cancelButton = this.container.querySelector('.seo-progress-cancel') as HTMLButtonElement;
		if (cancelButton) {
			cancelButton.onclick = callback;
		}
	}

	/**
	 * Check if progress indicator is visible
	 */
	isProgressVisible(): boolean {
		return this.isVisible;
	}

	/**
	 * Format duration in human-readable format
	 * @param ms - Duration in milliseconds
	 * @returns Formatted duration string
	 */
	private formatDuration(ms: number): string {
		if (ms < 1000) {
			return `${Math.round(ms)}ms`;
		} else if (ms < 60000) {
			return `${(ms / 1000).toFixed(1)}s`;
		} else {
			return `${(ms / 60000).toFixed(1)}m`;
		}
	}
}

/**
 * Progress indicator manager for coordinating multiple progress indicators
 */
export class ProgressManager {
	private indicators: Map<string, ProgressIndicator> = new Map();
	private globalProgress: ProgressInfo | null = null;

	/**
	 * Create a progress indicator
	 * @param id - Unique identifier for the indicator
	 * @param container - Container element
	 * @returns Progress indicator instance
	 */
	createIndicator(id: string, container: HTMLElement): ProgressIndicator {
		const indicator = new ProgressIndicator(container);
		this.indicators.set(id, indicator);
		return indicator;
	}

	/**
	 * Get a progress indicator by ID
	 * @param id - Indicator ID
	 * @returns Progress indicator or undefined
	 */
	getIndicator(id: string): ProgressIndicator | undefined {
		return this.indicators.get(id);
	}

	/**
	 * Remove a progress indicator
	 * @param id - Indicator ID
	 */
	removeIndicator(id: string): void {
		const indicator = this.indicators.get(id);
		if (indicator) {
			indicator.hide();
			this.indicators.delete(id);
		}
	}

	/**
	 * Update global progress
	 * @param progress - Progress information
	 */
	updateGlobalProgress(progress: ProgressInfo): void {
		this.globalProgress = progress;
		
		// Update all indicators
		this.indicators.forEach(indicator => {
			indicator.updateProgress(progress);
		});
	}

	/**
	 * Hide all progress indicators
	 */
	hideAll(): void {
		this.indicators.forEach(indicator => {
			indicator.hide();
		});
	}

	/**
	 * Get global progress information
	 */
	getGlobalProgress(): ProgressInfo | null {
		return this.globalProgress;
	}

	/**
	 * Clear all progress indicators
	 */
	clear(): void {
		this.hideAll();
		this.indicators.clear();
		this.globalProgress = null;
	}
}
