import { TFile } from "obsidian";
import { SEOSettings } from "./settings";

export interface SEOCheckResult {
	passed: boolean;
	message: string;
	suggestion?: string;
	line?: number;
	severity: 'info' | 'warning' | 'error';
}

export interface SEOResults {
	file: string;
	displayName?: string;
	checks: {
		altText: SEOCheckResult[];
		nakedLinks: SEOCheckResult[];
		headingOrder: SEOCheckResult[];
		keywordDensity: SEOCheckResult[];
		brokenLinks: SEOCheckResult[];
		metaDescription: SEOCheckResult[];
		titleLength: SEOCheckResult[];
		contentLength: SEOCheckResult[];
		imageFileNames: SEOCheckResult[];
		duplicateContent: SEOCheckResult[];
		readingLevel: SEOCheckResult[];
		potentiallyBrokenEmbeds: SEOCheckResult[];
	};
	overallScore: number;
	issuesCount: number;
	warningsCount: number;
}

export interface SEOCheck {
	name: string;
	description: string;
	check: (content: string, file: TFile, settings: SEOSettings) => Promise<SEOCheckResult[]>;
}
