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
			const [linkPath, displayText] = linkText.split('|');
			
			// Check if the linked file exists
			if (app) {
				const linkedFile = app.vault.getAbstractFileByPath(linkPath + '.md');
				if (!linkedFile) {
					brokenLinks.push({
						link: wikilink,
						path: linkPath,
						displayText: displayText || linkPath
					});
				}
			}
		}
		
		if (brokenLinks.length > 0) {
			brokenLinks.forEach(({ link, path, displayText }) => {
				const lineNumber = findLineNumberForImage(content, link);
				
				results.push({
					passed: false,
					message: `Broken internal link: ${displayText}`,
					suggestion: `Check if the file "${path}.md" exists or update the link`,
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
	
	// Remove code blocks to avoid false positives
	const cleanContent = content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks
	
	// Find wikilinks that might be broken
	const wikilinks = cleanContent.match(/\[\[([^\]]+)\]\]/g);
	if (wikilinks) {
		const potentiallyBroken = [];
		
		for (const wikilink of wikilinks) {
			const linkMatch = wikilink.match(/\[\[([^\]]+)\]\]/);
			if (!linkMatch || !linkMatch[1]) continue;
			
			const linkText = linkMatch[1];
			const [linkPath, displayText] = linkText.split('|');
			
			// Check for common issues that might indicate broken links
			if (app && linkPath) {
				const linkedFile = app.vault.getAbstractFileByPath(linkPath + '.md');
				if (!linkedFile) {
					// Check if there's a similar file (case sensitivity, spaces, etc.)
					const allFiles = app.vault.getMarkdownFiles();
					const similarFiles = allFiles.filter((f: any) => 
						f.path.toLowerCase().includes(linkPath.toLowerCase()) ||
						f.basename.toLowerCase().includes(linkPath.toLowerCase())
					);
					
					if (similarFiles.length > 0) {
						potentiallyBroken.push({
							link: wikilink,
							path: linkPath,
							displayText: displayText || linkPath,
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
