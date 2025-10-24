/**
 * Link validation checks
 * Checks for naked links, broken links, and external link issues
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeHtmlAttributes } from "./utils/content-parser";
import { findLineNumberForImage, getContextAroundLine } from "./utils/position-utils";

/**
 * Checks for naked links (URLs without markdown link syntax)
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkNakedLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkNakedLinks) {
		return [];
	}
	
	// Remove code blocks and HTML content to avoid false positives
	const cleanContent = removeHtmlAttributes(content);
	
	// Find naked links (URLs without markdown link syntax)
	// Use negative lookbehind to avoid matching URLs within other URLs
	const nakedLinks = cleanContent.match(/(?<!\]\()(?<!https?:\/\/[^\s\)]*\/)https?:\/\/[^\s\)]+/g);
	if (nakedLinks) {
		nakedLinks.forEach((link, index) => {
			// Skip archival URLs as they are meant to be displayed as-is
			if (link.includes('web.archive.org/web/') || 
				link.includes('archive.today/') ||
				link.includes('archive.is/') ||
				link.includes('web.archive.org/save/')) {
				return;
			}
			
			const lineNumber = findLineNumberForImage(content, link);
			
			results.push({
				passed: false,
				message: `Naked link found: ${link}`,
				suggestion: "Convert to markdown link format: [link text](url)",
				severity: 'warning',
				position: {
					line: lineNumber,
					searchText: link,
					context: getContextAroundLine(content, lineNumber)
				}
			});
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No naked links found",
			severity: 'info'
		});
	}
	
	return results;
}

/**
 * Checks for broken internal links
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @param app - Obsidian app instance (optional)
 * @returns Array of SEO check results
 */
export async function checkBrokenLinks(content: string, file: TFile, settings: SEOSettings, app?: any): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkBrokenLinks) {
		return [];
	}
	
	// Find wikilinks [[link]] and [[link|display text]]
	// First find all wikilinks in the original content
	const allWikilinks = content.match(/\[\[([^\]]+)\]\]/g);
	if (allWikilinks) {
		const brokenLinks = [];
		
		for (const wikilink of allWikilinks) {
			// Check if this link is inside a code block
			const linkStart = content.indexOf(wikilink);
			if (linkStart === -1) continue;
			
			// Check if the link is inside a code block by looking at content before it
			const contentBeforeLink = content.substring(0, linkStart);
			const codeBlockMatches = contentBeforeLink.match(/```[\s\S]*?```|~~~[\s\S]*?~~~/g);
			
			// Count unclosed code blocks
			const openCodeBlocks = (contentBeforeLink.match(/```/g) || []).length - (codeBlockMatches || []).length;
			const openTildeBlocks = (contentBeforeLink.match(/~~~/g) || []).length - (codeBlockMatches || []).length;
			
			// Skip if we're inside a code block
			if (openCodeBlocks > 0 || openTildeBlocks > 0) {
				continue;
			}
			const linkMatch = wikilink.match(/\[\[([^\]]+)\]\]/);
			if (!linkMatch || !linkMatch[1]) continue;
			
			const linkText = linkMatch[1];
			
			// Parse wikilink: handle both [[path|display]] and [[path#anchor|display]] formats
			let linkPath: string;
			let displayText: string;
			let anchor: string | null = null;
			
			// Check if there's a display text separator
			if (linkText.includes('|')) {
				const parts = linkText.split('|');
				const linkPart = parts[0] || '';
				displayText = parts[1] || linkPart;
				
				// Check if link part has an anchor
				if (linkPart.includes('#')) {
					const anchorParts = linkPart.split('#');
					linkPath = anchorParts[0] || '';
					anchor = anchorParts[1] || null;
				} else {
					linkPath = linkPart;
				}
			} else {
				// No display text, check if there's an anchor
				if (linkText.includes('#')) {
					const anchorParts = linkText.split('#');
					linkPath = anchorParts[0] || '';
					anchor = anchorParts[1] || null;
					displayText = linkPath; // Use path as display text
				} else {
					linkPath = linkText;
					displayText = linkText;
				}
			}
			
			// Check if the linked file exists using Obsidian's link resolution
			if (app) {
				// Use Obsidian's built-in link resolution to check if the link works
				const resolvedLink = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
				
				if (!resolvedLink) {
					brokenLinks.push({
						link: wikilink,
						path: linkPath,
						displayText: displayText,
						anchor: anchor
					});
				}
			}
		}
		
		if (brokenLinks.length > 0) {
			brokenLinks.forEach(({ link, path, displayText, anchor }) => {
				const lineNumber = findLineNumberForImage(content, link);
				
				// Create a more helpful suggestion message
				let suggestion = `Check if the file "${path}.md" exists or update the link`;
				if (anchor) {
					suggestion += ` (anchor: #${anchor})`;
				}
				
				results.push({
					passed: false,
					message: `Broken internal link: ${displayText}`,
					suggestion: suggestion,
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: link,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
	// Find markdown links [text](url) - check for relative/internal links (exclude images)
	// First find all markdown links in the original content
	const allMarkdownLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
	if (allMarkdownLinks) {
		for (const markdownLink of allMarkdownLinks) {
			// Check if this link is inside a code block
			const linkStart = content.indexOf(markdownLink);
			if (linkStart === -1) continue;
			
			// Check if the link is inside a code block by looking at content before it
			const contentBeforeLink = content.substring(0, linkStart);
			const codeBlockMatches = contentBeforeLink.match(/```[\s\S]*?```|~~~[\s\S]*?~~~/g);
			
			// Count unclosed code blocks
			const openCodeBlocks = (contentBeforeLink.match(/```/g) || []).length - (codeBlockMatches || []).length;
			const openTildeBlocks = (contentBeforeLink.match(/~~~/g) || []).length - (codeBlockMatches || []).length;
			
			// Skip if we're inside a code block
			if (openCodeBlocks > 0 || openTildeBlocks > 0) {
				continue;
			}
			
			const linkMatch = markdownLink.match(/\[([^\]]+)\]\(([^)]+)\)/);
			if (!linkMatch || !linkMatch[1] || !linkMatch[2]) continue;
			
			const linkText = linkMatch[1];
			const linkUrl = linkMatch[2];
			
			// Skip image links and linked images - they should not be checked as broken links
			if (markdownLink.startsWith('![') || linkText.startsWith('![')) {
				continue;
			}
			
			// Check if it's a relative/internal link (not external)
			if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://') && !linkUrl.startsWith('mailto:') && !linkUrl.startsWith('#')) {
				// This is a relative/internal link
				
				// Check if flexible relative path check is enabled (publish mode)
				if (settings.publishMode && linkUrl.startsWith('/')) {
					// In publish mode, absolute paths like /about/ are considered valid for static site generators
					// Skip these links - they should be handled by the potentially broken links check
					continue;
				}
				
				if (app) {
					// Use the EXACT same logic as wikilinks - this should work identically
					const resolvedLink = app.metadataCache.getFirstLinkpathDest(linkUrl, file.path);
					
					if (!resolvedLink) {
						const lineNumber = findLineNumberForImage(content, markdownLink);
						
						// Use the same suggestion format as wikilinks
						const suggestedPath = linkUrl.endsWith('.md') ? linkUrl : linkUrl + '.md';
						
						results.push({
							passed: false,
							message: `Broken internal link: ${linkText}`,
							suggestion: `Check if the file "${suggestedPath}" exists or update the link`,
							severity: 'error',
							position: {
								line: lineNumber,
								searchText: markdownLink,
								context: getContextAroundLine(content, lineNumber)
							}
						});
					}
				}
			}
		}
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No broken internal links found",
			severity: 'info'
		});
	}
	
	return results;
}

/**
 * Checks for potentially broken links (links that might be broken)
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @param app - Obsidian app instance (optional)
 * @returns Array of SEO check results
 */
export async function checkPotentiallyBrokenLinks(content: string, file: TFile, settings: SEOSettings, app?: any): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	// Only run this check in publish mode (flexible relative links), and when enabled
	if (!settings.checkPotentiallyBrokenLinks || !settings.publishMode) {
		return [];
	}
	
	// First, get the list of definitely broken links to avoid duplicates
	const brokenLinksResults = await checkBrokenLinks(content, file, settings, app);
	const definitelyBrokenLinks = new Set<string>();
	
	brokenLinksResults.forEach(result => {
		if (!result.passed && result.position?.searchText) {
			definitelyBrokenLinks.add(result.position.searchText);
		}
	});
	
	// Find markdown links that might be flexible relative links (exclude images and linked images)
	// Use a manual approach to properly handle nested brackets
	let pos = 0;
	while (pos < content.length) {
		// Find the next opening bracket
		const openBracket = content.indexOf('[', pos);
		if (openBracket === -1) break;
		
		// Check if this is inside a code block
		const contentBeforeBracket = content.substring(0, openBracket);
		const codeBlockMatches = contentBeforeBracket.match(/```[\s\S]*?```|~~~[\s\S]*?~~~/g);
		const openCodeBlocks = (contentBeforeBracket.match(/```/g) || []).length - (codeBlockMatches || []).length;
		const openTildeBlocks = (contentBeforeBracket.match(/~~~/g) || []).length - (codeBlockMatches || []).length;
		
		// Skip if we're inside a code block
		if (openCodeBlocks > 0 || openTildeBlocks > 0) {
			pos = openBracket + 1;
			continue;
		}
		
		// Find the matching closing bracket
		let bracketCount = 1;
		let closeBracket = openBracket + 1;
		while (closeBracket < content.length && bracketCount > 0) {
			if (content[closeBracket] === '[') {
				bracketCount++;
			} else if (content[closeBracket] === ']') {
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
		if (closeBracket < content.length && content[closeBracket] === '(') {
			// Find the matching closing parenthesis
			let parenCount = 1;
			let closeParen = closeBracket + 1;
			while (closeParen < content.length && parenCount > 0) {
				if (content[closeParen] === '(') {
					parenCount++;
				} else if (content[closeParen] === ')') {
					parenCount--;
				}
				closeParen++;
			}
			
			if (parenCount === 0) {
				// We found a complete markdown link
				const linkText = content.substring(openBracket + 1, closeBracket - 1);
				const linkUrl = content.substring(closeBracket + 1, closeParen - 1);
				const fullLink = content.substring(openBracket, closeParen);
				
				// Skip if this is a linked image (link text starts with ![)
				// Linked images should be handled by external link checks, not potentially broken link checks
				if (linkText.startsWith('![')) {
					pos = closeParen;
					continue;
				}
				
				// Check if it's a flexible relative link (publish mode)
				// Only check for relative paths, not external URLs
				if (settings.publishMode && linkUrl.startsWith('/') && !linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
					const lineNumber = findLineNumberForImage(content, fullLink);
					results.push({
						passed: true,
						message: `Relative path link: ${linkText}`,
						suggestion: "This link may be valid for static site generators but may not work in Obsidian",
						severity: 'notice',
						position: {
							line: lineNumber,
							searchText: fullLink,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				}
				
				pos = closeParen;
			} else {
				pos = closeBracket;
			}
		} else {
			pos = closeBracket;
		}
	}
	
	// Find wikilinks that might be broken
	// First find all wikilinks in the original content
	const allWikilinks = content.match(/\[\[([^\]]+)\]\]/g);
	if (allWikilinks) {
		const potentiallyBroken = [];
		
		for (const wikilink of allWikilinks) {
			// Check if this link is inside a code block
			const linkStart = content.indexOf(wikilink);
			if (linkStart === -1) continue;
			
			// Check if the link is inside a code block by looking at content before it
			const contentBeforeLink = content.substring(0, linkStart);
			const codeBlockMatches = contentBeforeLink.match(/```[\s\S]*?```|~~~[\s\S]*?~~~/g);
			
			// Count unclosed code blocks
			const openCodeBlocks = (contentBeforeLink.match(/```/g) || []).length - (codeBlockMatches || []).length;
			const openTildeBlocks = (contentBeforeLink.match(/~~~/g) || []).length - (codeBlockMatches || []).length;
			
			// Skip if we're inside a code block
			if (openCodeBlocks > 0 || openTildeBlocks > 0) {
				continue;
			}
			
			const linkMatch = wikilink.match(/\[\[([^\]]+)\]\]/);
			if (!linkMatch || !linkMatch[1]) continue;
			
			// Skip if this link is already flagged as definitely broken
			if (definitelyBrokenLinks.has(wikilink)) {
				continue;
			}
			
			const linkText = linkMatch[1];
			
			// Parse wikilink: handle both [[path|display]] and [[path#anchor|display]] formats
			let linkPath: string;
			let displayText: string;
			let anchor: string | null = null;
			
			// Check if there's a display text separator
			if (linkText.includes('|')) {
				const parts = linkText.split('|');
				const linkPart = parts[0] || '';
				displayText = parts[1] || linkPart;
				
				// Check if link part has an anchor
				if (linkPart.includes('#')) {
					const anchorParts = linkPart.split('#');
					linkPath = anchorParts[0] || '';
					anchor = anchorParts[1] || null;
				} else {
					linkPath = linkPart;
				}
			} else {
				// No display text, check if there's an anchor
				if (linkText.includes('#')) {
					const anchorParts = linkText.split('#');
					linkPath = anchorParts[0] || '';
					anchor = anchorParts[1] || null;
					displayText = linkPath; // Use path as display text
				} else {
					linkPath = linkText;
					displayText = linkText;
				}
			}
			
			// Check for common issues that might indicate broken links
			if (app && linkPath) {
				// Use Obsidian's link resolution to check if the link works
				const resolvedLink = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
				
				if (!resolvedLink) {
					// File doesn't exist, check if there's a similar file (case sensitivity, spaces, etc.)
					const allFiles = app.vault.getMarkdownFiles();
					const similarFiles = allFiles.filter((f: any) => 
						f.path.toLowerCase().includes(linkPath.toLowerCase()) ||
						f.basename.toLowerCase().includes(linkPath.toLowerCase())
					);
					
					if (similarFiles.length > 0) {
						potentiallyBroken.push({
							link: wikilink,
							path: linkPath,
							displayText: displayText,
							anchor: anchor,
							suggestions: similarFiles.map((f: any) => f.path)
						});
					}
				}
			}
		}
		
		if (potentiallyBroken.length > 0) {
			potentiallyBroken.forEach(({ link, path, displayText, suggestions }) => {
				const lineNumber = findLineNumberForImage(content, link);
				
				results.push({
					passed: false,
					message: `Potentially broken link: ${displayText}`,
					suggestion: `Consider these similar files: ${suggestions.slice(0, 3).join(', ')}`,
					severity: 'warning',
					position: {
						line: lineNumber,
						searchText: link,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No potentially broken links found",
			severity: 'info'
		});
	}
	
	return results;
}
