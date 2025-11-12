/**
 * Meta data validation checks
 * Checks for title length, meta descriptions, and keyword density
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";
import { getContextAroundLine } from "./utils/position-utils";

/**
 * Checks meta description length and presence
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkMetaDescription(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.descriptionProperty) {
		return Promise.resolve([]);
	}
	
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		results.push({
			passed: false,
			message: "No frontmatter found",
			suggestion: "Add frontmatter with description property",
			severity: 'warning'
		});
		return Promise.resolve(results);
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		results.push({
			passed: false,
			message: "No frontmatter content found",
			suggestion: "Add frontmatter with description property",
			severity: 'warning'
		});
		return Promise.resolve(results);
	}
	const descriptionMatch = frontmatter.match(new RegExp(`^${settings.descriptionProperty}:\\s*(.+)$`, 'm'));
	
	if (!descriptionMatch || !descriptionMatch[1]) {
		results.push({
			passed: false,
			message: `No ${settings.descriptionProperty} found in frontmatter`,
			suggestion: `Add ${settings.descriptionProperty} to frontmatter`,
			severity: 'warning'
		});
		return Promise.resolve(results);
	}
	
	let description = descriptionMatch[1].trim();
	
	// Remove surrounding quotes if present
	if ((description.startsWith('"') && description.endsWith('"')) || 
		(description.startsWith("'") && description.endsWith("'"))) {
		description = description.slice(1, -1);
	}
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
	
	return Promise.resolve(results);
}

/**
 * Checks title length and presence
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkTitleLength(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkTitleLength) {
		return Promise.resolve([]);
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
		return Promise.resolve(results); // Return empty results - don't show the check
	}
	
	// Apply prefix/suffix if configured (adds space for character count)
	const fullTitle = settings.titlePrefixSuffix ? `${title} ${settings.titlePrefixSuffix}` : title;
	const length = fullTitle.length;
	
	if (length < 30) {
		const message = settings.titlePrefixSuffix 
			? `Title too short: ${length} characters (${title} + " ${settings.titlePrefixSuffix}")`
			: `Title too short: ${length} characters`;
		results.push({
			passed: false,
			message,
			suggestion: "Aim for 30-60 characters",
			severity: 'warning'
		});
	} else if (length > 60) {
		const message = settings.titlePrefixSuffix 
			? `Title too long: ${length} characters (${title} + " ${settings.titlePrefixSuffix}")`
			: `Title too long: ${length} characters`;
		results.push({
			passed: false,
			message,
			suggestion: "Aim for 30-60 characters",
			severity: 'warning'
		});
	} else {
		const message = settings.titlePrefixSuffix 
			? `Good title length: ${length} characters (${title} + " ${settings.titlePrefixSuffix}")`
			: `Good title length: ${length} characters`;
		results.push({
			passed: true,
			message,
			severity: 'info'
		});
	}
	
	return Promise.resolve(results);
}

/**
 * Checks keyword density in content
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkKeywordDensity(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty) {
		return Promise.resolve([]);
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
		return Promise.resolve(results);
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		results.push({
			passed: false,
			message: "No frontmatter content found",
			suggestion: "Add frontmatter with keyword property",
			severity: 'warning'
		});
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
	
	// Remove code blocks and frontmatter for keyword analysis
	let cleanContent = removeCodeBlocks(content);
	
	// Add title to content for keyword density calculation if it exists
	const titleFrontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (titleFrontmatterMatch && titleFrontmatterMatch[1] && settings.titleProperty) {
		const frontmatter = titleFrontmatterMatch[1];
		const lines = frontmatter.split('\n');
		
		for (const line of lines) {
			if (line.startsWith(settings.titleProperty + ':')) {
				let title = line.substring(settings.titleProperty.length + 1).trim();
				// Remove surrounding quotes if present
				if ((title.startsWith('"') && title.endsWith('"')) || 
					(title.startsWith("'") && title.endsWith("'"))) {
					title = title.slice(1, -1);
				}
				// Remove title prefix/suffix if specified (for keyword density, we want the raw title)
				// Note: We don't remove prefix/suffix here because keyword density should count the actual title
				// Add title to content for keyword analysis
				cleanContent = title + ' ' + cleanContent;
				break;
			}
		}
	}
	
	// Count keyword occurrences (case-insensitive, flexible matching)
	const keywordLower = keyword.toLowerCase();
	const cleanContentLower = cleanContent.toLowerCase();
	
	// Split keyword into words for more flexible matching
	const keywordWords = keywordLower.split(/\s+/).filter(word => word.length > 0);
	
	// Count occurrences by checking if all keyword words appear together
	// This handles variations like "single-source-of-truth" vs "single source of truth"
	let keywordCount = 0;
	const contentWords = cleanContentLower.split(/\s+/);
	
	for (let i = 0; i <= contentWords.length - keywordWords.length; i++) {
		const phrase = contentWords.slice(i, i + keywordWords.length).join(' ');
		// Check if all keyword words appear in this phrase (in any order)
		const allWordsFound = keywordWords.every(word => phrase.includes(word));
		if (allWordsFound) {
			keywordCount++;
		}
	}
	
	// Count total words
	const words = cleanContent.split(/\s+/).filter(word => word.length > 0);
	const totalWords = words.length;
	
	if (totalWords === 0) {
		results.push({
			passed: false,
			message: "No content found for keyword analysis",
			severity: 'warning'
		});
		return Promise.resolve(results);
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
	
	return Promise.resolve(results);
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
export function checkKeywordInDescription(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty || !settings.descriptionProperty) {
		return Promise.resolve([]);
	}
	
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
	
	if (!foundKeywordLine || !keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		// No valid keyword, skip this check
		return Promise.resolve(results);
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
		return Promise.resolve(results);
	}
	
	// Check if keyword appears in description (case-insensitive, flexible matching)
	const keywordLower = keyword.toLowerCase();
	const descriptionLower = description.toLowerCase();
	
	// Split keyword into words for more flexible matching
	const keywordWords = keywordLower.split(/\s+/).filter(word => word.length > 0);
	
	// Check if all keyword words appear in the description
	const allWordsFound = keywordWords.every(word => descriptionLower.includes(word));
	
	if (allWordsFound) {
		results.push({
			passed: true,
			message: `Keyword found in description`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Keyword not found in description`,
			suggestion: "Include your target keyword in the description",
			severity: 'warning'
		});
	}
	
	return Promise.resolve(results);
}

/**
 * Checks if meta title and H1 are unique (not identical)
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkTitleH1Uniqueness(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.titleProperty) {
		return Promise.resolve(results);
	}
	
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return Promise.resolve(results);
	}
	
	const frontmatter = frontmatterMatch[1];
	if (!frontmatter) {
		return Promise.resolve(results);
	}
	
	// Get title from frontmatter
	let metaTitle = '';
	const lines = frontmatter.split('\n');
	
	for (const line of lines) {
		if (line.startsWith(settings.titleProperty + ':')) {
			metaTitle = line.substring(settings.titleProperty.length + 1).trim();
			// Remove surrounding quotes if present
			if ((metaTitle.startsWith('"') && metaTitle.endsWith('"')) || 
				(metaTitle.startsWith("'") && metaTitle.endsWith("'"))) {
				metaTitle = metaTitle.slice(1, -1);
			}
			break;
		}
	}
	
	if (!metaTitle) {
		// No title found in frontmatter - this check requires a title to be meaningful
		// Skip silently as this is expected behavior when no title is set
		return Promise.resolve(results);
	}
	
	// Get H1 heading
	let h1Heading = '';
	
	// If "Title property is H1" is enabled, use the title as H1
	if (settings.skipH1Check) {
		// If there's a prefix/suffix configured, they will always be different
		if (settings.titlePrefixSuffix && settings.titlePrefixSuffix.trim()) {
			results.push({
				passed: true,
				message: "Meta title and H1 are unique (prefix/suffix configured)",
				severity: 'info'
			});
			return Promise.resolve(results);
		}
		
		// The H1 is the title without prefix/suffix
		h1Heading = metaTitle;
		// Remove prefix/suffix if specified to get the actual H1 content
		if (settings.titlePrefixSuffix) {
			const prefixSuffix = settings.titlePrefixSuffix;
			// Remove prefix
			if (h1Heading.startsWith(prefixSuffix)) {
				h1Heading = h1Heading.substring(prefixSuffix.length).trim();
			}
			// Remove suffix
			if (h1Heading.endsWith(prefixSuffix)) {
				h1Heading = h1Heading.substring(0, h1Heading.length - prefixSuffix.length).trim();
			}
		}
		// Now metaTitle has prefix/suffix, h1Heading doesn't - they should be different
	} else {
		// Look for actual H1 in content
		const contentLines = content.split('\n');
		for (const line of contentLines) {
			if (!line) continue;
			const h1Match = line.match(/^#\s+(.+)$/);
			if (h1Match && h1Match[1]) {
				h1Heading = h1Match[1].trim();
				break;
			}
		}
	}
	
	if (!h1Heading) {
		// No H1 found - this should be flagged as a warning
		// The heading order check should already catch missing H1, but this provides context
		results.push({
			passed: false,
			message: "No H1 heading found to compare with meta title",
			suggestion: "Add an H1 heading to your content, or enable 'Title property is H1' if your static site generator creates H1s from the title",
			severity: 'warning'
		});
		return Promise.resolve(results);
	}
	
	// Compare meta title and H1
	const metaTitleLower = metaTitle.toLowerCase().trim();
	const h1Lower = h1Heading.toLowerCase().trim();
	
	if (metaTitleLower === h1Lower) {
		results.push({
			passed: false,
			message: "Meta title and H1 are identical",
			suggestion: "Modify one to be unique, or specify a suffix/prefix in plugin settings",
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: "Meta title and H1 are unique",
			severity: 'info'
		});
	}
	
	return Promise.resolve(results);
}

/**
 * Checks if target keyword appears in any heading (H1-H6)
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkKeywordInHeadings(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty) {
		return Promise.resolve(results);
	}
	
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

	if (!keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		results.push({
			passed: true,
			message: `No valid keyword defined in properties`,
			severity: 'notice'
		});
		return Promise.resolve(results);
	}
	
	// Extract H1 headings only (most important for SEO)
	const h1Headings: { text: string }[] = [];
	
	// If "Title property is H1" is enabled, add the title as a virtual H1
	if (settings.skipH1Check && settings.titleProperty) {
		const titleFrontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (titleFrontmatterMatch && titleFrontmatterMatch[1]) {
			const frontmatter = titleFrontmatterMatch[1];
			const lines = frontmatter.split('\n');
			
			for (const line of lines) {
				if (line.startsWith(settings.titleProperty + ':')) {
					let title = line.substring(settings.titleProperty.length + 1).trim();
					// Remove surrounding quotes if present
					if ((title.startsWith('"') && title.endsWith('"')) || 
						(title.startsWith("'") && title.endsWith("'"))) {
						title = title.slice(1, -1);
					}
					// Remove title prefix/suffix if specified
					if (settings.titlePrefixSuffix) {
						const prefixSuffix = settings.titlePrefixSuffix;
						// Remove prefix
						if (title.startsWith(prefixSuffix)) {
							title = title.substring(prefixSuffix.length).trim();
						}
						// Remove suffix
						if (title.endsWith(prefixSuffix)) {
							title = title.substring(0, title.length - prefixSuffix.length).trim();
						}
					}
					// Add as virtual H1
					h1Headings.push({ text: title });
					break;
				}
			}
		}
	}
	
	// Find actual H1 headings in content
	const contentLines = content.split('\n');
	
	for (const line of contentLines) {
		if (!line) continue;
		const h1Match = line.match(/^#\s+(.+)$/);
		if (h1Match && h1Match[1]) {
			h1Headings.push({ text: h1Match[1].trim() });
		}
	}
	
	if (h1Headings.length === 0) {
		results.push({
			passed: false,
			message: "No H1 heading found in content",
			suggestion: "Add an H1 heading to structure your content and include your target keyword",
			severity: 'warning'
		});
		return Promise.resolve(results);
	}
	
	// Check if keyword appears in any H1 heading (flexible matching)
	const keywordLower = keyword.toLowerCase();
	const keywordWords = keywordLower.split(/\s+/).filter(word => word.length > 0);
	
	let keywordFoundInH1 = false;
	let foundH1Text = '';
	
	for (const h1 of h1Headings) {
		const h1Lower = h1.text.toLowerCase();
		const allWordsFound = keywordWords.every(word => h1Lower.includes(word));
		
		if (allWordsFound) {
			keywordFoundInH1 = true;
			foundH1Text = h1.text;
			break;
		}
	}
	
	if (keywordFoundInH1) {
		results.push({
			passed: true,
			message: `Keyword found in H1`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Keyword not found in H1`,
			suggestion: "Include your target keyword in the H1 heading for better SEO",
			severity: 'warning'
		});
	}
	
	return Promise.resolve(results);
}

export function checkKeywordInTitle(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty || !settings.titleProperty) {
		return Promise.resolve([]);
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
		return Promise.resolve(results);
	}

	if (!keyword || keyword === 'false' || keyword === 'true' || keyword === 'null' || keyword === 'undefined') {
		results.push({
			passed: true,
			message: `No valid keyword defined in properties`,
			severity: 'notice'
		});
		return Promise.resolve(results);
	}
	
	// Skip check if no title found
	if (!foundTitleLine || !title) {
		return Promise.resolve(results);
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
			message: `Keyword found in title`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Keyword not found in title`,
			suggestion: "Include your target keyword in the title",
			severity: 'warning'
		});
	}
	
	return Promise.resolve(results);
}
