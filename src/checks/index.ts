import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";

export async function checkAltText(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	// Check markdown images ![alt](src)
	const markdownImages = content.match(/!\[([^\]]*)\]\([^)]+\)/g);
	if (markdownImages) {
		markdownImages.forEach((match, index) => {
			const altText = match.match(/!\[([^\]]*)\]/)?.[1];
			if (!altText || altText.trim() === '') {
				results.push({
					passed: false,
					message: `Image ${index + 1} is missing alt text`,
					suggestion: "Add descriptive alt text for accessibility and SEO",
					severity: 'error'
				});
			}
		});
	}
	
	// Check HTML images <img alt="text">
	const htmlImages = content.match(/<img[^>]*>/g);
	if (htmlImages) {
		htmlImages.forEach((match, index) => {
			if (!match.includes('alt=')) {
				results.push({
					passed: false,
					message: `HTML image ${index + 1} is missing alt attribute`,
					suggestion: "Add alt attribute to HTML img tags",
					severity: 'error'
				});
			}
		});
	}
	
	if (results.length === 0) {
		// Check if there are any images at all
		const hasImages = markdownImages && markdownImages.length > 0 || htmlImages && htmlImages.length > 0;
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
	
	// Find naked links (URLs without markdown link syntax)
	const nakedLinks = content.match(/(?<!\]\()https?:\/\/[^\s\)]+/g);
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
	
	const lines = content.split('\n');
	let lastHeadingLevel = 0;
	let hasHeading = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const headingMatch = line.match(/^(#{1,6})\s/);
		
		if (headingMatch) {
			hasHeading = true;
			const currentLevel = headingMatch[1].length;
			
			if (currentLevel > lastHeadingLevel + 1) {
				results.push({
					passed: false,
					message: `Heading level ${currentLevel} after level ${lastHeadingLevel} (line ${i + 1})`,
					suggestion: "Use heading levels in order (H1 → H2 → H3, etc.)",
					line: i + 1,
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
		return [{
			passed: true,
			message: "Keyword density check skipped (no keyword property configured)",
			severity: 'info'
		}];
	}
	
	// Extract keyword from frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return [{
			passed: true,
			message: "No frontmatter found, keyword density check skipped",
			severity: 'info'
		}];
	}
	
	const frontmatter = frontmatterMatch[1];
	const keywordMatch = frontmatter.match(new RegExp(`^${settings.keywordProperty}:\\s*(.+)$`, 'm'));
	
	if (!keywordMatch) {
		return [{
			passed: true,
			message: "No keyword found in frontmatter, keyword density check skipped",
			severity: 'info'
		}];
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
	
	// Find internal links [[link]] and [text](link)
	const internalLinks = [
		...content.match(/\[\[([^\]]+)\]\]/g) || [],
		...content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []
	];
	
	for (const link of internalLinks) {
		let linkTarget = '';
		
		if (link.startsWith('[[')) {
			// Wikilink
			linkTarget = link.match(/\[\[([^\]]+)\]\]/)?.[1] || '';
		} else {
			// Markdown link
			const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
			linkTarget = match?.[2] || '';
		}
		
		if (linkTarget && !linkTarget.startsWith('http')) {
			// Check if file exists
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
	
	if (results.length === 0) {
		results.push({
			passed: true,
			message: "No broken internal links found",
			severity: 'info'
		});
	}
	
	return results;
}

export async function checkMetaDescription(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.descriptionProperty) {
		return [{
			passed: true,
			message: "Meta description check skipped (no description property configured)",
			severity: 'info'
		}];
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
			suggestion: "Aim for 120-160 characters for optimal SEO",
			severity: 'warning'
		});
	} else if (length > 160) {
		results.push({
			passed: false,
			message: `Description too long: ${length} characters`,
			suggestion: "Aim for 120-160 characters for optimal SEO",
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
		return [{
			passed: true,
			message: "Title length check skipped (no title property configured)",
			severity: 'info'
		}];
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
		return [{
			passed: true,
			message: "Title length check skipped (no title found)",
			severity: 'info'
		}];
	}
	
	const length = title.length;
	
	if (length < 30) {
		results.push({
			passed: false,
			message: `Title too short: ${length} characters`,
			suggestion: "Aim for 30-60 characters for optimal SEO",
			severity: 'warning'
		});
	} else if (length > 60) {
		results.push({
			passed: false,
			message: `Title too long: ${length} characters`,
			suggestion: "Aim for 30-60 characters for optimal SEO",
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
	
	const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
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
	
	// Find image references
	const imageMatches = content.match(/!\[[^\]]*\]\(([^)]+)\)/g);
	if (imageMatches) {
		imageMatches.forEach((match, index) => {
			const imagePath = match.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
			if (imagePath) {
				const fileName = imagePath.split('/').pop() || '';
				
				// Check for problematic patterns
				if (fileName.includes(' ')) {
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
				} else if (fileName.toLowerCase().includes('pasted') || fileName.toLowerCase().includes('image')) {
					results.push({
						passed: false,
						message: `Image ${index + 1} has generic filename: ${fileName}`,
						suggestion: "Use descriptive filenames for better SEO",
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
		return [{
			passed: true,
			message: "Duplicate content check disabled",
			severity: 'info'
		}];
	}
	
	// This is a simplified duplicate check - in a real implementation,
	// you'd compare against other files in the vault
	results.push({
		passed: true,
		message: "Duplicate content check not yet implemented",
		severity: 'info'
	});
	
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
	const bodyContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
	const sentences = bodyContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
	const words = bodyContent.split(/\s+/).filter(w => w.length > 0);
	const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
	
	if (sentences.length === 0 || words.length === 0) {
		results.push({
			passed: true,
			message: "Not enough content for reading level analysis",
			severity: 'info'
		});
		return results;
	}
	
	const avgWordsPerSentence = words.length / sentences.length;
	const avgSyllablesPerWord = syllables / words.length;
	const readingLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
	
	if (readingLevel > 12) {
		results.push({
			passed: false,
			message: `Reading level too high: ${readingLevel.toFixed(1)} (College level)`,
			suggestion: "Consider simplifying language for broader audience",
			severity: 'warning'
		});
	} else if (readingLevel < 6) {
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
		results.push({
			passed: false,
			message: `Found ${wikilinks.length} wikilink(s) that may not render on web`,
			suggestion: "Consider converting to markdown links for web publishing",
			severity: 'warning'
		});
	}
	
	// Check for embedded images that might not work on web
	const embeddedImages = content.match(/!\[[^\]]*\]\([^)]+\)/g);
	if (embeddedImages) {
		results.push({
			passed: false,
			message: `Found ${embeddedImages.length} embedded image(s) that may not work on web`,
			suggestion: "Ensure images are properly linked and accessible",
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
