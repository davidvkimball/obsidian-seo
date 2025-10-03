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
				const panel = new SEOSidePanel(this.plugin, panelType, leaf);
				leaf.open(panel);
				this.app.workspace.setActiveLeaf(leaf);
				
				// Force icon refresh for new panel using onLayoutReady
				this.app.workspace.onLayoutReady(() => {
					panel.forceIconRefresh();
				});
			}
		}
	}

	async getFilesToCheck(): Promise<TFile[]> {
		const { vault } = this.app;
		const { scanDirectories } = this.plugin.settings;
		
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
