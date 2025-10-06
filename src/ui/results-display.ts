import { setIcon, App } from "obsidian";
import { SEOResults } from "../types";
import { getDisplayPath } from "./panel-utils";

interface ObsidianWindow extends Window {
	app: App;
}

/**
 * Helper function to create SVG icons
 */
function createSVGIcon(svgContent: string): SVGElement {
	const parser = new DOMParser();
	const doc = parser.parseFromString(svgContent, 'image/svg+xml');
	return doc.documentElement as unknown as SVGElement;
}

/**
 * Helper function to create collapse icon
 */
function createCollapseIcon(): SVGElement {
	return createSVGIcon('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 12,15 18,9"/></svg>');
}

/**
 * Helper function to create status icons
 */
function createStatusIcon(type: 'error' | 'warning' | 'notice' | 'success'): SVGElement {
	const icons = {
		error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
		warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
		notice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
		success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
	};
	return createSVGIcon(icons[type]);
}

export class ResultsDisplay {
	private isCollapsed: boolean = true; // Track collapse state
	
	constructor(
		private container: HTMLElement,
		private onFileClick: (filePath: string) => Promise<void>,
		private onFileAudit: (filePath: string) => Promise<void>
	) {}

	// Navigation method to jump to specific positions in the note
	private async navigateToPosition(position: { line: number; searchText?: string; context?: string }): Promise<void> {
		try {
			// Get the app instance
			const app = (window as unknown as ObsidianWindow).app;
			if (!app) {
				console.warn('Obsidian app not found');
				return;
			}

			// Get the current active file
			const activeFile = app.workspace.getActiveFile();
			if (!activeFile) {
				console.warn('No active file found for navigation');
				return;
			}

			// Open the file if it's not already open
			await this.onFileClick(activeFile.path);

			// Get the markdown view - try different approaches
			let markdownView: any = null;
			let editor: any = null;
			
			// Try direct access to active leaf
			if (app.workspace.activeLeaf) {
				markdownView = app.workspace.activeLeaf.view;
			}
			
			// Try getting leaves of type markdown
			if (!markdownView && app.workspace.getLeavesOfType) {
				const leaves = app.workspace.getLeavesOfType('markdown');
				if (leaves.length > 0) {
					markdownView = leaves[0]?.view;
				}
			}
			
			// Try getting all leaves using workspace iteration
			if (!markdownView) {
				// Use workspace iteration to find markdown views
				app.workspace.iterateAllLeaves((leaf) => {
					if (leaf.view && 'editor' in leaf.view && !markdownView) {
						markdownView = leaf.view;
					}
				});
			}
			
			if (!markdownView) {
				console.warn('No markdown view found');
				return;
			}

			editor = markdownView.editor;
			if (!editor) {
				console.warn('No editor found in markdown view');
				return;
			}

			// Navigate to the specific line
			if (position.line) {
				const lineIndex = Math.max(0, position.line - 1);
				
				// Set cursor position
				editor.setCursor({ line: lineIndex, ch: 0 });
				
				// Simple scroll to line - no fancy stuff
				try {
					editor.scrollIntoView({ line: lineIndex, ch: 0 });
				} catch (error) {
					// If that fails, try with just the line number
					try {
						editor.scrollIntoView(lineIndex);
					} catch (error2) {
						// If all else fails, just set the cursor (already done above)
					}
				}
				
				// Highlight the line briefly
				try {
					const lineLength = editor.getLine(lineIndex).length;
					editor.addHighlights([{
						from: { line: lineIndex, ch: 0 },
						to: { line: lineIndex, ch: lineLength }
					}]);
					
					// Remove highlight after 2 seconds
					setTimeout(() => {
						try {
							editor.removeHighlights();
						} catch (highlightError) {
							// Ignore highlight removal errors
						}
					}, 2000);
				} catch (highlightError) {
					// Ignore highlight errors
				}
			}
		} catch (error) {
			console.error('Error navigating to position:', error);
		}
	}

	renderResults(results: SEOResults): void {
		// Overall score with collapsible toggle
		const scoreEl = this.container.createEl('div', { cls: 'seo-score-header' });
		
		// Left side: Score text (not bold, not large)
		const scoreText = scoreEl.createEl('div', { cls: 'seo-score-text' });
		scoreText.createEl('span', { text: 'Score: ' });
		const scoreNumber = scoreText.createEl('span', { text: `${Math.round(results.overallScore)}%` });
		
		// Apply color coding to the score
		if (results.overallScore >= 80) {
			scoreNumber.addClass('seo-score-excellent');
		} else if (results.overallScore >= 60) {
			scoreNumber.addClass('seo-score-good');
		} else if (results.overallScore >= 40) {
			scoreNumber.addClass('seo-score-fair');
		} else {
			scoreNumber.addClass('seo-score-poor');
		}
		
		if (results.issuesCount > 0 || results.warningsCount > 0 || results.noticesCount > 0) {
			scoreText.createEl('span', { text: ` (` });
			const issuesCount = scoreText.createEl('span', { 
				text: `${results.issuesCount} issues`,
				cls: 'seo-issues-count-text'
			});
			scoreText.createEl('span', { text: ', ' });
			const warningsCount = scoreText.createEl('span', { 
				text: `${results.warningsCount} warnings`,
				cls: 'seo-warnings-count-text'
			});
			if (results.noticesCount > 0) {
				scoreText.createEl('span', { text: ', ' });
				const noticesCount = scoreText.createEl('span', { 
					text: `${results.noticesCount} notices`,
					cls: 'seo-notices-count-text'
				});
			}
			scoreText.createEl('span', { text: ')' });
		} else {
			scoreText.createEl('span', { 
				text: ' (All checks passed!)',
				cls: 'seo-success'
			});
		}
		
		// Right side: Toggle button (styled like global sort icon)
		const toggleBtn = scoreEl.createEl('div', { cls: 'seo-toggle-icon' });
		setIcon(toggleBtn, 'chevrons-down-up'); // Default: collapsed state
		
		toggleBtn.addEventListener('click', () => {
			// Toggle the state
			this.isCollapsed = !this.isCollapsed;
			// chevrons-down-up = "collapse all", chevrons-up-down = "expand all"
			setIcon(toggleBtn, this.isCollapsed ? 'chevrons-up-down' : 'chevrons-down-up');
			this.toggleChecksVisibility();
		});

		// Individual checks container
		const checksContainer = this.container.createEl('div', { cls: 'seo-checks' });
		
		// Initial state: all items expanded, icon shows "collapse all"
		this.isCollapsed = false;
		
		Object.entries(results.checks).forEach(([checkName, checkResults]) => {
			if (checkResults.length === 0) return;
			
			// Determine the check status for color coding
			const checkHasErrors = checkResults.some(r => r.severity === 'error');
			const checkHasWarnings = checkResults.some(r => r.severity === 'warning');
			const checkHasNotices = checkResults.some(r => r.severity === 'notice');
			const checkHasOnlyInfo = checkResults.every(r => r.severity === 'info');
			
			let statusClass = 'seo-passed'; // Default to green for passed checks
			if (checkHasErrors) {
				statusClass = 'seo-error';
			} else if (checkHasWarnings) {
				statusClass = 'seo-warning';
			} else if (checkHasNotices) {
				statusClass = 'seo-notice';
			} else if (checkHasOnlyInfo) {
				statusClass = 'seo-passed';
			}
			
			const checkEl = checksContainer.createEl('div', { cls: `seo-check ${statusClass}` });
			const header = checkEl.createEl('div', { cls: 'seo-check-header seo-collapsible-header' });
			
			// Convert camelCase to sentence case with special handling
			let displayName = checkName.replace(/([A-Z])/g, ' $1').trim()
				.replace(/^./, str => str.toUpperCase());
			
			// Special handling for specific check names
			if (checkName === 'brokenLinks') {
				displayName = 'Broken Internal Links';
			} else if (checkName === 'externalBrokenLinks') {
				// Check if this is notice-based (external links listing) or error-based (broken links)
				const hasNotices = checkResults.some(r => r.severity === 'notice');
				const hasErrors = checkResults.some(r => r.severity === 'error');
				
				if (hasNotices && !hasErrors) {
					displayName = 'External Links';
				} else {
					displayName = 'External Broken Links';
				}
			}
			
			// Add collapse icon
			const collapseIcon = header.createEl('span', { cls: 'seo-collapse-icon' });
			collapseIcon.appendChild(createCollapseIcon());
			
			header.createEl('span', { text: displayName });
			
			const statusIcon = header.createEl('span', { cls: 'seo-status' });
			const hasErrors = checkResults.some(r => r.severity === 'error');
			const hasWarnings = checkResults.some(r => r.severity === 'warning');
			const hasNotices = checkResults.some(r => r.severity === 'notice');
			
			// Use Lucide icons instead of emojis
			if (hasErrors) {
				statusIcon.appendChild(createStatusIcon('error'));
			} else if (hasWarnings) {
				statusIcon.appendChild(createStatusIcon('warning'));
			} else if (hasNotices) {
				statusIcon.appendChild(createStatusIcon('notice'));
			} else {
				statusIcon.appendChild(createStatusIcon('success'));
			}

			// Results
			const resultsList = checkEl.createEl('ul', { cls: 'seo-results seo-results-list-expanded' });
			checkResults.forEach(result => {
				const li = resultsList.createEl('li', { 
					cls: `seo-result seo-${result.severity}`
				});
				
				// Create clickable message if position info is available
				if (result.position) {
					const messageEl = li.createEl('span', { 
						text: result.message,
						cls: 'seo-result-message seo-clickable'
					});
					
					// Add click handler for navigation
					messageEl.addEventListener('click', async (e) => {
						e.preventDefault();
						e.stopPropagation();
						await this.navigateToPosition(result.position!);
					});
					
					// Add visual indicator that it's clickable
					messageEl.addClass('seo-clickable-message');
					messageEl.title = 'Click to jump to this issue in the note';
				} else {
					// Non-clickable message for results without position info
					li.createEl('span', { 
						text: result.message,
						cls: 'seo-result-message'
					});
				}
				
				if (result.suggestion) {
					const suggestionEl = li.createEl('div', { 
						cls: 'seo-suggestion',
						text: result.suggestion
					});
				}
			});
			
			// Add click handler for collapse functionality
			header.addEventListener('click', () => {
				const isCollapsed = resultsList.hasClass('seo-results-list-collapsed');
				if (isCollapsed) {
					resultsList.removeClass('seo-results-list-collapsed');
					resultsList.addClass('seo-results-list-expanded');
				} else {
					resultsList.removeClass('seo-results-list-expanded');
					resultsList.addClass('seo-results-list-collapsed');
				}
				
				// Rotate the collapse icon
				const icon = collapseIcon.querySelector('svg');
				if (icon) {
					if (isCollapsed) {
						icon.removeClass('seo-collapse-icon-rotated');
						icon.addClass('seo-collapse-icon-normal');
					} else {
						icon.removeClass('seo-collapse-icon-normal');
						icon.addClass('seo-collapse-icon-rotated');
					}
				}
				
				// If any individual item is expanded, reset main toggle to "collapse all" state
				if (isCollapsed) {
					// Item was just expanded, reset main toggle to "collapse all" state
					this.isCollapsed = false;
					const toggleBtn = this.container.querySelector('.seo-toggle-icon') as HTMLElement;
					if (toggleBtn) {
						setIcon(toggleBtn, 'chevrons-down-up');
					}
				}
			});
		});
	}

	renderGlobalResults(results: SEOResults[], settings?: any): void {
		const summary = this.container.createEl('div', { cls: 'seo-vault-summary' });
		
		const totalFiles = results.length;
		const totalIssues = results.reduce((sum, r) => sum + r.issuesCount, 0);
		const totalWarnings = results.reduce((sum, r) => sum + r.warningsCount, 0);
		const totalNotices = results.reduce((sum, r) => sum + r.noticesCount, 0);
		const avgScore = Math.round(
			results.reduce((sum, r) => sum + r.overallScore, 0) / totalFiles
		);
		
		// Check if notices should be shown (both potentially broken checks must be enabled)
		const showNotices = settings ? 
			(settings.checkPotentiallyBrokenLinks && settings.checkPotentiallyBrokenEmbeds) : 
			true;

		// Create stats grid
		const statsGrid = summary.createEl('div', { cls: 'seo-stats-grid' });
		
		// Overall score first with color coding
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
		scoreStat.createEl('div', { cls: 'seo-stat-label', text: 'Average Score' });
		
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
		
		// Notices count with color coding (only show if notices are enabled)
		if (showNotices) {
			const noticesStat = statsGrid.createEl('div', { cls: 'seo-stat-item' });
			const noticesNumber = noticesStat.createEl('div', { cls: 'seo-stat-number', text: totalNotices.toString() });
			if (totalNotices > 0) {
				noticesNumber.addClass('seo-notices-count');
			}
			noticesStat.createEl('div', { cls: 'seo-stat-label', text: 'Notices' });
		}
	}

	renderIssuesList(results: SEOResults[], currentSort: string, onSortChange: (sortType: string) => void, onShowSortMenu: (event: MouseEvent) => void, settings?: any): void {
		// Check if notices should be shown (both potentially broken checks must be enabled)
		const showNotices = settings ? 
			(settings.checkPotentiallyBrokenLinks && settings.checkPotentiallyBrokenEmbeds) : 
			true;
		
		const issuesFiles = results.filter(r => {
			const hasIssues = r.issuesCount > 0;
			const hasWarnings = r.warningsCount > 0;
			const hasNotices = showNotices && r.noticesCount > 0;
			return hasIssues || hasWarnings || hasNotices;
		});
		if (issuesFiles.length === 0) return;

		const issuesList = this.container.createEl('div', { cls: 'seo-issues-list' });
		
		// Header with sorting buttons and collapse functionality
		const issuesHeader = issuesList.createEl('div', { cls: 'seo-issues-header-container' });
		
		// Collapse icon (only this should be clickable)
		const collapseIcon = issuesHeader.createEl('span', { cls: 'seo-collapse-icon seo-collapsible-header' });
		collapseIcon.appendChild(createCollapseIcon());
		
		issuesHeader.createEl('h4', { text: 'Files with results', cls: 'seo-issues-header' });
		
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
				text: result.displayName || getDisplayPath(result.file),
				cls: 'seo-file-link',
				href: '#'
			});
			fileLink.addEventListener('click', async (e) => {
				e.preventDefault();
				await this.onFileClick(result.file);
			});
			
			// Stats and audit button container
			const statsContainer = fileEl.createEl('div', { cls: 'seo-stats-container' });
			
			// Issues, warnings, and notices text
			const statsText = [];
			if (result.issuesCount > 0) statsText.push(`${result.issuesCount} issues`);
			if (result.warningsCount > 0) statsText.push(`${result.warningsCount} warnings`);
			if (showNotices && result.noticesCount > 0) statsText.push(`${result.noticesCount} notices`);
			
			statsContainer.createEl('span', { 
				text: statsText.join(', '),
				cls: 'seo-file-stats'
			});
			
			// Audit button
			const auditBtn = statsContainer.createEl('button', {
				cls: 'clickable-icon seo-audit-btn',
				attr: { 'aria-label': 'Audit this note' }
			});
			setIcon(auditBtn, 'search-check');
			auditBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopPropagation();
				await this.onFileAudit(result.file);
			});
		});

		// Add collapse functionality to only the arrow icon
		collapseIcon.addEventListener('click', (e) => {
			const isCollapsed = filesListContainer.hasClass('seo-results-list-collapsed');
			if (isCollapsed) {
				filesListContainer.removeClass('seo-results-list-collapsed');
				filesListContainer.addClass('seo-results-list-expanded');
			} else {
				filesListContainer.removeClass('seo-results-list-expanded');
				filesListContainer.addClass('seo-results-list-collapsed');
			}
			
			// Rotate the collapse icon
			const icon = collapseIcon.querySelector('svg');
			if (icon) {
				if (isCollapsed) {
					icon.removeClass('seo-collapse-icon-rotated');
					icon.addClass('seo-collapse-icon-normal');
				} else {
					icon.removeClass('seo-collapse-icon-normal');
					icon.addClass('seo-collapse-icon-rotated');
				}
			}
		});
	}

	private sortFiles(files: SEOResults[], sortType: string): SEOResults[] {
		const sortedFiles = [...files];
		
		switch (sortType) {
			case 'warnings-desc':
				// Sort by warnings (high first), then by issues (high first), then by file name A-Z
				sortedFiles.sort((a, b) => {
					const warningsCompare = b.warningsCount - a.warningsCount;
					if (warningsCompare !== 0) return warningsCompare;
					const issuesCompare = b.issuesCount - a.issuesCount;
					if (issuesCompare !== 0) return issuesCompare;
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					return aFileName.localeCompare(bFileName);
				});
				break;
			case 'warnings-asc':
				// Sort by warnings (low first), then by issues (low first), then by file name A-Z
				sortedFiles.sort((a, b) => {
					const warningsCompare = a.warningsCount - b.warningsCount;
					if (warningsCompare !== 0) return warningsCompare;
					const issuesCompare = a.issuesCount - b.issuesCount;
					if (issuesCompare !== 0) return issuesCompare;
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					return aFileName.localeCompare(bFileName);
				});
				break;
			case 'issues-desc':
				// Sort by issues (high first), then by warnings (high first), then by file name A-Z
				sortedFiles.sort((a, b) => {
					const issuesCompare = b.issuesCount - a.issuesCount;
					if (issuesCompare !== 0) return issuesCompare;
					const warningsCompare = b.warningsCount - a.warningsCount;
					if (warningsCompare !== 0) return warningsCompare;
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					return aFileName.localeCompare(bFileName);
				});
				break;
			case 'issues-asc':
				// Sort by issues (low first), then by warnings (low first), then by file name A-Z
				sortedFiles.sort((a, b) => {
					const issuesCompare = a.issuesCount - b.issuesCount;
					if (issuesCompare !== 0) return issuesCompare;
					const warningsCompare = a.warningsCount - b.warningsCount;
					if (warningsCompare !== 0) return warningsCompare;
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					return aFileName.localeCompare(bFileName);
				});
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
	
	private toggleChecksVisibility(): void {
		const checksContainer = this.container.querySelector('.seo-checks') as HTMLElement;
		if (!checksContainer) return;
		
		// Get all individual collapse headers and force them to the appropriate state
		const allHeaders = checksContainer.querySelectorAll('.seo-check-header');
		allHeaders.forEach((header) => {
			const htmlHeader = header as HTMLElement;
			const resultsList = htmlHeader.parentElement?.querySelector('.seo-results') as HTMLElement;
			const collapseIcon = htmlHeader.querySelector('.seo-collapse-icon svg') as HTMLElement;
			
			if (resultsList && collapseIcon) {
				// Force to the state based on main toggle
				if (this.isCollapsed) {
					// Force all to collapsed
					resultsList.removeClass('seo-results-list-expanded');
					resultsList.addClass('seo-results-list-collapsed');
					collapseIcon.removeClass('seo-collapse-icon-normal');
					collapseIcon.addClass('seo-collapse-icon-rotated');
				} else {
					// Force all to expanded
					resultsList.removeClass('seo-results-list-collapsed');
					resultsList.addClass('seo-results-list-expanded');
					collapseIcon.removeClass('seo-collapse-icon-rotated');
					collapseIcon.addClass('seo-collapse-icon-normal');
				}
			}
		});
	}
}
