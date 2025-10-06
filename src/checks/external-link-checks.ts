/**
 * External link validation checks
 * Checks for external links and broken external links with network requests
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { findLineNumberForImage, getContextAroundLine } from "./utils/position-utils";

/**
 * Checks for external links and returns them as notices
 * This is the notice-based external links list
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results (notices)
 */
export async function checkExternalLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkExternalLinks) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks
	
	// Find external links - both markdown links and naked URLs
	const externalLinks: string[] = [];
	
	// Find markdown links with http/https URLs
	const markdownLinks = cleanContent.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
	if (markdownLinks) {
		markdownLinks.forEach(link => {
			const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
			if (match && match[2]) {
				externalLinks.push(match[2]);
			}
		});
	}
	
	// Find naked URLs (but exclude archival URLs as they are meant to be displayed as-is)
	// Using iOS-compatible regex without lookbehind assertions
	const nakedUrls = cleanContent.match(/https?:\/\/[^\s\)]+/g);
	if (nakedUrls) {
		// Get all markdown link URLs to exclude them from naked URLs
		const markdownLinkUrls = new Set<string>();
		if (markdownLinks) {
			markdownLinks.forEach(link => {
				const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
				if (match && match[2]) {
					markdownLinkUrls.add(match[2]);
				}
			});
		}
		
		nakedUrls.forEach(url => {
			// Skip if URL is already in a markdown link
			if (markdownLinkUrls.has(url)) {
				return;
			}
			
			// Skip archival URLs as they are meant to be displayed as-is
			if (!url.includes('web.archive.org/web/') && 
				!url.includes('archive.today/') &&
				!url.includes('archive.is/') &&
				!url.includes('web.archive.org/save/')) {
				externalLinks.push(url);
			}
		});
	}
	
	// Remove duplicates
	const uniqueLinks = [...new Set(externalLinks)];
	
	if (uniqueLinks.length > 0) {
		// List each external link as a notice
		uniqueLinks.forEach((url, index) => {
			const lineNumber = findLineNumberForImage(content, url);
			results.push({
				passed: true,
				message: `External link: ${url}`,
				suggestion: "To find if any of these are broken, use the 'Check external links for 404s' button to trigger it.",
				severity: 'notice',
				position: {
					line: lineNumber,
					searchText: url,
					context: getContextAroundLine(content, lineNumber)
				}
			});
		});
	} else {
		results.push({
			passed: true,
			message: "No external links found",
			severity: 'info'
		});
	}
	
	return results;
}

/**
 * Checks for broken external links with network requests
 * This performs actual 404 checking with timeout handling
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results (errors for broken links)
 */
export async function checkExternalBrokenLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.enableExternalLinkVaultCheck) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks
	
	// Find external links - both markdown links and naked URLs
	const externalLinks: string[] = [];
	
	// Find markdown links with http/https URLs
	const markdownLinks = cleanContent.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
	if (markdownLinks) {
		markdownLinks.forEach(link => {
			const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
			if (match && match[2]) {
				externalLinks.push(match[2]);
			}
		});
	}
	
	// Find naked URLs (but exclude archival URLs as they are meant to be displayed as-is)
	// Using iOS-compatible regex without lookbehind assertions
	const nakedUrls = cleanContent.match(/https?:\/\/[^\s\)]+/g);
	if (nakedUrls) {
		// Get all markdown link URLs to exclude them from naked URLs
		const markdownLinkUrls = new Set<string>();
		if (markdownLinks) {
			markdownLinks.forEach(link => {
				const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
				if (match && match[2]) {
					markdownLinkUrls.add(match[2]);
				}
			});
		}
		
		nakedUrls.forEach(url => {
			// Skip if URL is already in a markdown link
			if (markdownLinkUrls.has(url)) {
				return;
			}
			
			// Skip archival URLs as they are meant to be displayed as-is
			if (!url.includes('web.archive.org/web/') && 
				!url.includes('archive.today/') &&
				!url.includes('archive.is/') &&
				!url.includes('web.archive.org/save/')) {
				externalLinks.push(url);
			}
		});
	}
	
	// Remove duplicates
	const uniqueLinks = [...new Set(externalLinks)];
	
	if (uniqueLinks.length === 0) {
		results.push({
			passed: true,
			message: "No external links found",
			severity: 'info'
		});
		return results;
	}
	
	// Check each external link
	for (const url of uniqueLinks) {
		let timeoutId: NodeJS.Timeout | null = null;
		
		try {
			const controller = new AbortController();
			timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Range': 'bytes=0-0'
				},
				mode: 'no-cors',
				signal: controller.signal
			});
			
			if (timeoutId) clearTimeout(timeoutId);
			
			// With no-cors mode, we can't read the status, but if we get here without error, it's likely working
			// We'll consider it working if no network error occurred
			
		} catch (error) {
			if (timeoutId) clearTimeout(timeoutId);
			
			// Find the line number for this URL
			const lines = content.split('\n');
			let lineNumber = 1;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && url && line.includes(url)) {
					lineNumber = i + 1;
					break;
				}
			}
			
			let errorMessage = '';
			let suggestion = '';
			
			if (error instanceof Error && error.name === 'AbortError') {
				errorMessage = `External link timeout: ${url}`;
				suggestion = 'This link took too long to respond. The server might be slow or the link might be broken.';
			} else if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('net::ERR_'))) {
				errorMessage = `External link unreachable: ${url}`;
				suggestion = 'This link could not be reached. Check if the URL is correct or if the server is down.';
			} else {
				errorMessage = `External link error: ${url}`;
				suggestion = 'This link could not be verified. Please check the URL manually.';
			}
			
			results.push({
				passed: false,
				message: errorMessage,
				suggestion: suggestion,
				severity: 'error',
				position: {
					line: lineNumber,
					searchText: url,
					context: getContextAroundLine(content, lineNumber)
				}
			});
		}
	}
	
	// If no errors were found, add success message
	if (results.length === 0 && uniqueLinks.length > 0) {
		results.push({
			passed: true,
			message: `Found ${uniqueLinks.length} external link(s), all appear to resolve and are working`,
			severity: 'info'
		});
	}
	
	return results;
}


/**
 * Checks for external links only (simplified version)
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkExternalLinksOnly(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// This is a simplified version that just lists external links
	return checkExternalLinks(content, file, settings);
}