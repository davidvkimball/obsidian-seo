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
	checkKeywordDensity, 
	checkKeywordInTitle 
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

export async function checkNotices(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to content-checks.ts
	return [];
}

export async function checkKeywordInSlug(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to meta-checks.ts
	return [];
}

export async function checkSlugFormat(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to meta-checks.ts
	return [];
}

export async function checkPotentiallyBrokenEmbeds(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to link-checks.ts
	return [];
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
	// Fallback to file name
	return file.basename;
}

export function getSlugFromFile(file: TFile, content: string, settings: SEOSettings): string {
	// TODO: Move this to utils
	return file.basename;
}

// Import types
import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
