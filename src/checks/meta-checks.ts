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
	const keywordMatch = frontmatter.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
	
	if (!keywordMatch || !keywordMatch[1]) {
		// Don't penalize if no keyword is defined - just show as notice
		results.push({
			passed: true,
			message: `No ${settings.keywordProperty} defined in properties`,
			severity: 'notice'
		});
		return results;
	}
	
	const keyword = keywordMatch[1].trim();
	
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
	const keywordMatch = frontmatter.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
	const titleMatch = frontmatter.match(new RegExp(`^${settings.titleProperty}:\\s*(.+)$`, 'm'));
	
	const keyword = keywordMatch?.[1]?.trim();
	const title = titleMatch?.[1]?.trim();
	
	// Skip check if no title found
	if (!title) {
		return results;
	}
	
	// If no keyword is defined, show as notice (not a penalty)
	if (!keyword) {
		results.push({
			passed: true,
			message: `No ${settings.keywordProperty} defined in properties`,
			severity: 'notice'
		});
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
			suggestion: "Include your target keyword in the title for better SEO",
			severity: 'warning'
		});
	}
	
	return results;
}
