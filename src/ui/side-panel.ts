import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
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

	constructor(plugin: SEOPlugin, panelType: 'current' | 'global' = 'current', leaf?: WorkspaceLeaf) {
		super(leaf || plugin.app.workspace.getLeaf());
		this.plugin = plugin;
		this.panelType = panelType;
	}

	getViewType(): string {
		return this.panelType === 'current' ? SEOCurrentPanelViewType : SEOGlobalPanelViewType;
	}

	getDisplayText(): string {
		return this.panelType === 'current' ? "SEO: Current Note" : "SEO: Vault";
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
			header.createEl('h2', { text: this.panelType === 'current' ? 'SEO: Current Note' : 'SEO: Vault' });

			// Show current note file path if available
			if (this.panelType === 'current') {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.path.endsWith('.md')) {
					const filenameEl = header.createEl('div', { cls: 'seo-filename' });
					filenameEl.textContent = `Analyzed note: ${activeFile.path}`;
				}
			}

			// Action button at the top
			if (this.panelType === 'current') {
				const checkCurrentBtn = containerEl.createEl('button', { 
					text: 'Check Current Note',
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
							new Notice('Current note analysis complete!');
						}
					} catch (error) {
						console.error('Error checking current note:', error);
						new Notice('Error analyzing current note. Check console for details.');
					} finally {
						checkCurrentBtn.textContent = 'Check Current Note';
						checkCurrentBtn.disabled = false;
					}
				});
			} else {
				const checkAllBtn = containerEl.createEl('button', { 
					text: 'Check All Notes',
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
						new Notice(`Analysis complete! Checked ${results.length} files.`);
					} catch (error) {
						console.error('Error checking all notes:', error);
						new Notice('Error analyzing files. Check console for details.');
					} finally {
						checkAllBtn.textContent = 'Check All Notes';
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
					noResults.createEl('p', { text: 'No current note analysis available' });
					noResults.createEl('p', { text: 'Open a markdown file and click "Check Current Note" to analyze it.' });
				}
			} else {
				if (this.globalResults.length > 0) {
					this.renderGlobalResults(containerEl);
				} else {
					const noGlobal = containerEl.createEl('div', { cls: 'seo-no-results' });
					noGlobal.createEl('p', { text: 'No global analysis available' });
					noGlobal.createEl('p', { text: 'Click "Check All Notes" to analyze all files in your configured directories.' });
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
		scoreEl.createEl('span', { text: `Overall Score: ${results.overallScore}%` });
		
		if (results.issuesCount > 0 || results.warningsCount > 0) {
			scoreEl.createEl('span', { 
				text: ` (${results.issuesCount} issues, ${results.warningsCount} warnings)`,
				cls: 'seo-issues'
			});
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
			
			const checkEl = checksContainer.createEl('div', { cls: 'seo-check' });
			const header = checkEl.createEl('div', { cls: 'seo-check-header' });
			
			// Convert camelCase to sentence case
			const displayName = checkName.replace(/([A-Z])/g, ' $1').trim()
				.replace(/^./, str => str.toUpperCase());
			
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
				statusIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>';
			}

			// Results
			const resultsList = checkEl.createEl('ul', { cls: 'seo-results' });
			checkResults.forEach(result => {
				const li = resultsList.createEl('li', { 
					cls: `seo-result seo-${result.severity}`,
					text: result.message
				});
				
				if (result.suggestion) {
					li.createEl('div', { 
						text: result.suggestion,
						cls: 'seo-suggestion'
					});
				}
			});
		});
	}

	private renderGlobalResults(container: HTMLElement) {
		const summary = container.createEl('div', { cls: 'seo-summary' });
		
		const totalFiles = this.globalResults.length;
		const totalIssues = this.globalResults.reduce((sum, r) => sum + r.issuesCount, 0);
		const totalWarnings = this.globalResults.reduce((sum, r) => sum + r.warningsCount, 0);
		const avgScore = Math.round(
			this.globalResults.reduce((sum, r) => sum + r.overallScore, 0) / totalFiles
		);

		summary.createEl('p', { text: `Analyzed ${totalFiles} files` });
		summary.createEl('p', { text: `Average score: ${avgScore}%` });
		summary.createEl('p', { text: `Total issues: ${totalIssues}, warnings: ${totalWarnings}` });

		// Files with issues
		const issuesFiles = this.globalResults.filter(r => r.issuesCount > 0 || r.warningsCount > 0);
		if (issuesFiles.length > 0) {
			const issuesList = container.createEl('div', { cls: 'seo-issues-list' });
			issuesList.createEl('h4', { text: 'Files with Issues', cls: 'seo-issues-header' });
			
			issuesFiles.forEach(result => {
				const fileEl = issuesList.createEl('div', { cls: 'seo-file-issue' });
				
				// Make file path clickable
				const fileLink = fileEl.createEl('a', { 
					text: result.file,
					cls: 'seo-file-link',
					href: '#'
				});
				fileLink.addEventListener('click', (e) => {
					e.preventDefault();
					const file = this.app.vault.getAbstractFileByPath(result.file);
					if (file) {
						this.app.workspace.openLinkText(result.file, '', true);
					}
				});
				
				fileEl.createEl('span', { 
					text: `${result.issuesCount} issues, ${result.warningsCount} warnings`,
					cls: 'seo-file-stats'
				});
			});
		}
	}
}
