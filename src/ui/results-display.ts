import { setIcon, App } from "obsidian";
import { SEOResults } from "../types";
import { SEOSettings } from "../settings";
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
function createCollapseIcon(): HTMLElement {
	const iconEl = document.createElement('span');
	setIcon(iconEl, 'chevron-down');
	return iconEl;
}


export class ResultsDisplay {
	private isCollapsed: boolean = false; // Track collapse state (false = expanded, true = collapsed)
	private individualCollapseStates: Map<string, boolean> = new Map(); // Track individual item collapse states
	
	constructor(
		private container: HTMLElement,
		private onFileClick: (filePath: string) => Promise<void>,
		private onFileAudit: (filePath: string) => Promise<void>
	) {}

	// Method to update the container (needed for reusing instances)
	updateContainer(newContainer: HTMLElement) {
		this.container = newContainer;
	}

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
		// Note: Using unknown for Obsidian's internal view types that don't have public type definitions
		let markdownView: unknown = null;
		let editor: unknown = null;
			
			// Try getting leaves of type markdown (replacement for deprecated activeLeaf)
			if (app.workspace.getLeavesOfType) {
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

			// Type guard for markdown view with editor property
			if (typeof markdownView === 'object' && markdownView !== null && 'editor' in markdownView) {
				editor = (markdownView as { editor: unknown }).editor;
			}
			
			if (!editor) {
				console.warn('No editor found in markdown view');
				return;
			}

			// Type guard for editor with required methods
			if (typeof editor !== 'object' || editor === null) {
				console.warn('Editor is not an object');
				return;
			}
			
			const editorObj = editor as {
				setCursor?: (pos: { line: number; ch: number }) => void;
				scrollIntoView?: (pos: { line: number; ch: number } | number) => void;
				getLine?: (line: number) => { length: number };
				addHighlights?: (highlights: Array<{ from: { line: number; ch: number }; to: { line: number; ch: number } }>) => void;
				removeHighlights?: () => void;
			};

			// Navigate to the specific line
			if (position.line && editorObj.setCursor) {
				const lineIndex = Math.max(0, position.line - 1);
				
				// Set cursor position
				editorObj.setCursor({ line: lineIndex, ch: 0 });
				
				// Simple scroll to line - no fancy stuff
				if (editorObj.scrollIntoView) {
					try {
						editorObj.scrollIntoView({ line: lineIndex, ch: 0 });
					} catch {
						// If that fails, try with just the line number
						try {
							editorObj.scrollIntoView(lineIndex);
						} catch {
							// If all else fails, just set the cursor (already done above)
						}
					}
				}
				
				// Highlight the line briefly
				if (editorObj.getLine && editorObj.addHighlights && editorObj.removeHighlights) {
					try {
						const lineLength = editorObj.getLine(lineIndex).length;
						editorObj.addHighlights([{
							from: { line: lineIndex, ch: 0 },
							to: { line: lineIndex, ch: lineLength }
						}]);
						
						// Remove highlight after 2 seconds
						setTimeout(() => {
							try {
								if (editorObj.removeHighlights) {
									editorObj.removeHighlights();
								}
							} catch {
								// Ignore highlight removal errors
							}
						}, 2000);
					} catch {
						// Ignore highlight errors
					}
				}
			}
		} catch (error) {
			console.error('Error navigating to position:', error);
		}
	}

	renderResults(results: SEOResults): void {
		// Use raw notices count so notices from Potentially Broken Links are visible and counted
		let filteredNoticesCount = results.noticesCount;
		
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
		
		if (results.issuesCount > 0 || results.warningsCount > 0 || filteredNoticesCount > 0) {
			scoreText.createEl('span', { text: ` (` });
			scoreText.createEl('span', { 
				text: `${results.issuesCount} issues`,
				cls: 'seo-issues-count-text'
			});
			scoreText.createEl('span', { text: ', ' });
			scoreText.createEl('span', { 
				text: `${results.warningsCount} warnings`,
				cls: 'seo-warnings-count-text'
			});
			if (filteredNoticesCount > 0) {
				scoreText.createEl('span', { text: ', ' });
				scoreText.createEl('span', { 
					text: `${filteredNoticesCount} notices`,
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
		// Apply the current collapse state to the icon
		setIcon(toggleBtn, this.isCollapsed ? 'chevrons-up-down' : 'chevrons-down-up');
		
		toggleBtn.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			// Toggle the state
			this.isCollapsed = !this.isCollapsed;
			// chevrons-down-up = "collapse all", chevrons-up-down = "expand all"
			setIcon(toggleBtn, this.isCollapsed ? 'chevrons-up-down' : 'chevrons-down-up');
			this.toggleChecksVisibility();
		});

		// Individual checks container
		const checksContainer = this.container.createEl('div', { cls: 'seo-checks' });
		
		Object.entries(results.checks).forEach(([checkName, checkResults]) => {
			if (checkResults.length === 0) return;
			
			// Always show Potentially Broken Links so notice-only cases are visible
			
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
			header.setAttribute('data-check-name', checkName); // Store check name for state tracking
			
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
			} else if (checkName === 'duplicateTitles') {
				displayName = 'Duplicate Titles';
			} else if (checkName === 'duplicateDescriptions') {
				displayName = 'Duplicate Descriptions';
			} else if (checkName === 'duplicateContent') {
				displayName = 'Duplicate Content';
			}
			
			// Add collapse icon
			const collapseIcon = header.createEl('span', { cls: 'seo-collapse-icon' });
			collapseIcon.appendChild(createCollapseIcon());
			
			header.createEl('span', { text: displayName });
			
			const statusIcon = header.createEl('span', { cls: 'seo-status' });
			const hasErrors = checkResults.some(r => r.severity === 'error');
			const hasWarnings = checkResults.some(r => r.severity === 'warning');
			const hasNotices = checkResults.some(r => r.severity === 'notice');
			
			// Use Lucide icons for status
			if (hasErrors) {
				setIcon(statusIcon, 'x-circle');
			} else if (hasWarnings) {
				setIcon(statusIcon, 'triangle-alert');
			} else if (hasNotices) {
				setIcon(statusIcon, 'info');
			} else {
				setIcon(statusIcon, 'circle-check');
			}

			// Results
			const resultsList = checkEl.createEl('ul', { cls: 'seo-results seo-results-list-expanded' });
			
			// Apply saved collapse state
			const savedCollapseState = this.individualCollapseStates.get(checkName);
			if (savedCollapseState !== undefined) {
				if (savedCollapseState) {
					resultsList.classList.add('seo-results-list-collapsed');
					resultsList.classList.remove('seo-results-list-expanded');
					const icon = collapseIcon.querySelector('svg');
					if (icon) {
						icon.classList.add('seo-collapse-icon-rotated');
						icon.classList.remove('seo-collapse-icon-normal');
					}
				} else {
					resultsList.classList.add('seo-results-list-expanded');
					resultsList.classList.remove('seo-results-list-collapsed');
					const icon = collapseIcon.querySelector('svg');
					if (icon) {
						icon.classList.add('seo-collapse-icon-normal');
						icon.classList.remove('seo-collapse-icon-rotated');
					}
				}
			}
			
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
					messageEl.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						void (async () => {
							await this.navigateToPosition(result.position!);
						})();
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
						cls: 'seo-suggestion'
					});
					
					// Check if suggestion contains HTML (file links)
					if (result.suggestion.includes('<a href="#" data-file-path=')) {
						// Parse HTML safely using DOMParser
						const parser = new DOMParser();
						const doc = parser.parseFromString(result.suggestion, 'text/html');
						const body = doc.body;
						
						// Move all nodes from parsed body to suggestion element
						while (body.firstChild) {
							suggestionEl.appendChild(body.firstChild);
						}
						
						// Use event delegation on the suggestion element
						suggestionEl.addEventListener('click', (e) => {
							void (async () => {
								const target = e.target as HTMLElement;
								if (target && target.tagName === 'A' && target.hasAttribute('data-file-path')) {
									e.preventDefault();
									e.stopPropagation();
									const filePath = target.getAttribute('data-file-path');
									if (filePath) {
										await this.onFileClick(filePath);
									}
								}
							})();
						});
					} else {
						suggestionEl.textContent = result.suggestion;
					}
				}
			});
			
			// Add mousedown handler for collapse functionality (works better without focus)
			header.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				
				// Get or initialize the collapse state for this check
				const currentState = this.individualCollapseStates.get(checkName) ?? false;
				const newState = !currentState;
				this.individualCollapseStates.set(checkName, newState);
				
				// Apply the new state
				if (newState) {
					resultsList.classList.remove('seo-results-list-expanded');
					resultsList.classList.add('seo-results-list-collapsed');
				} else {
					resultsList.classList.remove('seo-results-list-collapsed');
					resultsList.classList.add('seo-results-list-expanded');
				}
				
				// Rotate the collapse icon
				const icon = collapseIcon.querySelector('svg');
				if (icon) {
					if (newState) {
						icon.classList.remove('seo-collapse-icon-normal');
						icon.classList.add('seo-collapse-icon-rotated');
					} else {
						icon.classList.remove('seo-collapse-icon-rotated');
						icon.classList.add('seo-collapse-icon-normal');
					}
				}
				
				// If any individual item is expanded, reset main toggle to "collapse all" state
				if (!newState) {
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

	renderGlobalResults(results: SEOResults[], settings?: SEOSettings): void {
		const summary = this.container.createEl('div', { cls: 'seo-vault-summary' });
		
		const totalFiles = results.length;
		const totalIssues = results.reduce((sum, r) => sum + r.issuesCount, 0);
		const totalWarnings = results.reduce((sum, r) => sum + r.warningsCount, 0);
		
		// Use raw sum of notices so PBL notices are included
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

	renderIssuesList(results: SEOResults[], currentSort: string, onSortChange: (sortType: string) => void, onShowSortMenu: (event: MouseEvent) => void, settings?: SEOSettings): void {
		// Check if notices should be shown (both potentially broken checks must be enabled)
		const showNotices = settings ? 
			(settings.checkPotentiallyBrokenLinks && settings.checkPotentiallyBrokenEmbeds) : 
			true;
		
		const issuesFiles = results.filter(r => {
			const hasIssues = r.issuesCount > 0;
			const hasWarnings = r.warningsCount > 0;
			
			// Use raw notices count so it matches visible entries
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
			fileLink.addEventListener('click', (e) => {
				e.preventDefault();
				void (async () => {
					await this.onFileClick(result.file);
				})();
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
			auditBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				void (async () => {
					await this.onFileAudit(result.file);
				})();
			});
		});

		// Add collapse functionality to only the arrow icon
		collapseIcon.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const isCollapsed = filesListContainer.classList.contains('seo-results-list-collapsed');
			if (isCollapsed) {
				filesListContainer.classList.remove('seo-results-list-collapsed');
				filesListContainer.classList.add('seo-results-list-expanded');
			} else {
				filesListContainer.classList.remove('seo-results-list-expanded');
				filesListContainer.classList.add('seo-results-list-collapsed');
			}
			
			// Rotate the collapse icon
			const icon = collapseIcon.querySelector('svg');
			if (icon) {
				if (isCollapsed) {
					icon.classList.remove('seo-collapse-icon-rotated');
					icon.classList.add('seo-collapse-icon-normal');
				} else {
					icon.classList.remove('seo-collapse-icon-normal');
					icon.classList.add('seo-collapse-icon-rotated');
				}
			}
		});

		// Add "Files that pass" section
		this.renderPassingFilesList(results, currentSort, showNotices);
	}

	private renderPassingFilesList(results: SEOResults[], currentSort: string, showNotices: boolean): void {
		// Filter for files that have no issues or warnings (only notices or nothing)
		const passingFiles = results.filter(r => {
			const hasIssues = r.issuesCount > 0;
			const hasWarnings = r.warningsCount > 0;
			return !hasIssues && !hasWarnings;
		});

		if (passingFiles.length === 0) return;

		const passingList = this.container.createEl('div', { cls: 'seo-issues-list' });
		
		// Header with collapse functionality
		const passingHeader = passingList.createEl('div', { cls: 'seo-issues-header-container' });
		
		// Collapse icon (only this should be clickable) - start with right arrow (collapsed state)
		const collapseIcon = passingHeader.createEl('span', { cls: 'seo-collapse-icon seo-collapsible-header' });
		collapseIcon.appendChild(createCollapseIcon());
		
		// Start with right arrow (collapsed state) and add rotation class
		const icon = collapseIcon.querySelector('svg');
		if (icon) {
			// Rotate the down arrow to point right (collapsed state)
			icon.classList.add('seo-collapse-icon-rotated');
		}
		
		// Center the heading
		const headingContainer = passingHeader.createEl('div', { cls: 'seo-heading-center' });
		headingContainer.createEl('h4', { text: 'Files that pass', cls: 'seo-issues-header' });
		
		// Files list container (collapsed by default)
		const filesListContainer = passingList.createEl('div', { 
			cls: 'seo-files-list-container seo-results-list-collapsed' 
		});
		
		// Apply same sorting as the main list
		const sortedFiles = this.sortFiles(passingFiles, currentSort);
		
		sortedFiles.forEach(result => {
			const fileEl = filesListContainer.createEl('div', { cls: 'seo-file-issue' });
			fileEl.setAttribute('data-file-path', result.file);
			
			// Make file path clickable
			const fileLink = fileEl.createEl('a', { 
				text: result.displayName || getDisplayPath(result.file),
				cls: 'seo-file-link',
				href: '#'
			});
			fileLink.addEventListener('click', (e) => {
				e.preventDefault();
				void (async () => {
					await this.onFileClick(result.file);
				})();
			});
			
			// Stats and audit button container
			const statsContainer = fileEl.createEl('div', { cls: 'seo-stats-container' });
			
			// Only show notices if they exist
			if (showNotices && result.noticesCount > 0) {
				statsContainer.createEl('span', { 
					text: `${result.noticesCount} notices`,
					cls: 'seo-file-stats'
				});
			}
			
			// Audit button
			const auditBtn = statsContainer.createEl('button', {
				cls: 'clickable-icon seo-audit-btn',
				attr: { 'aria-label': 'Audit this note' }
			});
			setIcon(auditBtn, 'search-check');
			auditBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				void (async () => {
					await this.onFileAudit(result.file);
				})();
			});
		});

		// Add collapse functionality to the header
		collapseIcon.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			
			const isCollapsed = filesListContainer.classList.contains('seo-results-list-collapsed');
			
			if (isCollapsed) {
				filesListContainer.classList.remove('seo-results-list-collapsed');
				filesListContainer.classList.add('seo-results-list-expanded');
			} else {
				filesListContainer.classList.remove('seo-results-list-expanded');
				filesListContainer.classList.add('seo-results-list-collapsed');
			}
			
			// Rotate the collapse icon with smooth transition
			const icon = collapseIcon.querySelector('svg');
			if (icon) {
				if (isCollapsed) {
					// Going from collapsed to expanded: remove rotation (down arrow)
					icon.classList.remove('seo-collapse-icon-rotated');
					icon.classList.add('seo-collapse-icon-normal');
				} else {
					// Going from expanded to collapsed: add rotation (right arrow)
					icon.classList.remove('seo-collapse-icon-normal');
					icon.classList.add('seo-collapse-icon-rotated');
				}
			}
		});
	}

	private sortFiles(files: SEOResults[], sortType: string): SEOResults[] {
		const sortedFiles = [...files];
		
		switch (sortType) {
			case 'notices-desc':
				// Sort by notices (high first), then issues (high first), then warnings (high first), then file name A-Z
				sortedFiles.sort((a, b) => {
					const noticesCompare = b.noticesCount - a.noticesCount;
					if (noticesCompare !== 0) return noticesCompare;
					const issuesCompare = b.issuesCount - a.issuesCount;
					if (issuesCompare !== 0) return issuesCompare;
					const warningsCompare = b.warningsCount - a.warningsCount;
					if (warningsCompare !== 0) return warningsCompare;
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					return aFileName.localeCompare(bFileName);
				});
				break;
			case 'notices-asc':
				// Sort by notices (low first), then issues (low first), then warnings (low first), then file name A-Z
				sortedFiles.sort((a, b) => {
					const noticesCompare = a.noticesCount - b.noticesCount;
					if (noticesCompare !== 0) return noticesCompare;
					const issuesCompare = a.issuesCount - b.issuesCount;
					if (issuesCompare !== 0) return issuesCompare;
					const warningsCompare = a.warningsCount - b.warningsCount;
					if (warningsCompare !== 0) return warningsCompare;
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					return aFileName.localeCompare(bFileName);
				});
				break;
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
					// Primary: file name A-Z
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					const fileNameCompare = aFileName.localeCompare(bFileName);
					if (fileNameCompare !== 0) return fileNameCompare;
					
					// Secondary: parent folder A-Z (root files first)
					const aParts = a.file.split('/');
					const bParts = b.file.split('/');
					const aParent = aParts.length > 1 ? (aParts[aParts.length - 2] || '') : '';
					const bParent = bParts.length > 1 ? (bParts[bParts.length - 2] || '') : '';
					const parentCompare = aParent.localeCompare(bParent);
					if (parentCompare !== 0) return parentCompare;
					
					// Tertiary: issues (high first)
					if (b.issuesCount !== a.issuesCount) {
						return b.issuesCount - a.issuesCount;
					}
					// Quaternary: warnings (high first)
					if (b.warningsCount !== a.warningsCount) {
						return b.warningsCount - a.warningsCount;
					}
					// Quinary: notices (high first)
					return b.noticesCount - a.noticesCount;
				});
				break;
			case 'filename-desc':
				sortedFiles.sort((a, b) => {
					// Primary: file name Z-A
					const aFileName = a.file.split('/').pop() || '';
					const bFileName = b.file.split('/').pop() || '';
					const fileNameCompare = bFileName.localeCompare(aFileName);
					if (fileNameCompare !== 0) return fileNameCompare;
					
					// Secondary: parent folder Z-A (root files last)
					const aParts = a.file.split('/');
					const bParts = b.file.split('/');
					const aParent = aParts.length > 1 ? (aParts[aParts.length - 2] || '') : '';
					const bParent = bParts.length > 1 ? (bParts[bParts.length - 2] || '') : '';
					const parentCompare = bParent.localeCompare(aParent);
					if (parentCompare !== 0) return parentCompare;
					
					// Tertiary: issues (high first)
					if (b.issuesCount !== a.issuesCount) {
						return b.issuesCount - a.issuesCount;
					}
					// Quaternary: warnings (high first)
					if (b.warningsCount !== a.warningsCount) {
						return b.warningsCount - a.warningsCount;
					}
					// Quinary: notices (high first)
					return b.noticesCount - a.noticesCount;
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
			
			// Find the check name for this header to update the state map
			const checkName = this.findCheckNameForHeader(htmlHeader);
			
			if (resultsList && collapseIcon) {
				// Update the individual state map
				if (checkName) {
					this.individualCollapseStates.set(checkName, this.isCollapsed);
				}
				
				// Force to the state based on main toggle
				if (this.isCollapsed) {
					// Force all to collapsed
					resultsList.classList.remove('seo-results-list-expanded');
					resultsList.classList.add('seo-results-list-collapsed');
					collapseIcon.classList.remove('seo-collapse-icon-normal');
					collapseIcon.classList.add('seo-collapse-icon-rotated');
				} else {
					// Force all to expanded
					resultsList.classList.remove('seo-results-list-collapsed');
					resultsList.classList.add('seo-results-list-expanded');
					collapseIcon.classList.remove('seo-collapse-icon-rotated');
					collapseIcon.classList.add('seo-collapse-icon-normal');
				}
			}
		});
	}
	
	// Helper method to find the check name for a given header
	private findCheckNameForHeader(header: HTMLElement): string | null {
		// Get the check name from the data attribute
		return header.getAttribute('data-check-name');
	}
}
