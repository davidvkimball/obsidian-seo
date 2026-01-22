import { App, Notice, setIcon, Menu, TFile } from "obsidian";
import { SEOResults } from "../types";
import { SEOSettings } from "../settings";
import { sortFiles } from "./panel-utils";
import { SEOSidePanel } from "./side-panel";
import { isSupportedFile } from "../utils/file-utils";

import SEOPlugin from "../main";

export class PanelActions {
	constructor(
		private app: App,
		private plugin: SEOPlugin,
		private panelType: 'current' | 'global'
	) {}

	async runInitialScan(): Promise<SEOResults[]> {
		try {
			// Get files to check
			const files = await this.plugin.getFilesToCheck();
			if (files.length === 0) {
				return [];
			}
			
			// Show notification for large scans
			if (files.length > 20) {
				new Notice(`Running SEO audit on ${files.length} files... This may take a moment.`);
			}
			
			// Import and run SEO check directly
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, files);
			
			// Save results to settings for backward compatibility
			this.plugin.settings.cachedGlobalResults = results;
			this.plugin.settings.lastScanTimestamp = Date.now();
			await this.plugin.saveSettings();
			
			new Notice(`SEO audit complete with ${results.length} files.`);
			return results;
		} catch (error) {
			console.error('Error running initial scan:', error);
			new Notice('Error analyzing files. Check console for details.');
			return [];
		}
	}

	async checkCurrentNote(abortSignal?: AbortSignal): Promise<SEOResults | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !isSupportedFile(activeFile, this.plugin.settings)) {
			// False positive: Text is already in sentence case
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice('Please open a markdown or MDX file first.');
			return null;
		}

		try {
			// Clear cache first to ensure fresh results
			const { clearCacheForFile } = await import("../seo-checker");
			clearCacheForFile(activeFile.path);
			
			// Import and run SEO check directly
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, [activeFile], abortSignal ? { signal: abortSignal } as AbortController : undefined);
			
		if (results.length > 0) {
			// False positive: "SEO" is a proper noun (acronym) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice('SEO audit complete.');
			return results[0] || null;
		}
			return null;
		} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			// False positive: "SEO" is a proper noun (acronym) and should be capitalized
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice('SEO audit cancelled.');
			throw error; // Re-throw abort errors
		}
			console.error('Error checking current note:', error);
			new Notice('Error analyzing current note. Check console for details.');
			return null;
		}
	}

	async checkExternalLinks(): Promise<SEOResults | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !isSupportedFile(activeFile, this.plugin.settings)) {
			// False positive: Text is already in sentence case
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice('Please open a markdown or MDX file first.');
			return null;
		}

		try {
			// Temporarily enable external broken links checking and disable external links
			const originalVaultSetting = this.plugin.settings.enableExternalLinkVaultCheck;
			const originalExternalSetting = this.plugin.settings.checkExternalLinks;

			this.plugin.settings.enableExternalLinkVaultCheck = true;
			this.plugin.settings.checkExternalLinks = false; // Disable the notice-based check

			// Clear cache first to ensure fresh results
			const { clearCacheForFile } = await import("../seo-checker");
			clearCacheForFile(activeFile.path);

			// Import and run SEO check directly with external broken links enabled
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, [activeFile]);

			// Restore original settings
			this.plugin.settings.enableExternalLinkVaultCheck = originalVaultSetting;
			this.plugin.settings.checkExternalLinks = originalExternalSetting;

			if (results.length > 0) {
				new Notice('External links check complete.');
				return results[0] || null;
			}
			return null;
		} catch (error) {
			console.error('Error checking external links:', error);
			new Notice('Error checking external links. Check console for details.');
			return null;
		}
	}

	async checkAllExternalLinks(): Promise<SEOResults[]> {
		try {
			// Get files to check
			const files = await this.plugin.getFilesToCheck();
			if (files.length === 0) {
				const fileTypeText = this.plugin.settings.enableMDXSupport ? 'markdown or MDX files' : 'markdown files';
				new Notice(`No ${fileTypeText} found in configured directories.`);
				return [];
			}

			// Temporarily enable external broken links checking and disable external links
			const originalVaultSetting = this.plugin.settings.enableExternalLinkVaultCheck;
			const originalExternalSetting = this.plugin.settings.checkExternalLinks;

			this.plugin.settings.enableExternalLinkVaultCheck = true;
			this.plugin.settings.checkExternalLinks = false; // Disable the notice-based check

			// Clear cache first to ensure fresh results
			const { clearAllCache } = await import("../seo-checker");
			clearAllCache();

			// Show notification for large scans
			if (files.length > 20) {
				new Notice(`Checking external links for 404s on ${files.length} files... This may take a moment.`);
			}

			// Import and run SEO check directly with external broken links enabled
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, files);

			// Restore original settings
			this.plugin.settings.enableExternalLinkVaultCheck = originalVaultSetting;
			this.plugin.settings.checkExternalLinks = originalExternalSetting;

			// Save results to settings for backward compatibility
			this.plugin.settings.cachedGlobalResults = results;
			this.plugin.settings.lastScanTimestamp = Date.now();
			await this.plugin.saveSettings();

			new Notice(`External links check complete with ${results.length} files.`);
			return results;
		} catch (error) {
			console.error('Error checking all external links:', error);
			new Notice('Error checking external links. Check console for details.');
			return [];
		}
	}

	async refreshGlobalResults(abortSignal?: AbortSignal): Promise<SEOResults[]> {
		let auditNotice: Notice | null = null;
		
		try {
			// Clear cache first to ensure fresh results
			const { clearAllCache } = await import("../seo-checker");
			clearAllCache();
			
			// Get files to check
		const files = await this.plugin.getFilesToCheck();
		if (files.length === 0) {
			const fileTypeText = this.plugin.settings.enableMDXSupport ? 'markdown or MDX files' : 'markdown files';
			new Notice(`No ${fileTypeText} found in configured directories.`);
			return [];
		}
			
			// Show persistent notification for large scans
			if (files.length > 20) {
				auditNotice = new Notice(`Refreshing SEO audit on ${files.length} files... This may take a moment.`, 0);
			}
			
			// Import and run SEO check directly
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, files, abortSignal ? { signal: abortSignal } as AbortController : undefined);
			
			// Save results to settings for backward compatibility
			this.plugin.settings.cachedGlobalResults = results;
			this.plugin.settings.lastScanTimestamp = Date.now();
			await this.plugin.saveSettings();
			
			// Dismiss the audit notice and show completion notice
			if (auditNotice) {
				auditNotice.hide();
			}
			new Notice(`SEO audit complete with ${results.length} files.`);
			return results;
		} catch (error) {
			// Dismiss the audit notice if it exists
			if (auditNotice) {
				auditNotice.hide();
			}
			
			if (error instanceof Error && error.name === 'AbortError') {
				console.debug('Vault audit cancelled by user');
				new Notice('Vault audit cancelled.');
				return [];
			}
			
			console.error('Error checking all notes:', error);
			new Notice('Error analyzing files. Check console for details.');
			return [];
		}
	}

	async openFile(filePath: string): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file && file instanceof TFile) {
				// Try different methods to work around plugin conflicts
				try {
					// Method 1: Use getLeaf and open
					const leaf = this.app.workspace.getLeaf();
					await leaf.openFile(file);
				} catch {
					// Method 2: Fallback to openLinkText
					await this.app.workspace.openLinkText(filePath, '', true);
				}
			} else {
				// File not found - show notification
				new Notice(`File not found: ${filePath}\nThis file may have been renamed or deleted.`);
			}
		} catch (error) {
			console.error(`Error opening file ${filePath}:`, error);
			new Notice(`Error opening file: ${filePath}`);
		}
	}

	async openFileAndAudit(filePath: string): Promise<void> {
		// Get the file object
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) {
			// File not found - show notification
			new Notice(`File not found: ${filePath}\nThis file may have been renamed or deleted.`);
			return;
		}
		
		// Open the file directly using workspace
		await this.app.workspace.getLeaf().openFile(file);
		
		// Open current note panel and wait for it to be fully ready
		this.plugin.openCurrentPanel();
		
		// Wait for the panel to be fully initialized and focused
		await new Promise<void>((resolve) => {
			const checkPanel = () => {
				const currentPanels = this.app.workspace.getLeavesOfType('seo-current-panel');
				if (currentPanels.length > 0) {
					const currentPanel = currentPanels[0];
					if (currentPanel && currentPanel.view) {
						// Focus the panel to ensure it's properly active
						this.app.workspace.setActiveLeaf(currentPanel);
						// Re-render to ensure it's in the correct state
						if (currentPanel.view instanceof SEOSidePanel) {
							currentPanel.view.render();
						}
						resolve();
					} else {
						// Panel not ready yet, check again
						setTimeout(checkPanel, 50);
					}
				} else {
					// Panel not found, check again
					setTimeout(checkPanel, 50);
				}
			};
			checkPanel();
		});

		// Now run the audit on the current note
		try {
			// Create abort controller for this audit if one doesn't exist
			if (!SEOSidePanel.globalAuditController) {
				SEOSidePanel.globalAuditController = new AbortController();
			}
			
			// Disable refresh button in current note panel if it exists
			// Wait a bit for the panel to be fully rendered
			await new Promise(resolve => setTimeout(resolve, 100));
			
			const currentPanels = this.app.workspace.getLeavesOfType('seo-current-panel');
			if (currentPanels.length > 0) {
				const currentPanel = currentPanels[0];
				if (currentPanel && currentPanel.view) {
					const refreshBtn = currentPanel.view.containerEl.querySelector('button[data-refresh-btn]') as HTMLButtonElement;
					if (refreshBtn) {
						refreshBtn.disabled = true;
						refreshBtn.textContent = 'Auditing...';
					}
				}
			}

			const results = await this.checkCurrentNote(SEOSidePanel.globalAuditController?.signal);
			if (results) {
				// Update the current note results in the panel
				if (this.plugin.sidePanel && this.plugin.sidePanel.panelType === 'current') {
					this.plugin.sidePanel.currentNoteResults = results;
					this.plugin.sidePanel.render();
				}
			}
		} catch (error) {
			console.error('Error running audit after opening file:', error);
		} finally {
			// Re-enable refresh button in current note panel
			const currentPanels = this.app.workspace.getLeavesOfType('seo-current-panel');
			if (currentPanels.length > 0) {
				const currentPanel = currentPanels[0];
				if (currentPanel && currentPanel.view) {
					const refreshBtn = currentPanel.view.containerEl.querySelector('button[data-refresh-btn]') as HTMLButtonElement;
					if (refreshBtn) {
						refreshBtn.disabled = false;
						refreshBtn.textContent = 'Refresh';
					}
				}
			}
		}
	}

	showSortMenu(event: MouseEvent, issuesFiles: SEOResults[], issuesList: HTMLElement, currentSort: string, onSortChange: (sortType: string) => void, settings?: SEOSettings): void {
		const menu = new Menu();
		
		// Check if notices should be shown (both potentially broken checks must be enabled)
		const showNotices = settings ? 
			(settings.checkPotentiallyBrokenLinks && settings.checkPotentiallyBrokenEmbeds) : 
			true;
		
		// If current sort is notices-related but notices are disabled, fall back to issues-desc
		// But only for display purposes - don't override the actual currentSort
		const displaySort = (!showNotices && (currentSort === 'notices-desc' || currentSort === 'notices-asc')) 
			? 'issues-desc' 
			: currentSort;
		
		// Issues (high to low) - DEFAULT
		menu.addItem((item) => {
			item.setTitle('Issues (high to low)')
				.onClick(() => {
					onSortChange('issues-desc');
					this.sortAndRenderFiles(issuesFiles, issuesList, 'issues-desc', settings);
				});
			if (displaySort === 'issues-desc') {
				item.setIcon('check');
			}
		});
		
		// Issues (low to high)
		menu.addItem((item) => {
			item.setTitle('Issues (low to high)')
				.onClick(() => {
					onSortChange('issues-asc');
					this.sortAndRenderFiles(issuesFiles, issuesList, 'issues-asc', settings);
				});
			if (displaySort === 'issues-asc') {
				item.setIcon('check');
			}
		});
		
		// Divider
		menu.addSeparator();
		
		// Warnings (high to low)
		menu.addItem((item) => {
			item.setTitle('Warnings (high to low)')
				.onClick(() => {
					onSortChange('warnings-desc');
					this.sortAndRenderFiles(issuesFiles, issuesList, 'warnings-desc', settings);
				});
			if (displaySort === 'warnings-desc') {
				item.setIcon('check');
			}
		});
		
		// Warnings (low to high)
		menu.addItem((item) => {
			item.setTitle('Warnings (low to high)')
				.onClick(() => {
					onSortChange('warnings-asc');
					this.sortAndRenderFiles(issuesFiles, issuesList, 'warnings-asc', settings);
				});
			if (displaySort === 'warnings-asc') {
				item.setIcon('check');
			}
		});
		
		// Divider
		menu.addSeparator();
		
		// Notices sorting options (only show if notices are enabled)
		if (showNotices) {
			// Notices (high to low)
			menu.addItem((item) => {
				item.setTitle('Notices (high to low)')
					.onClick(() => {
						onSortChange('notices-desc');
						this.sortAndRenderFiles(issuesFiles, issuesList, 'notices-desc', settings);
					});
				if (displaySort === 'notices-desc') {
					item.setIcon('check');
				}
			});
			
			// Notices (low to high)
			menu.addItem((item) => {
				item.setTitle('Notices (low to high)')
					.onClick(() => {
						onSortChange('notices-asc');
						this.sortAndRenderFiles(issuesFiles, issuesList, 'notices-asc', settings);
					});
				if (displaySort === 'notices-asc') {
					item.setIcon('check');
				}
			});
			
			// Divider
			menu.addSeparator();
		}
		
		// File name (A to Z)
		menu.addItem((item) => {
			// False positive: "(A to Z)" is a sorting indicator, not UI text
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			item.setTitle('File name (A to Z)')
				.onClick(() => {
					onSortChange('filename-asc');
					this.sortAndRenderFiles(issuesFiles, issuesList, 'filename-asc', settings);
				});
			if (displaySort === 'filename-asc') {
				item.setIcon('check');
			}
		});
		
		// File name (Z to A)
		menu.addItem((item) => {
			// False positive: "(Z to A)" is a sorting indicator, not UI text
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			item.setTitle('File name (Z to A)')
				.onClick(() => {
					onSortChange('filename-desc');
					this.sortAndRenderFiles(issuesFiles, issuesList, 'filename-desc', settings);
				});
			if (displaySort === 'filename-desc') {
				item.setIcon('check');
			}
		});
		
		menu.showAtPosition({ x: event.clientX, y: event.clientY });
	}

	private sortAndRenderFiles(issuesFiles: SEOResults[], issuesList: HTMLElement, sortType: string, settings?: SEOSettings): void {
		// Sort the array using the proper sorting function
		const sortedFiles = sortFiles([...issuesFiles], sortType);
		
		// Find the files list container
		const filesListContainer = issuesList.querySelector('.seo-files-list-container');
		if (!filesListContainer) return;
		
		// Clear existing file items
		filesListContainer.querySelectorAll('.seo-file-issue').forEach(el => el.remove());
		
		// Re-render sorted files
		this.renderFilesList(sortedFiles, filesListContainer as HTMLElement, settings);
	}

	private renderFilesList(files: SEOResults[], container: HTMLElement, settings?: SEOSettings): void {
		files.forEach(result => {
			const fileEl = container.createEl('div', { cls: 'seo-file-issue' });
			fileEl.setAttribute('data-file-path', result.file);
			
			// Make file path clickable
			const fileLink = fileEl.createEl('a', { 
				text: result.displayName || this.getDisplayPath(result.file),
				cls: 'seo-file-link',
				href: '#'
			});
			fileLink.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				void this.openFile(result.file);
			});
			
			// Stats and audit button container
			const statsContainer = fileEl.createEl('div', { cls: 'seo-stats-container' });
			
			// Check if notices should be shown
			const showNotices = settings ? 
				(settings.checkPotentiallyBrokenLinks && settings.checkPotentiallyBrokenEmbeds) : 
				true;
			
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
					await this.openFileAndAudit(result.file);
				})();
			});
		});
	}

	private getDisplayPath(fullPath: string): string {
		// Remove leading slash if present and split
		const cleanPath = fullPath.startsWith('/') ? fullPath.slice(1) : fullPath;
		const parts = cleanPath.split('/');
		if (parts.length <= 1) {
			return cleanPath; // Return as-is if no parent folder (just filename)
		}
		return parts.slice(-2).join('/'); // Return last two parts (parent folder + file name)
	}
}
