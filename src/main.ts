import { Plugin, Notice } from "obsidian";
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

	async onload() {
		await this.loadSettings();

		// Initialize managers
		this.panelManager = new PanelManager(this.app, this);
		this.realTimeChecker = new RealTimeChecker(this.app, this);

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

		// Register real-time checking for current note
		this.realTimeChecker.registerRealTimeChecking();

		// Add ribbon icon for easy access (default to global)
		this.addRibbonIcon('search-check', 'Open SEO check panel', () => {
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
