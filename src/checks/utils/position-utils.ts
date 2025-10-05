/**
 * Position and line number utilities for SEO checks
 * Provides functions to find and navigate to specific content positions
 */

/**
 * Finds the line number where a specific image match occurs
 * @param content - The content to search in
 * @param imageMatch - The image match string to find
 * @returns Line number (1-based) where the match occurs
 */
export function findLineNumberForImage(content: string, imageMatch: string): number {
	const lines = content.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line && line.includes(imageMatch)) {
			return i + 1;
		}
	}
	return 1;
}

/**
 * Gets context around a specific line number
 * @param content - The content to extract context from
 * @param lineNumber - The line number to get context around
 * @param contextLines - Number of lines before and after to include
 * @returns Context string with surrounding lines
 */
export function getContextAroundLine(content: string, lineNumber: number, contextLines: number = 2): string {
	const lines = content.split('\n');
	const start = Math.max(0, lineNumber - 1 - contextLines);
	const end = Math.min(lines.length, lineNumber - 1 + contextLines + 1);
	return lines.slice(start, end).join('\n');
}
