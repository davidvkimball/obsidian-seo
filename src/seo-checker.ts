import { App, TFile, Notice } from "obsidian";
import SEOPlugin from "./main";
import { SEOResults, SEOCheckResult } from "./types";
import { SEOSettings } from "./settings";

// Simple cache for SEO results
interface CacheEntry {
	result: SEOResults;
	timestamp: number;
	fileHash: string;
	settingsHash: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
import {
	checkAltText, 
	checkNakedLinks, 
	checkHeadingOrder, 
	checkKeywordDensity,
	checkBrokenLinks,
	checkExternalLinks,
	checkExternalBrokenLinks,
	checkPotentiallyBrokenLinks,
	checkMetaDescription,
	checkTitleLength,
	checkTitleH1Uniqueness,
	checkContentLength,
	checkImageNaming,
	checkDuplicateContent,
	checkReadingLevel,
	checkNotices,
	checkKeywordInTitle,
	checkKeywordInDescription,
	checkKeywordInHeadings,
	checkKeywordInSlug,
	checkSlugFormat,
	getDisplayName
} from "./checks";
import { 
	checkDuplicateTitles, 
	checkDuplicateDescriptions, 
	checkVaultDuplicateContent 
} from "./checks/content-checks";
import { VaultDuplicateDetector } from "./checks/duplicate-detection";

export async function runSEOCheck(plugin: SEOPlugin, files: TFile[], abortController?: AbortController): Promise<SEOResults[]> {
	const results: SEOResults[] = [];
	
	// Create vault detector for duplicate detection
	const vaultDetector = new VaultDuplicateDetector(plugin.app, plugin.settings);
	
	// Collect vault data if duplicate detection is enabled
	if (plugin.settings.checkDuplicateContent) {
		await vaultDetector.collectVaultData();
	}
	
	for (const file of files) {
		// Check for cancellation before processing each file
		if (abortController?.signal.aborted) {
			throw new DOMException('Operation was aborted', 'AbortError');
		}
		
		try {
			// Check cache first
			const cachedResult = getCachedResult(file, plugin);
			if (cachedResult) {
				results.push(cachedResult);
				continue;
			}
			
			// Run fresh check
			const content = await plugin.app.vault.read(file);
			const result = await checkFile(plugin, file, content, vaultDetector, abortController);
			
			// Cache the result
			void cacheResult(file, result, plugin);
			results.push(result);
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw error; // Re-throw AbortError to propagate cancellation
			}
			console.error(`Error checking file ${file.path}:`, error);
		}
	}
	
	// Don't show notification here - let the calling code handle it
	return results;
}

async function checkFile(plugin: SEOPlugin, file: TFile, content: string, vaultDetector: VaultDuplicateDetector, abortController?: AbortController): Promise<SEOResults> {
	const checks = {
		titleLength: await checkTitleLength(content, file, plugin.settings),
		metaDescription: await checkMetaDescription(content, file, plugin.settings),
		titleH1Uniqueness: await checkTitleH1Uniqueness(content, file, plugin.settings),
		keywordInTitle: await checkKeywordInTitle(content, file, plugin.settings),
		keywordInDescription: await checkKeywordInDescription(content, file, plugin.settings),
		keywordInHeadings: await checkKeywordInHeadings(content, file, plugin.settings),
		keywordInSlug: await checkKeywordInSlug(content, file, plugin.settings),
		slugFormat: await checkSlugFormat(content, file, plugin.settings),
		keywordDensity: await checkKeywordDensity(content, file, plugin.settings),
		headingOrder: await checkHeadingOrder(content, file, plugin.settings),
		contentLength: await checkContentLength(content, file, plugin.settings),
		duplicateTitles: await checkDuplicateTitles(content, file, plugin.settings, vaultDetector),
		duplicateDescriptions: await checkDuplicateDescriptions(content, file, plugin.settings, vaultDetector),
		duplicateContent: plugin.settings.checkDuplicateContent 
			? await checkVaultDuplicateContent(content, file, plugin.settings, vaultDetector)
			: await checkDuplicateContent(content, file, plugin.settings),
		altText: await checkAltText(content, file, plugin.settings),
		imageFileNames: await checkImageNaming(content, file, plugin.settings),
		nakedLinks: await checkNakedLinks(content, file, plugin.settings),
		brokenLinks: await checkBrokenLinks(content, file, plugin.settings, plugin.app),
		potentiallyBrokenLinks: await checkPotentiallyBrokenLinks(content, file, plugin.settings, plugin.app),
		potentiallyBrokenEmbeds: await checkNotices(content, file, plugin.settings),
		externalBrokenLinks: plugin.settings.enableExternalLinkVaultCheck 
			? await checkExternalBrokenLinks(content, file, plugin.settings, abortController)
			: (plugin.settings.checkExternalLinks ? await checkExternalLinks(content, file, plugin.settings) : []),
		readingLevel: await checkReadingLevel(content, file, plugin.settings)
	};

	// Calculate overall score and counts
	const allResults = Object.values(checks).flat();
	const issuesCount = allResults.filter(r => r.severity === 'error').length;
	const warningsCount = allResults.filter(r => r.severity === 'warning').length;
	const noticesCount = allResults.filter(r => r.severity === 'notice').length;
	
	// Improved SEO scoring system with weighted checks and no double penalties
	let overallScore: number;
	
	if (allResults.length === 0) {
		overallScore = 100;
	} else {
		// Calculate weighted base score (no double penalties)
		let weightedScore = 0;
		let totalWeight = 0;
		
		// Weight checks by SEO importance (exclude notices from scoring)
		allResults.forEach(result => {
			// Skip notices - they don't affect the score
			if (result.severity === 'notice') {
				return;
			}
			
			let weight = 1; // Default weight
			let points = 0;
			
			// Critical SEO factors (10x weight)
			if (result.message.includes('Broken link') && !result.passed) {
				weight = 10;
				points = 0; // Major penalty for broken links
			} else if (result.message.includes('title') && !result.passed && result.message.includes('No frontmatter')) {
				weight = 10;
				points = 0; // Major penalty for missing titles entirely
			}
			// Important SEO factors (5x weight)
			else if (result.message.includes('alt text') && !result.passed) {
				weight = 5;
				points = 0; // Significant penalty for missing alt text
			} else if (result.message.includes('meta description') && !result.passed) {
				weight = 5;
				points = 0; // Significant penalty for missing meta description
			}
			// Critical keyword factors (8x weight) - keywords are extremely important for SEO
			// Only apply high weight to actual keyword optimization failures, not missing keyword definitions
			else if (result.message.includes('keyword') && !result.passed && 
				(result.message.includes('density') || result.message.includes('not found in title') || result.message.includes('not found in slug'))) {
				weight = 8;
				points = 0; // High penalty for keyword optimization issues
			}
			// Moderate SEO factors (3x weight)
			else if (result.message.includes('content length') && !result.passed) {
				weight = 3;
				points = 0; // Moderate penalty for content issues
			}
			// Minor-Moderate SEO factors (2x weight) - title length issues
			else if (result.message.includes('title') && !result.passed && (result.message.includes('too short') || result.message.includes('too long'))) {
				weight = 2;
				points = 0; // Minor-moderate penalty for title length issues
			}
			// Minor SEO factors (1x weight) - reading level moved here as it's less critical
			else if (result.message.includes('reading level') && !result.passed) {
				weight = 1;
				points = 0; // Minor penalty for readability issues
			}
			// Other minor SEO factors (1x weight)
			else if (result.severity === 'warning' && !result.passed) {
				weight = 1;
				points = 0; // Minor penalty for warnings
			}
			// Passed checks get full points
			else if (result.passed) {
				points = 100; // Full points for passed checks
			}
			
			weightedScore += points * weight;
			totalWeight += weight;
		});
		
		// Calculate base score from weighted average
		const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 100;
		
		// Apply additional penalties for critical issues (but not double-counting)
		let additionalPenalty = 0;
		
		// Broken links: additional 2 points each (beyond the weight penalty)
		const brokenLinks = allResults.filter(r => 
			r.severity === 'error' && !r.passed && r.message.includes('Broken link')
		).length;
		additionalPenalty += Math.min(brokenLinks * 2, 10);
		
		// Missing alt text: additional 1 point each
		const missingAltText = allResults.filter(r => 
			r.severity === 'error' && !r.passed && r.message.includes('alt text')
		).length;
		additionalPenalty += Math.min(missingAltText * 1, 5);
		
		// Warnings: 0.5 points each (minor impact)
		const warnings = allResults.filter(r => r.severity === 'warning' && !r.passed).length;
		additionalPenalty += Math.min(warnings * 0.5, 5);
		
		// Apply penalties with reasonable caps
		additionalPenalty = Math.min(additionalPenalty, 20);
		
		// Calculate final score
		overallScore = Math.max(40, Math.min(100, baseScore - additionalPenalty));
	}

	return {
		file: file.path,
		displayName: getDisplayName(file, content, plugin.settings),
		checks,
		overallScore,
		issuesCount,
		warningsCount,
		noticesCount
	};
}

// Cache helper functions
async function generateFileHash(file: TFile, app: App): Promise<string> {
	try {
		const content = await app.vault.read(file);
		const stat = await app.vault.adapter.stat(file.path);
		// Simple hash combining content length and modification time
		return `${content.length}-${stat?.mtime || Date.now()}`;
	} catch (error) {
		return `${Date.now()}`; // Fallback to timestamp
	}
}

function generateSettingsHash(settings: SEOSettings): string {
	// Create a hash of the settings that affect SEO checks
	// This includes all settings that could change the results
	const relevantSettings = {
		keywordProperty: settings.keywordProperty || '',
		keywordDensityMin: settings.keywordDensityMin,
		keywordDensityMax: settings.keywordDensityMax,
		descriptionProperty: settings.descriptionProperty || '',
		titleProperty: settings.titleProperty || '',
		useFilenameAsTitle: settings.useFilenameAsTitle,
		checkContentLength: settings.checkContentLength,
		minContentLength: settings.minContentLength,
		scanDirectories: settings.scanDirectories || '',
		// External link checking settings
		checkExternalLinks: settings.checkExternalLinks,
		enableExternalLinkVaultCheck: settings.enableExternalLinkVaultCheck,
		checkPotentiallyBrokenLinks: settings.checkPotentiallyBrokenLinks,
		checkPotentiallyBrokenEmbeds: settings.checkPotentiallyBrokenEmbeds,
		// Other SEO check settings
		checkAltText: settings.checkAltText,
		checkBrokenLinks: settings.checkBrokenLinks,
		checkNakedLinks: settings.checkNakedLinks,
		checkHeadingOrder: settings.checkHeadingOrder,
		checkTitleLength: settings.checkTitleLength,
		checkImageNaming: settings.checkImageNaming,
		checkDuplicateContent: settings.checkDuplicateContent,
		checkReadingLevel: settings.checkReadingLevel,
		// Thresholds that affect results
		duplicateThreshold: settings.duplicateThreshold,
		// Add other settings that affect SEO results
	};
	
	// Simple hash of the settings object
	return JSON.stringify(relevantSettings);
}

function getCachedResult(file: TFile, plugin: SEOPlugin): SEOResults | null {
	const entry = cache.get(file.path);
	if (!entry) {
		return null;
	}
	
	const now = Date.now();
	const isExpired = (now - entry.timestamp) > CACHE_EXPIRY_MS;
	
	// Check if settings have changed
	const currentSettingsHash = generateSettingsHash(plugin.settings);
	const settingsChanged = entry.settingsHash !== currentSettingsHash;
	
	if (isExpired || settingsChanged) {
		// Remove expired or invalidated entry
		cache.delete(file.path);
		return null;
	}
	
	return entry.result;
}

async function cacheResult(file: TFile, result: SEOResults, plugin: SEOPlugin): Promise<void> {
	const fileHash = await generateFileHash(file, plugin.app);
	const settingsHash = generateSettingsHash(plugin.settings);
	cache.set(file.path, {
		result,
		timestamp: Date.now(),
		fileHash,
		settingsHash
	});
}

// Export cache management functions
export function clearCache(): void {
	cache.clear();
}

export function getCacheStats(): { size: number } {
	return { size: cache.size };
}

// Clear cache for a specific file (useful when settings change)
export function clearCacheForFile(filePath: string): void {
	cache.delete(filePath);
}

// Clear cache for all files (useful when global settings change)
export function clearAllCache(): void {
	cache.clear();
}
