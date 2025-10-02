import { ItemView, WorkspaceLeaf, TFile, Notice, setIcon, Menu } from "obsidian";
import SEOPlugin from "../main";
import { SEOResults } from "../types";

export const SEOPanelViewType = "seo-panel";
export const SEOCurrentPanelViewType = "seo-current-panel";
export const SEOGlobalPanelViewType = "seo-global-panel";

export class SEOSidePanel extends ItemView {
	plugin: SEOPlugin;
	currentNoteResults: SEOResults | null = null;
	globalResults: SEOResults[] = [];
	panelType: 'current' | 'global' = 'current';
	sortState: 'none' | 'issues-asc' | 'issues-desc' | 'warnings-asc' | 'warnings-desc' | 'score-asc' | 'score-desc' = 'none';
	currentSort: 'issues-desc' | 'issues-asc' | 'warnings-desc' | 'warnings-asc' | 'filename-asc' | 'filename-desc';

	constructor(plugin: SEOPlugin, panelType: 'current' | 'global' = 'current', leaf?: WorkspaceLeaf) {
		super(leaf || plugin.app.workspace.getLeaf());
		this.plugin = plugin;
		this.panelType = panelType;
		this.currentSort = plugin.settings.defaultSort;
	}

	getViewType(): string {
		return this.panelType === 'current' ? SEOCurrentPanelViewType : SEOGlobalPanelViewType;
	}

	getDisplayText(): string {
		return this.panelType === 'current' ? "SEO audit: current note" : "SEO audit: vault";
	}

	getIcon(): string {
		return "search-check";
	}

	async onOpen() {
		try {
			this.render();
			
			// Force icon refresh after panel is opened using onLayoutReady
			this.app.workspace.onLayoutReady(() => {
				this.forceIconRefresh();
			});
		} catch (error) {
			console.error('Error opening SEO panel:', error);
		}
	}

	async onClose() {
		// Cleanup if needed
	}

	cleanup() {
		// Cleanup resources
	}

	// Get vault folders information for display
	private getVaultFoldersInfo(): string {
		const scanDirectories = this.plugin.settings.scanDirectories;
		if (!scanDirectories || scanDirectories.trim() === '') {
			return 'Vault folders: all';
		}
		
		const folders = scanDirectories.split(',').map(f => f.trim()).filter(f => f.length > 0);
		return `Vault folders: ${folders.join(', ')}`;
	}

	// Toggle sort like Obsidian's native sorting
	private toggleSort() {
		if (this.panelType !== 'global') return;
		
		// Cycle through sort states
		switch (this.sortState) {
			case 'none':
				this.sortState = 'issues-desc';
				break;
			case 'issues-desc':
				this.sortState = 'issues-asc';
				break;
			case 'issues-asc':
				this.sortState = 'warnings-desc';
				break;
			case 'warnings-desc':
				this.sortState = 'warnings-asc';
				break;
			case 'warnings-asc':
				this.sortState = 'score-desc';
				break;
			case 'score-desc':
				this.sortState = 'score-asc';
				break;
			case 'score-asc':
				this.sortState = 'none';
				break;
		}
		
		this.applySort();
	}

	// Apply the current sort state
	private applySort() {
		if (this.panelType !== 'global') return;
		
		const issuesFiles = this.globalResults.filter(r => r.issuesCount > 0 || r.warningsCount > 0);
		
		switch (this.sortState) {
			case 'issues-desc':
				issuesFiles.sort((a, b) => b.issuesCount - a.issuesCount);
				break;
			case 'issues-asc':
				issuesFiles.sort((a, b) => a.issuesCount - b.issuesCount);
				break;
			case 'warnings-desc':
				issuesFiles.sort((a, b) => b.warningsCount - a.warningsCount);
				break;
			case 'warnings-asc':
				issuesFiles.sort((a, b) => a.warningsCount - b.warningsCount);
				break;
			case 'score-desc':
				issuesFiles.sort((a, b) => b.overallScore - a.overallScore);
				break;
			case 'score-asc':
				issuesFiles.sort((a, b) => a.overallScore - b.overallScore);
				break;
			case 'none':
			default:
				// No sorting, keep original order
				break;
		}
		
		// Re-render the panel with sorted results
		this.render();
	}

	// Search functionality for issues files
	private searchIssuesFiles() {
		// Use Obsidian's native search command
		(this.app as any).internalPlugins.plugins.globalSearch?.instance?.openGlobalSearch();
	}

	// Scroll to current note in the issues list
	private scrollToCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;
		
		const fileElement = this.containerEl.querySelector(`[data-file-path="${activeFile.path}"]`);
		if (fileElement) {
			fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	// Force icon refresh to handle Obsidian's icon caching issues
	public forceIconRefresh() {
		// Multiple approaches to ensure icon is properly displayed
		setTimeout(() => {
			// Approach 1: Direct DOM manipulation of icon element
			const iconEl = this.containerEl.querySelector('.view-header-icon') as HTMLElement;
			if (iconEl) {
				// Clear and reset the icon
				iconEl.innerHTML = '';
				iconEl.setAttribute('data-icon', 'search-check');
				// Force a re-render by temporarily changing the attribute
				iconEl.setAttribute('data-icon', '');
				iconEl.offsetHeight; // Force reflow
				iconEl.setAttribute('data-icon', 'search-check');
			}
			
			// Approach 2: Force re-render of the entire header
			const headerEl = this.containerEl.querySelector('.view-header') as HTMLElement;
			if (headerEl) {
				headerEl.style.display = 'none';
				headerEl.offsetHeight; // Force reflow
				headerEl.style.display = '';
			}
			
			// Approach 3: Trigger a workspace refresh
			this.app.workspace.trigger('layout-change');
			
			// Approach 4: Force re-registration of the view
			this.leaf.setViewState({
				type: this.getViewType(),
				state: this.leaf.view.getState()
			});
		}, 100);
	}


	async updateCurrentNoteResults(file: TFile) {
		if (!file || !file.path.endsWith('.md')) return;

		try {
			const content = await this.app.vault.read(file);
			// Run checks for current note
			// This would be similar to the checkFile function in seo-checker.ts
			// For now, we'll just update the display
			this.render();
		} catch (error) {
			console.error('Error updating current note results:', error);
		}
	}

	async updateResults(results: SEOResults[]) {
		this.globalResults = results;
		this.render();
	}

	render() {
		try {
			const { containerEl } = this;
			containerEl.empty();
			containerEl.addClass('seo-panel');

			// Header with proper spacing
			const header = containerEl.createEl('div', { cls: 'seo-panel-header' });
			header.createEl('h2', { text: this.panelType === 'current' ? 'SEO audit: current note' : 'SEO audit: vault' });

			// Show current note file path if available
			if (this.panelType === 'current') {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.path.endsWith('.md')) {
					const filenameEl = header.createEl('div', { cls: 'seo-filename' });
					filenameEl.textContent = `Target note: ${activeFile.path}`;
				}
			} else {
				// Show vault folders information for global panel
				const foldersInfo = this.getVaultFoldersInfo();
				const foldersEl = header.createEl('div', { cls: 'seo-filename' });
				foldersEl.textContent = foldersInfo;
			}

			// Action button at the top
			if (this.panelType === 'current') {
				const checkCurrentBtn = containerEl.createEl('button', { 
					text: 'Check current note',
					cls: 'mod-cta seo-btn seo-top-btn'
				});
				checkCurrentBtn.addEventListener('click', async () => {
					const activeFile = this.app.workspace.getActiveFile();
					if (!activeFile || !activeFile.path.endsWith('.md')) {
						new Notice('Please open a markdown file first.');
						return;
					}

					checkCurrentBtn.textContent = 'Checking...';
					checkCurrentBtn.disabled = true;
					
					try {
						// Import and run SEO check directly
						const { runSEOCheck } = await import("../seo-checker");
						const results = await runSEOCheck(this.plugin, [activeFile]);
						
						if (results.length > 0) {
							this.currentNoteResults = results[0];
							this.render();
							new Notice('SEO audit complete.');
						}
					} catch (error) {
						console.error('Error checking current note:', error);
						new Notice('Error analyzing current note. Check console for details.');
					} finally {
							checkCurrentBtn.textContent = 'Check current note';
						checkCurrentBtn.disabled = false;
					}
				});
			} else {
				const checkAllBtn = containerEl.createEl('button', { 
					text: 'Check all notes',
					cls: 'mod-cta seo-btn seo-top-btn'
				});
				checkAllBtn.addEventListener('click', async () => {
					checkAllBtn.textContent = 'Checking...';
					checkAllBtn.disabled = true;
					
					try {
						// Get files to check
						const files = await this.plugin.getFilesToCheck();
						if (files.length === 0) {
							new Notice('No markdown files found in configured directories.');
							return;
						}
						
						// Import and run SEO check directly
						const { runSEOCheck } = await import("../seo-checker");
						const results = await runSEOCheck(this.plugin, files);
						
						this.globalResults = results;
						this.render();
						new Notice(`SEO audit complete with ${results.length} files.`);
					} catch (error) {
						console.error('Error checking all notes:', error);
						new Notice('Error analyzing files. Check console for details.');
					} finally {
							checkAllBtn.textContent = 'Check all notes';
						checkAllBtn.disabled = false;
					}
				});
			}

			// Content based on panel type
			if (this.panelType === 'current') {
				if (this.currentNoteResults) {
					this.renderResults(containerEl, this.currentNoteResults);
				} else {
					const noResults = containerEl.createEl('div', { cls: 'seo-no-results' });
					noResults.createEl('p', { text: 'Open a markdown file and click "Check current note" to audit it.' });
				}
			} else {
				if (this.globalResults.length > 0) {
					this.renderGlobalResults(containerEl);
				} else {
					const noGlobal = containerEl.createEl('div', { cls: 'seo-no-results' });
					noGlobal.createEl('p', { text: 'Click "Check all notes" to audit your files in your configured directories.' });
				}
			}

		} catch (error) {
			console.error('Error rendering SEO panel:', error);
			this.containerEl.createEl('div', { text: 'Error loading SEO panel. Please try again.' });
		}
	}

	private renderResults(container: HTMLElement, results: SEOResults) {
		// Overall score
		const scoreEl = container.createEl('div', { cls: 'seo-score' });
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
		const checksContainer = container.createEl('div', { cls: 'seo-checks' });
		
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

	private renderGlobalResults(container: HTMLElement) {
		const summary = container.createEl('div', { cls: 'seo-vault-summary' });
		
		const totalFiles = this.globalResults.length;
		const totalIssues = this.globalResults.reduce((sum, r) => sum + r.issuesCount, 0);
		const totalWarnings = this.globalResults.reduce((sum, r) => sum + r.warningsCount, 0);
		const avgScore = Math.round(
			this.globalResults.reduce((sum, r) => sum + r.overallScore, 0) / totalFiles
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

		// Files with issues
		const issuesFiles = this.globalResults.filter(r => r.issuesCount > 0 || r.warningsCount > 0);
		if (issuesFiles.length > 0) {
			const issuesList = container.createEl('div', { cls: 'seo-issues-list' });
			
			// Header with sorting buttons
			const issuesHeader = issuesList.createEl('div', { cls: 'seo-issues-header-container' });
			issuesHeader.createEl('h4', { text: 'Files with issues', cls: 'seo-issues-header' });
			
			// Sort button
			const sortBtn = issuesHeader.createEl('button', {
				cls: 'seo-sort-btn',
				attr: { 'aria-label': 'Sort files' }
			});
			setIcon(sortBtn, 'arrow-up-narrow-wide');
			sortBtn.addEventListener('click', (e) => {
				this.showSortMenu(e, issuesFiles, issuesList);
			});
			
			// Apply saved sort preference
			let sortedFiles = [...issuesFiles];
			switch (this.currentSort) {
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
			
			sortedFiles.forEach(result => {
				const fileEl = issuesList.createEl('div', { cls: 'seo-file-issue' });
				fileEl.setAttribute('data-file-path', result.file);
				
				// Make file path clickable
				const fileLink = fileEl.createEl('a', { 
					text: this.getDisplayPath(result.file),
					cls: 'seo-file-link',
					href: '#'
				});
				fileLink.addEventListener('click', (e) => {
					e.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(result.file);
					if (file) {
						// Check if file is already open, if so switch to it, otherwise open new tab
						const existingLeaf = this.app.workspace.getLeavesOfType('markdown').find(leaf => 
							leaf.view.getState().file === result.file
						);
						if (existingLeaf) {
							this.app.workspace.setActiveLeaf(existingLeaf);
						} else {
							this.app.workspace.openLinkText(result.file, '', true);
						}
					}
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
				auditBtn.addEventListener('click', async (e) => {
					e.preventDefault();
					e.stopPropagation();
					// Open the note
					const file = this.app.vault.getAbstractFileByPath(result.file);
					if (file) {
						// Check if file is already open, if so switch to it, otherwise open new tab
						const existingLeaf = this.app.workspace.getLeavesOfType('markdown').find(leaf => 
							leaf.view.getState().file === result.file
						);
						if (existingLeaf) {
							this.app.workspace.setActiveLeaf(existingLeaf);
						} else {
							this.app.workspace.openLinkText(result.file, '', true);
						}
						// Open current note panel and run audit
						this.plugin.openCurrentPanel();
						// Wait for panel to open, then trigger the check
						setTimeout(() => {
							// Find and click the "Check current note" button
							const currentPanel = this.app.workspace.getLeavesOfType(SEOCurrentPanelViewType)[0];
							if (currentPanel) {
								const checkBtn = currentPanel.view.containerEl.querySelector('.seo-top-btn') as HTMLButtonElement;
								if (checkBtn) {
									checkBtn.click();
								}
							}
						}, 200);
					}
				});
			});
		}
	}

	// Show sort menu and handle sorting
	private showSortMenu(event: MouseEvent, issuesFiles: SEOResults[], issuesList: HTMLElement) {
		const menu = new Menu();
		
		// Warnings (high to low)
		menu.addItem((item) => {
			item.setTitle('Warnings (high to low)')
				.onClick(() => {
					this.currentSort = 'warnings-desc';
					this.plugin.settings.defaultSort = 'warnings-desc';
					this.plugin.saveSettings();
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => b.warningsCount - a.warningsCount);
				});
			if (this.currentSort === 'warnings-desc') {
				item.setIcon('check');
			}
		});
		
		// Warnings (low to high)
		menu.addItem((item) => {
			item.setTitle('Warnings (low to high)')
				.onClick(() => {
					this.currentSort = 'warnings-asc';
					this.plugin.settings.defaultSort = 'warnings-asc';
					this.plugin.saveSettings();
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => a.warningsCount - b.warningsCount);
				});
			if (this.currentSort === 'warnings-asc') {
				item.setIcon('check');
			}
		});
		
		// Divider
		menu.addSeparator();
		
		// Issues (high to low)
		menu.addItem((item) => {
			item.setTitle('Issues (high to low)')
				.onClick(() => {
					this.currentSort = 'issues-desc';
					this.plugin.settings.defaultSort = 'issues-desc';
					this.plugin.saveSettings();
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => b.issuesCount - a.issuesCount);
				});
			if (this.currentSort === 'issues-desc') {
				item.setIcon('check');
			}
		});
		
		// Issues (low to high)
		menu.addItem((item) => {
			item.setTitle('Issues (low to high)')
				.onClick(() => {
					this.currentSort = 'issues-asc';
					this.plugin.settings.defaultSort = 'issues-asc';
					this.plugin.saveSettings();
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => a.issuesCount - b.issuesCount);
				});
			if (this.currentSort === 'issues-asc') {
				item.setIcon('check');
			}
		});
		
		// Divider
		menu.addSeparator();
		
		// File name (A to Z)
		menu.addItem((item) => {
			item.setTitle('File name (A to Z)')
				.onClick(() => {
					this.currentSort = 'filename-asc';
					this.plugin.settings.defaultSort = 'filename-asc';
					this.plugin.saveSettings();
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => {
						const aFileName = a.file.split('/').pop() || '';
						const bFileName = b.file.split('/').pop() || '';
						const fileNameCompare = aFileName.localeCompare(bFileName);
						if (fileNameCompare !== 0) return fileNameCompare;
						// If filenames are the same, sort by folder
						return a.file.localeCompare(b.file);
					});
				});
			if (this.currentSort === 'filename-asc') {
				item.setIcon('check');
			}
		});
		
		// File name (Z to A)
		menu.addItem((item) => {
			item.setTitle('File name (Z to A)')
				.onClick(() => {
					this.currentSort = 'filename-desc';
					this.plugin.settings.defaultSort = 'filename-desc';
					this.plugin.saveSettings();
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => {
						const aFileName = a.file.split('/').pop() || '';
						const bFileName = b.file.split('/').pop() || '';
						const fileNameCompare = bFileName.localeCompare(aFileName);
						if (fileNameCompare !== 0) return fileNameCompare;
						// If filenames are the same, sort by folder
						return b.file.localeCompare(a.file);
					});
				});
			if (this.currentSort === 'filename-desc') {
				item.setIcon('check');
			}
		});
		
		menu.showAtPosition({ x: event.clientX, y: event.clientY });
	}

	// Helper function to get parent folder and filename
	private getDisplayPath(fullPath: string): string {
		const parts = fullPath.split('/');
		if (parts.length <= 2) {
			return fullPath; // Return as-is if no parent folder
		}
		return parts.slice(-2).join('/'); // Return last two parts (parent folder + filename)
	}

	// Sort files and re-render
	private sortAndRenderFiles(issuesFiles: SEOResults[], issuesList: HTMLElement, sortFn: (a: SEOResults, b: SEOResults) => number) {
		// Sort the array
		const sortedFiles = [...issuesFiles].sort(sortFn);
		
		// Clear existing file items
		issuesList.querySelectorAll('.seo-file-issue').forEach(el => el.remove());
		
		// Re-render sorted files
		sortedFiles.forEach(result => {
			const fileEl = issuesList.createEl('div', { cls: 'seo-file-issue' });
			fileEl.setAttribute('data-file-path', result.file);
			
			// Make file path clickable
			const fileLink = fileEl.createEl('a', { 
				text: this.getDisplayPath(result.file),
				cls: 'seo-file-link',
				href: '#'
			});
			fileLink.addEventListener('click', (e) => {
				e.preventDefault();
				const file = this.app.vault.getAbstractFileByPath(result.file);
				if (file) {
					// Check if file is already open, if so switch to it, otherwise open new tab
					const existingLeaf = this.app.workspace.getLeavesOfType('markdown').find(leaf => 
						leaf.view.getState().file === result.file
					);
					if (existingLeaf) {
						this.app.workspace.setActiveLeaf(existingLeaf);
					} else {
						this.app.workspace.openLinkText(result.file, '', true);
					}
				}
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
			auditBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopPropagation();
				// Open the note
				const file = this.app.vault.getAbstractFileByPath(result.file);
				if (file) {
					// Check if file is already open, if so switch to it, otherwise open new tab
					const existingLeaf = this.app.workspace.getLeavesOfType('markdown').find(leaf => 
						leaf.view.getState().file === result.file
					);
					if (existingLeaf) {
						this.app.workspace.setActiveLeaf(existingLeaf);
					} else {
						this.app.workspace.openLinkText(result.file, '', true);
					}
					// Open current note panel and run audit
					this.plugin.openCurrentPanel();
					// Wait for panel to open, then trigger the check
					setTimeout(() => {
						// Find and click the "Check current note" button
						const currentPanel = this.app.workspace.getLeavesOfType(SEOCurrentPanelViewType)[0];
						if (currentPanel) {
							const checkBtn = currentPanel.view.containerEl.querySelector('.seo-top-btn') as HTMLButtonElement;
							if (checkBtn) {
								checkBtn.click();
							}
						}
					}, 200);
				}
			});
		});
	}
}
