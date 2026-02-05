/**
 * Content validation checks
 * Checks for content length, reading level, and duplicate content
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { removeCodeBlocks } from "./utils/content-parser";
import { countSyllables, getReadingLevelDescription } from "./utils/reading-level";
import { VaultDuplicateDetector } from "./duplicate-detection";

/**
 * Checks content length against minimum requirements
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkContentLength(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];

	if (!settings.checkContentLength) {
		return Promise.resolve([]);
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
			suggestion: `Aim for at least ${settings.minContentLength} words`,
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good content length: ${wordCount} words`,
			severity: 'info'
		});
	}

	return Promise.resolve(results);
}

/**
 * Checks reading level of the content
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkReadingLevel(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];

	if (!settings.checkReadingLevel) {
		return Promise.resolve([]);
	}

	// Remove code blocks and frontmatter for reading level analysis
	const cleanContent = removeCodeBlocks(content);

	// Split into sentences and words
	const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
	const words = cleanContent.split(/\s+/).filter(word => word.length > 0);

	if (sentences.length === 0 || words.length === 0) {
		results.push({
			passed: true,
			message: "No readable content found for reading level analysis",
			severity: 'info'
		});
		return Promise.resolve(results);
	}

	// Calculate Flesch-Kincaid reading level
	const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
	const avgWordsPerSentence = words.length / sentences.length;
	const avgSyllablesPerWord = totalSyllables / words.length;

	const readingLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

	const description = getReadingLevelDescription(readingLevel);

	if (readingLevel > 12) {
		results.push({
			passed: false,
			message: `Reading level too high: ${readingLevel.toFixed(1)} (${description})`,
			suggestion: "Consider simplifying sentence structure and using shorter words",
			severity: 'warning'
		});
	} else {
		results.push({
			passed: true,
			message: `Good reading level: ${readingLevel.toFixed(1)} (${description})`,
			severity: 'info'
		});
	}

	return Promise.resolve(results);
}

/**
 * Checks for duplicate content
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkDuplicateContent(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];

	if (!settings.checkDuplicateContent) {
		return Promise.resolve([]);
	}

	// This is a simplified version - in a real implementation, you'd compare against other files
	// For now, we'll just check for obvious duplication within the same file

	// Remove code blocks and frontmatter
	const cleanContent = removeCodeBlocks(content);

	// Split into paragraphs
	const paragraphs = cleanContent.split(/\n\s*\n/).filter(p => p.trim().length > 20);

	// Check for repeated paragraphs
	const duplicateParagraphs = [];
	for (let i = 0; i < paragraphs.length; i++) {
		for (let j = i + 1; j < paragraphs.length; j++) {
			const paragraph1 = paragraphs[i];
			const paragraph2 = paragraphs[j];
			if (paragraph1 && paragraph2) {
				const similarity = calculateSimilarity(paragraph1, paragraph2);
				if (similarity > settings.duplicateThreshold) {
					duplicateParagraphs.push({
						paragraph1: i + 1,
						paragraph2: j + 1,
						similarity: similarity
					});
				}
			}
		}
	}

	if (duplicateParagraphs.length > 0) {
		duplicateParagraphs.forEach(({ paragraph1, paragraph2, similarity }) => {
			results.push({
				passed: false,
				message: `Duplicate content detected between paragraphs ${paragraph1} and ${paragraph2}`,
				suggestion: `Similarity: ${similarity.toFixed(1)}% - consider rewriting one of these paragraphs`,
				severity: 'warning'
			});
		});
	} else {
		results.push({
			passed: true,
			message: "No duplicate content detected",
			severity: 'info'
		});
	}

	return Promise.resolve(results);
}

/**
 * Calculates similarity between two text strings
 * @param text1 - First text string
 * @param text2 - Second text string
 * @returns Similarity percentage (0-100)
 */
function calculateSimilarity(text1: string, text2: string): number {
	const words1 = text1.toLowerCase().split(/\s+/);
	const words2 = text2.toLowerCase().split(/\s+/);

	const set1 = new Set(words1);
	const set2 = new Set(words2);

	const intersection = new Set([...set1].filter(x => set2.has(x)));
	const union = new Set([...set1, ...set2]);

	return (intersection.size / union.size) * 100;
}

/**
 * Check for duplicate titles across the vault
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @param vaultDetector - Vault duplicate detector instance
 * @returns Array of SEO check results
 */
export async function checkDuplicateTitles(
	content: string,
	file: TFile,
	settings: SEOSettings,
	vaultDetector: VaultDuplicateDetector
): Promise<SEOCheckResult[]> {
	return await vaultDetector.checkDuplicateTitles(file, settings);
}

/**
 * Check for duplicate descriptions across the vault
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @param vaultDetector - Vault duplicate detector instance
 * @returns Array of SEO check results
 */
export async function checkDuplicateDescriptions(
	content: string,
	file: TFile,
	settings: SEOSettings,
	vaultDetector: VaultDuplicateDetector
): Promise<SEOCheckResult[]> {
	return await vaultDetector.checkDuplicateDescriptions(file, settings);
}

/**
 * Enhanced duplicate content detection using vault-wide analysis
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @param vaultDetector - Vault duplicate detector instance
 * @returns Array of SEO check results
 */
export async function checkVaultDuplicateContent(
	content: string,
	file: TFile,
	settings: SEOSettings,
	vaultDetector: VaultDuplicateDetector
): Promise<SEOCheckResult[]> {
	return await vaultDetector.checkDuplicateContent(file, settings);
}

/**
 * Checks for general notices
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export function checkNotices(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Implement actual notice checks if needed
	return Promise.resolve([]);
}
