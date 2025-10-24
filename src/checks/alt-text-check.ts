/**
 * Alt text validation for media content
 * Checks for missing alt text in markdown, wikilink, and HTML media elements (images, videos, embeds, etc.)
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";
import { findLineNumberForImage, getContextAroundLine } from "./utils/position-utils";

/**
 * Checks for missing alt text in media content
 * Validates markdown media, wikilink media, and HTML media tags (images, videos, embeds, etc.)
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
	
	// Check markdown media ![alt](src)
	const markdownImages = cleanContent.match(/!\[([^\]]*)\]\([^)]+\)/g);
	if (markdownImages) {
		const missingAltText = markdownImages.filter(match => {
			const altText = match.match(/!\[([^\]]*)\]/)?.[1];
			return !altText || altText.trim() === '';
		});
		if (missingAltText.length > 0) {
			// Create individual results for each missing alt text media element
			missingAltText.forEach((match, index) => {
				const pathMatch = match.match(/!\[[^\]]*\]\(([^)]+)\)/);
				const imagePath = pathMatch ? pathMatch[1] : match;
				const lineNumber = findLineNumberForImage(content, match);
				
				results.push({
					passed: false,
					message: `Media missing alt text: ${imagePath}`,
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
	
	// Check wikilink media ![[media.png]]] and ![[media.png|alt text]]
	const wikilinkImages = cleanContent.match(/!\[\[([^\]]+)\]\]/g);
	if (wikilinkImages) {
		const missingAltText = wikilinkImages.filter(match => !match.includes('|'));
		if (missingAltText.length > 0) {
			// Create individual results for each missing alt text wikilink media element
			missingAltText.forEach((match, index) => {
				const pathMatch = match.match(/!\[\[([^\]]+)\]\]/);
				const imagePath = pathMatch ? pathMatch[1] : match;
				const lineNumber = findLineNumberForImage(content, match);
				
				results.push({
					passed: false,
					message: `Wikilink media missing alt text: ${imagePath}`,
					suggestion: "Add alt text using ![[media.png|alt text]] syntax or consider using standard markdown media syntax",
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
	
	// Check HTML media <img alt="text">
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
					message: `HTML media missing alt attribute: ${imagePath}`,
					suggestion: "Add alt attribute to HTML media tag",
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
		// Check if there are any media elements at all
		const hasMedia = markdownImages && markdownImages.length > 0 || htmlImages && htmlImages.length > 0 || wikilinkImages && wikilinkImages.length > 0;
		if (hasMedia) {
			results.push({
				passed: true,
				message: "All media elements have alt text",
				severity: 'info'
			});
		} else {
			results.push({
				passed: true,
				message: "No media elements in this post",
				severity: 'info'
			});
		}
	}
	
	return results;
}
