import { Plugin, Notice, TFile, TFolder } from "obsidian";
import SEOPlugin from "../main";
import { runSEOCheck } from "../seo-checker";
import { SEOResults } from "../types";

interface SEOPanelView {
	globalResults: SEOResults[];
	actions: any;
	render(): void;
}

/**
 * Registers all plugin commands with Obsidian
 * @param plugin - The SEO plugin instance
 */
export function registerCommands(plugin: SEOPlugin) {
	// Open SEO Current Note panel only (without running audit)
	plugin.addCommand({
		id: "seo-open-current",
		name: "Open current note audit",
		callback: async () => {
			plugin.openCurrentPanel();
		}
	});

	// Open SEO Global panel only (without running audit)
	plugin.addCommand({
		id: "seo-open-global",
		name: "Open vault audit",
		callback: async () => {
			plugin.openGlobalPanel();
		}
	});

	// Run SEO Current Note audit (opens panel and runs audit)
	plugin.addCommand({
		id: "seo-run-current",
		name: "Run current note audit",
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

	// Run SEO Global audit (opens panel and runs audit)
	plugin.addCommand({
		id: "seo-run-global",
		name: "Run vault audit",
		callback: async () => {
			plugin.openGlobalPanel();
			
			// Always check if panel opened successfully and run the audit
			setTimeout(async () => {
				const globalPanels = plugin.app.workspace.getLeavesOfType('seo-global-panel');
				
				if (globalPanels.length === 0) {
					// Fallback: try to open again
					plugin.openGlobalPanel();
					return;
				}
				
				const panel = globalPanels[0];
				if (panel?.view) {
					const seoPanel = panel.view as unknown as SEOPanelView;
					
					// Always trigger the refresh logic (same as clicking the refresh button)
					await seoPanel.actions.refreshGlobalResults();
					// Update the panel display with new results
					seoPanel.render();
				}
			}, 300);
		}
	});

}

/**
 * Gets the list of files to check based on plugin settings
 * @param plugin - The SEO plugin instance
 * @returns Promise resolving to array of files to check
 */
async function getFilesToCheck(plugin: SEOPlugin): Promise<TFile[]> {
	const { vault } = plugin.app;
	const { scanDirectories, ignoreUnderscoreFiles } = plugin.settings;
	
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
				files.push(...vault.getMarkdownFiles().filter((file: TFile) => 
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
