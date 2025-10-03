import { ItemView, WorkspaceLeaf, TFile, Notice, setIcon } from "obsidian";
import SEOPlugin from "../main";
import { SEOResults } from "../types";
import { SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./panel-constants";
import { getVaultFoldersInfo } from "./panel-utils";
import { PanelActions } from "./panel-actions";
import { ResultsDisplay } from "./results-display";

export class SEOSidePanel extends ItemView {
	plugin: SEOPlugin;
	currentNoteResults: SEOResults | null = null;
	globalResults: SEOResults[] = [];
	panelType: 'current' | 'global' = 'current';
	currentSort: 'issues-desc' | 'issues-asc' | 'warnings-desc' | 'warnings-asc' | 'filename-asc' | 'filename-desc';
	hasRunInitialScan: boolean = false;
	
	private actions: PanelActions;
	private resultsDisplay: ResultsDisplay;

	constructor(plugin: SEOPlugin, panelType: 'current' | 'global' = 'current', leaf?: WorkspaceLeaf) {
		super(leaf || plugin.app.workspace.getLeaf());
		this.plugin = plugin;
		this.panelType = panelType;
		this.currentSort = plugin.settings.defaultSort;
		
		this.actions = new PanelActions(this.app, this.plugin, this.panelType);
		this.resultsDisplay = new ResultsDisplay(
			this.containerEl,
			(filePath: string) => this.actions.openFile(filePath),
			(filePath: string) => this.actions.openFileAndAudit(filePath)
		);
	}

	getViewType(): string {
		return this.panelType === 'current' ? SEOCurrentPanelViewType : SEOGlobalPanelViewType;
	}

	getDisplayText(): string {
		return this.panelType === 'current' ? "SEO check: current note" : "SEO check: vault";
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
			
			this.render();
			
			// Force icon refresh after panel is opened using onLayoutReady
			this.app.workspace.onLayoutReady(() => {
				this.forceIconRefresh();
			});

			// Auto-scan for global panel on first open if no cached results
			if (this.panelType === 'global' && !this.hasRunInitialScan && this.globalResults.length === 0) {
				this.hasRunInitialScan = true;
				await this.runInitialScan();
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
			header.createEl('h2', { text: this.panelType === 'current' ? 'SEO check: current note' : 'SEO check: vault' });

			// Show current note file path if available
			if (this.panelType === 'current') {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.path.endsWith('.md')) {
					const filenameEl = header.createEl('div', { cls: 'seo-filename' });
					filenameEl.textContent = `Target note: ${activeFile.path}`;
				}
			} else {
				// Show vault folders information for global panel
				const foldersInfo = getVaultFoldersInfo(this.plugin.settings.scanDirectories);
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
					checkCurrentBtn.textContent = 'Checking...';
					checkCurrentBtn.disabled = true;
					
					try {
						const result = await this.actions.checkCurrentNote();
						if (result) {
							this.currentNoteResults = result;
							this.render();
						}
					} finally {
						checkCurrentBtn.textContent = 'Check current note';
						checkCurrentBtn.disabled = false;
					}
				});
			}

			// Content based on panel type
			if (this.panelType === 'current') {
				if (this.currentNoteResults) {
					this.resultsDisplay.renderResults(this.currentNoteResults);
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

	private renderGlobalResults(container: HTMLElement) {
		// Render summary stats
		this.resultsDisplay.renderGlobalResults(this.globalResults);

		// Add refresh button below stats
		const refreshBtn = container.createEl('button', { 
			text: 'Refresh',
			cls: 'mod-cta seo-btn seo-refresh-btn'
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
				this.currentSort = sortType as any;
				this.plugin.settings.defaultSort = sortType as any;
				this.plugin.saveSettings();
			},
			(event: MouseEvent) => {
				const issuesFiles = this.globalResults.filter(r => r.issuesCount > 0 || r.warningsCount > 0);
				this.actions.showSortMenu(event, issuesFiles, container, this.currentSort, (sortType: string) => {
					this.currentSort = sortType as any;
					this.plugin.settings.defaultSort = sortType as any;
					this.plugin.saveSettings();
				});
			}
		);
	}
}
