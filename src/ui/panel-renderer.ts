/**
 * Panel rendering logic for SEO side panel
 * Handles the complex rendering of both current and global panels
 */

import { App, TFile } from "obsidian";
import SEOPlugin from "../main";
import { SEOResults } from "../types";
import { getVaultFoldersInfo } from "./panel-utils";
import { PanelActions } from "./panel-actions";
import { ResultsDisplay } from "./results-display";
import { SEOSidePanel } from "./side-panel";

type SortType = 'issues-desc' | 'issues-asc' | 'warnings-desc' | 'warnings-asc' | 'notices-desc' | 'notices-asc' | 'filename-asc' | 'filename-desc';

export class PanelRenderer {
	constructor(
		private app: App,
		private plugin: SEOPlugin,
		private actions: PanelActions
	) {}

	/**
	 * Renders the main panel content
	 */
	render(
		containerEl: HTMLElement,
		panelType: 'current' | 'global',
		currentNoteResults: SEOResults | null,
		globalResults: SEOResults[],
		onRefreshClick: (btn: HTMLButtonElement) => Promise<void>,
		onExternalLinksClick: () => Promise<void>
	) {
		try {
			containerEl.empty();
			containerEl.addClass('seo-panel');

			// Header with proper spacing
			const header = containerEl.createEl('div', { cls: 'seo-panel-header' });
			header.createEl('h2', { text: panelType === 'current' ? 'SEO audit: current note' : 'SEO audit: vault' });

			// Show current note file path if available
			if (panelType === 'current') {
				this.renderCurrentNoteHeader(header, currentNoteResults);
			} else {
				// Show vault folders information for global panel
				const fileCount = globalResults.length;
				const foldersInfo = getVaultFoldersInfo(this.plugin.settings.scanDirectories, fileCount);
				const foldersEl = header.createEl('div', { cls: 'seo-filename' });
				foldersEl.textContent = foldersInfo;
			}

			// Action button at the top
			if (panelType === 'current') {
				this.renderCurrentNoteActions(containerEl, onRefreshClick, onExternalLinksClick);
			}

			// Content based on panel type
			if (panelType === 'current') {
				this.renderCurrentNoteContent(containerEl, currentNoteResults);
			} else {
				if (globalResults.length > 0) {
					this.renderGlobalResults(containerEl, globalResults);
				} else {
					const noGlobal = containerEl.createEl('div', { cls: 'seo-no-results' });
					noGlobal.createEl('p', { text: 'Click "Audit all notes" to audit your files in your configured directories.' });
				}
			}

		} catch (error) {
			console.error('Error rendering SEO panel:', error);
			containerEl.createEl('div', { text: 'Error loading SEO panel. Please try again.' });
		}
	}

	/**
	 * Renders the current note header with file path
	 */
	private renderCurrentNoteHeader(header: HTMLElement, currentNoteResults: SEOResults | null) {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.path.endsWith('.md')) {
			const filenameEl = header.createEl('div', { cls: 'seo-filename' });
			
			// Get the correct display name based on the current active file
			let displayName = activeFile.path;
			
			// If we have current note results for this specific file, use its display name
			if (currentNoteResults && currentNoteResults.file === activeFile.path) {
				displayName = currentNoteResults.displayName || activeFile.path;
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

	/**
	 * Renders action buttons for current note panel
	 */
	private renderCurrentNoteActions(
		containerEl: HTMLElement, 
		onRefreshClick: (btn: HTMLButtonElement) => Promise<void>,
		onExternalLinksClick: () => Promise<void>
	) {
		const auditCurrentBtn = containerEl.createEl('button', { 
			text: 'Refresh',
			cls: 'mod-cta seo-btn seo-top-btn',
			attr: { 'data-refresh-btn': 'true' }
		});
		
		// Use only click event to avoid double execution
		auditCurrentBtn.addEventListener('click', async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await onRefreshClick(auditCurrentBtn);
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
					await onExternalLinksClick();
				} finally {
					externalLinksBtn.disabled = false;
					externalLinksBtn.textContent = 'Check external links for 404s';
					externalLinksBtn.removeClass('seo-btn-disabled');
					externalLinksBtn.addClass('seo-btn-enabled');
				}
			});
		}
	}

	/**
	 * Renders current note content
	 */
	private renderCurrentNoteContent(containerEl: HTMLElement, currentNoteResults: SEOResults | null) {
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
		const resultsToShow = currentNoteResults || currentFileResults;
		if (resultsToShow) {
			// Create a new results container and render results
			const newResultsContainer = containerEl.createEl('div', { cls: 'seo-results-container' });
			
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
	}

	/**
	 * Renders global results with sorting and filtering
	 */
	private renderGlobalResults(containerEl: HTMLElement, globalResults: SEOResults[]) {
		// Create a temporary results display instance for global results
		const tempResultsDisplay = new ResultsDisplay(
			containerEl,
			async (filePath: string) => await this.actions.openFile(filePath),
			async (filePath: string) => await this.actions.openFileAndAudit(filePath)
		);
		
		// Render summary stats
		tempResultsDisplay.renderGlobalResults(globalResults, this.plugin.settings);

		// Add refresh button below stats
		const refreshBtn = containerEl.createEl('button', { 
			text: 'Refresh',
			cls: 'mod-cta seo-btn seo-refresh-btn',
			attr: { 'data-refresh-btn': 'true' }
		});
		refreshBtn.addEventListener('click', async () => {
			// Check if this is a cancel operation
			if (refreshBtn.textContent === 'Cancel') {
				// Cancel the ongoing audit
				if (SEOSidePanel.globalAuditController) {
					SEOSidePanel.globalAuditController.abort();
					SEOSidePanel.globalAuditController = null;
					console.log('Vault audit cancelled by user');
				}
				refreshBtn.textContent = 'Refresh';
				refreshBtn.disabled = false;
				return;
			}
			
			// Start new audit
			refreshBtn.textContent = 'Cancel';
			refreshBtn.disabled = false; // Keep enabled so user can cancel
			
			// Create abort controller for vault audit
			SEOSidePanel.globalAuditController = new AbortController();
			
			try {
				const results = await this.actions.refreshGlobalResults(SEOSidePanel.globalAuditController?.signal);
				if (results.length > 0) {
					// Only dispatch completion event if audit wasn't cancelled
					if (SEOSidePanel.globalAuditController && !SEOSidePanel.globalAuditController.signal.aborted) {
						containerEl.dispatchEvent(new CustomEvent('seo-refresh-complete', { 
							detail: { results } 
						}));
					}
				}
			} catch (error) {
				// Handle cancellation or other errors
				if (error instanceof Error && error.name === 'AbortError') {
					console.log('Vault audit cancelled in panel renderer');
					// Don't dispatch completion event for cancelled audits
				} else {
					console.error('Error in vault audit:', error);
				}
			} finally {
				refreshBtn.textContent = 'Refresh';
				refreshBtn.disabled = false;
			}
		});

		// Render issues list with sorting
		tempResultsDisplay.renderIssuesList(
			globalResults,
			this.plugin.settings.defaultSort,
			(sortType: string) => {
				// This will be handled by the calling code
				containerEl.dispatchEvent(new CustomEvent('seo-sort-change', { 
					detail: { sortType } 
				}));
			},
			(event: MouseEvent) => {
				// Check if notices should be shown
				const showNotices = this.plugin.settings.checkPotentiallyBrokenLinks && this.plugin.settings.checkPotentiallyBrokenEmbeds;
				const issuesFiles = globalResults.filter(r => {
					const hasIssues = r.issuesCount > 0;
					const hasWarnings = r.warningsCount > 0;
					const hasNotices = showNotices && r.noticesCount > 0;
					return hasIssues || hasWarnings || hasNotices;
				});
				this.actions.showSortMenu(event, issuesFiles, containerEl, this.plugin.settings.defaultSort, (sortType: string) => {
					containerEl.dispatchEvent(new CustomEvent('seo-sort-change', { 
						detail: { sortType } 
					}));
				}, this.plugin.settings);
			},
			this.plugin.settings
		);
	}
}
