/**
 * SEO Checks - Main Export File
 * This file exports all SEO check functions from their focused modules
 */

// Alt text checks
export { checkAltText } from './alt-text-check';

// Link checks
export { 
	checkNakedLinks, 
	checkBrokenLinks, 
	checkPotentiallyBrokenLinks 
} from './link-checks';

// External link checks
export { 
	checkExternalLinks, 
	checkExternalBrokenLinks, 
	checkExternalLinksOnly 
} from './external-link-checks';

// Content checks
export { 
	checkContentLength, 
	checkReadingLevel, 
	checkDuplicateContent 
} from './content-checks';

// Meta checks
export { 
	checkMetaDescription, 
	checkTitleLength, 
	checkTitleH1Uniqueness,
	checkKeywordDensity, 
	checkKeywordInTitle,
	checkKeywordInDescription,
	checkKeywordInHeadings
} from './meta-checks';

// Heading checks
export { checkHeadingOrder } from './heading-checks';

// Image checks
export { checkImageNaming } from './image-checks';

// Utility functions
export { 
	removeCodeBlocks, 
	removeHtmlAttributes 
} from './utils/content-parser';

export { 
	findLineNumberForImage, 
	getContextAroundLine 
} from './utils/position-utils';

export { 
	countSyllables, 
	getReadingLevelDescription 
} from './utils/reading-level';

// Legacy functions that need to be moved or refactored
// These are still in the original file and need to be addressed

export function checkNotices(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to content-checks.ts
	return Promise.resolve([]);
}

export function checkKeywordInSlug(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty) {
		return Promise.resolve(results);
	}
	
	// Get keyword from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return Promise.resolve(results);
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		return Promise.resolve(results);
	}
	
	// Parse line by line instead of using regex
	const lines = frontmatter.split('\n');
	let keyword = '';
	let foundKeywordLine = false;
	
	for (const line of lines) {
		if (line.startsWith(settings.keywordProperty + ':')) {
			foundKeywordLine = true;
			keyword = line.substring(settings.keywordProperty.length + 1).trim();
			break;
		}
	}
	
	if (!foundKeywordLine) {
		results.push({
			passed: true,
			message: `No ${settings.keywordProperty} defined in properties`,
			severity: 'notice'
		});
		return Promise.resolve(results);
	}
	
	// Validate that the keyword is meaningful (not just a boolean or empty)
	if (!keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		results.push({
			passed: true,
			message: `No valid keyword defined in properties`,
			severity: 'notice'
		});
		return Promise.resolve(results);
	}
	
	// Get the file slug (filename without extension)
	const slug = file.basename.toLowerCase();
	const keywordLower = keyword.toLowerCase();
	
	// Check if keyword appears in slug (case-insensitive, generous matching)
	const keywordWords = keywordLower.split(/\s+/).filter(word => word.length > 0);
	const allWordsFound = keywordWords.every(word => slug.includes(word));
	
	if (allWordsFound) {
		results.push({
			passed: true,
			message: `Target keyword "${keyword}" found in slug`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Target keyword "${keyword}" not found in slug`,
			suggestion: "Include your target keyword in the filename",
			severity: 'warning'
		});
	}
	
	return Promise.resolve(results);
}

export function checkSlugFormat(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to meta-checks.ts
	return Promise.resolve([]);
}

export function checkPotentiallyBrokenEmbeds(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to link-checks.ts
	return Promise.resolve([]);
}

export function getDisplayName(file: TFile, content: string, settings: SEOSettings): string {
	if (settings.useNoteTitles && settings.titleProperty.trim()) {
		// Try to get title from frontmatter - handle various formats
		let frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (!frontmatterMatch) {
			// Try without carriage returns
			frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		}
		if (!frontmatterMatch) {
			// Try with just dashes and any whitespace
			frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n\s*---/);
		}

		if (frontmatterMatch && frontmatterMatch[1]) {
			const frontmatter = frontmatterMatch[1];

			// Split by lines and look for the property
			const lines = frontmatter.split('\n');

			for (const line of lines) {
				if (!line) continue;
				const trimmedLine = line.trim();

				if (trimmedLine.startsWith(settings.titleProperty + ':')) {
					// Extract the value after the colon
					const colonIndex = trimmedLine.indexOf(':');
					if (colonIndex !== -1) {
						let title = trimmedLine.substring(colonIndex + 1).trim();

						// Remove surrounding quotes if present
						if ((title.startsWith('"') && title.endsWith('"')) ||
							(title.startsWith("'") && title.endsWith("'"))) {
							title = title.slice(1, -1);
						}

						if (title) {
							return title;
						}
					}
				}
			}
		}
	}
	// Fallback to file path with parent folder
	return getDisplayPath(file.path);
}

export function getSlugFromFile(file: TFile, content: string, settings: SEOSettings): string {
	// TODO: Move this to utils
	return file.basename;
}

// Import types
import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { getDisplayPath } from "../ui/panel-utils";
