import { App, TFile } from "obsidian";
import SEOPlugin from "./main";
import { SEOResults } from "./types";
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

	// Calculate weighted SEO scoring system (0-100)
	let overallScore = 0;

	// 1. Title optimization (15 points)
	const titleResults = [...checks.titleLength, ...checks.titleH1Uniqueness];
	if (titleResults.length > 0) {
		const passedCount = titleResults.filter(r => r.passed).length;
		overallScore += (passedCount / titleResults.length) * 15;
	} else {
		overallScore += 15; // Assume pass if no checks
	}

	// 2. Meta description (15 points)
	const metaResults = checks.metaDescription;
	if (metaResults.length > 0) {
		const passedCount = metaResults.filter(r => r.passed).length;
		overallScore += (passedCount / metaResults.length) * 15;
	} else {
		overallScore += 15;
	}

	// 3. Heading hierarchy (15 points)
	const headingResults = checks.headingOrder;
	if (headingResults.length > 0) {
		const passedCount = headingResults.filter(r => r.passed).length;
		overallScore += (passedCount / headingResults.length) * 15;
	} else {
		overallScore += 15;
	}

	// 4. Content quality (20 points)
	const contentResults = [...checks.contentLength, ...checks.readingLevel];
	if (contentResults.length > 0) {
		const passedCount = contentResults.filter(r => r.passed).length;
		overallScore += (passedCount / contentResults.length) * 20;
	} else {
		overallScore += 20;
	}

	// 5. Image alt text (10 points)
	const altTextResults = checks.altText;
	if (altTextResults.length > 0) {
		const passedCount = altTextResults.filter(r => r.passed).length;
		overallScore += (passedCount / altTextResults.length) * 10;
	} else {
		overallScore += 10;
	}

	// 6. Link health (15 points)
	const linkResults = [...checks.brokenLinks, ...checks.nakedLinks];
	if (linkResults.length > 0) {
		const passedCount = linkResults.filter(r => r.passed).length;
		overallScore += (passedCount / linkResults.length) * 15;
	} else {
		overallScore += 15;
	}

	// 7. Keyword usage (10 points)
	const keywordResults = [
		...checks.keywordDensity,
		...checks.keywordInTitle,
		...checks.keywordInDescription,
		...checks.keywordInHeadings,
		...checks.keywordInSlug
	];
	if (keywordResults.length > 0) {
		const passedCount = keywordResults.filter(r => r.passed).length;
		overallScore += (passedCount / keywordResults.length) * 10;
	} else {
		overallScore += 10;
	}

	overallScore = Math.round(Math.max(0, Math.min(100, overallScore)));

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
	} catch {
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
		enableMDXSupport: settings.enableMDXSupport,
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
