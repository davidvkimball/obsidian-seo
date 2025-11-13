import SEOPlugin from "../main";
import { PanelActions } from "../ui/panel-actions";

/**
 * Registers all plugin commands with Obsidian
 * @param plugin - The SEO plugin instance
 */
export function registerCommands(plugin: SEOPlugin) {
	// Open SEO Current Note panel only (without running audit)
	plugin.addCommand({
		id: "open-current",
		name: "Open current note audit",
		icon: "search-check",
		callback: () => {
			plugin.openCurrentPanel();
		}
	});

	// Open SEO Global panel only (without running audit)
	plugin.addCommand({
		id: "open-global",
		name: "Open vault audit",
		icon: "search-check",
		callback: () => {
			plugin.openGlobalPanel();
		}
	});

	// Run SEO Current Note audit (opens panel and runs audit)
	plugin.addCommand({
		id: "run-current",
		name: "Run current note audit",
		icon: "search-check",
		callback: () => {
			plugin.openCurrentPanel();
			// Wait for panel to open, then trigger the audit
			setTimeout(() => {
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
		id: "run-global",
		name: "Run vault audit",
		icon: "search-check",
		callback: () => {
			plugin.openGlobalPanel();
			
			// Always check if panel opened successfully and run the audit
			void setTimeout(() => {
				void (async () => {
					const globalPanels = plugin.app.workspace.getLeavesOfType('seo-global-panel');
					
					if (globalPanels.length === 0) {
						// Fallback: try to open again
						plugin.openGlobalPanel();
						return;
					}
					
					const panel = globalPanels[0];
					if (panel?.view) {
						const seoPanel = panel.view as unknown as { actions: PanelActions; render(): void };
						
						// Always trigger the refresh logic (same as clicking the refresh button)
						await seoPanel.actions.refreshGlobalResults();
						// Update the panel display with new results
						seoPanel.render();
					}
				})();
			}, 300);
		}
	});

}
