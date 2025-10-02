import { Plugin, ItemView, WorkspaceLeaf, TFile, TFolder, Notice } from "obsidian";
import { SEOSettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";
import { SEOSettingTab } from "./settings-tab";
import { SEOSidePanel, SEOPanelViewType, SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./ui/side-panel";

export default class SEOPlugin extends Plugin {
	settings: SEOSettings;
	statusBarEl: HTMLElement | null = null;

	async onload() {
		await this.loadSettings();

		// Register the side panel views
		this.registerView(SEOCurrentPanelViewType, (leaf) => new SEOSidePanel(this, 'current', leaf));
		this.registerView(SEOGlobalPanelViewType, (leaf) => new SEOSidePanel(this, 'global', leaf));

		// Register commands
		registerCommands(this);

		// Add settings tab
		this.addSettingTab(new SEOSettingTab(this.app, this));

		// Add status bar if enabled
		if (this.settings.showStatusBar) {
			this.addStatusBar();
		}

		// Register real-time checking for current note
		this.registerRealTimeChecking();

		// Add ribbon icon for easy access (default to global)
		this.addRibbonIcon('search-check', 'Open SEO Global Panel', () => {
			this.openGlobalPanel();
		});
	}

	onunload() {
		// Clean up status bar
		if (this.statusBarEl) {
			this.statusBarEl.remove();
			this.statusBarEl = null;
		}
		
		// Note: Obsidian automatically cleans up:
		// - Registered views (registerView)
		// - Registered commands (addCommand) 
		// - Settings tabs (addSettingTab)
		// - Ribbon icons (addRibbonIcon)
		// - Registered events (registerEvent)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private addStatusBar() {
		if (this.statusBarEl) return;

		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.setText('SEO: Ready');
		this.statusBarEl.addClass('seo-status-bar');
		
		// Add click handler to open panel
		this.statusBarEl.addEventListener('click', () => {
			this.openGlobalPanel();
		});
	}

	private removeStatusBar() {
		if (this.statusBarEl) {
			this.statusBarEl.remove();
			this.statusBarEl = null;
		}
	}

	openCurrentPanel() {
		// Try to find existing current panel first
		const existingLeaf = this.app.workspace.getLeavesOfType(SEOCurrentPanelViewType)[0];
		if (existingLeaf) {
			// If panel exists, just reveal it and make it active
			this.app.workspace.revealLeaf(existingLeaf);
			this.app.workspace.setActiveLeaf(existingLeaf);
		} else {
			// Create new panel in the right side
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				leaf.open(new SEOSidePanel(this, 'current', leaf));
				this.app.workspace.setActiveLeaf(leaf);
			}
		}
	}

	openGlobalPanel() {
		// Try to find existing global panel first
		const existingLeaf = this.app.workspace.getLeavesOfType(SEOGlobalPanelViewType)[0];
		if (existingLeaf) {
			// If panel exists, just reveal it and make it active
			this.app.workspace.revealLeaf(existingLeaf);
			this.app.workspace.setActiveLeaf(existingLeaf);
		} else {
			// Create new panel in the right side
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				leaf.open(new SEOSidePanel(this, 'global', leaf));
				this.app.workspace.setActiveLeaf(leaf);
			}
		}
	}

	private registerRealTimeChecking() {
		// Debounced checking for current note
		let timeoutId: number;
		
		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				clearTimeout(timeoutId);
				timeoutId = window.setTimeout(() => {
					this.checkCurrentNote();
				}, 2000); // 2 second debounce
			})
		);
	}

	async checkCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !activeFile.path.endsWith('.md')) {
			if (this.statusBarEl) {
				this.statusBarEl.setText('SEO: Ready');
			}
			return;
		}

		// Update status bar
		if (this.statusBarEl) {
			this.statusBarEl.setText('SEO: Checking...');
		}

		try {
			// Run SEO check on current note
			const { runSEOCheck } = await import("./seo-checker");
			const results = await runSEOCheck(this, [activeFile]);
			
			// Results will be displayed when panels are opened
			
			// Update status bar with results
			if (this.statusBarEl) {
				this.statusBarEl.setText('SEO: ✓');
			}
		} catch (error) {
			console.error('Error checking current note:', error);
			if (this.statusBarEl) {
				this.statusBarEl.setText('SEO: Error');
			}
		}
	}

	// Public method to update status bar from external calls
	updateStatusBar(status: string) {
		if (this.statusBarEl) {
			this.statusBarEl.setText(`SEO: ${status}`);
		}
	}

	// Public method for bulk checking
	async runBulkCheck() {
		const { runSEOCheck } = await import("./seo-checker");
		const files = await this.getFilesToCheck();
		if (files.length === 0) {
			new Notice('No markdown files found in configured directories.');
			return;
		}
		
		try {
			const results = await runSEOCheck(this, files);
			
			// Results will be displayed when panels are opened
		} catch (error) {
			console.error('Error running bulk check:', error);
			new Notice('Error running SEO check. Check console for details.');
		}
	}

	// Public method to get files to check
	async getFilesToCheck(): Promise<TFile[]> {
		const { vault } = this.app;
		const { scanDirectories } = this.settings;
		
		if (!scanDirectories.trim()) {
			// Scan all markdown files
			return vault.getMarkdownFiles();
		}
		
		const directories = scanDirectories.split(',').map(dir => dir.trim());
		const files: TFile[] = [];
		
		for (const dir of directories) {
			const folder = vault.getAbstractFileByPath(dir);
			if (folder && folder instanceof TFolder) {
				files.push(...vault.getMarkdownFiles().filter(file => 
					file.path.startsWith(dir + '/') || file.path === dir
				));
			}
		}
		
		return files;
	}
}
