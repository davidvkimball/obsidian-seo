/**
 * SEO Checks - Main Export File
 * This file exports all SEO check functions from their focused modules
 */

// Alt text checks
export { checkAltText } from './alt-text-check';

// Link checks
export {
	checkNakedLinks,
	checkBrokenLinks,
	checkPotentiallyBrokenLinks,
	checkPotentiallyBrokenEmbeds
} from './link-checks';

// External link checks
export {
	checkExternalLinks,
	checkExternalBrokenLinks,
	checkExternalLinksOnly
} from './external-link-checks';

// Content checks
export {
	checkContentLength,
	checkReadingLevel,
	checkDuplicateContent,
	checkNotices,
	checkDuplicateTitles,
	checkDuplicateDescriptions,
	checkVaultDuplicateContent
} from './content-checks';

// Meta checks
export {
	checkMetaDescription,
	checkTitleLength,
	checkTitleH1Uniqueness,
	checkKeywordDensity,
	checkKeywordInTitle,
	checkKeywordInDescription,
	checkKeywordInHeadings,
	checkKeywordInSlug
} from './meta-checks';

// Heading checks
export { checkHeadingOrder } from './heading-checks';

// Image checks
export { checkImageNaming } from './image-checks';

// Utility functions
export {
	removeCodeBlocks,
	removeHtmlAttributes
} from './utils/content-parser';

export {
	findLineNumberForImage,
	getContextAroundLine
} from './utils/position-utils';

export {
	countSyllables,
	getReadingLevelDescription
} from './utils/reading-level';

export {
	getDisplayName,
	getSlugFromFile,
	checkSlugFormat
} from './utils/note-utils';
