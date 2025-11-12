/**
 * External link validation checks
 * Checks for external links and broken external links with network requests
 */

import { TFile, requestUrl } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { findLineNumberForImage, getContextAroundLine } from "./utils/position-utils";
import { removeCodeBlocks } from "./utils/content-parser";

/**
 * Validates if a URL is properly formatted and not embedded in HTML entities
 * @param url - The URL to validate
 * @returns true if the URL is valid and should be checked
 */
function isValidUrl(url: string): boolean {
	// Check if URL contains HTML entities or malformed characters
	if (url.includes('&gt;') || url.includes('&lt;') || url.includes('&amp;') || 
		url.includes('&quot;') || url.includes('&apos;') || url.includes('&nbsp;')) {
		return false;
	}
	
	// Check if URL contains HTML tags or malformed HTML
	if (url.includes('<') || url.includes('>') || url.includes('"') || url.includes("'")) {
		return false;
	}
	
	// Check if URL ends with HTML-like fragments
	if (url.endsWith('&gt;') || url.endsWith('&lt;') || url.endsWith('&amp;') ||
		url.endsWith('&quot;') || url.endsWith('&apos;') || url.endsWith('&nbsp;')) {
		return false;
	}
	
	// Check if URL contains suspicious patterns that indicate HTML fragments
	if (url.includes('/a&gt;') || url.includes('/p&gt;') || url.includes('/div&gt;') ||
		url.includes('/span&gt;') || url.includes('/img&gt;') || url.includes('/script&gt;')) {
		return false;
	}
	
	// Basic URL format validation
	try {
		const urlObj = new URL(url);
		// Ensure it's http or https
		if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
			return false;
		}
		// Ensure hostname is not empty
		if (!urlObj.hostname || urlObj.hostname.length === 0) {
			return false;
		}
		// Ensure hostname doesn't contain suspicious characters
		if (urlObj.hostname.includes('<') || urlObj.hostname.includes('>') || 
			urlObj.hostname.includes('"') || urlObj.hostname.includes("'")) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Extracts and validates external links from content
 * @param content - The content to extract links from
 * @returns Array of valid external URLs
 */
function extractValidExternalLinks(content: string): string[] {
	// Use the content parser to remove code blocks, HTML, and other non-content
	const cleanContent = removeCodeBlocks(content);
	
	const externalLinks: string[] = [];
	
	// Find markdown links with http/https URLs using manual parsing to handle nested brackets
	let pos = 0;
	while (pos < cleanContent.length) {
		// Find the next opening bracket
		const openBracket = cleanContent.indexOf('[', pos);
		if (openBracket === -1) break;
		
		// Find the matching closing bracket
		let bracketCount = 1;
		let closeBracket = openBracket + 1;
		while (closeBracket < cleanContent.length && bracketCount > 0) {
			if (cleanContent[closeBracket] === '[') {
				bracketCount++;
			} else if (cleanContent[closeBracket] === ']') {
				bracketCount--;
			}
			closeBracket++;
		}
		
		if (bracketCount > 0) {
			// No matching closing bracket found
			pos = openBracket + 1;
			continue;
		}
		
		// Check if there's a URL part after the closing bracket
		if (closeBracket < cleanContent.length && cleanContent[closeBracket] === '(') {
			// Find the matching closing parenthesis
			let parenCount = 1;
			let closeParen = closeBracket + 1;
			while (closeParen < cleanContent.length && parenCount > 0) {
				if (cleanContent[closeParen] === '(') {
					parenCount++;
				} else if (cleanContent[closeParen] === ')') {
					parenCount--;
				}
				closeParen++;
			}
			
			if (parenCount === 0) {
				// We found a complete markdown link
				const linkUrl = cleanContent.substring(closeBracket + 1, closeParen - 1);
				
				// Check if it's an external URL
				if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
					if (isValidUrl(linkUrl)) {
						externalLinks.push(linkUrl);
					}
				}
				
				pos = closeParen;
			} else {
				pos = closeBracket;
			}
		} else {
			pos = closeBracket;
		}
	}
	
	// Find naked URLs with improved regex and validation
	const nakedUrls = cleanContent.match(/https?:\/\/[^\s)\]]+/g);
	if (nakedUrls) {
		// Get all markdown link URLs to exclude them from naked URLs
		const markdownLinkUrls = new Set<string>(externalLinks);
		
		nakedUrls.forEach(url => {
			// Skip if URL is already in a markdown link
			if (markdownLinkUrls.has(url)) {
				return;
			}
			
			// Skip archival URLs as they are meant to be displayed as-is
			if (url.includes('web.archive.org/web/') || 
				url.includes('archive.today/') ||
				url.includes('archive.is/') ||
				url.includes('web.archive.org/save/')) {
				return;
			}
			
			// Validate the URL before adding it
			if (isValidUrl(url)) {
				externalLinks.push(url);
			}
		});
	}
	
	// Remove duplicates
	return [...new Set(externalLinks)];
}

/**
 * Checks for external links and returns them as notices
 * This is the notice-based external links list
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results (notices)
 */
export function checkExternalLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkExternalLinks) {
		return Promise.resolve([]);
	}
	
	// Use the improved link extraction
	const uniqueLinks = extractValidExternalLinks(content);
	
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
	
	return Promise.resolve(results);
}

/**
 * Checks for broken external links with network requests
 * This performs actual 404 checking with timeout handling
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results (errors for broken links)
 */
export async function checkExternalBrokenLinks(content: string, file: TFile, settings: SEOSettings, abortController?: AbortController): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.enableExternalLinkVaultCheck) {
		return Promise.resolve([]);
	}
	
	// Use the improved link extraction
	const uniqueLinks = extractValidExternalLinks(content);
	
	if (uniqueLinks.length === 0) {
		results.push({
			passed: true,
			message: "No external links found",
			severity: 'info'
		});
		return Promise.resolve(results);
	}
	
	// Check each external link
	for (const url of uniqueLinks) {
		// Check for global cancellation before processing each link
		if (abortController?.signal.aborted) {
			console.debug('External link check cancelled');
			throw new DOMException('Operation was aborted', 'AbortError');
		}
		
		let linkIsBroken = false;
		let errorMessage = '';
		let suggestion = '';
		
		try {
			// Use Obsidian's requestUrl
			const response = await requestUrl({
				url: url,
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; Obsidian-SEO-Plugin/1.0)'
				}
			});
			
			// Check the response status
			if (response.status >= 400) {
				linkIsBroken = true;
				if (response.status >= 400 && response.status < 500) {
					errorMessage = `External link error (${response.status}): ${url}`;
					suggestion = `This link returned a ${response.status} error. The page may not exist or may require authentication.`;
				} else if (response.status >= 500) {
					errorMessage = `External link server error (${response.status}): ${url}`;
					suggestion = `This link returned a ${response.status} server error. The server may be experiencing issues.`;
				} else {
					errorMessage = `External link error (${response.status}): ${url}`;
					suggestion = `This link returned an unexpected status code: ${response.status}`;
				}
			}
			
		} catch (error) {
			linkIsBroken = true;
			
			if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
				errorMessage = `External link timeout: ${url}`;
				suggestion = 'This link took too long to respond. The server might be slow or the link might be broken.';
			} else if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('net::ERR_') || error.message.includes('NetworkError'))) {
				errorMessage = `External link unreachable: ${url}`;
				suggestion = 'This link could not be reached. Check if the URL is correct or if the server is down.';
			} else {
				errorMessage = `External link error: ${url}`;
				suggestion = 'This link could not be verified. Please check the URL manually.';
			}
		}
		
		// If we detected a broken link, add it to results
		if (linkIsBroken) {
			const lines = content.split('\n');
			let lineNumber = 1;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && url && line.includes(url)) {
					lineNumber = i + 1;
					break;
				}
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
	} else if (uniqueLinks.length > 0) {
		// Add summary message when there are both working and broken links
		const workingLinks = uniqueLinks.length - results.filter(r => !r.passed).length;
		if (workingLinks > 0) {
			results.push({
				passed: true,
				message: `${workingLinks} of ${uniqueLinks.length} external link(s) are working`,
				severity: 'info'
			});
		}
	}
	
	return Promise.resolve(results);
}


/**
 * Checks for external links only (simplified version)
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkExternalLinksOnly(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// This is a simplified version that just lists external links
	return checkExternalLinks(content, file, settings);
}