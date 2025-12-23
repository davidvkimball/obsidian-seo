/**
 * Error handling utilities for the SEO plugin
 * Provides consistent error handling and user feedback
 */

import { Notice } from "obsidian";

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	INFO = 'info',
	WARNING = 'warning',
	ERROR = 'error',
	CRITICAL = 'critical'
}

/**
 * Custom error class for SEO plugin errors
 */
export class SEOPluginError extends Error {
	public severity: ErrorSeverity;
	public userMessage: string;
	public suggestion?: string;

	constructor(
		message: string,
		severity: ErrorSeverity = ErrorSeverity.ERROR,
		userMessage?: string,
		suggestion?: string
	) {
		super(message);
		this.name = 'SEOPluginError';
		this.severity = severity;
		this.userMessage = userMessage || message;
		this.suggestion = suggestion;
	}
}

/**
 * Handles errors with user-friendly messages and logging
 * @param error - The error to handle
 * @param context - Context about where the error occurred
 * @param showNotice - Whether to show a notice to the user
 * @returns Formatted error information
 */
export function handleError(
	error: unknown,
	context: string,
	showNotice: boolean = true
): { message: string; severity: ErrorSeverity; suggestion?: string } {
	let message: string;
	let severity: ErrorSeverity = ErrorSeverity.ERROR;
	let suggestion: string | undefined;

	if (error instanceof SEOPluginError) {
		message = error.userMessage;
		severity = error.severity;
		suggestion = error.suggestion;
	} else if (error instanceof Error) {
		message = error.message;
		severity = ErrorSeverity.ERROR;
		suggestion = 'Please try again or check the plugin settings';
	} else {
		message = 'An unexpected error occurred';
		severity = ErrorSeverity.CRITICAL;
		suggestion = 'Please restart Obsidian and try again';
	}

	// Log error for debugging
	console.error(`[SEO Plugin] Error in ${context}:`, error);

	// Show notice to user if requested
	if (showNotice) {
		const noticeMessage = suggestion 
			? `${message} - ${suggestion}`
			: message;
		
		new Notice(noticeMessage, 5000);
	}

	return { message, severity, suggestion };
}

/**
 * Wraps async functions with error handling
 * @param fn - The async function to wrap
 * @param context - Context for error reporting
 * @param fallback - Fallback value to return on error
 * @returns Promise that resolves to the function result or fallback
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T> | T,
	context: string,
	fallback: T
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		handleError(error, context, true);
		return fallback;
	}
}

/**
 * Creates a safe async function that handles errors gracefully
 * @param fn - The async function to make safe
 * @param context - Context for error reporting
 * @param fallback - Fallback value to return on error
 * @returns Safe async function
 */
export function createSafeAsyncFunction<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	context: string,
	fallback: R
) {
	return async (...args: T): Promise<R> => {
		try {
			return await fn(...args);
		} catch (error) {
			handleError(error, context, true);
			return fallback;
		}
	};
}

/**
 * Validates that required parameters are not null/undefined
 * @param params - Object with parameter names and values
 * @param context - Context for error reporting
 * @throws SEOPluginError if any required parameter is missing
 */
export function validateRequiredParams(
	params: Record<string, unknown>,
	context: string
): void {
	const missing = Object.entries(params)
		.filter(([_, value]) => value === null || value === undefined)
		.map(([name]) => name);

	if (missing.length > 0) {
		throw new SEOPluginError(
			`Missing required parameters: ${missing.join(', ')}`,
			ErrorSeverity.ERROR,
			`Missing required parameters: ${missing.join(', ')}`,
			'Please check your plugin configuration'
		);
	}
}

/**
 * Creates a debounced function that handles errors
 * @param fn - The function to debounce
 * @param delay - Delay in milliseconds
 * @param context - Context for error reporting
 * @returns Debounced function with error handling
 */
export function createDebouncedFunction<T extends unknown[], R>(
	fn: (...args: T) => Promise<R>,
	delay: number,
	context: string
) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return async (...args: T): Promise<R | undefined> => {
		return new Promise((resolve) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(() => {
				void (async () => {
					try {
						const result = await fn(...args);
						resolve(result);
					} catch (error) {
						handleError(error, context, true);
						resolve(undefined);
					}
				})();
			}, delay);
		});
	};
}
