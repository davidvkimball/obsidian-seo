/**
 * SEO Plugin Settings Interface
 * Defines all configurable options for the SEO plugin
 */
export interface SEOSettings {
	// Directory settings
	/** Comma-separated list of directories to scan for SEO analysis */
	scanDirectories: string;
	/** Ignore files that begin with an underscore */
	ignoreUnderscoreFiles: boolean;
	
	// Property names
	/** Frontmatter property name for keywords */
	keywordProperty: string;
	/** Frontmatter property name for meta description */
	descriptionProperty: string;
	/** Frontmatter property name for page title */
	titleProperty: string;
	/** Whether to use filename as title when no title property is set */
	useFilenameAsTitle: boolean;
	/** Frontmatter property name for URL slug */
	slugProperty: string;
	/** Whether to use filename as slug when no slug property is set */
	useFilenameAsSlug: boolean;
	/** Filename pattern for parent folder slug generation */
	parentFolderSlugFilename: string;
	
	// Check toggles
	/** Enable title length validation */
	checkTitleLength: boolean;
	/** Enable heading hierarchy validation */
	checkHeadingOrder: boolean;
	/** Enable alt text validation for images */
	checkAltText: boolean;
	/** Enable image filename validation */
	checkImageNaming: boolean;
	/** Enable broken link detection */
	checkBrokenLinks: boolean;
	/** Enable external link validation */
	checkExternalLinks: boolean;
	/** Show external link button in results */
	enableExternalLinkButton: boolean;
	/** Check external links against vault files */
	enableExternalLinkVaultCheck: boolean;
	/** Enable naked link detection */
	checkNakedLinks: boolean;
	/** Enable content length validation */
	checkContentLength: boolean;
	/** Enable duplicate content detection */
	checkDuplicateContent: boolean;
	/** Enable reading level analysis */
	checkReadingLevel: boolean;
	/** Enable potentially broken link detection */
	checkPotentiallyBrokenLinks: boolean;
	/** Enable potentially broken embed detection */
	checkPotentiallyBrokenEmbeds: boolean;
	/** Use note titles in analysis */
	useNoteTitles: boolean;
	/** Skip H1 heading validation */
	skipH1Check: boolean;
	
	// Publishing settings
	/** Enable publishing mode for public-facing content */
	publishMode: boolean;
	
	// UI settings
	/** Default sort order for results display */
	defaultSort: 'issues-desc' | 'issues-asc' | 'warnings-desc' | 'warnings-asc' | 'notices-desc' | 'notices-asc' | 'filename-asc' | 'filename-desc';
	
	// Thresholds
	/** Minimum content length in characters */
	minContentLength: number;
	/** Minimum keyword density percentage */
	keywordDensityMin: number;
	/** Maximum keyword density percentage */
	keywordDensityMax: number;
	/** Duplicate content similarity threshold percentage */
	duplicateThreshold: number;
	
	// Cached scan results
	/** Cached results from global scan */
	cachedGlobalResults: any[];
	/** Timestamp of last scan */
	lastScanTimestamp: number;
}

export const DEFAULT_SETTINGS: SEOSettings = {
	scanDirectories: "",
	ignoreUnderscoreFiles: false,
	keywordProperty: "",
	descriptionProperty: "",
	titleProperty: "",
	useFilenameAsTitle: false,
	slugProperty: "",
	useFilenameAsSlug: false,
	parentFolderSlugFilename: "",
	checkTitleLength: true,
	checkHeadingOrder: true,
	checkAltText: true,
	checkImageNaming: true,
	checkBrokenLinks: true,
	checkExternalLinks: true,
	enableExternalLinkButton: true,
	enableExternalLinkVaultCheck: false,
	checkNakedLinks: true,
	checkContentLength: true,
	checkDuplicateContent: false,
	checkReadingLevel: true,
	checkPotentiallyBrokenLinks: true,
	checkPotentiallyBrokenEmbeds: true,
	useNoteTitles: false,
	skipH1Check: false,
	publishMode: false,
	defaultSort: 'issues-desc',
	minContentLength: 300,
	keywordDensityMin: 1,
	keywordDensityMax: 2,
	duplicateThreshold: 80,
	cachedGlobalResults: [],
	lastScanTimestamp: 0
};
