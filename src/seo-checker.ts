import { TFile, Notice } from "obsidian";
import SEOPlugin from "./main";
import { SEOResults, SEOCheckResult } from "./types";
import { 
	checkAltText, 
	checkNakedLinks, 
	checkHeadingOrder, 
	checkKeywordDensity,
	checkBrokenLinks,
	checkPotentiallyBrokenLinks,
	checkMetaDescription,
	checkTitleLength,
	checkContentLength,
	checkImageNaming,
	checkDuplicateContent,
	checkReadingLevel,
	checkNotices
} from "./checks";

export async function runSEOCheck(plugin: SEOPlugin, files: TFile[]): Promise<SEOResults[]> {
	const results: SEOResults[] = [];
	
	for (const file of files) {
		try {
			const content = await plugin.app.vault.read(file);
			const result = await checkFile(plugin, file, content);
			results.push(result);
		} catch (error) {
			console.error(`Error checking file ${file.path}:`, error);
		}
	}
	
	// Don't show notification here - let the calling code handle it
	return results;
}

async function checkFile(plugin: SEOPlugin, file: TFile, content: string): Promise<SEOResults> {
	const checks = {
		altText: await checkAltText(content, file, plugin.settings),
		nakedLinks: await checkNakedLinks(content, file, plugin.settings),
		headingOrder: await checkHeadingOrder(content, file, plugin.settings),
		keywordDensity: await checkKeywordDensity(content, file, plugin.settings),
		brokenLinks: await checkBrokenLinks(content, file, plugin.settings, plugin.app),
		potentiallyBrokenLinks: await checkPotentiallyBrokenLinks(content, file, plugin.settings, plugin.app),
		metaDescription: await checkMetaDescription(content, file, plugin.settings),
		titleLength: await checkTitleLength(content, file, plugin.settings),
		contentLength: await checkContentLength(content, file, plugin.settings),
		imageNaming: await checkImageNaming(content, file, plugin.settings),
		duplicateContent: await checkDuplicateContent(content, file, plugin.settings),
		readingLevel: await checkReadingLevel(content, file, plugin.settings),
		notices: await checkNotices(content, file, plugin.settings)
	};

	// Calculate overall score and counts
	const allResults = Object.values(checks).flat();
	const issuesCount = allResults.filter(r => r.severity === 'error').length;
	const warningsCount = allResults.filter(r => r.severity === 'warning').length;
	
	// Improved SEO scoring system with weighted checks and no double penalties
	let overallScore: number;
	
	if (allResults.length === 0) {
		overallScore = 100;
	} else {
		// Calculate weighted base score (no double penalties)
		let weightedScore = 0;
		let totalWeight = 0;
		
		// Weight checks by SEO importance
		allResults.forEach(result => {
			let weight = 1; // Default weight
			let points = 0;
			
			// Critical SEO factors (10x weight)
			if (result.message.includes('Broken link') && !result.passed) {
				weight = 10;
				points = 0; // Major penalty for broken links
			} else if (result.message.includes('title') && !result.passed) {
				weight = 10;
				points = 0; // Major penalty for missing titles
			}
			// Important SEO factors (5x weight)
			else if (result.message.includes('alt text') && !result.passed) {
				weight = 5;
				points = 0; // Significant penalty for missing alt text
			} else if (result.message.includes('meta description') && !result.passed) {
				weight = 5;
				points = 0; // Significant penalty for missing meta description
			}
			// Moderate SEO factors (3x weight)
			else if (result.message.includes('content length') && !result.passed) {
				weight = 3;
				points = 0; // Moderate penalty for content issues
			} else if (result.message.includes('reading level') && !result.passed) {
				weight = 3;
				points = 0; // Moderate penalty for readability issues
			}
			// Minor SEO factors (1x weight)
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
		checks,
		overallScore,
		issuesCount,
		warningsCount
	};
}
