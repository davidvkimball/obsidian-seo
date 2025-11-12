/**
 * Image validation checks
 * Checks for image naming conventions and file naming best practices
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";
import { findLineNumberForImage, getContextAroundLine } from "./utils/position-utils";

/**
 * Checks image file naming conventions
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkImageNaming(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkImageNaming) {
		return Promise.resolve([]);
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find image references with line numbers
	const lines = content.split('\n');
	const imageMatches = cleanContent.match(/!\[[^\]]*\]\(([^)]+)\)/g);
	if (imageMatches) {
		imageMatches.forEach((match, index) => {
			const imagePath = match.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
			if (imagePath) {
				const fileName = imagePath.split('/').pop() || '';
				
				// Find the line number for this image
				const lineNumber = findLineNumberForImage(content, match);
				
				// Check for problematic patterns
				if (fileName.includes(' ') || fileName.includes('%20')) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has spaces in file name: ${fileName}`,
						suggestion: "Use kebab-case or underscores instead of spaces",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (fileName.match(/^[a-f0-9]{8,}$/) || 
						   fileName.match(/^[a-f0-9]{8,}_[A-Z0-9]+\./) ||
						   fileName.match(/^[a-f0-9]{8,}_MD5\./) ||
						   fileName.match(/^[a-f0-9]{20,}\./)) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has random file name: ${fileName}`,
						suggestion: "Use descriptive file names",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (fileName.toLowerCase().includes('pasted') || 
						   fileName.toLowerCase().includes('untitled') ||
						   fileName.toLowerCase().includes('photo') ||
						   // Only flag generic screenshots (no descriptive content)
						   fileName.match(/^screenshot\d*\.(png|jpg|jpeg|gif|webp)$/i) ||
						   // Flag screenshots with only random characters
						   (fileName.toLowerCase().includes('screenshot') && 
						    fileName.match(/^screenshot[a-f0-9]{6,}\.(png|jpg|jpeg|gif|webp)$/i))) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has a potentially generic file name: ${fileName}`,
						suggestion: "Use descriptive file names",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (fileName.length < 5 || fileName.length > 50) {
					results.push({
						passed: false,
						message: `Image ${index + 1} exceeds suggested file name length: ${fileName}`,
						suggestion: "Use descriptive file names between 5-50 characters",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				}
			}
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "All images have good file names",
			severity: 'info'
		});
	}
	
	return Promise.resolve(results);
}
