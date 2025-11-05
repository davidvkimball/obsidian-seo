import { Plugin, Notice, TFile } from "obsidian";
import { SEOSettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";
import { SEOSettingTab } from "./settings-tab";
import { SEOSidePanel } from "./ui/side-panel";
import { SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./ui/panel-constants";
import { PanelManager } from "./ui/panel-manager";
import { handleError, withErrorHandling, validateRequiredParams } from "./utils/error-handler";
import { seoCache, clearAllCache } from "./utils/cache-manager";

interface SEOPanelView {
	actions: any;
	render(): void;
}

/**
 * Main SEO Plugin class for Obsidian
 * Provides SEO auditing capabilities for markdown notes
 */
export default class SEOPlugin extends Plugin {
	settings!: SEOSettings;
	private panelManager: PanelManager | null = null;
	public sidePanel: SEOSidePanel | null = null;

	/**
	 * Plugin initialization - called when the plugin is loaded
	 * Sets up managers, registers views, and commands
	 */
	async onload() {
		try {
			await this.loadSettings();

			// Validate required parameters
			validateRequiredParams(
				{ app: this.app, settings: this.settings },
				'plugin initialization'
			);

			// Initialize managers with error handling
			this.panelManager = await withErrorHandling(
				() => Promise.resolve(new PanelManager(this.app, this)),
				'panel manager initialization',
				null
			);


			// Ensure icons load properly using Obsidian's API
			this.forceIconRefresh();

			// Register the side panel views with error handling
			await withErrorHandling(
				async () => {
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
				},
				'side panel registration',
				undefined
			);

			// Register commands with error handling
			await withErrorHandling(
				async () => {
					registerCommands(this);
				},
				'command registration',
				undefined
			);

			// Add settings tab with error handling
			await withErrorHandling(
				async () => {
					this.addSettingTab(new SEOSettingTab(this.app, this));
				},
				'settings tab registration',
				undefined
			);


			// Add ribbon icon for easy access (default to global) with error handling
			await withErrorHandling(
				async () => {
					this.addRibbonIcon('search-check', 'Open SEO audit panel', async () => {
						try {
							// Check if panel already exists
							const existingPanels = this.app.workspace.getLeavesOfType('seo-global-panel');
							const isFirstRun = existingPanels.length === 0;
							
							this.openGlobalPanel();
							
							// Only trigger manual refresh if panel already existed (not first run)
							if (!isFirstRun) {
								setTimeout(async () => {
									try {
										const globalPanels = this.app.workspace.getLeavesOfType('seo-global-panel');
										if (globalPanels.length > 0) {
											const panel = globalPanels[0];
											if (panel?.view) {
												// Cast to SEOSidePanel and trigger refresh
												const seoPanel = panel.view as unknown as SEOPanelView;
												// Trigger the refresh logic (same as clicking the refresh button)
												await seoPanel.actions.refreshGlobalResults();
												// Update the panel display with new results
												seoPanel.render();
											}
										}
									} catch (error) {
										handleError(error, 'ribbon icon panel refresh', true);
									}
								}, 500);
							}
							// If first run, let the panel's onOpen() handle the initial scan automatically
						} catch (error) {
							handleError(error, 'ribbon icon click handler', true);
						}
					});
				},
				'ribbon icon registration',
				undefined
			);
		} catch (error) {
			handleError(error, 'plugin initialization', true);
		}
	}

	onunload() {
		try {
			// Clean up cache managers
			seoCache.destroy();
		} catch (error) {
			handleError(error, 'plugin unload', false);
		}
		
		// Note: Obsidian automatically cleans up:
		// - Registered views (registerView)
		// - Registered commands (addCommand) 
		// - Settings tabs (addSettingTab)
		// - Ribbon icons (addRibbonIcon)
		// - Registered events (registerEvent)
	}

	/**
	 * Load plugin settings from Obsidian's data store
	 * Merges saved settings with default values
	 */
	async loadSettings() {
		try {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		} catch (error) {
			handleError(error, 'loading settings', true);
			// Fallback to default settings
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	/**
	 * Save plugin settings to Obsidian's data store
	 * Clears cache to ensure fresh results after settings changes
	 */
	async saveSettings() {
		try {
			await this.saveData(this.settings);
			// Clear cache when settings change to ensure fresh results
			clearAllCache();
		} catch (error) {
			handleError(error, 'saving settings', true);
		}
	}

	public addStatusBar() {
		// Status bar removed - not useful
	}

	public removeStatusBar() {
		// Status bar removed
	}

	/**
	 * Opens the current note SEO audit panel
	 * Shows SEO analysis for the currently active note
	 */
	openCurrentPanel() {
		try {
			if (this.panelManager) {
				this.panelManager.openCurrentPanel();
			} else {
				throw new Error('Panel manager not initialized');
			}
		} catch (error) {
			handleError(error, 'opening current panel', true);
		}
	}

	/**
	 * Opens the global vault SEO audit panel
	 * Shows SEO analysis for all notes in the vault
	 */
	openGlobalPanel() {
		try {
			if (this.panelManager) {
				this.panelManager.openGlobalPanel();
			} else {
				throw new Error('Panel manager not initialized');
			}
		} catch (error) {
			handleError(error, 'opening global panel', true);
		}
	}

	/**
	 * Runs bulk SEO check across all configured files
	 * @returns Promise that resolves when bulk check is complete
	 */
	async runBulkCheck() {
		try {
			const { runSEOCheck } = await import("./seo-checker");
			const files = await this.getFilesToCheck();
			if (files.length === 0) {
				return [];
			}
			
			const results = await runSEOCheck(this, files);
			return results;
		} catch (error) {
			handleError(error, 'running bulk check', true);
			return [];
		}
	}

	/**
	 * Gets the list of files to check based on current settings
	 * @returns Promise resolving to array of TFile objects to check
	 */
	async getFilesToCheck() {
		try {
			if (this.panelManager) {
				return await this.panelManager.getFilesToCheck();
			} else {
				throw new Error('Panel manager not initialized');
			}
		} catch (error) {
			handleError(error, 'getting files to check', true);
			return [];
		}
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
