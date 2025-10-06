import { TFile } from "obsidian";
import { SEOSettings } from "./settings";

/**
 * Result of a single SEO check
 * Contains information about whether a check passed and any issues found
 */
export interface SEOCheckResult {
	/** Whether the check passed */
	passed: boolean;
	/** Human-readable message describing the result */
	message: string;
	/** Optional suggestion for fixing the issue */
	suggestion?: string;
	/** Line number where the issue was found */
	line?: number;
	/** Severity level of the issue */
	severity: 'info' | 'warning' | 'error' | 'notice';
	/** Enhanced position information for navigation */
	position?: {
		/** Line number where issue occurs */
		line: number;
		/** Column number where issue occurs */
		column?: number;
		/** Text to search for to find the issue */
		searchText?: string;
		/** Surrounding context for better identification */
		context?: string;
	};
}

/**
 * Complete SEO analysis results for a single file
 * Contains all check results and summary statistics
 */
export interface SEOResults {
	/** File path of the analyzed file */
	file: string;
	/** Display name for the file (may differ from path) */
	displayName?: string;
	/** Results from all SEO checks */
	checks: {
		/** Alt text validation results */
		altText: SEOCheckResult[];
		/** Naked link detection results */
		nakedLinks: SEOCheckResult[];
		/** Heading hierarchy validation results */
		headingOrder: SEOCheckResult[];
		/** Keyword density analysis results */
		keywordDensity: SEOCheckResult[];
		/** Broken link detection results */
		brokenLinks: SEOCheckResult[];
		/** External broken link detection results */
		externalBrokenLinks: SEOCheckResult[];
		/** Meta description validation results */
		metaDescription: SEOCheckResult[];
		/** Title length validation results */
		titleLength: SEOCheckResult[];
		/** Content length validation results */
		contentLength: SEOCheckResult[];
		/** Image filename validation results */
		imageFileNames: SEOCheckResult[];
	/** Duplicate content detection results */
	duplicateContent: SEOCheckResult[];
	/** Duplicate title detection results */
	duplicateTitles: SEOCheckResult[];
	/** Duplicate description detection results */
	duplicateDescriptions: SEOCheckResult[];
	/** Reading level analysis results */
	readingLevel: SEOCheckResult[];
	/** Potentially broken embed detection results */
	potentiallyBrokenEmbeds: SEOCheckResult[];
	};
	/** Overall SEO score (0-100) */
	overallScore: number;
	/** Number of error-level issues found */
	issuesCount: number;
	/** Number of warning-level issues found */
	warningsCount: number;
	/** Number of notice-level issues found */
	noticesCount: number;
}

/**
 * Definition of a single SEO check
 * Contains metadata and the check function
 */
export interface SEOCheck {
	/** Human-readable name of the check */
	name: string;
	/** Description of what the check does */
	description: string;
	/** Function that performs the actual check */
	check: (content: string, file: TFile, settings: SEOSettings) => Promise<SEOCheckResult[]>;
}
