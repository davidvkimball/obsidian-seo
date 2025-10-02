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
	showStatusBar: boolean;
	
	// Thresholds
	minContentLength: number;
	keywordDensityMin: number;
	keywordDensityMax: number;
	duplicateThreshold: number;
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
	showStatusBar: true,
	minContentLength: 300,
	keywordDensityMin: 1,
	keywordDensityMax: 2,
	duplicateThreshold: 80
};
