/**
 * Panel rendering logic for SEO side panel
 * Handles the complex rendering of both current and global panels
 */

import { App, setIcon, TFile } from "obsidian";
import SEOPlugin from "../main";
import { SEOResults } from "../types";
import { getVaultFoldersInfo } from "./panel-utils";
import { PanelActions } from "./panel-actions";
import { ResultsDisplay } from "./results-display";
import { SEOSidePanel } from "./side-panel";
import { isSupportedFile } from "../utils/file-utils";
import { Notice } from "obsidian";
import { resultsToExportString, downloadExport, copyExportToClipboard } from "./csv-export";

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

			// Header: flex row with title left, icons right (when data exists)
			const header = containerEl.createEl('div', { cls: 'seo-panel-header' });
			const headerRow = header.createEl('div', { cls: 'seo-panel-header-row' });
			headerRow.createEl('h2', { text: panelType === 'current' ? 'SEO audit: current note' : 'SEO audit: vault' });

			if (panelType === 'global' && globalResults.length > 0) {
				this.renderHeaderIcons(headerRow, 'global', globalResults, null);
			} else if (panelType === 'current') {
				let activeFile = this.app.workspace.getActiveFile();
				// When the SEO panel is the active leaf on load, getActiveFile() is null; use any open markdown file
				if (!activeFile) {
					const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
					for (const leaf of markdownLeaves) {
						const file = (leaf.view as { file?: TFile })?.file;
						if (file) {
							activeFile = file;
							break;
						}
					}
				}
				const currentFileResults = activeFile && this.plugin.settings.cachedGlobalResults
					? this.plugin.settings.cachedGlobalResults.find(r => r.file === activeFile.path) ?? null
					: null;
				const resultsToShow = currentNoteResults || currentFileResults;
				const hasActiveFile = activeFile && isSupportedFile(activeFile, this.plugin.settings);
				if (resultsToShow || hasActiveFile) {
					this.renderHeaderIcons(headerRow, 'current', resultsToShow ? [resultsToShow] : [], resultsToShow ?? null);
				}
			}

			// Show current note file path or vault folders below header row
			if (panelType === 'current') {
				this.renderCurrentNoteHeader(header, currentNoteResults);
			} else {
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
				// False positive: Contains quoted text which is already in sentence case
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				noGlobal.createEl('p', { text: 'Click "Audit all notes" to audit your files in your configured directories.' });
			}
			}

		} catch (error) {
			console.error('Error rendering SEO panel:', error);
			// False positive: "SEO" is a proper noun (acronym) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			containerEl.createEl('div', { text: 'Error loading SEO panel. Please try again.' });
		}
	}

	/**
	 * Renders the current note header with file path
	 */
	private renderCurrentNoteHeader(header: HTMLElement, currentNoteResults: SEOResults | null) {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && isSupportedFile(activeFile, this.plugin.settings)) {
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
	 * Renders minimal header icons (download for vault; copy + download for current note).
	 */
	private renderHeaderIcons(
		headerRow: HTMLElement,
		panelType: 'global' | 'current',
		resultsForCsv: SEOResults[],
		singleNoteResult: SEOResults | null
	) {
		const wrap = headerRow.createEl('div', { cls: 'seo-header-icon-wrap' });
		if (panelType === 'current') {
			const copyBtn = wrap.createEl('button', { type: 'button', cls: 'seo-header-icon', attr: { 'aria-label': 'Copy results to clipboard' } });
			setIcon(copyBtn, 'lucide-copy');
			copyBtn.addEventListener('click', () => {
				if (!singleNoteResult) {
					new Notice('No results to export. Run Refresh first.');
					return;
				}
				const format = this.plugin.settings.exportFormat;
				const content = resultsToExportString(singleNoteResult, format);
				void copyExportToClipboard(content);
			});
			const downloadBtn = wrap.createEl('button', { type: 'button', cls: 'seo-header-icon', attr: { 'aria-label': 'Download results' } });
			setIcon(downloadBtn, 'lucide-download');
			downloadBtn.addEventListener('click', () => {
				if (!singleNoteResult) {
					new Notice('No results to export. Run Refresh first.');
					return;
				}
				const format = this.plugin.settings.exportFormat;
				const content = resultsToExportString(singleNoteResult, format);
				const base = singleNoteResult.file.replace(/\.[^.]+$/, '').replace(/[/\\]/g, '-') || 'note';
				downloadExport(content, `seo-audit-${base}`, format);
			});
		} else if (panelType === 'global' && resultsForCsv.length > 0) {
			const downloadBtn = wrap.createEl('button', { type: 'button', cls: 'seo-header-icon', attr: { 'aria-label': 'Download results' } });
			setIcon(downloadBtn, 'lucide-download');
			downloadBtn.addEventListener('click', () => {
				const format = this.plugin.settings.exportFormat;
				const content = resultsToExportString(resultsForCsv, format);
				downloadExport(content, 'seo-vault-audit', format);
			});
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
		auditCurrentBtn.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			void (async () => {
				await onRefreshClick(auditCurrentBtn);
			})();
		});

		// External links button (only show if enabled in settings and vault-wide is disabled)
		if (this.plugin.settings.enableExternalLinkButton && !this.plugin.settings.enableExternalLinkVaultCheck) {
			const externalLinksBtn = containerEl.createEl('button', { 
				text: 'Check external links for 404s',
				cls: 'seo-btn'
			});
			externalLinksBtn.addEventListener('click', () => {
				void (async () => {
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
				})();
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
			const fileTypeText = this.plugin.settings.enableMDXSupport ? 'markdown or MDX file' : 'markdown file';
			noResults.createEl('p', { text: `Open a ${fileTypeText} and click "Refresh" to audit it.` });
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

		// External links button (only show if enabled in settings and vault-wide is disabled)
		if (this.plugin.settings.enableExternalLinkButton && !this.plugin.settings.enableExternalLinkVaultCheck) {
			const externalLinksBtn = containerEl.createEl('button', {
				text: 'Check all 404s',
				cls: 'seo-btn'
			});
			externalLinksBtn.addEventListener('click', () => {
				void (async () => {
					externalLinksBtn.disabled = true;
					externalLinksBtn.textContent = 'Checking...';
					externalLinksBtn.addClass('seo-btn-disabled');

					try {
						const results = await this.actions.checkAllExternalLinks();
						if (results.length > 0) {
							// Dispatch completion event to update the panel
							containerEl.dispatchEvent(new CustomEvent('seo-refresh-complete', {
								detail: { results }
							}));
						}
					} finally {
						externalLinksBtn.disabled = false;
						externalLinksBtn.textContent = 'Check all 404s';
						externalLinksBtn.removeClass('seo-btn-disabled');
						externalLinksBtn.addClass('seo-btn-enabled');
					}
				})();
			});
		}
		refreshBtn.addEventListener('click', () => {
			void (async () => {
				// Check if this is a cancel operation
				if (refreshBtn.textContent === 'Cancel') {
					// Cancel the ongoing audit
					if (SEOSidePanel.globalAuditController) {
						SEOSidePanel.globalAuditController.abort();
						SEOSidePanel.globalAuditController = null;
						console.debug('Vault audit cancelled by user');
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
						console.debug('Vault audit cancelled in panel renderer');
						// Don't dispatch completion event for cancelled audits
					} else {
						console.error('Error in vault audit:', error);
					}
				} finally {
					refreshBtn.textContent = 'Refresh';
					refreshBtn.disabled = false;
				}
			})();
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
