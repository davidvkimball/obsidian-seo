import { App, Notice, setIcon, Menu } from "obsidian";
import { SEOResults } from "../types";
import { SEOCurrentPanelViewType } from "./panel-constants";
import { sortFiles } from "./panel-utils";

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
			
			// Import and run SEO check directly
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, files);
			
			// Save results to settings
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

	async refreshGlobalResults(): Promise<SEOResults[]> {
		try {
			// Get files to check
			const files = await this.plugin.getFilesToCheck();
			if (files.length === 0) {
				new Notice('No markdown files found in configured directories.');
				return [];
			}
			
			// Import and run SEO check directly
			const { runSEOCheck } = await import("../seo-checker");
			const results = await runSEOCheck(this.plugin, files);
			
			// Save results to settings
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

	openFile(filePath: string): void {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file) {
			// Check if file is already open, if so switch to it, otherwise open new tab
			const existingLeaf = this.app.workspace.getLeavesOfType('markdown').find(leaf => 
				leaf.view.getState().file === filePath
			);
			if (existingLeaf) {
				this.app.workspace.setActiveLeaf(existingLeaf);
			} else {
				this.app.workspace.openLinkText(filePath, '', true);
			}
		}
	}

	openFileAndAudit(filePath: string): void {
		this.openFile(filePath);
		
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

	showSortMenu(event: MouseEvent, issuesFiles: SEOResults[], issuesList: HTMLElement, currentSort: string, onSortChange: (sortType: string) => void): void {
		const menu = new Menu();
		
		// Warnings (high to low)
		menu.addItem((item) => {
			item.setTitle('Warnings (high to low)')
				.onClick(() => {
					onSortChange('warnings-desc');
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => b.warningsCount - a.warningsCount);
				});
			if (currentSort === 'warnings-desc') {
				item.setIcon('check');
			}
		});
		
		// Warnings (low to high)
		menu.addItem((item) => {
			item.setTitle('Warnings (low to high)')
				.onClick(() => {
					onSortChange('warnings-asc');
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => a.warningsCount - b.warningsCount);
				});
			if (currentSort === 'warnings-asc') {
				item.setIcon('check');
			}
		});
		
		// Divider
		menu.addSeparator();
		
		// Issues (high to low)
		menu.addItem((item) => {
			item.setTitle('Issues (high to low)')
				.onClick(() => {
					onSortChange('issues-desc');
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => b.issuesCount - a.issuesCount);
				});
			if (currentSort === 'issues-desc') {
				item.setIcon('check');
			}
		});
		
		// Issues (low to high)
		menu.addItem((item) => {
			item.setTitle('Issues (low to high)')
				.onClick(() => {
					onSortChange('issues-asc');
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => a.issuesCount - b.issuesCount);
				});
			if (currentSort === 'issues-asc') {
				item.setIcon('check');
			}
		});
		
		// Divider
		menu.addSeparator();
		
		// File name (A to Z)
		menu.addItem((item) => {
			item.setTitle('File name (A to Z)')
				.onClick(() => {
					onSortChange('filename-asc');
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => {
						const aFileName = a.file.split('/').pop() || '';
						const bFileName = b.file.split('/').pop() || '';
						const fileNameCompare = aFileName.localeCompare(bFileName);
						if (fileNameCompare !== 0) return fileNameCompare;
						return a.file.localeCompare(b.file);
					});
				});
			if (currentSort === 'filename-asc') {
				item.setIcon('check');
			}
		});
		
		// File name (Z to A)
		menu.addItem((item) => {
			item.setTitle('File name (Z to A)')
				.onClick(() => {
					onSortChange('filename-desc');
					this.sortAndRenderFiles(issuesFiles, issuesList, (a, b) => {
						const aFileName = a.file.split('/').pop() || '';
						const bFileName = b.file.split('/').pop() || '';
						const fileNameCompare = bFileName.localeCompare(aFileName);
						if (fileNameCompare !== 0) return fileNameCompare;
						return b.file.localeCompare(a.file);
					});
				});
			if (currentSort === 'filename-desc') {
					item.setIcon('check');
				}
		});
		
		menu.showAtPosition({ x: event.clientX, y: event.clientY });
	}

	private sortAndRenderFiles(issuesFiles: SEOResults[], issuesList: HTMLElement, sortFn: (a: SEOResults, b: SEOResults) => number): void {
		// Sort the array
		const sortedFiles = [...issuesFiles].sort(sortFn);
		
		// Find the files list container
		const filesListContainer = issuesList.querySelector('.seo-files-list-container');
		if (!filesListContainer) return;
		
		// Clear existing file items
		filesListContainer.querySelectorAll('.seo-file-issue').forEach(el => el.remove());
		
		// Re-render sorted files
		this.renderFilesList(sortedFiles, filesListContainer as HTMLElement);
	}

	private renderFilesList(files: SEOResults[], container: HTMLElement): void {
		files.forEach(result => {
			const fileEl = container.createEl('div', { cls: 'seo-file-issue' });
			fileEl.setAttribute('data-file-path', result.file);
			
			// Make file path clickable
			const fileLink = fileEl.createEl('a', { 
				text: this.getDisplayPath(result.file),
				cls: 'seo-file-link',
				href: '#'
			});
			fileLink.addEventListener('click', (e) => {
				e.preventDefault();
				this.openFile(result.file);
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
			auditBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.openFileAndAudit(result.file);
			});
		});
	}

	private getDisplayPath(fullPath: string): string {
		const parts = fullPath.split('/');
		if (parts.length <= 2) {
			return fullPath; // Return as-is if no parent folder
		}
		return parts.slice(-2).join('/'); // Return last two parts (parent folder + filename)
	}
}
