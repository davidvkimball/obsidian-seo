/**
 * File utility functions for SEO plugin
 * Provides functions to check file extensions and filter files
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";

/**
 * Checks if a file has a supported extension (MD or MDX based on settings)
 * @param file - The file to check
 * @param settings - Plugin settings
 * @returns True if the file extension is supported
 */
export function isSupportedFile(file: TFile, settings: SEOSettings): boolean {
	const extension = file.extension.toLowerCase();
	if (extension === 'md') {
		return true;
	}
	if (extension === 'mdx' && settings.enableMDXSupport) {
		return true;
	}
	return false;
}

/**
 * Gets the file extension check pattern for filtering files
 * @param settings - Plugin settings
 * @returns Array of supported extensions
 */
export function getSupportedExtensions(settings: SEOSettings): string[] {
	const extensions = ['md'];
	if (settings.enableMDXSupport) {
		extensions.push('mdx');
	}
	return extensions;
}
