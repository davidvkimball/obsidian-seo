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
			const count = missingAltText.length;
			const isPlural = count > 1;
			
			// Extract image paths for display
			const imagePaths = missingAltText.map(match => {
				const pathMatch = match.match(/!\[[^\]]*\]\(([^)]+)\)/);
				return pathMatch ? pathMatch[1] : match;
			});
			
			results.push({
				passed: false,
				message: `${count} image${isPlural ? 's are' : ' is'} missing alt text`,
				suggestion: `Add descriptive alt text for accessibility:<br><br>${imagePaths.map(path => `• ${path}`).join('<br>')}`,
				severity: 'error'
			});
		}
	}
	
		// Check wikilink images ![[image.png]] and ![[image.png|alt text]]
		const wikilinkImages = cleanContent.match(/!\[\[([^\]]+)\]\]/g);
		if (wikilinkImages) {
			const missingAltText = wikilinkImages.filter(match => !match.includes('|'));
		if (missingAltText.length > 0) {
			const count = missingAltText.length;
			const isPlural = count > 1;
			
			// Extract image paths for display
			const imagePaths = missingAltText.map(match => {
				const pathMatch = match.match(/!\[\[([^\]]+)\]\]/);
				return pathMatch ? pathMatch[1] : match;
			});
			
			results.push({
				passed: false,
				message: `${count} wikilink image${isPlural ? 's are' : ' is'} missing alt text`,
				suggestion: `Add alt text using ![[image.png|alt text]] syntax or consider using standard markdown image syntax:<br><br>${imagePaths.map(path => `• ${path}`).join('<br>')}`,
				severity: 'error'
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
			const count = missingAlt.length;
			const isPlural = count > 1;
			
			// Extract src attributes for display
			const imagePaths = missingAlt.map(img => {
				const srcMatch = img.match(/src\s*=\s*["']([^"']*)["']/);
				return srcMatch ? srcMatch[1] : 'HTML img tag';
			});
			
			results.push({
				passed: false,
				message: `${count} HTML image${isPlural ? 's are' : ' is'} missing alt attribute`,
				suggestion: `Add alt attribute to HTML img tags:<br><br>${imagePaths.map(path => `• ${path}`).join('<br>')}`,
				severity: 'error'
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
			
			results.push({
				passed: false,
				message: `Naked link found: ${link}`,
				suggestion: "Convert to markdown link format: [link text](url)",
				severity: 'warning'
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
	
	// Remove frontmatter
	let bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
	
	// Remove code blocks (both ``` and ~~~)
	bodyContent = bodyContent.replace(/```[\s\S]*?```/g, '');
	bodyContent = bodyContent.replace(/~~~[\s\S]*?~~~/g, '');
	
	const lines = bodyContent.split('\n');
	let lastHeadingLevel = null;
	let hasHeading = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
		
		if (headingMatch) {
			hasHeading = true;
			const currentLevel = headingMatch[1].length;
			const headingText = headingMatch[2].trim();
			
			// If this is the first heading, don't check for violations
			if (lastHeadingLevel === null) {
				lastHeadingLevel = currentLevel;
				continue;
			}
			
			// Check if current level skips levels after the last heading
			if (currentLevel > lastHeadingLevel + 1) {
				results.push({
					passed: false,
					message: `"${headingText}" (H${currentLevel}) skips heading level(s) after H${lastHeadingLevel}`,
					suggestion: "Use heading levels in order (H1 → H2 → H3, etc.)",
					severity: 'warning'
				});
			}
			
			lastHeadingLevel = currentLevel;
		}
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
						severity: 'error'
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
						severity: 'error'
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
					message: `Potentially broken link: ${linkTarget}`,
					suggestion: `${linkType.charAt(0).toUpperCase() + linkType.slice(1)} that may be resolved by your site generator. Verify the target will resolve on your published site.`,
					severity: 'warning'
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
							message: `Potentially broken link: ${linkTarget}`,
							suggestion: "Wikilinks may not work on the web - consider converting to standard markdown links",
							severity: 'warning'
						});
					}
				}
			}
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
	
	// Find image references
	const imageMatches = cleanContent.match(/!\[[^\]]*\]\(([^)]+)\)/g);
	if (imageMatches) {
		imageMatches.forEach((match, index) => {
			const imagePath = match.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
			if (imagePath) {
				const fileName = imagePath.split('/').pop() || '';
				
				// Check for problematic patterns
				if (fileName.includes(' ') || fileName.includes('%20')) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has spaces in file name: ${fileName}`,
						suggestion: "Use kebab-case or underscores instead of spaces",
						severity: 'warning'
					});
				} else if (fileName.match(/^[a-f0-9]{8,}$/) || 
						   fileName.match(/^[a-f0-9]{8,}_[A-Z0-9]+\./) ||
						   fileName.match(/^[a-f0-9]{8,}_MD5\./) ||
						   fileName.match(/^[a-f0-9]{20,}\./)) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has random file name: ${fileName}`,
						suggestion: "Use descriptive file names",
						severity: 'warning'
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
						severity: 'warning'
					});
				} else if (fileName.length < 5 || fileName.length > 50) {
					results.push({
						passed: false,
						message: `Image ${index + 1} exceeds suggested file name length: ${fileName}`,
						suggestion: "Use descriptive file names between 5-50 characters",
						severity: 'warning'
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
	const embeddedMedia: string[] = [];
	
	// Check for markdown embedded images ![alt](src)
	const markdownImages = content.match(/!\[[^\]]*\]\([^)]+\)/g);
	if (markdownImages) {
		embeddedMedia.push(...markdownImages.map(img => {
			const match = img.match(/!\[[^\]]*\]\(([^)]+)\)/);
			return match ? match[1] : img;
		}));
	}
	
	// Check for wikilink embedded images ![[image.png]]
	const wikilinkImages = content.match(/!\[\[([^\]]+)\]\]/g);
	if (wikilinkImages) {
		embeddedMedia.push(...wikilinkImages.map(img => {
			const match = img.match(/!\[\[([^\]]+)\]\]/);
			return match ? match[1] : img;
		}));
	}
	
	// Check for embedded videos (common formats)
	const videoEmbeds = content.match(/!\[[^\]]*\]\([^)]+\.(mp4|webm|ogg|mov|avi|mkv)(\?[^)]*)?\)/gi);
	if (videoEmbeds) {
		embeddedMedia.push(...videoEmbeds.map(video => {
			const match = video.match(/!\[[^\]]*\]\(([^)]+)\)/);
			return match ? match[1] : video;
		}));
	}
	
	// Check for embedded audio (common formats)
	const audioEmbeds = content.match(/!\[[^\]]*\]\([^)]+\.(mp3|wav|ogg|m4a|flac|aac)(\?[^)]*)?\)/gi);
	if (audioEmbeds) {
		embeddedMedia.push(...audioEmbeds.map(audio => {
			const match = audio.match(/!\[[^\]]*\]\(([^)]+)\)/);
			return match ? match[1] : audio;
		}));
	}
	
	if (embeddedMedia.length > 0) {
		results.push({
			passed: false,
			message: `Found ${embeddedMedia.length} embedded media file(s) that may not work on web publishing`,
			suggestion: `Verify these media files will be accessible on your published site:<br><br>${embeddedMedia.map(path => `• ${path}`).join('<br>')}`,
			severity: 'warning'
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No embedded media compatibility issues found",
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
