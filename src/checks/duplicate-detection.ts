/**
 * Vault-wide duplicate detection system
 * Handles duplicate titles, descriptions, and content across the entire vault
 */

import { TFile, App } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";

/**
 * Vault data structure for storing file metadata
 */
export interface VaultData {
	/** Map of file paths to their metadata */
	files: Map<string, FileMetadata>;
	/** Map of titles to file paths that use them */
	titleMap: Map<string, string[]>;
	/** Map of descriptions to file paths that use them */
	descriptionMap: Map<string, string[]>;
	/** Timestamp when data was last collected */
	lastUpdated: number;
}

/**
 * Metadata for a single file
 */
export interface FileMetadata {
	/** File path */
	path: string;
	/** Extracted title */
	title: string;
	/** Extracted description */
	description?: string;
	/** File content for content duplicate detection */
	content: string;
	/** Whether this file should be ignored */
	ignored: boolean;
}

/**
 * Vault data collection and duplicate detection manager
 */
export class VaultDuplicateDetector {
	private vaultData: VaultData | null = null;
	private app: App;
	private settings: SEOSettings;

	constructor(app: App, settings: SEOSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Collect vault-wide data for duplicate detection
	 */
	async collectVaultData(): Promise<VaultData> {
		const vaultData: VaultData = {
			files: new Map(),
			titleMap: new Map(),
			descriptionMap: new Map(),
			lastUpdated: Date.now()
		};

		// Get all markdown files
		const files = this.app.vault.getMarkdownFiles();
		
		// Filter files based on settings
		const filteredFiles = files.filter(file => {
			// Check ignore underscore files setting
			if (this.settings.ignoreUnderscoreFiles && file.basename.startsWith('_')) {
				return false;
			}
			
			// Check scan directories setting
			if (this.settings.scanDirectories) {
				const directories = this.settings.scanDirectories.split(',').map(d => d.trim());
				return directories.some(dir => file.path.startsWith(dir));
			}
			
			return true;
		});

		// Process each file
		for (const file of filteredFiles) {
			try {
				const content = await this.app.vault.read(file);
				const metadata = this.extractFileMetadata(file, content);
				
				if (!metadata.ignored) {
					vaultData.files.set(file.path, metadata);
					
					// Add to title map
					const titleKey = metadata.title.toLowerCase().trim();
					if (titleKey) {
						if (!vaultData.titleMap.has(titleKey)) {
							vaultData.titleMap.set(titleKey, []);
						}
						vaultData.titleMap.get(titleKey)!.push(file.path);
					}
					
					// Add to description map
					if (metadata.description) {
						const descKey = metadata.description.toLowerCase().trim();
						if (descKey) {
							if (!vaultData.descriptionMap.has(descKey)) {
								vaultData.descriptionMap.set(descKey, []);
							}
							vaultData.descriptionMap.get(descKey)!.push(file.path);
						}
					}
				}
			} catch (error) {
				console.warn(`Failed to process file ${file.path}:`, error);
			}
		}

		this.vaultData = vaultData;
		return vaultData;
	}

	/**
	 * Extract metadata from a file
	 */
	private extractFileMetadata(file: TFile, content: string): FileMetadata {
		// Extract frontmatter
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
		const frontmatter: Record<string, any> = {};
		
		if (frontmatterMatch && frontmatterMatch[1]) {
			const frontmatterContent = frontmatterMatch[1];
			const lines = frontmatterContent.split('\n');
			
			for (const line of lines) {
				const match = line.match(/^(\w+):\s*(.*)$/);
				if (match && match[1] && match[2] !== undefined) {
					const key = match[1];
					let value = match[2];
					
					// Remove quotes if present
					if ((value.startsWith('"') && value.endsWith('"')) || 
						(value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1);
					}
					
					frontmatter[key] = value;
				}
			}
		}

		// Extract title
		let title = '';
		if (this.settings.titleProperty && frontmatter[this.settings.titleProperty]) {
			title = frontmatter[this.settings.titleProperty];
		} else if (this.settings.useFilenameAsTitle) {
			title = file.basename;
		} else {
			title = file.basename; // Default fallback
		}

		// Extract description
		let description: string | undefined;
		if (this.settings.descriptionProperty && frontmatter[this.settings.descriptionProperty]) {
			description = frontmatter[this.settings.descriptionProperty];
		}

		return {
			path: file.path,
			title,
			description,
			content,
			ignored: false
		};
	}

	/**
	 * Check for duplicate titles
	 */
	async checkDuplicateTitles(file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
		const results: SEOCheckResult[] = [];
		
		// Only run if duplicate content checking is enabled AND we have title configuration
		if (!settings.checkDuplicateContent || (!settings.titleProperty && !settings.useFilenameAsTitle)) {
			return results;
		}

		// Ensure vault data is collected
		if (!this.vaultData) {
			await this.collectVaultData();
		}

		const fileMetadata = this.vaultData!.files.get(file.path);
		if (!fileMetadata) {
			return results;
		}

		const titleKey = fileMetadata.title.toLowerCase().trim();
		if (!titleKey) {
			return results;
		}

		const duplicateFiles = this.vaultData?.titleMap.get(titleKey) || [];
		
		if (duplicateFiles.length > 1) {
			const otherFiles = duplicateFiles.filter(f => f !== file.path);
			
			// Check for generic titles
			const genericTitles = ['untitled', 'new note', 'untitled note', 'new file', 'document'];
			const isGeneric = genericTitles.includes(titleKey);
			
			const severity = isGeneric ? 'warning' : 'error';
			const message = isGeneric 
				? `Generic title "${fileMetadata.title}" used in ${duplicateFiles.length} files`
				: `Duplicate title "${fileMetadata.title}" found in ${duplicateFiles.length} files`;
			
			const suggestion = isGeneric
				? 'Consider using a more descriptive title'
				: `This title is also used in: ${otherFiles.map(f => `<a href="#" data-file-path="${f}" class="seo-file-link">${this.getDisplayPath(f)}</a>`).join(', ')}`;

			results.push({
				passed: false,
				message,
				suggestion,
				severity,
				position: {
					line: 1,
					searchText: this.settings.titleProperty || 'title',
					context: `title: "${fileMetadata.title}"`
				}
			});
		} else {
			results.push({
				passed: true,
				message: `Unique title: "${fileMetadata.title}"`,
				severity: 'info'
			});
		}

		return results;
	}

	/**
	 * Check for duplicate descriptions
	 */
	async checkDuplicateDescriptions(file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
		const results: SEOCheckResult[] = [];
		
		// Only run if duplicate content checking is enabled AND we have description property configured
		if (!settings.checkDuplicateContent || !settings.descriptionProperty) {
			return results;
		}

		// Ensure vault data is collected
		if (!this.vaultData) {
			await this.collectVaultData();
		}

		const fileMetadata = this.vaultData!.files.get(file.path);
		if (!fileMetadata || !fileMetadata.description) {
			return results;
		}

		const descKey = fileMetadata.description.toLowerCase().trim();
		const duplicateFiles = this.vaultData?.descriptionMap.get(descKey) || [];
		
		if (duplicateFiles.length > 1) {
			const otherFiles = duplicateFiles.filter(f => f !== file.path);
			
			// Check for generic descriptions
			const genericDescriptions = ['description', 'meta description', 'page description'];
			const isGeneric = genericDescriptions.includes(descKey);
			
			const severity = isGeneric ? 'warning' : 'error';
			const message = isGeneric 
				? `Generic description "${fileMetadata.description}" used in ${duplicateFiles.length} files`
				: `Duplicate description "${fileMetadata.description}" found in ${duplicateFiles.length} files`;
			
			const suggestion = isGeneric
				? 'Consider using a more descriptive meta description'
				: `This description is also used in: ${otherFiles.map(f => `<a href="#" data-file-path="${f}" class="seo-file-link">${this.getDisplayPath(f)}</a>`).join(', ')}`;

			results.push({
				passed: false,
				message,
				suggestion,
				severity,
				position: {
					line: 1,
					searchText: this.settings.descriptionProperty || 'description',
					context: `description: "${fileMetadata.description}"`
				}
			});
		} else {
			results.push({
				passed: true,
				message: `Unique description: "${fileMetadata.description}"`,
				severity: 'info'
			});
		}

		return results;
	}

	/**
	 * Check for duplicate content using Jaccard similarity
	 */
	async checkDuplicateContent(file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
		const results: SEOCheckResult[] = [];
		
		if (!settings.checkDuplicateContent) {
			return results;
		}

		// Ensure vault data is collected
		if (!this.vaultData) {
			await this.collectVaultData();
		}

		const fileMetadata = this.vaultData?.files.get(file.path);
		if (!fileMetadata) {
			return results;
		}

		// Split content into paragraphs
		const paragraphs = this.splitIntoParagraphs(fileMetadata.content);
		const duplicates: Array<{
			paragraph: number;
			similarFiles: Array<{ file: string; similarity: number }>;
		}> = [];

		// Compare each paragraph against all other files
		for (let i = 0; i < paragraphs.length; i++) {
			const paragraph = paragraphs[i];
			if (!paragraph || paragraph.length < 50) continue; // Skip short paragraphs

			const similarFiles: Array<{ file: string; similarity: number }> = [];

			// Check against all other files
			for (const [otherFilePath, otherMetadata] of this.vaultData?.files || []) {
				if (otherFilePath === file.path) continue;

				const otherParagraphs = this.splitIntoParagraphs(otherMetadata.content);
				
				for (const otherParagraph of otherParagraphs) {
					if (!otherParagraph || otherParagraph.length < 50) continue;

					const similarity = this.calculateJaccardSimilarity(paragraph, otherParagraph);
					if (similarity >= settings.duplicateThreshold) {
						similarFiles.push({
							file: otherFilePath,
							similarity
						});
					}
				}
			}

			if (similarFiles.length > 0) {
				duplicates.push({
					paragraph: i + 1,
					similarFiles
				});
			}
		}

		// Generate results
		if (duplicates.length > 0) {
			duplicates.forEach(({ paragraph, similarFiles }) => {
				const maxSimilarity = Math.max(...similarFiles.map(s => s.similarity));
				const fileList = similarFiles
					.sort((a, b) => b.similarity - a.similarity)
					.slice(0, 3) // Show top 3 matches
					.map(s => `<a href="#" data-file-path="${s.file}" class="seo-file-link">${this.getDisplayPath(s.file)}</a> (${s.similarity.toFixed(1)}%)`)
					.join(', ');

				results.push({
					passed: false,
					message: `Duplicate content detected in paragraph ${paragraph}`,
					suggestion: `Similarity: ${maxSimilarity.toFixed(1)}% with: ${fileList}`,
					severity: 'error',
					position: {
						line: this.findParagraphLine(fileMetadata.content, paragraph - 1),
						searchText: paragraphs[paragraph - 1]?.substring(0, 50) + '...',
						context: `Paragraph ${paragraph} content`
					}
				});
			});
		} else {
			results.push({
				passed: true,
				message: "No duplicate content detected",
				severity: 'info'
			});
		}

		return results;
	}

	/**
	 * Split content into paragraphs, filtering out non-content elements
	 */
	private splitIntoParagraphs(content: string): string[] {
		// Use the content parser to remove code blocks, HTML, and other non-content
		let cleanContent = removeCodeBlocks(content);
		
		// Additional filtering for structural elements
		cleanContent = cleanContent
			.replace(/^#{1,6}\s+/gm, '') // Remove heading markers
			.replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
			.replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
			.replace(/^\s*>\s*/gm, '') // Remove blockquote markers
			.replace(/^\s*\|.*\|.*$/gm, '') // Remove table rows
			.replace(/^\s*\|.*$/gm, '') // Remove table separators
			.replace(/\[\[.*?\]\]/g, '') // Remove Obsidian internal links
			.replace(/!\[\[.*?\]\]/g, '') // Remove Obsidian image links
			.replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
			.replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
			.replace(/^\s*---\s*$/gm, '') // Remove horizontal rules
			.replace(/^\s*\+\+\+\s*$/gm, '') // Remove Obsidian spoilers
			.replace(/^\s*==\s*$/gm, '') // Remove Obsidian highlights
			.replace(/^\s*!!\s*$/gm, '') // Remove Obsidian callouts
			.replace(/^\s*>\s*\[!.*?\]\s*$/gm, '') // Remove Obsidian callout headers
			.replace(/^\s*>\s*$/gm, '') // Remove empty blockquotes
			.replace(/^\s*$/gm, '') // Remove empty lines
			.trim();
		
		// Split into paragraphs and filter out non-content
		return cleanContent
			.split(/\n\s*\n/)
			.map(p => p.trim())
			.filter(p => {
				// Filter out paragraphs that are too short or contain only structural elements
				if (p.length < 30) return false;
				
				// Filter out paragraphs that are mostly HTML-like content
				const htmlLikeRatio = (p.match(/<[^>]*>/g) || []).join('').length / p.length;
				if (htmlLikeRatio > 0.3) return false;
				
				// Filter out paragraphs that are mostly special characters or formatting
				const specialCharRatio = (p.match(/[^\w\s.,!?;:'"()-]/g) || []).length / p.length;
				if (specialCharRatio > 0.5) return false;
				
				// Filter out paragraphs that are mostly numbers or symbols
				const wordRatio = (p.match(/\b\w+\b/g) || []).length / p.split(/\s+/).length;
				if (wordRatio < 0.3) return false;
				
				return true;
			});
	}

	/**
	 * Calculate Jaccard similarity between two texts
	 */
	private calculateJaccardSimilarity(text1: string, text2: string): number {
		// Normalize text by removing extra whitespace and converting to lowercase
		const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
		
		const normalized1 = normalize(text1);
		const normalized2 = normalize(text2);
		
		// Extract words, filtering out very short words and common stop words
		const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
		
		const words1 = new Set(
			normalized1
				.split(/\s+/)
				.filter(w => w.length > 2 && !stopWords.has(w))
				.map(w => w.replace(/[^\w]/g, '')) // Remove punctuation
				.filter(w => w.length > 0)
		);
		
		const words2 = new Set(
			normalized2
				.split(/\s+/)
				.filter(w => w.length > 2 && !stopWords.has(w))
				.map(w => w.replace(/[^\w]/g, '')) // Remove punctuation
				.filter(w => w.length > 0)
		);
		
		// If either set is empty, return 0 similarity
		if (words1.size === 0 || words2.size === 0) {
			return 0;
		}
		
		const intersection = new Set([...words1].filter(x => words2.has(x)));
		const union = new Set([...words1, ...words2]);
		
		return (intersection.size / union.size) * 100;
	}

	/**
	 * Find the line number of a paragraph in the content
	 */
	private findParagraphLine(content: string, paragraphIndex: number): number {
		const paragraphs = this.splitIntoParagraphs(content);
		if (paragraphIndex >= paragraphs.length) return 1;
		
		const targetParagraph = paragraphs[paragraphIndex];
		if (!targetParagraph) return 1;
		
		const lines = content.split('\n');
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line && line.includes(targetParagraph.substring(0, 50))) {
				return i + 1;
			}
		}
		
		return 1;
	}

	/**
	 * Get display path for a file
	 */
	private getDisplayPath(filePath: string): string {
		// If we have vault data and useNoteTitles is enabled, try to get the title
		if (this.vaultData && this.settings.useNoteTitles) {
			const fileMetadata = this.vaultData.files.get(filePath);
			if (fileMetadata && fileMetadata.title) {
				return fileMetadata.title;
			}
		}
		
		// Fallback to filename
		const parts = filePath.split('/');
		return parts[parts.length - 1] || filePath;
	}

	/**
	 * Clear cached vault data
	 */
	clearCache(): void {
		this.vaultData = null;
	}

	/**
	 * Get current vault data
	 */
	getVaultData(): VaultData | null {
		return this.vaultData;
	}
}
