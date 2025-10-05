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
export async function checkExternalBrokenLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to link-checks.ts
	return [];
}

export async function checkExternalLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to link-checks.ts
	return [];
}

export async function checkExternalLinksOnly(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to link-checks.ts
	return [];
}

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
	// TODO: Move this to utils
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
