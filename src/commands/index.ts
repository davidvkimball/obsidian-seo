import { Plugin, Notice, TFile, TFolder } from "obsidian";
import SEOPlugin from "../main";
import { runSEOCheck } from "../seo-checker";

export function registerCommands(plugin: SEOPlugin) {
	// Check current note
	plugin.addCommand({
		id: "seo-check-current",
		name: "Check current note SEO",
		callback: async () => {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (!activeFile || !activeFile.path.endsWith('.md')) {
				new Notice('Please open a markdown file to check SEO.');
				return;
			}
			
			await runSEOCheck(plugin, [activeFile]);
		}
	});

	// Check all notes in configured directories
	plugin.addCommand({
		id: "seo-check-all",
		name: "Check all notes SEO",
		callback: async () => {
			const files = await getFilesToCheck(plugin);
			if (files.length === 0) {
				new Notice('No markdown files found in configured directories.');
				return;
			}
			
			await runSEOCheck(plugin, files);
		}
	});

	// Open SEO Current Note panel
	plugin.addCommand({
		id: "seo-open-current",
		name: "SEO: Open current note analysis",
		callback: () => {
			plugin.openCurrentPanel();
		}
	});

	// Open SEO Global panel
	plugin.addCommand({
		id: "seo-open-global",
		name: "SEO: Open vault analysis",
		callback: () => {
			plugin.openGlobalPanel();
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
