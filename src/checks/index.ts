import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";

// Helper function to remove code blocks, inline code, and HTML content from content
function removeCodeBlocks(content: string): string {
	return content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/<[^>]*>/g, '') // Remove HTML tags (but keep text content)
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks like ::link{url="..."}
}

// Helper function specifically for naked links - removes HTML attributes
function removeHtmlAttributes(content: string): string {
	return content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/<[^>]*>/g, '') // Remove HTML tags completely
		.replace(/^---\n[\s\S]*?\n---\n/, '') // Remove frontmatter
		.replace(/::\w+\{[^}]*\}/g, ''); // Remove Obsidian callout-style blocks like ::link{url="..."}
}

export async function checkAltText(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkAltText) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Check markdown images ![alt](src)
	const markdownImages = cleanContent.match(/!\[([^\]]*)\]\([^)]+\)/g);
	if (markdownImages) {
		const missingAltText = markdownImages.filter(match => {
			const altText = match.match(/!\[([^\]]*)\]/)?.[1];
			return !altText || altText.trim() === '';
		});
		if (missingAltText.length > 0) {
			// Create individual results for each missing alt text image
			missingAltText.forEach((match, index) => {
				const pathMatch = match.match(/!\[[^\]]*\]\(([^)]+)\)/);
				const imagePath = pathMatch ? pathMatch[1] : match;
				const lineNumber = findLineNumberForImage(content, match);
				
				results.push({
					passed: false,
					message: `Image missing alt text: ${imagePath}`,
					suggestion: "Add descriptive alt text for accessibility",
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: match,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
		// Check wikilink images ![[image.png]] and ![[image.png|alt text]]
		const wikilinkImages = cleanContent.match(/!\[\[([^\]]+)\]\]/g);
		if (wikilinkImages) {
			const missingAltText = wikilinkImages.filter(match => !match.includes('|'));
		if (missingAltText.length > 0) {
			// Create individual results for each missing alt text wikilink image
			missingAltText.forEach((match, index) => {
				const pathMatch = match.match(/!\[\[([^\]]+)\]\]/);
				const imagePath = pathMatch ? pathMatch[1] : match;
				const lineNumber = findLineNumberForImage(content, match);
				
				results.push({
					passed: false,
					message: `Wikilink image missing alt text: ${imagePath}`,
					suggestion: "Add alt text using ![[image.png|alt text]] syntax or consider using standard markdown image syntax",
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: match,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
		}
	
	// Check HTML images <img alt="text">
	const htmlImages = cleanContent.match(/<img[^>]*>/g);
	if (htmlImages) {
		const missingAlt = htmlImages.filter(img => {
			// Check if alt attribute is missing or empty
			const altMatch = img.match(/alt\s*=\s*["']([^"']*)["']/);
			return !altMatch || altMatch[1].trim() === '';
		});
		if (missingAlt.length > 0) {
			// Create individual results for each missing alt attribute
			missingAlt.forEach((img, index) => {
				const srcMatch = img.match(/src\s*=\s*["']([^"']*)["']/);
				const imagePath = srcMatch ? srcMatch[1] : 'HTML img tag';
				const lineNumber = findLineNumberForImage(content, img);
				
				results.push({
					passed: false,
					message: `HTML image missing alt attribute: ${imagePath}`,
					suggestion: "Add alt attribute to HTML img tag",
					severity: 'error',
					position: {
						line: lineNumber,
						searchText: img,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			});
		}
	}
	
	if (results.length === 0) {
		// Check if there are any images at all
		const hasImages = markdownImages && markdownImages.length > 0 || htmlImages && htmlImages.length > 0 || wikilinkImages && wikilinkImages.length > 0;
		if (hasImages) {
			results.push({
				passed: true,
				message: "All images have alt text",
				severity: 'info'
			});
		} else {
			results.push({
				passed: true,
				message: "No images in this post",
				severity: 'info'
			});
		}
	}
	
	return results;
}

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

export async function checkHeadingOrder(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkHeadingOrder) {
		return [];
	}
	
	// Work with original content for accurate line numbers
	const originalLines = content.split('\n');
	let lastHeadingLevel = null;
	let hasHeading = false;
	let hasH1 = false;
	let firstHeadingLine = 0;
	
	for (let i = 0; i < originalLines.length; i++) {
		const line = originalLines[i];
		const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
		
		if (headingMatch) {
			hasHeading = true;
			const currentLevel = headingMatch[1].length;
			const headingText = headingMatch[2].trim();
			const lineNumber = i + 1; // 1-based line number from original content
			
			// Track if we have an H1
			if (currentLevel === 1) {
				hasH1 = true;
			}
			
			// If this is the first heading, don't check for violations yet
			if (lastHeadingLevel === null) {
				lastHeadingLevel = currentLevel;
				firstHeadingLine = lineNumber;
				continue;
			}
			
			// Check if current level skips levels after the last heading
			if (currentLevel > lastHeadingLevel + 1) {
				results.push({
					passed: false,
					message: `"${headingText}" (H${currentLevel}) skips heading level(s) after H${lastHeadingLevel}`,
					suggestion: "Use heading levels in order (H1 → H2 → H3, etc.)",
					severity: 'warning',
					position: {
						line: lineNumber,
						searchText: line,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			}
			
			// If H1 appears after other heading levels, flag it
			if (currentLevel === 1 && lastHeadingLevel > 1) {
				results.push({
					passed: false,
					message: `"${headingText}" (H1) appears after H${lastHeadingLevel}`,
					suggestion: "H1 should be the first heading or not used at all",
					severity: 'warning',
					position: {
						line: lineNumber,
						searchText: line,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			}
			
			lastHeadingLevel = currentLevel;
		}
	}
	
	// Check for missing H1 if skipH1Check is false - add this FIRST if it exists
	if (hasHeading && !settings.skipH1Check && !hasH1) {
		results.unshift({
			passed: false,
			message: "No H1 heading found",
			suggestion: "Add an H1 heading at the beginning of your content",
			severity: 'warning'
			// No position info since there's no H1 to jump to
		});
	}
	
	if (!hasHeading) {
		results.push({
			passed: true,
			message: "No heading structure issues found",
			severity: 'info'
		});
	} else if (results.length === 0) {
		results.push({
			passed: true,
			message: "Heading structure is correct",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkKeywordDensity(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty) {
		return [];
	}
	
	// Extract keyword from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return [];
	}
	
	const frontmatter = frontmatterMatch[1];
	const keywordMatch = frontmatter.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
	
	if (!keywordMatch) {
		return [];
	}
	
	let keyword = keywordMatch[1].trim();
	// Strip surrounding quotes if present
	if ((keyword.startsWith('"') && keyword.endsWith('"')) ||
		(keyword.startsWith("'") && keyword.endsWith("'"))) {
		keyword = keyword.slice(1, -1);
	}
	const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
	const wordCount = bodyContent.split(/\s+/).filter(word => word.length > 0).length;
	const keywordCount = (bodyContent.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
	const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
	
	if (keywordCount === 0) {
		results.push({
			passed: false,
			message: `Target keyword "${keyword}" not found in content`,
			suggestion: "Include your target keyword naturally in the content",
			severity: 'warning'
		});
	} else if (density < settings.keywordDensityMin) {
		results.push({
			passed: false,
			message: `Keyword density too low: ${density.toFixed(1)}% (${keywordCount} uses in ${wordCount} words)`,
			suggestion: `Aim for ${settings.keywordDensityMin}-${settings.keywordDensityMax}% density`,
			severity: 'warning'
		});
	} else if (density > settings.keywordDensityMax) {
		results.push({
			passed: false,
			message: `Keyword density too high: ${density.toFixed(1)}% (${keywordCount} uses in ${wordCount} words)`,
			suggestion: `Aim for ${settings.keywordDensityMin}-${settings.keywordDensityMax}% density`,
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good keyword density: ${density.toFixed(1)}% (${keywordCount} uses in ${wordCount} words)`,
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkBrokenLinks(content: string, file: TFile, settings: SEOSettings, app?: any): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkBrokenLinks) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find internal links [[link]] and [text](link)
	const internalLinks = [
		...cleanContent.match(/\[\[([^\]]+)\]\]/g) || [],
		...cleanContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []
	];

	for (const link of internalLinks) {
		let linkTarget = '';

		if (link.startsWith('[[')) {
			// Wikilink - extract the actual target (before the | if there's an alias)
			const fullTarget = link.match(/\[\[([^\]]+)\]\]/)?.[1] || '';
			linkTarget = fullTarget.split('|')[0]; // Get the part before the pipe
		} else {
			// Markdown link
			const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
			linkTarget = match?.[2] || '';
		}
		
		if (linkTarget && !linkTarget.startsWith('http')) {
			// Find line number for this link
			const lineNumber = findLineNumberForImage(content, link);
			
			// Check if it's a wikilink or embedded image first
			const isWikilink = link.startsWith('[[');
			const isEmbeddedImage = linkTarget.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
			const isRelativePath = linkTarget.startsWith('/') && !linkTarget.startsWith('//');
			const isAnchorLink = linkTarget.startsWith('#');
			
			// In publish mode, treat relative paths and anchor links as potentially broken (warning) instead of broken (error)
			if (settings.publishMode && (isRelativePath || isAnchorLink) && !isEmbeddedImage) {
				// Add to potentially broken links instead of broken links
				// This will be handled in the checkPotentiallyBrokenLinks function
				continue;
			}
			
			if (isWikilink || isEmbeddedImage) {
				// For wikilinks and embedded images, use Obsidian's link resolution
				const resolvedLink = app?.metadataCache.getFirstLinkpathDest(linkTarget, file.path);
				if (!resolvedLink) {
					// Link doesn't exist in Obsidian - this is a broken link
					results.push({
						passed: false,
						message: `Broken link: ${linkTarget}`,
						suggestion: isEmbeddedImage 
							? "Verify the image path exists or check if it's a relative path"
							: "Check if the wikilink target exists or create the target note",
						severity: 'error',
						position: {
							line: lineNumber,
							searchText: link,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				}
			} else {
				// For regular markdown links, check if file exists
				const targetFile = app?.vault.getAbstractFileByPath(linkTarget);
				if (!targetFile) {
					results.push({
						passed: false,
						message: `Broken internal link: ${linkTarget}`,
						suggestion: "Check the link path or create the target file",
						severity: 'error',
						position: {
							line: lineNumber,
							searchText: link,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				}
			}
		}
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No broken links found",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkExternalBrokenLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.enableExternalLinkVaultCheck) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find external links - both markdown links and naked URLs
	const externalLinks: string[] = [];
	
	// Find markdown links with http/https URLs
	const markdownLinks = cleanContent.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
	if (markdownLinks) {
		markdownLinks.forEach(link => {
			const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
			if (match) {
				externalLinks.push(match[2]);
			}
		});
	}
	
	// Find naked URLs (but exclude archival URLs as they are meant to be displayed as-is)
	const nakedUrls = cleanContent.match(/(?<!\]\()(?<!https?:\/\/[^\s\)]*\/)https?:\/\/[^\s\)]+/g);
	if (nakedUrls) {
		nakedUrls.forEach(url => {
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
				if (lines[i].includes(url)) {
					lineNumber = i + 1;
					break;
				}
			}
			
			let errorMessage = '';
			let suggestion = '';
			
			if (error.name === 'AbortError') {
				errorMessage = `External link timeout: ${url}`;
				suggestion = 'This link took too long to respond. The server might be slow or the link might be broken.';
			} else if (error.message.includes('Failed to fetch') || error.message.includes('net::ERR_')) {
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

export async function checkExternalLinks(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkExternalLinks) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find external links - both markdown links and naked URLs
	const externalLinks: string[] = [];
	
	// Find markdown links with http/https URLs
	const markdownLinks = cleanContent.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
	if (markdownLinks) {
		markdownLinks.forEach(link => {
			const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
			if (match) {
				externalLinks.push(match[2]);
			}
		});
	}
	
	// Find naked URLs (but exclude archival URLs as they are meant to be displayed as-is)
	const nakedUrls = cleanContent.match(/(?<!\]\()(?<!https?:\/\/[^\s\)]*\/)https?:\/\/[^\s\)]+/g);
	if (nakedUrls) {
		nakedUrls.forEach(url => {
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

export async function checkExternalLinksOnly(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkExternalLinks) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find external links - both markdown links and naked URLs
	const externalLinks: string[] = [];
	
	// Find markdown links with http/https URLs
	const markdownLinks = cleanContent.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g);
	if (markdownLinks) {
		markdownLinks.forEach(link => {
			const match = link.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
			if (match) {
				externalLinks.push(match[2]);
			}
		});
	}
	
	// Find naked URLs (but exclude archival URLs as they are meant to be displayed as-is)
	const nakedUrls = cleanContent.match(/(?<!\]\()(?<!https?:\/\/[^\s\)]*\/)https?:\/\/[^\s\)]+/g);
	if (nakedUrls) {
		nakedUrls.forEach(url => {
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
	
	// Check each external link
	for (const url of uniqueLinks) {
		const lineNumber = findLineNumberForImage(content, url);
		
		try {
			// Use no-cors mode to bypass CORS restrictions
			// This is the only way to make requests from Obsidian's Electron environment
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
			
			// Use fetch with no-cors mode to bypass CORS restrictions
			const response = await fetch(url, {
				method: 'GET', // Use GET since HEAD might not work with no-cors
				mode: 'no-cors', // Bypass CORS restrictions
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
				},
				signal: controller.signal
			});
			
			clearTimeout(timeoutId);
			
			// With no-cors mode, we can't read response.ok or status
			// If we get here without an error, the request succeeded
			// We'll assume it's working unless we get a specific error
			// Note: This approach can't detect 404s or other HTTP errors due to CORS limitations
		} catch (error) {
			// Handle network errors, timeouts, etc.
			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					results.push({
						passed: false,
						message: `This link resolves with timeout: ${url}`,
						suggestion: "This link took too long to respond. The server may be slow or temporarily unavailable.",
						severity: 'error',
						position: {
							line: lineNumber,
							searchText: url,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
					// This is likely a network connectivity issue
					results.push({
						passed: false,
						message: `This link resolves with network error: ${url}`,
						suggestion: "This link could not be reached. Check if the URL is correct or if the server is down.",
						severity: 'error',
						position: {
							line: lineNumber,
							searchText: url,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else {
					results.push({
						passed: false,
						message: `This link resolves with error: ${url}`,
						suggestion: "This link could not be accessed. Check if the URL is correct or if there's a network issue.",
						severity: 'error',
						position: {
							line: lineNumber,
							searchText: url,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				}
			}
		}
	}
	
	if (results.length === 0 && uniqueLinks.length > 0) {
		results.push({
			passed: true,
			message: `Found ${uniqueLinks.length} external link(s), all appear to resolve and are working`,
			severity: 'info'
		});
	} else if (uniqueLinks.length === 0) {
		results.push({
			passed: true,
			message: "No external links found",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkPotentiallyBrokenLinks(content: string, file: TFile, settings: SEOSettings, app?: any): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkPotentiallyBrokenLinks) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find internal links [[link]] and [text](link)
	const internalLinks = [
		...cleanContent.match(/\[\[([^\]]+)\]\]/g) || [],
		...cleanContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []
	];

	for (const link of internalLinks) {
		let linkTarget = '';

		if (link.startsWith('[[')) {
			// Wikilink - extract the actual target (before the | if there's an alias)
			const fullTarget = link.match(/\[\[([^\]]+)\]\]/)?.[1] || '';
			linkTarget = fullTarget.split('|')[0]; // Get the part before the pipe
		} else {
			// Markdown link
			const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
			linkTarget = match?.[2] || '';
		}
		
		if (linkTarget && !linkTarget.startsWith('http')) {
			// Find line number for this link
			const lineNumber = findLineNumberForImage(content, link);
			
			// Check if it's a wikilink or embedded image first
			const isWikilink = link.startsWith('[[');
			const isEmbeddedImage = linkTarget.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
			const isRelativePath = linkTarget.startsWith('/') && !linkTarget.startsWith('//');
			const isAnchorLink = linkTarget.startsWith('#');
			
			// In publish mode, show relative paths and anchor links as potentially broken (warning)
			if (settings.publishMode && (isRelativePath || isAnchorLink) && !isEmbeddedImage) {
				const linkType = isAnchorLink ? 'anchor link' : 'relative path';
				results.push({
					passed: false,
					message: `Relative link: ${linkTarget}`,
					suggestion: `${linkType.charAt(0).toUpperCase() + linkType.slice(1)} that may be resolved by your site generator. Verify the target will resolve on your published site.`,
					severity: 'notice',
					position: {
						line: lineNumber,
						searchText: link,
						context: getContextAroundLine(content, lineNumber)
					}
				});
				continue;
			}
			
			if (isWikilink || isEmbeddedImage) {
				// For wikilinks and embedded images, use Obsidian's link resolution
				const resolvedLink = app?.metadataCache.getFirstLinkpathDest(linkTarget, file.path);
				if (resolvedLink) {
					// Only show as potentially broken if it's a wikilink (not embedded images)
					// Embedded images that exist are fine, wikilinks may not work on web
					if (isWikilink) {
						results.push({
							passed: false,
							message: `Relative link: ${linkTarget}`,
							suggestion: "Wikilinks may not work on the web - consider converting to standard markdown links",
							severity: 'notice',
							position: {
								line: lineNumber,
								searchText: link,
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
			message: "No relative links found",
			severity: 'info'
		});
	}
	
	return results;
}

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
	const descriptionMatch = frontmatter.match(new RegExp(`^${settings.descriptionProperty}:\\s*(.+)$`, 'm'));
	
	if (!descriptionMatch) {
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

export async function checkTitleLength(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkTitleLength) {
		return [];
	}
	
	if (!settings.titleProperty) {
		return [];
	}
	
	let title = '';
	
	// If useFilenameAsTitle is enabled, ignore title property and use file name
	if (settings.useFilenameAsTitle) {
		title = file.basename;
	} else {
		// Check frontmatter for title property
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1];
			const titleMatch = frontmatter.match(new RegExp(`^${settings.titleProperty}:\\s*(.+)$`, 'm'));
			if (titleMatch) {
				title = titleMatch[1].trim();
			}
		}
	}
	
	// Skip check if no title found and file name fallback is disabled
	if (!title) {
		return [];
	}
	
	const length = title.length;
	
	if (length < 30) {
		results.push({
			passed: false,
			message: `Title too short: ${length} characters`,
			suggestion: "Aim for 30-60 characters.",
			severity: 'warning'
		});
	} else if (length > 60) {
		results.push({
			passed: false,
			message: `Title too long: ${length} characters`,
			suggestion: "Aim for 30-60 characters.",
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

export async function checkContentLength(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkContentLength) {
		return [];
	}
	
	// Remove only frontmatter and code blocks - count everything a reader would see
	let bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, ''); // Remove frontmatter
	bodyContent = bodyContent.replace(/```[\s\S]*?```/g, ''); // Remove code blocks
	bodyContent = bodyContent.replace(/~~~[\s\S]*?~~~/g, ''); // Remove code blocks with ~~~
	// Keep everything else - wikilinks, images, HTML, headings, lists - all are readable content
	
	const wordCount = bodyContent.split(/\s+/).filter(word => word.length > 0).length;
	
	if (wordCount < settings.minContentLength) {
		results.push({
			passed: false,
			message: `Content too short: ${wordCount} words`,
			suggestion: `Aim for at least ${settings.minContentLength} words for better SEO`,
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good content length: ${wordCount} words`,
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkImageNaming(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkImageNaming) {
		return [];
	}
	
	// Remove code blocks to avoid false positives
	const cleanContent = removeCodeBlocks(content);
	
	// Find image references with line numbers
	const lines = content.split('\n');
	const imageMatches = cleanContent.match(/!\[[^\]]*\]\(([^)]+)\)/g);
	if (imageMatches) {
		imageMatches.forEach((match, index) => {
			const imagePath = match.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
			if (imagePath) {
				const fileName = imagePath.split('/').pop() || '';
				
				// Find the line number for this image
				const lineNumber = findLineNumberForImage(content, match);
				
				// Check for problematic patterns
				if (fileName.includes(' ') || fileName.includes('%20')) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has spaces in file name: ${fileName}`,
						suggestion: "Use kebab-case or underscores instead of spaces",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (fileName.match(/^[a-f0-9]{8,}$/) || 
						   fileName.match(/^[a-f0-9]{8,}_[A-Z0-9]+\./) ||
						   fileName.match(/^[a-f0-9]{8,}_MD5\./) ||
						   fileName.match(/^[a-f0-9]{20,}\./)) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has random file name: ${fileName}`,
						suggestion: "Use descriptive file names",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (fileName.toLowerCase().includes('pasted') || 
						   fileName.toLowerCase().includes('untitled') ||
						   fileName.toLowerCase().includes('photo') ||
						   // Only flag generic screenshots (no descriptive content)
						   fileName.match(/^screenshot\d*\.(png|jpg|jpeg|gif|webp)$/i) ||
						   // Flag screenshots with only random characters
						   (fileName.toLowerCase().includes('screenshot') && 
						    fileName.match(/^screenshot[a-f0-9]{6,}\.(png|jpg|jpeg|gif|webp)$/i))) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has a potentially generic file name: ${fileName}`,
						suggestion: "Use descriptive file names",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				} else if (fileName.length < 5 || fileName.length > 50) {
					results.push({
						passed: false,
						message: `Image ${index + 1} exceeds suggested file name length: ${fileName}`,
						suggestion: "Use descriptive file names between 5-50 characters",
						severity: 'warning',
						position: {
							line: lineNumber,
							searchText: match,
							context: getContextAroundLine(content, lineNumber)
						}
					});
				}
			}
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "All images have good file names",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkDuplicateContent(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkDuplicateContent) {
		return [];
	}
	
	// Check for duplicate content across other files in the vault
	const app = (globalThis as any).app;
	if (!app) {
		return results;
	}
	
	// Get files to compare against based on scan directories setting
	let filesToCheck: TFile[];
	
	if (settings.scanDirectories.trim()) {
		// Only check files in specified directories
		const targetDirs = settings.scanDirectories.split(',').map(d => d.trim());
		filesToCheck = app.vault.getMarkdownFiles().filter((f: TFile) => {
			return targetDirs.some(dir => f.path.startsWith(dir + '/') || f.path.startsWith(dir + '\\'));
		});
	} else {
		// Check all markdown files in vault
		filesToCheck = app.vault.getMarkdownFiles();
	}
	
	const otherFiles = filesToCheck.filter((f: TFile) => f.path !== file.path);
	
	if (otherFiles.length === 0) {
		results.push({
			passed: true,
			message: "No other files to compare against",
			severity: 'info'
		});
		return results;
	}
	
	// Extract meaningful content from current file (remove frontmatter, code blocks, etc.)
	const cleanContent = removeCodeBlocks(content);
	const currentParagraphs = cleanContent
		.split('\n\n')
		.filter(p => p.trim().length > 100) // Only check substantial paragraphs
		.map(p => p.trim().toLowerCase().replace(/\s+/g, ' ')); // Normalize whitespace
	
	if (currentParagraphs.length === 0) {
		results.push({
			passed: true,
			message: "No substantial content to check",
			severity: 'info'
		});
		return results;
	}
	
	// Check each paragraph against other files
	const duplicateInfo: { paragraph: string; duplicateFiles: string[] }[] = [];
	
	for (const paragraph of currentParagraphs) {
		const duplicateFiles: string[] = [];
		
		for (const otherFile of otherFiles) {
			try {
				const otherContent = await app.vault.read(otherFile);
				const cleanOtherContent = removeCodeBlocks(otherContent);
				const otherParagraphs = cleanOtherContent
					.split('\n\n')
					.filter(p => p.trim().length > 100)
					.map(p => p.trim().toLowerCase().replace(/\s+/g, ' '));
				
				// Check if this paragraph exists in the other file
				if (otherParagraphs.includes(paragraph)) {
					duplicateFiles.push(otherFile.path);
				}
			} catch (error) {
				// Skip files that can't be read
				continue;
			}
		}
		
		if (duplicateFiles.length > 0) {
			duplicateInfo.push({ paragraph, duplicateFiles });
		}
	}
	
	if (duplicateInfo.length > 0) {
		const totalDuplicates = duplicateInfo.length;
		const allDuplicateFiles = [...new Set(duplicateInfo.flatMap(d => d.duplicateFiles))];
		
		results.push({
			passed: false,
			message: `Found ${totalDuplicates} paragraph(s) duplicated in other files`,
			suggestion: `Duplicate content found. Review and rewrite duplicate content to improve SEO.<br><br>${allDuplicateFiles.map(path => `• ${path}`).join('<br>')}`,
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: "No duplicate content found across vault",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkReadingLevel(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkReadingLevel) {
		return [];
	}
	
	// Simple Flesch-Kincaid reading level calculation
	let bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
	
	// Remove only code blocks and inline code, keep other markdown formatting
	bodyContent = bodyContent
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
		.trim();
	
	const sentences = bodyContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
	const words = bodyContent.split(/\s+/).filter(w => w.length > 0 && /^[a-zA-Z]/.test(w));
	const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
	
	if (sentences.length === 0 || words.length < 10) {
		results.push({
			passed: true,
			message: "Not enough content for reading level analysis",
			severity: 'info'
		});
		return results;
	}
	
	const avgWordsPerSentence = words.length / sentences.length;
	const avgSyllablesPerWord = syllables / words.length;
	
	// Use Flesch Reading Ease instead of Flesch-Kincaid for better results with short content
	const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
	
	// Convert Flesch Reading Ease to approximate grade level
	let readingLevel: number;
	if (fleschScore >= 90) readingLevel = 5; // Very easy
	else if (fleschScore >= 80) readingLevel = 6; // Easy
	else if (fleschScore >= 70) readingLevel = 7; // Fairly easy
	else if (fleschScore >= 60) readingLevel = 8; // Standard
	else if (fleschScore >= 50) readingLevel = 9; // Fairly difficult
	else if (fleschScore >= 30) readingLevel = 10; // Difficult
	else readingLevel = 12; // Very difficult
	
	// More reasonable thresholds - 12+ is very high, 6- is very low
	if (readingLevel > 15) {
		results.push({
			passed: false,
			message: `Reading level too high: ${readingLevel.toFixed(1)} (Graduate level)`,
			suggestion: "Consider simplifying language for broader audience",
			severity: 'warning'
		});
	} else if (readingLevel < 4) {
		results.push({
			passed: false,
			message: `Reading level too low: ${readingLevel.toFixed(1)} (Elementary level)`,
			suggestion: "Consider using more sophisticated language",
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good reading level: ${readingLevel.toFixed(1)} (${getReadingLevelDescription(readingLevel)})`,
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkNotices(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkPotentiallyBrokenEmbeds) {
		return [];
	}
	
	// Check for embedded media that might not work on web publishing
	const embeddedMedia: { path: string; match: string; line: number }[] = [];
	
	// Check for markdown embedded images ![alt](src)
	const markdownImages = content.match(/!\[[^\]]*\]\([^)]+\)/g);
	if (markdownImages) {
		markdownImages.forEach(img => {
			const match = img.match(/!\[[^\]]*\]\(([^)]+)\)/);
			const path = match ? match[1] : img;
			const lineNumber = findLineNumberForImage(content, img);
			embeddedMedia.push({ path, match: img, line: lineNumber });
		});
	}
	
	// Check for wikilink embedded images ![[image.png]]
	const wikilinkImages = content.match(/!\[\[([^\]]+)\]\]/g);
	if (wikilinkImages) {
		wikilinkImages.forEach(img => {
			const match = img.match(/!\[\[([^\]]+)\]\]/);
			const path = match ? match[1] : img;
			const lineNumber = findLineNumberForImage(content, img);
			embeddedMedia.push({ path, match: img, line: lineNumber });
		});
	}
	
	// Check for embedded videos (common formats)
	const videoEmbeds = content.match(/!\[[^\]]*\]\([^)]+\.(mp4|webm|ogg|mov|avi|mkv)(\?[^)]*)?\)/gi);
	if (videoEmbeds) {
		videoEmbeds.forEach(video => {
			const match = video.match(/!\[[^\]]*\]\(([^)]+)\)/);
			const path = match ? match[1] : video;
			const lineNumber = findLineNumberForImage(content, video);
			embeddedMedia.push({ path, match: video, line: lineNumber });
		});
	}
	
	// Check for embedded audio (common formats)
	const audioEmbeds = content.match(/!\[[^\]]*\]\([^)]+\.(mp3|wav|ogg|m4a|flac|aac)(\?[^)]*)?\)/gi);
	if (audioEmbeds) {
		audioEmbeds.forEach(audio => {
			const match = audio.match(/!\[[^\]]*\]\(([^)]+)\)/);
			const path = match ? match[1] : audio;
			const lineNumber = findLineNumberForImage(content, audio);
			embeddedMedia.push({ path, match: audio, line: lineNumber });
		});
	}
	
	if (embeddedMedia.length > 0) {
		// Create individual results for each embedded media item
		embeddedMedia.forEach((media, index) => {
			results.push({
				passed: false,
				message: `Embed: ${media.path}`,
				suggestion: "Verify this media file will be accessible on your published site",
				severity: 'notice',
				position: {
					line: media.line,
					searchText: media.match,
					context: getContextAroundLine(content, media.line)
				}
			});
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No embedded media found",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkKeywordInSlug(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.keywordProperty.trim()) {
		return [];
	}
	
	// If no slug property is defined and not using file name as slug, skip this check
	if (!settings.slugProperty.trim() && !settings.useFilenameAsSlug) {
		return [];
	}
	
	// Get keyword from frontmatter
	const keywordMatch = content.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
	let keyword = keywordMatch?.[1]?.trim();
	
	if (!keyword) {
		return [];
	}
	
	// Strip surrounding quotes if present
	if ((keyword.startsWith('"') && keyword.endsWith('"')) ||
		(keyword.startsWith("'") && keyword.endsWith("'"))) {
		keyword = keyword.slice(1, -1);
	}
	
	// Get slug from frontmatter or use file name
	const slug = getSlugFromFile(file, content, settings);
	
	if (!slug) {
		return [];
	}
	
	// Check if keyword appears in slug (case-insensitive)
	// Convert keyword to kebab-case for comparison
	const keywordKebabCase = keyword.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
		.replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
	
	const keywordInSlug = slug.toLowerCase().includes(keywordKebabCase);
	
	if (keywordInSlug) {
		results.push({
			passed: true,
			message: `Keyword "${keyword}" found in slug`,
			severity: 'info'
		});
	} else {
		results.push({
			passed: false,
			message: `Keyword "${keyword}" not found in slug`,
			suggestion: `Consider including your target keyword in the slug for better SEO. Current slug: "${slug}"`,
			severity: 'warning'
		});
	}
	
	return results;
}

export async function checkSlugFormat(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	// If no slug property is defined and not using file name as slug, skip this check
	if (!settings.slugProperty.trim() && !settings.useFilenameAsSlug) {
		return [];
	}
	
	// Get slug from frontmatter or use file name
	const slug = getSlugFromFile(file, content, settings);
	
	if (!slug) {
		return [];
	}
	
	// Check for problematic patterns
	const issues: string[] = [];
	
	// Check for spaces
	if (slug.includes(' ')) {
		issues.push('contains spaces');
	}
	
	// Check for "Untitled"
	if (slug.toLowerCase().includes('untitled')) {
		issues.push('contains "Untitled"');
	}
	
	// Check for random string patterns (8+ consecutive alphanumeric characters)
	if (slug.match(/^[a-f0-9]{8,}$/i)) {
		issues.push('appears to be a random string');
	}
	
	// Check for illegal URL characters
	if (slug.match(/[<>:"'|?*]/)) {
		issues.push('contains illegal URL characters');
	}
	
	// Check for multiple consecutive special characters
	if (slug.match(/[-_]{2,}/)) {
		issues.push('has multiple consecutive separators');
	}
	
	if (issues.length > 0) {
		results.push({
			passed: false,
			message: `Slug format issues: ${issues.join(', ')}`,
			suggestion: `Use kebab-case format (e.g., "my-awesome-post") or underscores (e.g., "my_awesome_post"). Current slug: "${slug}"`,
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: "Slug format looks good",
			severity: 'info'
		});
	}
	
	return results;
}

// Helper functions
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

		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1];

			// Split by lines and look for the property
			const lines = frontmatter.split('\n');

			for (const line of lines) {
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

function getSlugFromFile(file: TFile, content: string, settings: SEOSettings): string {
	if (settings.useFilenameAsSlug) {
		// Check if we should use parent folder name instead
		if (settings.parentFolderSlugFilename.trim() && 
			file.basename.toLowerCase() === settings.parentFolderSlugFilename.toLowerCase()) {
			// Use parent folder name as slug
			const pathParts = file.path.split('/');
			if (pathParts.length > 1) {
				return pathParts[pathParts.length - 2]; // Get parent folder name
			}
		}
		// Use file name without extension
		return file.basename;
	} else if (settings.slugProperty.trim()) {
		const slugMatch = content.match(new RegExp(`^${settings.slugProperty}:\\s*(.+)$`, 'm'));
		return slugMatch?.[1]?.trim() || '';
	}
	return '';
}

function countSyllables(word: string): number {
	word = word.toLowerCase();
	if (word.length <= 3) return 1;
	
	const vowels = 'aeiouy';
	let syllableCount = 0;
	let previousWasVowel = false;
	
	for (let i = 0; i < word.length; i++) {
		const isVowel = vowels.includes(word[i]);
		if (isVowel && !previousWasVowel) {
			syllableCount++;
		}
		previousWasVowel = isVowel;
	}
	
	if (word.endsWith('e')) syllableCount--;
	if (syllableCount === 0) syllableCount = 1;
	
	return syllableCount;
}

function getReadingLevelDescription(level: number): string {
	if (level < 6) return 'Elementary';
	if (level < 8) return 'Middle School';
	if (level < 10) return 'High School';
	if (level < 12) return 'College Prep';
	return 'College';
}

// Helper functions for position tracking
function findLineNumberForImage(content: string, imageMatch: string): number {
	const lines = content.split('\n');
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].includes(imageMatch)) {
			return i + 1; // 1-based line numbers
		}
	}
	return 1; // Fallback to first line
}

function getContextAroundLine(content: string, lineNumber: number, contextLines: number = 2): string {
	const lines = content.split('\n');
	const startLine = Math.max(0, lineNumber - contextLines - 1);
	const endLine = Math.min(lines.length, lineNumber + contextLines);
	
	return lines.slice(startLine, endLine).join('\n');
}

export async function checkKeywordInTitle(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	// Skip if no keyword property is configured
	if (!settings.keywordProperty.trim()) {
		return [];
	}
	
	let title = '';
	let keyword = '';
	
	// Get keyword from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		
		// Extract keyword
		const keywordMatch = frontmatter.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
		if (keywordMatch) {
			keyword = keywordMatch[1].trim();
			// Strip surrounding quotes if present
			if ((keyword.startsWith('"') && keyword.endsWith('"')) ||
				(keyword.startsWith("'") && keyword.endsWith("'"))) {
				keyword = keyword.slice(1, -1);
			}
		}
	}
	
	// Get title - use file name if setting is enabled, otherwise use title property
	if (settings.useFilenameAsTitle) {
		title = file.basename;
	} else if (settings.titleProperty.trim()) {
		// Extract title from frontmatter
		if (frontmatterMatch) {
			const frontmatter = frontmatterMatch[1];
			const titleMatch = frontmatter.match(new RegExp(`^${settings.titleProperty}:\\s*(.+)$`, 'm'));
			if (titleMatch) {
				title = titleMatch[1].trim();
			}
		}
	}
	
	// Skip check if no title or keyword found
	if (!title || !keyword) {
		return [];
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
