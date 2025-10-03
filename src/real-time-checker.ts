import { App, TFile } from "obsidian";
import SEOPlugin from "./main";

export class RealTimeChecker {
	private timeoutId: number | null = null;

	constructor(
		private app: App,
		private plugin: SEOPlugin
	) {}

	registerRealTimeChecking() {
		// Debounced checking for current note
		this.plugin.registerEvent(
			this.app.workspace.on("editor-change", () => {
				if (this.timeoutId) {
					clearTimeout(this.timeoutId);
				}
				this.timeoutId = window.setTimeout(() => {
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

		try {
			// Run SEO check on current note
			const { runSEOCheck } = await import("./seo-checker");
			const results = await runSEOCheck(this.plugin, [activeFile]);
			
			// Results will be displayed when panels are opened
			
		} catch (error) {
			console.error('Error checking current note:', error);
		}
	}

	// Public method for bulk checking
	async runBulkCheck() {
		const { runSEOCheck } = await import("./seo-checker");
		const files = await this.plugin.getFilesToCheck();
		if (files.length === 0) {
			return;
		}
		
		try {
			const results = await runSEOCheck(this.plugin, files);
			
			// Results will be displayed when panels are opened
		} catch (error) {
			console.error('Error running bulk check:', error);
		}
	}
}
