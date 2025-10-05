/**
 * Alt text validation for images
 * Checks for missing alt text in markdown, wikilink, and HTML images
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";
import { findLineNumberForImage, getContextAroundLine } from "./utils/position-utils";

/**
 * Checks for missing alt text in images
 * Validates markdown images, wikilink images, and HTML img tags
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkAltText(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkAltText) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Check markdown images ![alt](src)
	const markdownImages = cleanContent.match(/!\[([^\]]*)\]\([^)]+\)/g);
	if (markdownImages) {
		const missingAltText = markdownImages.filter(match => {
			const altText = match.match(/!\[([^\]]*)\]/)?.[1];
			return !altText || altText.trim() === '';
		});
		if (missingAltText.length > 0) {
			// Create individual results for each missing alt text image
			missingAltText.forEach((match, index) => {
				const pathMatch = match.match(/!\[[^\]]*\]\(([^)]+)\)/);
				const imagePath = pathMatch ? pathMatch[1] : match;
				const lineNumber = findLineNumberForImage(content, match);
				
				results.push({
					passed: false,
					message: `Image missing alt text: ${imagePath}`,
					suggestion: "Add descriptive alt text for accessibility",
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: match,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
	// Check wikilink images ![[image.png]]] and ![[image.png|alt text]]
	const wikilinkImages = cleanContent.match(/!\[\[([^\]]+)\]\]/g);
	if (wikilinkImages) {
		const missingAltText = wikilinkImages.filter(match => !match.includes('|'));
		if (missingAltText.length > 0) {
			// Create individual results for each missing alt text wikilink image
			missingAltText.forEach((match, index) => {
				const pathMatch = match.match(/!\[\[([^\]]+)\]\]/);
				const imagePath = pathMatch ? pathMatch[1] : match;
				const lineNumber = findLineNumberForImage(content, match);
				
				results.push({
					passed: false,
					message: `Wikilink image missing alt text: ${imagePath}`,
					suggestion: "Add alt text using ![[image.png|alt text]] syntax or consider using standard markdown image syntax",
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: match,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
	// Check HTML images <img alt="text">
	const htmlImages = cleanContent.match(/<img[^>]*>/g);
	if (htmlImages) {
		const missingAlt = htmlImages.filter(img => {
			// Check if alt attribute is missing or empty
			const altMatch = img.match(/alt\s*=\s*["']([^"']*)["']/);
			return !altMatch || !altMatch[1] || altMatch[1].trim() === '';
		});
		if (missingAlt.length > 0) {
			// Create individual results for each missing alt attribute
			missingAlt.forEach((img, index) => {
				const srcMatch = img.match(/src\s*=\s*["']([^"']*)["']/);
				const imagePath = srcMatch ? srcMatch[1] : 'HTML img tag';
				const lineNumber = findLineNumberForImage(content, img);
				
				results.push({
					passed: false,
					message: `HTML image missing alt attribute: ${imagePath}`,
					suggestion: "Add alt attribute to HTML img tag",
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: img,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
	if (results.length === 0) {
		// Check if there are any images at all
		const hasImages = markdownImages && markdownImages.length > 0 || htmlImages && htmlImages.length > 0 || wikilinkImages && wikilinkImages.length > 0;
		if (hasImages) {
			results.push({
				passed: true,
				message: "All images have alt text",
				severity: 'info'
			});
		} else {
			results.push({
				passed: true,
				message: "No images in this post",
				severity: 'info'
			});
		}
	}
	
	return results;
}
