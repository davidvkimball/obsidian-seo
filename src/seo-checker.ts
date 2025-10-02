import { TFile, Notice } from "obsidian";
import SEOPlugin from "./main";
import { SEOResults, SEOCheckResult } from "./types";
import { 
	checkAltText, 
	checkNakedLinks, 
	checkHeadingOrder, 
	checkKeywordDensity,
	checkBrokenLinks,
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
	
	new Notice(`SEO check completed for ${results.length} files.`);
	
	return results;
}

async function checkFile(plugin: SEOPlugin, file: TFile, content: string): Promise<SEOResults> {
	const checks = {
		altText: await checkAltText(content, file, plugin.settings),
		nakedLinks: await checkNakedLinks(content, file, plugin.settings),
		headingOrder: await checkHeadingOrder(content, file, plugin.settings),
		keywordDensity: await checkKeywordDensity(content, file, plugin.settings),
		brokenLinks: await checkBrokenLinks(content, file, plugin.settings, plugin.app),
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
	const totalChecks = allResults.length;
	const passedChecks = allResults.filter(r => r.passed).length;
	const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

	return {
		file: file.path,
		checks,
		overallScore,
		issuesCount,
		warningsCount
	};
}
