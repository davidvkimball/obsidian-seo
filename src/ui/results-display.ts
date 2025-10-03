import { setIcon } from "obsidian";
import { SEOResults } from "../types";
import { getDisplayPath } from "./panel-utils";

export class ResultsDisplay {
	constructor(
		private container: HTMLElement,
		private onFileClick: (filePath: string) => void,
		private onFileAudit: (filePath: string) => void
	) {}

	renderResults(results: SEOResults): void {
		// Overall score
		const scoreEl = this.container.createEl('div', { cls: 'seo-score' });
		scoreEl.createEl('span', { text: `Overall score: ${results.overallScore}%` });
		
		if (results.issuesCount > 0 || results.warningsCount > 0) {
			const issuesSpan = scoreEl.createEl('span', { text: ` (` });
			const issuesCount = issuesSpan.createEl('span', { 
				text: `${results.issuesCount} issues`,
				cls: 'seo-issues-count-text'
			});
			const comma = issuesSpan.createEl('span', { text: ', ' });
			const warningsCount = issuesSpan.createEl('span', { 
				text: `${results.warningsCount} warnings`,
				cls: 'seo-warnings-count-text'
			});
			issuesSpan.createEl('span', { text: ')' });
		} else {
			scoreEl.createEl('span', { 
				text: ' (All checks passed!)',
				cls: 'seo-success'
			});
		}

		// Individual checks
		const checksContainer = this.container.createEl('div', { cls: 'seo-checks' });
		
		Object.entries(results.checks).forEach(([checkName, checkResults]) => {
			if (checkResults.length === 0) return;
			
			// Determine the check status for color coding
			const checkHasErrors = checkResults.some(r => r.severity === 'error');
			const checkHasWarnings = checkResults.some(r => r.severity === 'warning');
			const checkHasOnlyInfo = checkResults.every(r => r.severity === 'info');
			
			let statusClass = 'seo-passed'; // Default to green for passed checks
			if (checkHasErrors) {
				statusClass = 'seo-error';
			} else if (checkHasWarnings) {
				statusClass = 'seo-warning';
			} else if (checkHasOnlyInfo) {
				statusClass = 'seo-passed';
			}
			
			const checkEl = checksContainer.createEl('div', { cls: `seo-check ${statusClass}` });
			const header = checkEl.createEl('div', { cls: 'seo-check-header seo-collapsible-header' });
			
			// Convert camelCase to sentence case
			let displayName = checkName.replace(/([A-Z])/g, ' $1').trim()
				.replace(/^./, str => str.toUpperCase());
			
			// Add collapse icon
			const collapseIcon = header.createEl('span', { cls: 'seo-collapse-icon' });
			collapseIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>';
			
			header.createEl('span', { text: displayName });
			
			const statusIcon = header.createEl('span', { cls: 'seo-status' });
			const hasErrors = checkResults.some(r => r.severity === 'error');
			const hasWarnings = checkResults.some(r => r.severity === 'warning');
			
			// Use Lucide icons instead of emojis
			if (hasErrors) {
				statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
			} else if (hasWarnings) {
				statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
			} else {
				statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
			}

			// Results
			const resultsList = checkEl.createEl('ul', { cls: 'seo-results' });
			checkResults.forEach(result => {
				const li = resultsList.createEl('li', { 
					cls: `seo-result seo-${result.severity}`,
					text: result.message
				});
				
				if (result.suggestion) {
					const suggestionEl = li.createEl('div', { 
						cls: 'seo-suggestion'
					});
					suggestionEl.innerHTML = result.suggestion;
				}
			});
			
			// Add click handler for collapse functionality
			header.addEventListener('click', () => {
				const isCollapsed = resultsList.style.display === 'none';
				resultsList.style.display = isCollapsed ? 'block' : 'none';
				
				// Rotate the collapse icon
				const icon = collapseIcon.querySelector('svg');
				if (icon) {
					icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
				}
			});
		});
	}

	renderGlobalResults(results: SEOResults[]): void {
		const summary = this.container.createEl('div', { cls: 'seo-vault-summary' });
		
		const totalFiles = results.length;
		const totalIssues = results.reduce((sum, r) => sum + r.issuesCount, 0);
		const totalWarnings = results.reduce((sum, r) => sum + r.warningsCount, 0);
		const avgScore = Math.round(
			results.reduce((sum, r) => sum + r.overallScore, 0) / totalFiles
		);

		// Create stats grid
		const statsGrid = summary.createEl('div', { cls: 'seo-stats-grid' });
		
		// Files analyzed
		const filesStat = statsGrid.createEl('div', { cls: 'seo-stat-item' });
		filesStat.createEl('div', { cls: 'seo-stat-number', text: totalFiles.toString() });
		filesStat.createEl('div', { cls: 'seo-stat-label', text: 'Files analyzed' });
		
		// Average score with color coding
		const scoreStat = statsGrid.createEl('div', { cls: 'seo-stat-item' });
		const scoreNumber = scoreStat.createEl('div', { cls: 'seo-stat-number', text: `${avgScore}%` });
		if (avgScore >= 80) {
			scoreNumber.addClass('seo-score-excellent');
		} else if (avgScore >= 60) {
			scoreNumber.addClass('seo-score-good');
		} else if (avgScore >= 40) {
			scoreNumber.addClass('seo-score-fair');
		} else {
			scoreNumber.addClass('seo-score-poor');
		}
		scoreStat.createEl('div', { cls: 'seo-stat-label', text: 'Average score' });
		
		// Issues count with color coding
		const issuesStat = statsGrid.createEl('div', { cls: 'seo-stat-item' });
		const issuesNumber = issuesStat.createEl('div', { cls: 'seo-stat-number', text: totalIssues.toString() });
		if (totalIssues > 0) {
			issuesNumber.addClass('seo-issues-count');
		}
		issuesStat.createEl('div', { cls: 'seo-stat-label', text: 'Issues' });
		
		// Warnings count with color coding
		const warningsStat = statsGrid.createEl('div', { cls: 'seo-stat-item' });
		const warningsNumber = warningsStat.createEl('div', { cls: 'seo-stat-number', text: totalWarnings.toString() });
		if (totalWarnings > 0) {
			warningsNumber.addClass('seo-warnings-count');
		}
		warningsStat.createEl('div', { cls: 'seo-stat-label', text: 'Warnings' });
	}

	renderIssuesList(results: SEOResults[], currentSort: string, onSortChange: (sortType: string) => void, onShowSortMenu: (event: MouseEvent) => void): void {
		const issuesFiles = results.filter(r => r.issuesCount > 0 || r.warningsCount > 0);
		if (issuesFiles.length === 0) return;

		const issuesList = this.container.createEl('div', { cls: 'seo-issues-list' });
		
		// Header with sorting buttons and collapse functionality
		const issuesHeader = issuesList.createEl('div', { cls: 'seo-issues-header-container seo-collapsible-header' });
		
		// Collapse icon
		const collapseIcon = issuesHeader.createEl('span', { cls: 'seo-collapse-icon' });
		collapseIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>';
		
		issuesHeader.createEl('h4', { text: 'Files with issues', cls: 'seo-issues-header' });
		
		// Sort button
		const sortBtn = issuesHeader.createEl('button', {
			cls: 'seo-sort-btn',
			attr: { 'aria-label': 'Sort files' }
		});
		setIcon(sortBtn, 'arrow-up-narrow-wide');
		sortBtn.addEventListener('click', onShowSortMenu);
		
		// Files list container
		const filesListContainer = issuesList.createEl('div', { cls: 'seo-files-list-container' });
		
		// Apply saved sort preference
		const sortedFiles = this.sortFiles(issuesFiles, currentSort);
		
		sortedFiles.forEach(result => {
			const fileEl = filesListContainer.createEl('div', { cls: 'seo-file-issue' });
			fileEl.setAttribute('data-file-path', result.file);
			
			// Make file path clickable
			const fileLink = fileEl.createEl('a', { 
				text: getDisplayPath(result.file),
				cls: 'seo-file-link',
				href: '#'
			});
			fileLink.addEventListener('click', (e) => {
				e.preventDefault();
				this.onFileClick(result.file);
			});
			
			// Stats and audit button container
			const statsContainer = fileEl.createEl('div', { cls: 'seo-stats-container' });
			
			// Issues and warnings text
			statsContainer.createEl('span', { 
				text: `${result.issuesCount} issues, ${result.warningsCount} warnings`,
				cls: 'seo-file-stats'
			});
			
			// Audit button
			const auditBtn = statsContainer.createEl('button', {
				cls: 'clickable-icon seo-audit-btn',
				attr: { 'aria-label': 'Audit this note' }
			});
			setIcon(auditBtn, 'search-check');
			auditBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.onFileAudit(result.file);
			});
		});

		// Add collapse functionality to the header
		issuesHeader.addEventListener('click', (e) => {
			// Don't collapse if clicking on the sort button
			if ((e.target as HTMLElement).closest('.seo-sort-btn')) {
				return;
			}
			
			const isCollapsed = filesListContainer.style.display === 'none';
			filesListContainer.style.display = isCollapsed ? 'block' : 'none';
			
			// Rotate the collapse icon
			const icon = collapseIcon.querySelector('svg');
			if (icon) {
				icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
			}
		});
	}

	private sortFiles(files: SEOResults[], sortType: string): SEOResults[] {
		const sortedFiles = [...files];
		
		switch (sortType) {
			case 'warnings-desc':
				sortedFiles.sort((a, b) => b.warningsCount - a.warningsCount);
				break;
			case 'warnings-asc':
				sortedFiles.sort((a, b) => a.warningsCount - b.warningsCount);
				break;
			case 'issues-desc':
				sortedFiles.sort((a, b) => b.issuesCount - a.issuesCount);
				break;
			case 'issues-asc':
				sortedFiles.sort((a, b) => a.issuesCount - b.issuesCount);
				break;
			case 'filename-asc':
				sortedFiles.sort((a, b) => {
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					const fileNameCompare = aFileName.localeCompare(bFileName);
					if (fileNameCompare !== 0) return fileNameCompare;
					return a.file.localeCompare(b.file);
				});
				break;
			case 'filename-desc':
				sortedFiles.sort((a, b) => {
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					const fileNameCompare = bFileName.localeCompare(aFileName);
					if (fileNameCompare !== 0) return fileNameCompare;
					return b.file.localeCompare(a.file);
				});
				break;
		}
		
		return sortedFiles;
	}
}
