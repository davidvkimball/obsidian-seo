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
		.replace(/^---\n[\s\S]*?\n---\n/, ''); // Remove frontmatter
}

// Helper function specifically for naked links - removes HTML attributes
function removeHtmlAttributes(content: string): string {
	return content
		.replace(/```[\s\S]*?```/g, '') // Remove code blocks
		.replace(/~~~[\s\S]*?~~~/g, '') // Remove code blocks with ~~~
		.replace(/`[^`\n]+`/g, '') // Remove inline code
		.replace(/<[^>]*>/g, '') // Remove HTML tags completely
		.replace(/^---\n[\s\S]*?\n---\n/, ''); // Remove frontmatter
}

export async function checkAltText(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
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
			results.push({
				passed: false,
				message: `${count} image${isPlural ? 's are' : ' is'} missing alt text`,
				suggestion: "Add descriptive alt text for accessibility",
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
				results.push({
					passed: false,
					message: `${count} wikilink image${isPlural ? 's are' : ' is'} missing alt text`,
					suggestion: "Add alt text using ![[image.png|alt text]] syntax or consider using standard markdown image syntax",
					severity: 'error'
				});
			}
		}
	
	// Check HTML images <img alt="text">
	const htmlImages = cleanContent.match(/<img[^>]*>/g);
	if (htmlImages) {
		const missingAlt = htmlImages.filter(match => !match.includes('alt='));
		if (missingAlt.length > 0) {
			const count = missingAlt.length;
			const isPlural = count > 1;
			results.push({
				passed: false,
				message: `${count} HTML image${isPlural ? 's are' : ' is'} missing alt attribute`,
				suggestion: "Add alt attribute to HTML img tags",
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
	
	// Remove code blocks and HTML content to avoid false positives
	const cleanContent = removeHtmlAttributes(content);
	
	// Find naked links (URLs without markdown link syntax)
	const nakedLinks = cleanContent.match(/(?<!\]\()https?:\/\/[^\s\)]+/g);
	if (nakedLinks) {
		nakedLinks.forEach((link, index) => {
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
	
	const keyword = keywordMatch[1].trim();
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
	
	if (!settings.titleProperty) {
		return [];
	}
	
	let title = '';
	
	// Check frontmatter first
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		const titleMatch = frontmatter.match(new RegExp(`^${settings.titleProperty}:\\s*(.+)$`, 'm'));
		if (titleMatch) {
			title = titleMatch[1].trim();
		}
	}
	
	// Fall back to filename if no frontmatter title and setting is enabled
	if (!title && settings.useFilenameAsTitle) {
		title = file.basename;
	}
	
	// Skip check if no title found and filename fallback is disabled
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
		return [{
			passed: true,
			message: "Content length check disabled",
			severity: 'info'
		}];
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
		return [{
			passed: true,
			message: "Image naming check disabled",
			severity: 'info'
		}];
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
						message: `Image ${index + 1} has spaces in filename: ${fileName}`,
						suggestion: "Use kebab-case or underscores instead of spaces",
						severity: 'warning'
					});
				} else if (fileName.match(/^[a-f0-9]{8,}$/)) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has random filename: ${fileName}`,
						suggestion: "Use descriptive filenames for better SEO",
						severity: 'warning'
					});
				} else if (fileName.toLowerCase().includes('pasted') || 
						   fileName.toLowerCase().includes('image') ||
						   fileName.toLowerCase().includes('untitled') ||
						   fileName.toLowerCase().includes('screenshot') ||
						   fileName.toLowerCase().includes('photo')) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has generic filename: ${fileName}`,
						suggestion: "Use descriptive filenames for better SEO",
						severity: 'warning'
					});
				} else if (fileName.length < 5 || fileName.length > 50) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has inappropriate filename length: ${fileName}`,
						suggestion: "Use descriptive filenames between 5-50 characters",
						severity: 'warning'
					});
				}
			}
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "All images have good filenames",
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
		return [{
			passed: true,
			message: "Reading level check disabled",
			severity: 'info'
		}];
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
	
	if (!settings.showNotices) {
		return [{
			passed: true,
			message: "Notices check disabled",
			severity: 'info'
		}];
	}
	
	// Check for wikilinks that might not render on web
	const wikilinks = content.match(/\[\[([^\]]+)\]\]/g);
	if (wikilinks) {
		// Extract just the link text for display
		const wikilinkTexts = wikilinks.map(link => {
			const match = link.match(/\[\[([^\]]+)\]\]/);
			return match ? match[1] : link;
		});
		
		results.push({
			passed: false,
			message: `Found ${wikilinks.length} wikilink(s) that may not render on web`,
			suggestion: `Consider converting to markdown links for web publishing:<br><br>${wikilinkTexts.map(text => `• ${text}`).join('<br>')}`,
			severity: 'warning'
		});
	}
	
	// Check for embedded images that might not work on web
	const embeddedImages = content.match(/!\[[^\]]*\]\([^)]+\)/g);
	if (embeddedImages) {
		// Extract image paths for display
		const imagePaths = embeddedImages.map(img => {
			const match = img.match(/!\[[^\]]*\]\(([^)]+)\)/);
			return match ? match[1] : img;
		});
		
		results.push({
			passed: false,
			message: `Found ${embeddedImages.length} embedded image(s) that may not work on web`,
			suggestion: `Ensure images are properly linked and accessible:<br><br>${imagePaths.map(path => `• ${path}`).join('<br>')}`,
			severity: 'warning'
		});
	}
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No web compatibility issues found",
			severity: 'info'
		});
	}
	
	return results;
}

// Helper functions
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
	
	// Skip if no title property or keyword property is configured
	if (!settings.titleProperty || !settings.keywordProperty) {
		return [];
	}
	
	let title = '';
	let keyword = '';
	
	// Get title from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (frontmatterMatch) {
		const frontmatter = frontmatterMatch[1];
		
		// Extract title
		const titleMatch = frontmatter.match(new RegExp(`^${settings.titleProperty}:\\s*(.+)$`, 'm'));
		if (titleMatch) {
			title = titleMatch[1].trim();
		}
		
		// Extract keyword
		const keywordMatch = frontmatter.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
		if (keywordMatch) {
			keyword = keywordMatch[1].trim();
		}
	}
	
	// Fall back to filename if no frontmatter title and setting is enabled
	if (!title && settings.useFilenameAsTitle) {
		title = file.basename;
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
