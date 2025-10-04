import { TFile } from "obsidian";
import { SEOSettings } from "./settings";

export interface SEOCheckResult {
	passed: boolean;
	message: string;
	suggestion?: string;
	line?: number;
	severity: 'info' | 'warning' | 'error' | 'notice';
	// Enhanced position information for navigation
	position?: {
		line: number;
		column?: number;
		searchText?: string; // Text to search for to find the issue
		context?: string; // Surrounding context for better identification
	};
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
	noticesCount: number;
}

export interface SEOCheck {
	name: string;
	description: string;
	check: (content: string, file: TFile, settings: SEOSettings) => Promise<SEOCheckResult[]>;
}
