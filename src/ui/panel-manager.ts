import { App, TFile, TFolder } from "obsidian";
import SEOPlugin from "../main";
import { SEOSidePanel } from "./side-panel";
import { SEOCurrentPanelViewType, SEOGlobalPanelViewType } from "./panel-constants";

export class PanelManager {
	constructor(
		private app: App,
		private plugin: SEOPlugin
	) {}

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
			
			// Store reference for settings updates
			if (existingLeaf.view instanceof SEOSidePanel) {
				this.plugin.sidePanel = existingLeaf.view as SEOSidePanel;
			}
			
			// Ensure icon loads properly - use setTimeout for panel timing
			if (existingLeaf.view instanceof SEOSidePanel) {
				setTimeout(() => (existingLeaf.view as SEOSidePanel).forceIconRefresh(), 100);
			}
		} else {
			// Create new panel in the right side - use the simple, direct approach
			const leaf = this.app.workspace.getRightLeaf(false);
			
			if (leaf) {
				// Create the panel manually - this is the most reliable approach
				const panel = new SEOSidePanel(this.plugin, panelType, leaf);
				this.plugin.sidePanel = panel; // Store reference for settings updates
				leaf.open(panel);
				this.app.workspace.setActiveLeaf(leaf);
				
				// Ensure icon loads properly after opening
				setTimeout(() => {
					if (leaf.view instanceof SEOSidePanel) {
						(leaf.view as SEOSidePanel).forceIconRefresh();
					}
				}, 100);
			}
		}
	}

	async getFilesToCheck(): Promise<TFile[]> {
		const { vault } = this.app;
		const { scanDirectories, ignoreUnderscoreFiles } = this.plugin.settings;
		
		let files: TFile[];
		
		if (!scanDirectories.trim()) {
			// Scan all markdown files
			files = vault.getMarkdownFiles();
		} else {
			const directories = scanDirectories.split(',').map(dir => dir.trim());
			files = [];
			
			for (const dir of directories) {
				const folder = vault.getAbstractFileByPath(dir);
				if (folder && folder instanceof TFolder) {
					files.push(...vault.getMarkdownFiles().filter(file => 
						file.path.startsWith(dir + '/') || file.path === dir
					));
				}
			}
		}
		
		// Filter out files with underscore prefix if setting is enabled
		if (ignoreUnderscoreFiles) {
			files = files.filter(file => {
				const fileName = file.basename;
				return !fileName.startsWith('_');
			});
		}
		
		return files;
	}
}
