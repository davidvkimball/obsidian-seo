/**
 * Heading structure validation checks
 * Checks for proper heading hierarchy and H1 usage
 */

import { TFile } from "obsidian";
import { SEOSettings } from "../settings";
import { SEOCheckResult } from "../types";
import { getContextAroundLine } from "./utils/position-utils";

/**
 * Checks heading order and hierarchy
 * @param content - The markdown content to check
 * @param file - The file being checked
 * @param settings - Plugin settings
 * @returns Array of SEO check results
 */
export async function checkHeadingOrder(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	const results: SEOCheckResult[] = [];
	
	if (!settings.checkHeadingOrder) {
		return [];
	}
	
	// Work with original content for accurate line numbers
	const originalLines = content.split('\n');
	let lastHeadingLevel = null;
	let hasHeading = false;
	let hasH1 = false;
	let firstHeadingLine = 0;
	
	for (let i = 0; i < originalLines.length; i++) {
		const line = originalLines[i];
		if (!line) continue;
		const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
		
		if (headingMatch && headingMatch[1] && headingMatch[2]) {
			hasHeading = true;
			const currentLevel = headingMatch[1].length;
			const headingText = headingMatch[2].trim();
			const lineNumber = i + 1; // 1-based line number from original content
			
			// Track if we have an H1
			if (currentLevel === 1) {
				hasH1 = true;
			}
			
			// If this is the first heading, don't check for violations yet
			if (lastHeadingLevel === null) {
				lastHeadingLevel = currentLevel;
				firstHeadingLine = lineNumber;
				continue;
			}
			
			// Check if current level skips levels after the last heading
			if (currentLevel > lastHeadingLevel + 1) {
				results.push({
					passed: false,
					message: `"${headingText}" (H${currentLevel}) skips heading level(s) after H${lastHeadingLevel}`,
					suggestion: "Use heading levels in order (H1 → H2 → H3, etc.)",
					severity: 'warning',
					position: {
						line: lineNumber,
						searchText: line,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			}
			
			// If H1 appears after other heading levels, flag it
			if (currentLevel === 1 && lastHeadingLevel > 1) {
				results.push({
					passed: false,
					message: `"${headingText}" (H1) appears after H${lastHeadingLevel}`,
					suggestion: "H1 should be the first heading or not used at all",
					severity: 'warning',
					position: {
						line: lineNumber,
						searchText: line,
						context: getContextAroundLine(content, lineNumber)
					}
				});
			}
			
			lastHeadingLevel = currentLevel;
		}
	}
	
	// Check for missing H1 if skipH1Check is false - add this FIRST if it exists
	if (hasHeading && !settings.skipH1Check && !hasH1) {
		results.unshift({
			passed: false,
			message: "No H1 heading found",
			suggestion: "Add an H1 heading at the beginning of your content",
			severity: 'warning'
			// No position info since there's no H1 to jump to
		});
	}
	
	if (!hasHeading) {
		results.push({
			passed: true,
			message: "No heading structure issues found",
			severity: 'info'
		});
	} else if (results.length === 0) {
		results.push({
			passed: true,
			message: "Heading structure is correct",
			severity: 'info'
		});
	}
	
	return results;
}
