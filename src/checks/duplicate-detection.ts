/**
 * Vault-wide duplicate detection system
 * Handles duplicate titles, descriptions, and content across the entire vault
 */

import { TFile, App } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";

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
	 * Split content into paragraphs
	 */
	private splitIntoParagraphs(content: string): string[] {
		// Remove frontmatter and code blocks
		let cleanContent = content.replace(/^---\n[\s\S]*?\n---\n/, '');
		cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '');
		cleanContent = cleanContent.replace(/~~~[\s\S]*?~~~/g, '');
		
		// Split into paragraphs
		return cleanContent
			.split(/\n\s*\n/)
			.map(p => p.trim())
			.filter(p => p.length > 0);
	}

	/**
	 * Calculate Jaccard similarity between two texts
	 */
	private calculateJaccardSimilarity(text1: string, text2: string): number {
		const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
		const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
		
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
