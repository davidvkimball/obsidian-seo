/**
 * Export for SEO audit results (CSV or Markdown)
 */

import { Notice } from "obsidian";
import { SEOResults, SEOCheckResult } from "../types";

export type ExportFormat = 'csv' | 'markdown';

const ISSUE_SEVERITIES = ['error', 'warning', 'notice'] as const;

const CHECK_TYPE_LABELS: Record<string, string> = {
	altText: 'Alt text',
	nakedLinks: 'Naked links',
	headingOrder: 'Heading order',
	keywordDensity: 'Keyword density',
	keywordInTitle: 'Keyword in title',
	keywordInDescription: 'Keyword in description',
	keywordInSlug: 'Keyword in slug',
	slugFormat: 'Slug format',
	brokenLinks: 'Broken links',
	externalBrokenLinks: 'External broken links',
	metaDescription: 'Meta description',
	titleLength: 'Title length',
	contentLength: 'Content length',
	imageFileNames: 'Image file names',
	duplicateContent: 'Duplicate content',
	duplicateTitles: 'Duplicate titles',
	duplicateDescriptions: 'Duplicate descriptions',
	readingLevel: 'Reading level',
	potentiallyBrokenEmbeds: 'Potentially broken embeds',
	potentiallyBrokenLinks: 'Potentially broken links',
};

function escapeCsvField(value: string): string {
	if (value === null || value === undefined) return '';
	const s = String(value);
	if (/[",\r\n]/.test(s)) {
		return '"' + s.replace(/"/g, '""') + '"';
	}
	return s;
}

function getCheckLabel(key: string): string {
	return CHECK_TYPE_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function* iterateFindings(results: SEOResults): Generator<{ checkType: string; finding: SEOCheckResult }> {
	for (const [key, list] of Object.entries(results.checks)) {
		if (!Array.isArray(list)) continue;
		for (const finding of list) {
			if (ISSUE_SEVERITIES.includes(finding.severity as (typeof ISSUE_SEVERITIES)[number])) {
				yield { checkType: getCheckLabel(key), finding };
			}
		}
	}
}

/**
 * Build CSV string from one or more SEOResults. One row per finding (error/warning/notice).
 */
export function resultsToCsv(results: SEOResults | SEOResults[]): string {
	const rows: SEOResults[] = Array.isArray(results) ? results : [results];
	const header = ['file', 'displayName', 'checkType', 'severity', 'message', 'line', 'suggestion'];
	const lines: string[] = [header.map(escapeCsvField).join(',')];

	for (const r of rows) {
		const file = r.file;
		const displayName = r.displayName ?? r.file;
		for (const { checkType, finding } of iterateFindings(r)) {
			const line = finding.position?.line ?? finding.line;
			lines.push([
				escapeCsvField(file),
				escapeCsvField(displayName),
				escapeCsvField(checkType),
				escapeCsvField(finding.severity),
				escapeCsvField(finding.message),
				escapeCsvField(line != null ? String(line) : ''),
				escapeCsvField(finding.suggestion ?? ''),
			].join(','));
		}
	}

	return lines.join('\r\n');
}

/**
 * Build Markdown string from one or more SEOResults (headings and lists, agent-friendly).
 */
export function resultsToMarkdown(results: SEOResults | SEOResults[]): string {
	const rows: SEOResults[] = Array.isArray(results) ? results : [results];
	const lines: string[] = [];

	const severityHeadings: Record<(typeof ISSUE_SEVERITIES)[number], string> = {
		error: '### Issues',
		warning: '### Warnings',
		notice: '### Notices',
	};

	for (const r of rows) {
		const displayName = r.displayName ?? r.file;
		const bySeverity: Record<(typeof ISSUE_SEVERITIES)[number], Array<{ checkType: string; finding: SEOCheckResult }>> = {
			error: [],
			warning: [],
			notice: [],
		};
		for (const item of iterateFindings(r)) {
			const sev = item.finding.severity as (typeof ISSUE_SEVERITIES)[number];
			if (ISSUE_SEVERITIES.includes(sev)) {
				bySeverity[sev].push(item);
			}
		}

		const hasAny = bySeverity.error.length + bySeverity.warning.length + bySeverity.notice.length > 0;
		if (!hasAny) continue;

		lines.push(`## ${displayName}`);
		lines.push('');

		for (const sev of ISSUE_SEVERITIES) {
			const items = bySeverity[sev];
			if (items.length === 0) continue;
			lines.push(severityHeadings[sev]);
			for (const { checkType, finding } of items) {
				const lineNum = finding.position?.line ?? finding.line;
				const linePart = lineNum != null ? ` (line ${lineNum})` : '';
				let bullet = `- **${checkType}**${linePart}: ${finding.message}`;
				if (finding.suggestion) bullet += ` ${finding.suggestion}`;
				lines.push(bullet);
			}
			lines.push('');
		}
		lines.push('');
	}

	return lines.length ? lines.join('\n').trimEnd() : '';
}

/**
 * Build export string in the given format.
 */
export function resultsToExportString(results: SEOResults | SEOResults[], format: ExportFormat): string {
	return format === 'markdown' ? resultsToMarkdown(results) : resultsToCsv(results);
}

/**
 * Trigger download of export content (CSV or Markdown).
 */
export function downloadExport(content: string, filenameBase: string, format: ExportFormat): void {
	const ext = format === 'markdown' ? 'md' : 'csv';
	const mime = format === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/csv;charset=utf-8';
	const filename = filenameBase.endsWith(`.${ext}`) ? filenameBase : `${filenameBase}.${ext}`;
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = createEl('a', { href: url, attr: { download: filename } });
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Copy export content to clipboard and show a notice.
 */
export async function copyExportToClipboard(content: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(content);
		new Notice('Copied to clipboard');
	} catch {
		new Notice('Failed to copy');
	}
}
