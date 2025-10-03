export interface SEOSettings {
	// Directory settings
	scanDirectories: string;
	
	// Property names
	keywordProperty: string;
	descriptionProperty: string;
	titleProperty: string;
	useFilenameAsTitle: boolean;
	
	// Check toggles
	checkContentLength: boolean;
	checkImageNaming: boolean;
	checkDuplicateContent: boolean;
	checkReadingLevel: boolean;
	showNotices: boolean;
	
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
	checkContentLength: true,
	checkImageNaming: true,
	checkDuplicateContent: true,
	checkReadingLevel: true,
	showNotices: true,
	defaultSort: 'warnings-desc',
	minContentLength: 300,
	keywordDensityMin: 1,
	keywordDensityMax: 2,
	duplicateThreshold: 80,
	cachedGlobalResults: [],
	lastScanTimestamp: 0
};
