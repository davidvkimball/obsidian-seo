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
	
	// Remove code blocks to avoid false positives
	const cleanContent = content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks
	
	// Find wikilinks [[link]] and [[link|display text]]
	const wikilinks = cleanContent.match(/\[\[([^\]]+)\]\]/g);
	if (wikilinks) {
		const brokenLinks = [];
		
		for (const wikilink of wikilinks) {
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
	const markdownLinks = cleanContent.match(/\[([^\]]+)\]\(([^)]+)\)/g);
	if (markdownLinks) {
		for (const markdownLink of markdownLinks) {
			// Skip image links - they should not be checked as broken links
			if (markdownLink.startsWith('![')) {
				continue;
			}
			
			const linkMatch = markdownLink.match(/\[([^\]]+)\]\(([^)]+)\)/);
			if (!linkMatch || !linkMatch[1] || !linkMatch[2]) continue;
			
			const linkText = linkMatch[1];
			const linkUrl = linkMatch[2];
			
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
					// Try to resolve the relative path
					let resolvedPath = linkUrl;
					
					// Handle different relative path formats
					if (linkUrl.startsWith('/')) {
						// Absolute path from vault root
						resolvedPath = linkUrl.substring(1); // Remove leading slash
						// Remove trailing slash if present
						if (resolvedPath.endsWith('/')) {
							resolvedPath = resolvedPath.substring(0, resolvedPath.length - 1);
						}
					} else if (linkUrl.startsWith('./')) {
						// Relative to current file
						const currentDir = file.parent?.path || '';
						resolvedPath = currentDir + '/' + linkUrl.substring(2);
					} else {
						// Relative to current file's directory
						const currentDir = file.parent?.path || '';
						// Only add current directory if the link doesn't already start with a path
						if (linkUrl.includes('/')) {
							// Link already has a path, use it as-is
							resolvedPath = linkUrl;
						} else {
							// Simple filename, add current directory
							resolvedPath = currentDir + '/' + linkUrl;
						}
					}
					
					// Try different file extensions
					const possiblePaths = [
						resolvedPath + '.md',
						resolvedPath,
						resolvedPath + '.markdown'
					];
					
					let linkedFile = null;
					for (const possiblePath of possiblePaths) {
						linkedFile = app.vault.getAbstractFileByPath(possiblePath);
						if (linkedFile) break;
					}
					
					if (!linkedFile) {
						const lineNumber = findLineNumberForImage(content, markdownLink);
						
						results.push({
							passed: false,
							message: `Broken internal link: ${linkText}`,
							suggestion: `Check if the file "${resolvedPath}.md" exists or update the link`,
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
	
	if (!settings.checkPotentiallyBrokenLinks) {
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
	
	// Remove code blocks to avoid false positives
	const cleanContent = content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks
	
	// Find markdown links that might be flexible relative links (exclude images)
	const markdownLinks = cleanContent.match(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g);
	if (markdownLinks) {
		for (const markdownLink of markdownLinks) {
			
			const linkMatch = markdownLink.match(/\[([^\]]+)\]\(([^)]+)\)/);
			if (!linkMatch || !linkMatch[1] || !linkMatch[2]) continue;
			
			const linkText = linkMatch[1];
			const linkUrl = linkMatch[2];
			
			// Check if it's a flexible relative link (publish mode)
			if (settings.publishMode && linkUrl.startsWith('/') && !linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) {
				const lineNumber = findLineNumberForImage(content, markdownLink);
				results.push({
					passed: true,
					message: `Relative path link: ${linkText}`,
					suggestion: "This link is valid for static site generators but may not work in Obsidian",
					severity: 'notice',
					position: {
						line: lineNumber,
						searchText: markdownLink,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			}
		}
	}
	
	// Find wikilinks that might be broken
	const wikilinks = cleanContent.match(/\[\[([^\]]+)\]\]/g);
	if (wikilinks) {
		const potentiallyBroken = [];
		
		for (const wikilink of wikilinks) {
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
