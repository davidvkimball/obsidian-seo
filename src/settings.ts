export interface SEOSettings {
	// Directory settings
	scanDirectories: string;
	
	// Property names
	keywordProperty: string;
	descriptionProperty: string;
	titleProperty: string;
	useFilenameAsTitle: boolean;
	slugProperty: string;
	useFilenameAsSlug: boolean;
	parentFolderSlugFilename: string;
	
	// Check toggles
	checkTitleLength: boolean;
	checkHeadingOrder: boolean;
	checkAltText: boolean;
	checkImageNaming: boolean;
	checkBrokenLinks: boolean;
	checkExternalLinks: boolean;
	enableExternalLinkButton: boolean;
	enableExternalLinkVaultCheck: boolean;
	checkNakedLinks: boolean;
	checkContentLength: boolean;
	checkDuplicateContent: boolean;
	checkReadingLevel: boolean;
	checkPotentiallyBrokenLinks: boolean;
	checkPotentiallyBrokenEmbeds: boolean;
	useNoteTitles: boolean;
	skipH1Check: boolean;
	
	// Publishing settings
	publishMode: boolean;
	
	// UI settings
	defaultSort: 'issues-desc' | 'issues-asc' | 'warnings-desc' | 'warnings-asc' | 'filename-asc' | 'filename-desc';
	
	// Thresholds
	minContentLength: number;
	keywordDensityMin: number;
	keywordDensityMax: number;
	duplicateThreshold: number;
	
	// Cached scan results
	cachedGlobalResults: any[];
	lastScanTimestamp: number;
}

export const DEFAULT_SETTINGS: SEOSettings = {
	scanDirectories: "",
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
