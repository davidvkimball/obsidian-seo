import { SEOResults } from "../types";

export function getDisplayPath(fullPath: string): string {
	const parts = fullPath.split('/');
	if (parts.length <= 2) {
		return fullPath; // Return as-is if no parent folder
	}
	return parts.slice(-2).join('/'); // Return last two parts (parent folder + file name)
}

export function getVaultFoldersInfo(scanDirectories: string): string {
	if (!scanDirectories || scanDirectories.trim() === '') {
		return 'Vault folders: all';
	}
	
	const folders = scanDirectories.split(',').map(f => f.trim()).filter(f => f.length > 0);
	return `Vault folders: ${folders.join(', ')}`;
}

export function sortFiles(files: SEOResults[], sortType: string): SEOResults[] {
	const sortedFiles = [...files];
	
	switch (sortType) {
		case 'warnings-desc':
			sortedFiles.sort((a, b) => {
				// Primary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Secondary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Tertiary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'warnings-asc':
			sortedFiles.sort((a, b) => {
				// Primary: warnings (low first)
				if (a.warningsCount !== b.warningsCount) {
					return a.warningsCount - b.warningsCount;
				}
				// Secondary: issues (low first)
				if (a.issuesCount !== b.issuesCount) {
					return a.issuesCount - b.issuesCount;
				}
				// Tertiary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'issues-desc':
			sortedFiles.sort((a, b) => {
				// Primary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Secondary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Tertiary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'issues-asc':
			sortedFiles.sort((a, b) => {
				// Primary: issues (low first)
				if (a.issuesCount !== b.issuesCount) {
					return a.issuesCount - b.issuesCount;
				}
				// Secondary: warnings (low first)
				if (a.warningsCount !== b.warningsCount) {
					return a.warningsCount - b.warningsCount;
				}
				// Tertiary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'filename-asc':
			sortedFiles.sort((a, b) => a.file.localeCompare(b.file));
			break;
		case 'filename-desc':
			sortedFiles.sort((a, b) => b.file.localeCompare(a.file));
			break;
	}
	
	return sortedFiles;
}
