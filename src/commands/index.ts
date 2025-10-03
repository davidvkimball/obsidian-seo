import { Plugin, Notice, TFile, TFolder } from "obsidian";
import SEOPlugin from "../main";
import { runSEOCheck } from "../seo-checker";

export function registerCommands(plugin: SEOPlugin) {
	// Open SEO Current Note panel and run audit
	plugin.addCommand({
		id: "seo-open-current",
		name: "Open current note audit",
		callback: async () => {
			plugin.openCurrentPanel();
			// Wait for panel to open, then trigger the audit
			setTimeout(async () => {
				const currentPanel = plugin.app.workspace.getLeavesOfType('seo-current-panel')[0];
				if (currentPanel && currentPanel.view) {
					const checkBtn = currentPanel.view.containerEl.querySelector('.seo-top-btn') as HTMLButtonElement;
					if (checkBtn) {
						checkBtn.click();
					}
				}
			}, 200);
		}
	});

	// Open SEO Global panel and run audit
	plugin.addCommand({
		id: "seo-open-global",
		name: "Open vault audit",
		callback: async () => {
			// Check if panel already exists
			const existingPanels = plugin.app.workspace.getLeavesOfType('seo-global-panel');
			const isFirstRun = existingPanels.length === 0;
			
			plugin.openGlobalPanel();
			
			// Only trigger manual refresh if panel already existed (not first run)
			if (!isFirstRun) {
				setTimeout(async () => {
					const globalPanels = plugin.app.workspace.getLeavesOfType('seo-global-panel');
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
		}
	});

}

async function getFilesToCheck(plugin: SEOPlugin): Promise<TFile[]> {
	const { vault } = plugin.app;
	const { scanDirectories } = plugin.settings;
	
	if (!scanDirectories.trim()) {
		// Scan all markdown files
		return vault.getMarkdownFiles();
	}
	
	const directories = scanDirectories.split(',').map(dir => dir.trim());
	const files: TFile[] = [];
	
	for (const dir of directories) {
		const folder = vault.getAbstractFileByPath(dir);
		if (folder && folder instanceof TFolder) {
			files.push(...vault.getMarkdownFiles().filter((file: TFile) => 
				file.path.startsWith(dir + '/') || file.path === dir
			));
		}
	}
	
	return files;
}
