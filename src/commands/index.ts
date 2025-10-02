import { Plugin, Notice, TFile, TFolder } from "obsidian";
import SEOPlugin from "../main";
import { runSEOCheck } from "../seo-checker";

export function registerCommands(plugin: SEOPlugin) {
	// Open SEO Current Note panel
	plugin.addCommand({
		id: "seo-open-current",
		name: "Open current note audit",
		callback: () => {
			plugin.openCurrentPanel();
		}
	});

	// Open SEO Global panel
	plugin.addCommand({
		id: "seo-open-global",
		name: "Open vault audit",
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
