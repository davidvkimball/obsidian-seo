/**
 * Meta data validation checks
 * Checks for title length, meta descriptions, and keyword density
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";

/**
 * Checks meta description length and presence
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkMetaDescription(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.descriptionProperty) {
		return [];
	}
	
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		results.push({
			passed: false,
			message: "No frontmatter found",
			suggestion: "Add frontmatter with description property",
			severity: 'warning'
		});
		return results;
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		results.push({
			passed: false,
			message: "No frontmatter content found",
			suggestion: "Add frontmatter with description property",
			severity: 'warning'
		});
		return results;
	}
	const descriptionMatch = frontmatter.match(new RegExp(`^${settings.descriptionProperty}:\\s*(.+)$`, 'm'));
	
	if (!descriptionMatch || !descriptionMatch[1]) {
		results.push({
			passed: false,
			message: `No ${settings.descriptionProperty} found in frontmatter`,
			suggestion: `Add ${settings.descriptionProperty} to frontmatter`,
			severity: 'warning'
		});
		return results;
	}
	
	const description = descriptionMatch[1].trim();
	const length = description.length;
	
	if (length < 120) {
		results.push({
			passed: false,
			message: `Description too short: ${length} characters`,
			suggestion: "Aim for 120-160 characters",
			severity: 'warning'
		});
	} else if (length > 160) {
		results.push({
			passed: false,
			message: `Description too long: ${length} characters`,
			suggestion: "Aim for 120-160 characters",
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good description length: ${length} characters`,
			severity: 'info'
		});
	}
	
	return results;
}

/**
 * Checks title length and presence
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkTitleLength(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkTitleLength) {
		return [];
	}
	
	let title = '';
	
	// Check frontmatter first
	if (settings.titleProperty) {
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (frontmatterMatch && frontmatterMatch[1]) {
			const frontmatter = frontmatterMatch[1];
			const titleMatch = frontmatter.match(new RegExp(`^${settings.titleProperty}:\\s*(.+)$`, 'm'));
			if (titleMatch && titleMatch[1]) {
				title = titleMatch[1].trim();
			}
		}
	}
	
	// Fallback to filename if enabled
	if (!title && settings.useFilenameAsTitle) {
		title = file.basename;
	}
	
	// Fallback to first H1 heading
	if (!title) {
		const h1Match = content.match(/^#\s+(.+)$/m);
		if (h1Match && h1Match[1]) {
			title = h1Match[1].trim();
		}
	}
	
	// Only check title length if we have a title from frontmatter or filename
	// Don't show the check at all if no title is configured
	if (!title) {
		return results; // Return empty results - don't show the check
	}
	
	const length = title.length;
	
	if (length < 30) {
		results.push({
			passed: false,
			message: `Title too short: ${length} characters`,
			suggestion: "Aim for 30-60 characters",
			severity: 'warning'
		});
	} else if (length > 60) {
		results.push({
			passed: false,
			message: `Title too long: ${length} characters`,
			suggestion: "Aim for 30-60 characters",
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good title length: ${length} characters`,
			severity: 'info'
		});
	}
	
	return results;
}

/**
 * Checks keyword density in content
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkKeywordDensity(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty) {
		return [];
	}
	
	// Get keyword from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		results.push({
			passed: false,
			message: "No frontmatter found",
			suggestion: "Add frontmatter with keyword property",
			severity: 'warning'
		});
		return results;
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		results.push({
			passed: false,
			message: "No frontmatter content found",
			suggestion: "Add frontmatter with keyword property",
			severity: 'warning'
		});
		return results;
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
		return results;
	}
	
	// Validate that the keyword is meaningful (not just a boolean or empty)
	if (!keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		results.push({
			passed: true,
			message: `No valid keyword defined in properties`,
			severity: 'notice'
		});
		return results;
	}
	
	// Remove code blocks and frontmatter for keyword analysis
	const cleanContent = removeCodeBlocks(content);
	
	// Count keyword occurrences (case-insensitive)
	const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
	const matches = cleanContent.match(keywordRegex);
	const keywordCount = matches ? matches.length : 0;
	
	// Count total words
	const words = cleanContent.split(/\s+/).filter(word => word.length > 0);
	const totalWords = words.length;
	
	if (totalWords === 0) {
		results.push({
			passed: false,
			message: "No content found for keyword analysis",
			severity: 'warning'
		});
		return results;
	}
	
	const density = (keywordCount / totalWords) * 100;
	
	if (density < settings.keywordDensityMin) {
		results.push({
			passed: false,
			message: `Keyword density too low: ${density.toFixed(1)}%`,
			suggestion: `Aim for at least ${settings.keywordDensityMin}% density`,
			severity: 'warning'
		});
	} else if (density > settings.keywordDensityMax) {
		results.push({
			passed: false,
			message: `Keyword density too high: ${density.toFixed(1)}%`,
			suggestion: `Aim for no more than ${settings.keywordDensityMax}% density`,
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good keyword density: ${density.toFixed(1)}%`,
			severity: 'info'
		});
	}
	
	return results;
}

/**
 * Checks if keyword appears in title
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
/**
 * Checks if target keyword appears in meta description
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkKeywordInDescription(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty || !settings.descriptionProperty) {
		return [];
	}
	
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return results;
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		return results;
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
	
	if (!foundKeywordLine || !keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		// No valid keyword, skip this check
		return results;
	}
	
	// Get description from frontmatter
	let description = '';
	let foundDescriptionLine = false;
	
	for (const line of lines) {
		if (line.startsWith(settings.descriptionProperty + ':')) {
			foundDescriptionLine = true;
			description = line.substring(settings.descriptionProperty.length + 1).trim();
			break;
		}
	}
	
	if (!foundDescriptionLine) {
		results.push({
			passed: false,
			message: "No description found",
			suggestion: "Add a meta description to your frontmatter",
			severity: 'warning'
		});
		return results;
	}
	
	// Check if keyword appears in description (case-insensitive)
	const keywordLower = keyword.toLowerCase();
	const descriptionLower = description.toLowerCase();
	
	if (descriptionLower.includes(keywordLower)) {
		results.push({
			passed: true,
			message: `Target keyword "${keyword}" found in description`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Target keyword "${keyword}" not found in description`,
			suggestion: "Include your target keyword in the description",
			severity: 'warning'
		});
	}
	
	return results;
}

export async function checkKeywordInTitle(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty || !settings.titleProperty) {
		return [];
	}
	
	// Get keyword from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return results;
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		return results;
	}
	
	// Parse line by line instead of using regex
	const lines = frontmatter.split('\n');
	let keyword = '';
	let foundKeywordLine = false;
	let title = '';
	let foundTitleLine = false;
	
	for (const line of lines) {
		if (line.startsWith(settings.keywordProperty + ':')) {
			foundKeywordLine = true;
			keyword = line.substring(settings.keywordProperty.length + 1).trim();
			break;
		}
	}
	
	for (const line of lines) {
		if (line.startsWith(settings.titleProperty + ':')) {
			foundTitleLine = true;
			title = line.substring(settings.titleProperty.length + 1).trim();
			break;
		}
	}
	
	if (!foundKeywordLine) {
		results.push({
			passed: true,
			message: `No ${settings.keywordProperty} defined in properties`,
			severity: 'notice'
		});
		return results;
	}

	if (!keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		results.push({
			passed: true,
			message: `No valid keyword defined in properties`,
			severity: 'notice'
		});
		return results;
	}
	
	// Skip check if no title found
	if (!foundTitleLine || !title) {
		return results;
	}
	
	// Check if keyword appears in title (case-insensitive, generous matching)
	const titleLower = title.toLowerCase();
	const keywordLower = keyword.toLowerCase();
	
	// Split keyword into words for more flexible matching
	const keywordWords = keywordLower.split(/\s+/).filter(word => word.length > 0);
	
	// Check if all keyword words appear in the title
	const allWordsFound = keywordWords.every(word => titleLower.includes(word));
	
	if (allWordsFound) {
		results.push({
			passed: true,
			message: `Target keyword "${keyword}" found in title`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Target keyword "${keyword}" not found in title`,
			suggestion: "Include your target keyword in the title",
			severity: 'warning'
		});
	}
	
	return results;
}
