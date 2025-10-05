import { Plugin, Notice, TFile } from "obsidian";
import { SEOSettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";
import { SEOSettingTab } from "./settings-tab";
import { SEOSidePanel } from "./ui/side-panel";
import { SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./ui/panel-constants";
import { PanelManager } from "./ui/panel-manager";
import { RealTimeChecker } from "./real-time-checker";

export default class SEOPlugin extends Plugin {
	settings: SEOSettings;
	private panelManager: PanelManager;
	private realTimeChecker: RealTimeChecker;
	public sidePanel: SEOSidePanel | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize managers
		this.panelManager = new PanelManager(this.app, this);
		this.realTimeChecker = new RealTimeChecker(this.app, this);

		// Ensure icons load properly using Obsidian's API
		this.forceIconRefresh();

		// Register the side panel views
		this.registerView(SEOCurrentPanelViewType, (leaf) => {
			const panel = new SEOSidePanel(this, 'current', leaf);
			this.sidePanel = panel; // Store reference for settings updates
			return panel;
		});
		this.registerView(SEOGlobalPanelViewType, (leaf) => {
			const panel = new SEOSidePanel(this, 'global', leaf);
			this.sidePanel = panel; // Store reference for settings updates
			return panel;
		});

		// Register commands
		registerCommands(this);

		// Add settings tab
		this.addSettingTab(new SEOSettingTab(this.app, this));

		// Register real-time checking for current note
		this.realTimeChecker.registerRealTimeChecking();

		// Add ribbon icon for easy access (default to global)
		this.addRibbonIcon('search-check', 'Open SEO audit panel', async () => {
			// Check if panel already exists
			const existingPanels = this.app.workspace.getLeavesOfType('seo-global-panel');
			const isFirstRun = existingPanels.length === 0;
			
			this.openGlobalPanel();
			
			// Only trigger manual refresh if panel already existed (not first run)
			if (!isFirstRun) {
				setTimeout(async () => {
					const globalPanels = this.app.workspace.getLeavesOfType('seo-global-panel');
					if (globalPanels.length > 0) {
						const panel = globalPanels[0];
						if (panel.view) {
							// Cast to SEOSidePanel and trigger refresh
							const seoPanel = panel.view as any;
							// Trigger the refresh logic (same as clicking the refresh button)
							await seoPanel.actions.refreshGlobalResults();
							// Update the panel display with new results
							seoPanel.render();
						}
					}
				}, 500);
			}
			// If first run, let the panel's onOpen() handle the initial scan automatically
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
		// Clear cache when settings change to ensure fresh results
		const { clearAllCache } = await import("./seo-checker");
		clearAllCache();
	}

	public addStatusBar() {
		// Status bar removed - not useful
	}

	public removeStatusBar() {
		// Status bar removed
	}

	openCurrentPanel() {
		this.panelManager.openCurrentPanel();
	}

	openGlobalPanel() {
		this.panelManager.openGlobalPanel();
	}

	// Public method for bulk checking
	async runBulkCheck() {
		await this.realTimeChecker.runBulkCheck();
	}

	// Public method to get files to check
	async getFilesToCheck() {
		return this.panelManager.getFilesToCheck();
	}



	// Proper icon refresh using Obsidian's onLayoutReady API
	private forceIconRefresh() {
		// Use Obsidian's proper API to ensure icons load correctly
		this.app.workspace.onLayoutReady(() => {
			// Force refresh of any existing panels
			const existingCurrentPanels = this.app.workspace.getLeavesOfType(SEOCurrentPanelViewType);
			const existingGlobalPanels = this.app.workspace.getLeavesOfType(SEOGlobalPanelViewType);
			
			[...existingCurrentPanels, ...existingGlobalPanels].forEach(leaf => {
				if (leaf.view instanceof SEOSidePanel) {
					leaf.view.render();
				}
			});
		});
	}
}
