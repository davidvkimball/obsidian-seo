import { Plugin, ItemView, WorkspaceLeaf, TFile, TFolder, Notice } from "obsidian";
import { SEOSettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";
import { SEOSettingTab } from "./settings-tab";
import { SEOSidePanel, SEOPanelViewType, SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./ui/side-panel";

export default class SEOPlugin extends Plugin {
	settings: SEOSettings;
	// Status bar removed

	async onload() {
		await this.loadSettings();

		// Force icon refresh by clearing any cached icon data
		this.forceIconRefresh();

		// Register the side panel views
		this.registerView(SEOCurrentPanelViewType, (leaf) => {
			const panel = new SEOSidePanel(this, 'current', leaf);
			return panel;
		});
		this.registerView(SEOGlobalPanelViewType, (leaf) => {
			const panel = new SEOSidePanel(this, 'global', leaf);
			return panel;
		});

		// Register commands
		registerCommands(this);

		// Add settings tab
		this.addSettingTab(new SEOSettingTab(this.app, this));

		// Status bar removed

		// Register real-time checking for current note
		this.registerRealTimeChecking();

		// Add ribbon icon for easy access (default to global)
		this.addRibbonIcon('search-check', 'Open SEO Global Panel', () => {
			this.openGlobalPanel();
		});

		// Use onLayoutReady for better timing of icon refresh
		this.app.workspace.onLayoutReady(() => {
			this.forceIconRefresh();
		});
	}

	onunload() {
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

	public addStatusBar() {
		// Status bar removed - not useful
	}

	public removeStatusBar() {
		// Status bar removed
	}

	openCurrentPanel() {
		this.openPanel(SEOCurrentPanelViewType, 'current');
	}

	openGlobalPanel() {
		this.openPanel(SEOGlobalPanelViewType, 'global');
	}

	private openPanel(viewType: string, panelType: 'current' | 'global') {
		// Try to find existing panel first
		const existingLeaf = this.app.workspace.getLeavesOfType(viewType)[0];
		if (existingLeaf) {
			// If panel exists, just reveal it and make it active
			this.app.workspace.revealLeaf(existingLeaf);
			this.app.workspace.setActiveLeaf(existingLeaf);
			
			// Force icon refresh for existing panel using onLayoutReady
			if (existingLeaf.view instanceof SEOSidePanel) {
				this.app.workspace.onLayoutReady(() => {
					(existingLeaf.view as SEOSidePanel).forceIconRefresh();
				});
			}
		} else {
			// Create new panel in the right side
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				const panel = new SEOSidePanel(this, panelType, leaf);
				leaf.open(panel);
				this.app.workspace.setActiveLeaf(leaf);
				
				// Force icon refresh for new panel using onLayoutReady
				this.app.workspace.onLayoutReady(() => {
					panel.forceIconRefresh();
				});
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
			return;
		}

		// Status bar removed

		try {
			// Run SEO check on current note
			const { runSEOCheck } = await import("./seo-checker");
			const results = await runSEOCheck(this, [activeFile]);
			
			// Results will be displayed when panels are opened
			
		} catch (error) {
			console.error('Error checking current note:', error);
		}
	}

	// Status bar methods removed

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

	// Force icon refresh to handle Obsidian's icon caching issues
	private forceIconRefresh() {
		// Approach 1: Force a DOM refresh by temporarily modifying and restoring the workspace
		const workspaceEl = this.app.workspace.containerEl;
		if (workspaceEl) {
			// Trigger a reflow to clear any cached icon data
			workspaceEl.style.display = 'none';
			workspaceEl.offsetHeight; // Force reflow
			workspaceEl.style.display = '';
		}
		
		// Approach 2: Force refresh of any existing panels
		const existingCurrentPanels = this.app.workspace.getLeavesOfType(SEOCurrentPanelViewType);
		const existingGlobalPanels = this.app.workspace.getLeavesOfType(SEOGlobalPanelViewType);
		
		[...existingCurrentPanels, ...existingGlobalPanels].forEach(leaf => {
			if (leaf.view instanceof SEOSidePanel) {
				// Force a re-render to refresh the icon
				leaf.view.render();
			}
		});
		
		// Approach 3: Force icon registration by creating a temporary element
		this.registerIconProperly();
	}

	// Register icon properly to ensure it's available in Obsidian's icon system
	private registerIconProperly() {
		// Approach 1: Create a temporary element to force icon registration
		const tempEl = document.createElement('div');
		tempEl.setAttribute('data-icon', 'search-check');
		tempEl.style.display = 'none';
		document.body.appendChild(tempEl);
		
		// Force a reflow to ensure the icon is registered
		tempEl.offsetHeight;
		
		// Clean up
		document.body.removeChild(tempEl);
		
		// Approach 2: Force icon registration through Obsidian's icon system
		// This ensures the icon is properly registered in Obsidian's internal icon cache
		const iconContainer = this.app.workspace.containerEl.querySelector('.workspace-tabs');
		if (iconContainer) {
			const iconEl = document.createElement('div');
			iconEl.setAttribute('data-icon', 'search-check');
			iconEl.style.display = 'none';
			iconContainer.appendChild(iconEl);
			iconEl.offsetHeight; // Force reflow
			iconContainer.removeChild(iconEl);
		}
	}
}
