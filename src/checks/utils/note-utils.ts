import { TFile } from "obsidian";
import { SEOSettings } from "../../settings";
import { SEOCheckResult } from "../../types";
import { getDisplayPath } from "../../ui/panel-utils";

/**
 * Gets the display name for a file, prioritizing the title property if configured
 */
export function getDisplayName(file: TFile, content: string, settings: SEOSettings): string {
	if (settings.useNoteTitles && settings.titleProperty.trim()) {
		// Try to get title from frontmatter - handle various formats
		let frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (!frontmatterMatch) {
			// Try without carriage returns
			frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
		}
		if (!frontmatterMatch) {
			// Try with just dashes and any whitespace
			frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n\s*---/);
		}

		if (frontmatterMatch && frontmatterMatch[1]) {
			const frontmatter = frontmatterMatch[1];

			// Split by lines and look for the property
			const lines = frontmatter.split('\n');

			for (const line of lines) {
				if (!line) continue;
				const trimmedLine = line.trim();

				if (trimmedLine.startsWith(settings.titleProperty + ':')) {
					// Extract the value after the colon
					const colonIndex = trimmedLine.indexOf(':');
					if (colonIndex !== -1) {
						let title = trimmedLine.substring(colonIndex + 1).trim();

						// Remove surrounding quotes if present
						if ((title.startsWith('"') && title.endsWith('"')) ||
							(title.startsWith("'") && title.endsWith("'"))) {
							title = title.slice(1, -1);
						}

						if (title) {
							return title;
						}
					}
				}
			}
		}
	}
	// Fallback to file path with parent folder
	return getDisplayPath(file.path);
}

/**
 * Gets the slug from a file (frontmatter slug property if set, else parent folder when file is index, else file name without extension)
 */
export function getSlugFromFile(file: TFile, content: string, settings: SEOSettings): string {
	if (settings.slugProperty?.trim()) {
		const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (frontmatterMatch?.[1]) {
			const lines = frontmatterMatch[1].split('\n');
			const prefix = settings.slugProperty + ':';
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith(prefix)) {
					let value = trimmed.slice(prefix.length).trim();
					if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1);
					}
					if (value) return value;
					break;
				}
			}
		}
	}
	// Folder/index.md pattern: use parent folder name as slug (e.g. .../my-post/index.md -> my-post)
	const base = file.basename.toLowerCase();
	const useParentFolder = base === 'index' ||
		(settings.parentFolderSlugFilename?.trim() && base === settings.parentFolderSlugFilename.trim().toLowerCase());
	if (useParentFolder) {
		const parts = file.path.replace(/\\/g, '/').split('/');
		if (parts.length >= 2) {
			const parentFolder = parts[parts.length - 2];
			if (parentFolder) return parentFolder;
		}
	}
	return file.basename;
}

/**
 * Checks the slug format
 */
export function checkSlugFormat(content: string, file: TFile, settings: SEOSettings): Promise<SEOCheckResult[]> {
	// TODO: Move this to meta-checks.ts
	return Promise.resolve([]);
}
