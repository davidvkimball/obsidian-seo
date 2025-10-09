import { ItemView, WorkspaceLeaf, TFile, Notice, setIcon } from "obsidian";
import SEOPlugin from "../main";
import { SEOResults } from "../types";
import { SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./panel-constants";
import { getVaultFoldersInfo } from "./panel-utils";
import { PanelActions } from "./panel-actions";
import { ResultsDisplay } from "./results-display";
import { PanelRenderer } from "./panel-renderer";

interface SEOPanelView {
	globalResults: SEOResults[];
	render(): void;
}

type SortType = 'issues-desc' | 'issues-asc' | 'warnings-desc' | 'warnings-asc' | 'notices-desc' | 'notices-asc' | 'filename-asc' | 'filename-desc';

export class SEOSidePanel extends ItemView {
	plugin: SEOPlugin;
	currentNoteResults: SEOResults | null = null;
	globalResults: SEOResults[] = [];
	panelType: 'current' | 'global' = 'current';
	currentSort: SortType;
	hasRunInitialScan: boolean = false;
	private isRefreshing: boolean = false;
	private currentAuditController: AbortController | null = null;
	
	// Static property to track the current audit controller globally
	public static globalAuditController: AbortController | null = null;
	
	private actions: PanelActions;
	private resultsDisplay: ResultsDisplay;
	private renderer: PanelRenderer;

	constructor(plugin: SEOPlugin, panelType: 'current' | 'global' = 'current', leaf?: WorkspaceLeaf) {
		super(leaf || plugin.app.workspace.getLeaf());
		this.plugin = plugin;
		this.panelType = panelType;
		this.currentSort = plugin.settings.defaultSort;
		
		this.actions = new PanelActions(this.app, this.plugin, this.panelType);
		this.resultsDisplay = new ResultsDisplay(
			this.containerEl,
			async (filePath: string) => await this.actions.openFile(filePath),
			async (filePath: string) => await this.actions.openFileAndAudit(filePath)
		);
		this.renderer = new PanelRenderer(this.app, this.plugin, this.actions);
		
		
		// No global event delegation - we'll handle this in render()
		
		// Listen for file changes to update current note panel
		if (this.panelType === 'current') {
			let activeLeafChangeTimeout: any = null;
			this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
				// Cancel any ongoing audit when switching files
				if (SEOSidePanel.globalAuditController) {
					SEOSidePanel.globalAuditController.abort();
					SEOSidePanel.globalAuditController = null;
					console.log('Audit cancelled due to file switch');
				}
				
				// Don't re-render if we're currently refreshing
				if (this.isRefreshing) {
					return;
				}
				
				// Always update when switching files
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					return;
				}
				
				// Update the panel with results for the new file
				if (activeFile) {
					this.updateCurrentNoteResults(activeFile);
				}
			}));
			
			// Listen for file modifications to update current note panel
			this.registerEvent(this.app.vault.on('modify', (file) => {
				if (file instanceof TFile && file.path.endsWith('.md')) {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile && activeFile.path === file.path) {
						// Don't re-render if we're currently refreshing
						if (this.isRefreshing) {
							return;
						}
						
						// Clear current note results when the active file is modified
						this.currentNoteResults = null;
						// Update the panel with results for the modified file
						this.updateCurrentNoteResults(activeFile);
					}
				}
			}));
		}
	}

	getViewType(): string {
		return this.panelType === 'current' ? SEOCurrentPanelViewType : SEOGlobalPanelViewType;
	}

	private async handleRefreshClick(button: HTMLButtonElement): Promise<void> {
		// Prevent multiple clicks
		if (button.disabled) {
			return;
		}
		
		// Cancel any existing audit
		if (SEOSidePanel.globalAuditController) {
			SEOSidePanel.globalAuditController.abort();
		}
		
		// Create new abort controller for this audit
		SEOSidePanel.globalAuditController = new AbortController();
		
		this.isRefreshing = true;
		button.textContent = 'Refreshing...';
		button.disabled = true;
		
		try {
			const result = await this.actions.checkCurrentNote(SEOSidePanel.globalAuditController.signal);
			if (result) {
				this.currentNoteResults = result;
				
				// Clear ALL existing results more aggressively
				const existingResults = this.containerEl.querySelectorAll('.seo-results-container, .seo-file-issue, .seo-issue, .seo-warning, .seo-notice, .seo-info-note, .seo-check, .seo-result, .seo-score-header, .seo-score-text, .seo-score-number, .seo-toggle-icon, .seo-collapse-icon');
				existingResults.forEach(el => el.remove());
				
				// Create a new results container and render results
				const newResultsContainer = this.containerEl.createEl('div', { cls: 'seo-results-container' });
				
				// Create a new ResultsDisplay instance with the new container
				const tempResultsDisplay = new ResultsDisplay(
					newResultsContainer,
					async (filePath: string) => await this.actions.openFile(filePath),
					async (filePath: string) => await this.actions.openFileAndAudit(filePath)
				);
				tempResultsDisplay.renderResults(result);
				
				// Update global results if they exist (but don't trigger re-render)
				this.updateGlobalResultsIfExists(result);
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				console.log('Audit was cancelled');
				return;
			}
			console.error('Error in refresh button:', error);
		} finally {
			this.isRefreshing = false;
			button.textContent = 'Refresh';
			button.disabled = false;
			SEOSidePanel.globalAuditController = null;
		}
	}


	getDisplayText(): string {
		return this.panelType === 'current' ? "SEO audit: current note" : "SEO audit: vault";
	}

	getIcon(): string {
		return "search-check";
	}

	async onOpen() {
		try {
			// Load cached results for global panel
			if (this.panelType === 'global' && this.plugin.settings.cachedGlobalResults.length > 0) {
				this.globalResults = this.plugin.settings.cachedGlobalResults;
			}
			
			// Ensure icon is correct before rendering
			this.forceIconRefresh();

			// Auto-scan for global panel on first open if no cached results
			if (this.panelType === 'global' && !this.hasRunInitialScan && this.globalResults.length === 0) {
				// Show loading state first
				this.showLoadingState();
				this.hasRunInitialScan = true;
				await this.runInitialScan();
			} else {
				// Render normally if we have cached results or it's not a global panel
				this.render();
			}
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

	// Run initial scan for global panel
	async runInitialScan() {
		const results = await this.actions.runInitialScan();
		if (results.length > 0) {
			this.globalResults = results;
			this.render();
		}
	}

	// Force icon refresh to handle Obsidian's icon caching issues
	public forceIconRefresh() {
		// Immediate approach - try to set icon before DOM is rendered
		// This should prevent the flash of wrong icon
		
		// Force re-registration of the view with correct icon
		if (this.leaf) {
			this.leaf.setViewState({
				type: this.getViewType(),
				state: this.leaf.view.getState()
			});
		}
		
		// Also do the DOM manipulation as backup
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
		}, 50); // Reduced timeout for faster correction
	}

	async updateCurrentNoteResults(file: TFile) {
		if (!file || !file.path.endsWith('.md')) {
			return;
		}

		try {
			// Check if we have cached results for this file
			let currentFileResults: SEOResults | null = null;
			
			if (this.plugin.settings.cachedGlobalResults) {
				// Find results for the current file in the global results
				currentFileResults = this.plugin.settings.cachedGlobalResults.find(
					result => result.file === file.path
				) || null;
			}
			
			// Update currentNoteResults with cached results if available
			if (currentFileResults) {
				this.currentNoteResults = currentFileResults;
			} else {
				// Clear current note results when switching files if no cached results
				this.currentNoteResults = null;
			}
			
			// Show results if we have them (either from current note audit or global audit)
			const resultsToShow = this.currentNoteResults;
			
			
			// Clear existing results
			const existingResults = this.containerEl.querySelectorAll('.seo-results-container, .seo-file-issue, .seo-issue, .seo-warning, .seo-notice, .seo-info-note, .seo-check, .seo-result, .seo-score-header, .seo-score-text, .seo-score-number, .seo-toggle-icon, .seo-collapse-icon');
			existingResults.forEach(el => el.remove());
			
		if (resultsToShow) {
			// Create a new results container and render results
			const newResultsContainer = this.containerEl.createEl('div', { cls: 'seo-results-container' });
			
			// Reuse the existing results display instance or create a new one
			if (!this.resultsDisplay) {
				this.resultsDisplay = new ResultsDisplay(
					newResultsContainer,
					async (filePath: string) => await this.actions.openFile(filePath),
					async (filePath: string) => await this.actions.openFileAndAudit(filePath)
				);
			} else {
				// Update the container for the existing instance
				this.resultsDisplay.updateContainer(newResultsContainer);
			}
			
			this.resultsDisplay.renderResults(resultsToShow);
			
			// Panel is ready for interactions without stealing focus
			
		} else {
				// No results available, show message
				const noResultsEl = this.containerEl.createEl('div', { 
					cls: 'seo-info-note',
					text: 'No SEO results available for this file. Click "Refresh" to run an audit.'
				});
				noResultsEl.style.marginTop = '10px';
				noResultsEl.style.padding = '8px';
				noResultsEl.style.backgroundColor = 'var(--background-secondary)';
				noResultsEl.style.borderRadius = '4px';
				noResultsEl.style.fontSize = '12px';
				noResultsEl.style.color = 'var(--text-muted)';
			}
			
			// Update the header with the new file name (preserves button event listeners)
			this.updateHeaderAndResults();
		} catch (error) {
			console.error('Error updating current note results:', error);
		}
	}

	/**
	 * Updates only the header and results content without re-rendering the entire panel
	 * This preserves button event listeners and other UI state
	 */
	private updateHeaderAndResults() {
		// Update the header with the current file name
		const header = this.containerEl.querySelector('.seo-panel-header');
		if (header) {
			const filenameEl = header.querySelector('.seo-filename');
			if (filenameEl) {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.path.endsWith('.md')) {
					// Get the correct display name based on the current active file
					let displayName = activeFile.path;
					
					// If we have current note results for this specific file, use its display name
					if (this.currentNoteResults && this.currentNoteResults.file === activeFile.path) {
						displayName = this.currentNoteResults.displayName || activeFile.path;
					}
					// If we have global results for this file, use its display name
					else if (this.plugin.settings.cachedGlobalResults) {
						const globalResult = this.plugin.settings.cachedGlobalResults.find(
							result => result.file === activeFile.path
						);
						if (globalResult) {
							displayName = globalResult.displayName || activeFile.path;
						}
					}
					
					filenameEl.textContent = `Target note: ${displayName}`;
				}
			}
		}
	}

	async updateResults(results: SEOResults[]) {
		this.globalResults = results;
		this.render();
	}

	// Show loading state for large scans
	showLoadingState() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('seo-panel');

		// Header
		const header = containerEl.createEl('div', { cls: 'seo-panel-header' });
		header.createEl('h2', { text: this.panelType === 'current' ? 'SEO audit: current note' : 'SEO audit: vault' });

		// Show vault folders information for global panel
		if (this.panelType === 'global') {
			const foldersInfo = getVaultFoldersInfo(this.plugin.settings.scanDirectories);
			const foldersEl = header.createEl('div', { cls: 'seo-filename' });
			foldersEl.textContent = foldersInfo;
		}

		// Loading state
		const loadingContainer = containerEl.createEl('div', { cls: 'seo-loading-container' });
		const spinnerEl = loadingContainer.createEl('div', { cls: 'seo-loading-spinner' });
		setIcon(spinnerEl, 'loader-circle');
		loadingContainer.createEl('h3', { 
			text: 'Running SEO audit...',
			cls: 'seo-loading-title'
		});
		loadingContainer.createEl('p', { 
			text: 'This may take a moment for large vaults. Please wait...',
			cls: 'seo-loading-message'
		});
	}

	// Method to refresh the panel when settings change
	refresh() {
		this.render();
	}

	render() {
		// Use the new renderer for cleaner code organization
		this.renderer.render(
			this.containerEl,
			this.panelType,
			this.currentNoteResults,
			this.globalResults,
			async (btn: HTMLButtonElement) => await this.handleRefreshClick(btn),
			async () => {
				const result = await this.actions.checkExternalLinks();
				if (result) {
					this.currentNoteResults = result;
					// Update global results if they exist
					this.updateGlobalResultsIfExists(result);
					this.render();
				}
			}
		);

		// Handle custom events from the renderer
		this.containerEl.addEventListener('seo-refresh-complete', (event: Event) => {
			const customEvent = event as CustomEvent;
			this.globalResults = customEvent.detail.results;
			this.render();
		});

		this.containerEl.addEventListener('seo-sort-change', (event: Event) => {
			const customEvent = event as CustomEvent;
			this.currentSort = customEvent.detail.sortType;
			this.plugin.settings.defaultSort = customEvent.detail.sortType;
			this.plugin.saveSettings();
			this.render();
		});
	}

	/**
	 * Legacy render method - kept as fallback during migration
	 * TODO: Remove once PanelRenderer is fully tested
	 */
	private renderLegacy() {
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
					
					// Get the correct display name based on the current active file
					let displayName = activeFile.path;
					
					// If we have current note results for this specific file, use its display name
					if (this.currentNoteResults && this.currentNoteResults.file === activeFile.path) {
						displayName = this.currentNoteResults.displayName || activeFile.path;
					}
					// If we have global results for this file, use its display name
					else if (this.plugin.settings.cachedGlobalResults) {
						const globalResult = this.plugin.settings.cachedGlobalResults.find(
							result => result.file === activeFile.path
						);
						if (globalResult) {
							displayName = globalResult.displayName || activeFile.path;
						}
					}
					
					filenameEl.textContent = `Target note: ${displayName}`;
				}
			} else {
				// Show vault folders information for global panel
				const fileCount = this.globalResults.length;
				const foldersInfo = getVaultFoldersInfo(this.plugin.settings.scanDirectories, fileCount);
				const foldersEl = header.createEl('div', { cls: 'seo-filename' });
				foldersEl.textContent = foldersInfo;
			}

			// Action button at the top
			if (this.panelType === 'current') {
				const auditCurrentBtn = containerEl.createEl('button', { 
					text: 'Refresh',
					cls: 'mod-cta seo-btn seo-top-btn'
				});
				
				// Use only click event to avoid double execution
				auditCurrentBtn.addEventListener('click', async (event) => {
					event.preventDefault();
					event.stopPropagation();
					await this.handleRefreshClick(auditCurrentBtn);
				});

				// External links button (only show if enabled in settings and vault-wide is disabled)
				if (this.plugin.settings.enableExternalLinkButton && !this.plugin.settings.enableExternalLinkVaultCheck) {
					const externalLinksBtn = containerEl.createEl('button', { 
						text: 'Check external links for 404s',
						cls: 'seo-btn'
					});
					externalLinksBtn.addEventListener('click', async () => {
						externalLinksBtn.disabled = true;
						externalLinksBtn.textContent = 'This may take some time...';
						externalLinksBtn.addClass('seo-btn-disabled');
						
						try {
							const result = await this.actions.checkExternalLinks();
							if (result) {
								this.currentNoteResults = result;
								// Update global results if they exist
								this.updateGlobalResultsIfExists(result);
								this.render();
							}
						} finally {
							externalLinksBtn.disabled = false;
							externalLinksBtn.textContent = 'Check external links for 404s';
							externalLinksBtn.removeClass('seo-btn-disabled');
							externalLinksBtn.addClass('seo-btn-enabled');
						}
					});
				}
			}

			// Content based on panel type
			if (this.panelType === 'current') {
				// Check if we have results for the current file from global audit
				const activeFile = this.app.workspace.getActiveFile();
				let currentFileResults: SEOResults | null = null;
				
				if (activeFile && this.plugin.settings.cachedGlobalResults) {
					// Find results for the current file in the global results
					currentFileResults = this.plugin.settings.cachedGlobalResults.find(
						result => result.file === activeFile.path
					) || null;
				}
				
				// Show results if we have them (either from current note audit or global audit)
				const resultsToShow = this.currentNoteResults || currentFileResults;
				if (resultsToShow) {
					// Create a new results container and render results
					const newResultsContainer = this.containerEl.createEl('div', { cls: 'seo-results-container' });
					
					// Create a new results display instance for this container
					const tempResultsDisplay = new ResultsDisplay(
						newResultsContainer,
						async (filePath: string) => await this.actions.openFile(filePath),
						async (filePath: string) => await this.actions.openFileAndAudit(filePath)
					);
					tempResultsDisplay.renderResults(resultsToShow);
					
				} else {
					const noResults = containerEl.createEl('div', { cls: 'seo-no-results' });
					noResults.createEl('p', { text: 'Open a markdown file and click "Refresh" to audit it.' });
				}
			} else {
				if (this.globalResults.length > 0) {
					this.renderGlobalResults(containerEl);
				} else {
					const noGlobal = containerEl.createEl('div', { cls: 'seo-no-results' });
					noGlobal.createEl('p', { text: 'Click "Audit all notes" to audit your files in your configured directories.' });
				}
			}

		} catch (error) {
			console.error('Error rendering SEO panel:', error);
			this.containerEl.createEl('div', { text: 'Error loading SEO panel. Please try again.' });
		}
	}

	private shouldIncludeFileInGlobalResults(filePath: string): boolean {
		// Check if file should be excluded based on underscore prefix setting
		if (this.plugin.settings.ignoreUnderscoreFiles) {
			const fileName = filePath.split('/').pop() || '';
			const basename = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
			if (basename.startsWith('_')) {
				return false; // Exclude files with underscore prefix
			}
		}
		
		// Check if file should be excluded based on directory settings
		const { scanDirectories } = this.plugin.settings;
		if (scanDirectories.trim()) {
			const directories = scanDirectories.split(',').map(dir => dir.trim());
			const isInConfiguredDirectory = directories.some(dir => 
				filePath.startsWith(dir + '/') || filePath === dir
			);
			return isInConfiguredDirectory;
		}
		
		return true; // Include file if no restrictions apply
	}

	private updateGlobalResultsIfExists(currentResult: SEOResults): void {
		// Only update if global results exist
		if (this.plugin.settings.cachedGlobalResults && this.plugin.settings.cachedGlobalResults.length > 0) {
			// Check if this file should be included in global results
			if (!this.shouldIncludeFileInGlobalResults(currentResult.file)) {
				return; // Don't update global results for files that should be excluded
			}
			
			// Find the file in global results and update it
			const globalResults = this.plugin.settings.cachedGlobalResults;
			const existingIndex = globalResults.findIndex(r => r.file === currentResult.file);
			
			if (existingIndex !== -1) {
				// Update existing result
				globalResults[existingIndex] = currentResult;
			} else {
				// Add new result if not found (shouldn't happen normally)
				globalResults.push(currentResult);
			}
			
			// Save updated results
			this.plugin.saveSettings();
			
			// Update global panel if it's open
			this.updateGlobalPanelIfOpen();
		}
	}

	private updateDisplayName(): void {
		// Update display name and results for the new file
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.path.endsWith('.md')) {
			// Update the display name
			const filenameEl = this.containerEl.querySelector('.seo-filename');
			if (filenameEl) {
				// Get the correct display name based on the current active file
				let displayName = activeFile.path;
				
				// If we have current note results for this specific file, use its display name
				if (this.currentNoteResults && this.currentNoteResults.file === activeFile.path) {
					displayName = this.currentNoteResults.displayName || activeFile.path;
				}
				// If we have global results for this file, use its display name
				else if (this.plugin.settings.cachedGlobalResults) {
					const globalResult = this.plugin.settings.cachedGlobalResults.find(
						result => result.file === activeFile.path
					);
					if (globalResult) {
						displayName = globalResult.displayName || activeFile.path;
					}
				}
				
				filenameEl.textContent = `Target note: ${displayName}`;
			}
			
			// Update the results display
			this.updateResultsForCurrentFile();
		}
	}

	private updateResultsForCurrentFile(): void {
		// Check if we have results for the current file from global audit
		const activeFile = this.app.workspace.getActiveFile();
		let currentFileResults: SEOResults | null = null;
		
		if (activeFile && this.plugin.settings.cachedGlobalResults) {
			// Find results for the current file in the global results
			currentFileResults = this.plugin.settings.cachedGlobalResults.find(
				result => result.file === activeFile.path
			) || null;
		}
		
		// Show results if we have them (either from current note audit or global audit)
		const resultsToShow = this.currentNoteResults || currentFileResults;
		
		// Clear existing results
		const existingResults = this.containerEl.querySelectorAll('.seo-results-container, .seo-file-issue, .seo-issue, .seo-warning, .seo-notice, .seo-info-note, .seo-check, .seo-result, .seo-score-header, .seo-score-text, .seo-score-number, .seo-toggle-icon, .seo-collapse-icon');
		existingResults.forEach(el => el.remove());
		
		if (resultsToShow) {
			// Create a new results container and render results
			const newResultsContainer = this.containerEl.createEl('div', { cls: 'seo-results-container' });
			
			// Create a new results display instance for this container
			const tempResultsDisplay = new ResultsDisplay(
				newResultsContainer,
				async (filePath: string) => await this.actions.openFile(filePath),
				async (filePath: string) => await this.actions.openFileAndAudit(filePath)
			);
			tempResultsDisplay.renderResults(resultsToShow);
			
		} else {
			// No results available, show prompt
			const noResults = this.containerEl.createEl('div', { cls: 'seo-no-results' });
			noResults.createEl('p', { text: 'Open a markdown file and click "Refresh" to audit it.' });
		}
	}

	private updateGlobalPanelIfOpen(): void {
		// Find and update the global panel if it's open
		const globalPanels = this.app.workspace.getLeavesOfType('seo-global-panel');
		
		if (globalPanels.length > 0) {
			const globalPanel = globalPanels[0];
			
			if (globalPanel?.view && globalPanel.view instanceof SEOSidePanel) {
				const seoPanel = globalPanel.view as SEOSidePanel;
				// Update the global results in the panel
				seoPanel.globalResults = [...this.plugin.settings.cachedGlobalResults];
				// Re-render the panel
				seoPanel.render();
			}
		}
	}

	private renderGlobalResults(container: HTMLElement) {
		// Render summary stats
		this.resultsDisplay.renderGlobalResults(this.globalResults, this.plugin.settings);

		// Add refresh button below stats
		const refreshBtn = container.createEl('button', { 
			text: 'Refresh',
			cls: 'mod-cta seo-btn seo-refresh-btn',
			attr: { 'data-refresh-btn': 'true' }
		});
		refreshBtn.addEventListener('click', async () => {
			refreshBtn.textContent = 'Refreshing...';
			refreshBtn.disabled = true;
			
			try {
				const results = await this.actions.refreshGlobalResults();
				if (results.length > 0) {
					this.globalResults = results;
					this.render();
				}
			} finally {
				refreshBtn.textContent = 'Refresh';
				refreshBtn.disabled = false;
			}
		});

		// Render issues list with sorting
		this.resultsDisplay.renderIssuesList(
			this.globalResults,
			this.currentSort,
			(sortType: string) => {
				this.currentSort = sortType as SortType;
				this.plugin.settings.defaultSort = sortType as SortType;
				this.plugin.saveSettings();
			},
			(event: MouseEvent) => {
				// Check if notices should be shown
				const showNotices = this.plugin.settings.checkPotentiallyBrokenLinks && this.plugin.settings.checkPotentiallyBrokenEmbeds;
				const issuesFiles = this.globalResults.filter(r => {
					const hasIssues = r.issuesCount > 0;
					const hasWarnings = r.warningsCount > 0;
					const hasNotices = showNotices && r.noticesCount > 0;
					return hasIssues || hasWarnings || hasNotices;
				});
				this.actions.showSortMenu(event, issuesFiles, container, this.currentSort, (sortType: string) => {
					this.currentSort = sortType as SortType;
					this.plugin.settings.defaultSort = sortType as SortType;
					this.plugin.saveSettings();
				}, this.plugin.settings);
			},
			this.plugin.settings
		);
	}
}
