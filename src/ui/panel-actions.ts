import { App, Notice, setIcon, Menu } from "obsidian";
import { SEOResults } from "../types";
import { sortFiles } from "./panel-utils";
import { SEOCurrentPanelViewType } from "./panel-constants";

export class PanelActions {
	constructor(
		private app: App,
		private plugin: any,
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

	async checkCurrentNote(): Promise<SEOResults | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !activeFile.path.endsWith('.md')) {
			new Notice('Please open a markdown file first.');
			return null;
		}

		try {
			// Clear cache first to ensure fresh results
			const { clearCacheForFile } = await import("../seo-checker");
			clearCacheForFile(activeFile.path);
			
			// Import and run SEO check directly
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, [activeFile]);
			
			if (results.length > 0) {
				new Notice('SEO audit complete.');
				return results[0];
			}
			return null;
		} catch (error) {
			console.error('Error checking current note:', error);
			new Notice('Error analyzing current note. Check console for details.');
			return null;
		}
	}

	async checkExternalLinks(): Promise<SEOResults | null> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !activeFile.path.endsWith('.md')) {
			new Notice('Please open a markdown file first.');
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
				return results[0];
			}
			return null;
		} catch (error) {
			console.error('Error checking external links:', error);
			new Notice('Error checking external links. Check console for details.');
			return null;
		}
	}

	async refreshGlobalResults(): Promise<SEOResults[]> {
		try {
			// Clear cache first to ensure fresh results
			const { clearAllCache } = await import("../seo-checker");
			clearAllCache();
			
			// Get files to check
			const files = await this.plugin.getFilesToCheck();
			if (files.length === 0) {
				new Notice('No markdown files found in configured directories.');
				return [];
			}
			
			// Show notification for large scans
			if (files.length > 20) {
				new Notice(`Refreshing SEO audit on ${files.length} files... This may take a moment.`);
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
			console.error('Error checking all notes:', error);
			new Notice('Error analyzing files. Check console for details.');
			return [];
		}
	}

	async openFile(filePath: string): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file) {
				// Try different methods to work around plugin conflicts
				try {
					// Method 1: Use getLeaf and open
					const leaf = this.app.workspace.getLeaf();
					await leaf.openFile(file as any);
				} catch (error) {
					// Method 2: Fallback to openLinkText
					await this.app.workspace.openLinkText(filePath, '', true);
				}
			}
		} catch (error) {
			console.error(`Error opening file ${filePath}:`, error);
		}
	}

	async openFileAndAudit(filePath: string): Promise<void> {
		// Get the file object
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file) return;
		
		// Open the file directly using workspace
		await this.app.workspace.getLeaf().openFile(file as any);
		
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

	showSortMenu(event: MouseEvent, issuesFiles: SEOResults[], issuesList: HTMLElement, currentSort: string, onSortChange: (sortType: string) => void, settings?: any): void {
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

	private sortAndRenderFiles(issuesFiles: SEOResults[], issuesList: HTMLElement, sortType: string, settings?: any): void {
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

	private renderFilesList(files: SEOResults[], container: HTMLElement, settings?: any): void {
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
				this.openFile(result.file);
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
			auditBtn.addEventListener('click', async (e) => {
				e.preventDefault();
				e.stopPropagation();
				await this.openFileAndAudit(result.file);
			});
		});
	}

	private getDisplayPath(fullPath: string): string {
		const parts = fullPath.split('/');
		if (parts.length <= 2) {
			return fullPath; // Return as-is if no parent folder
		}
		return parts.slice(-2).join('/'); // Return last two parts (parent folder + file name)
	}
}
