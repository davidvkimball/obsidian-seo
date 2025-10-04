import { SEOResults } from "../types";

export function getDisplayPath(fullPath: string): string {
	const parts = fullPath.split('/');
	if (parts.length <= 2) {
		return fullPath; // Return as-is if no parent folder
	}
	return parts.slice(-2).join('/'); // Return last two parts (parent folder + file name)
}

export function getVaultFoldersInfo(scanDirectories: string, fileCount?: number): string {
	let baseText = 'Vault folders: ';
	if (!scanDirectories || scanDirectories.trim() === '') {
		baseText += 'all';
	} else {
		const folders = scanDirectories.split(',').map(f => f.trim()).filter(f => f.length > 0);
		baseText += folders.join(', ');
	}
	
	if (fileCount !== undefined) {
		baseText += `; ${fileCount} files analyzed`;
	}
	
	return baseText;
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
				// Tertiary: notices (high first)
				if (b.noticesCount !== a.noticesCount) {
					return b.noticesCount - a.noticesCount;
				}
				// Quaternary: file name A-Z
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
				// Tertiary: notices (low first)
				if (a.noticesCount !== b.noticesCount) {
					return a.noticesCount - b.noticesCount;
				}
				// Quaternary: file name A-Z
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
				// Tertiary: notices (high first)
				if (b.noticesCount !== a.noticesCount) {
					return b.noticesCount - a.noticesCount;
				}
				// Quaternary: file name A-Z
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
				// Tertiary: notices (low first)
				if (a.noticesCount !== b.noticesCount) {
					return a.noticesCount - b.noticesCount;
				}
				// Quaternary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'notices-desc':
			sortedFiles.sort((a, b) => {
				// Primary: notices (high first)
				if (b.noticesCount !== a.noticesCount) {
					return b.noticesCount - a.noticesCount;
				}
				// Secondary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Tertiary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Quaternary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'notices-asc':
			sortedFiles.sort((a, b) => {
				// Primary: notices (low first)
				if (a.noticesCount !== b.noticesCount) {
					return a.noticesCount - b.noticesCount;
				}
				// Secondary: issues (low first)
				if (a.issuesCount !== b.issuesCount) {
					return a.issuesCount - b.issuesCount;
				}
				// Tertiary: warnings (low first)
				if (a.warningsCount !== b.warningsCount) {
					return a.warningsCount - b.warningsCount;
				}
				// Quaternary: file name A-Z
				return a.file.localeCompare(b.file);
			});
			break;
		case 'filename-asc':
			sortedFiles.sort((a, b) => {
				// Primary: file name A-Z
				const nameCompare = a.file.localeCompare(b.file);
				if (nameCompare !== 0) return nameCompare;
				// Secondary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Tertiary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Quaternary: notices (high first)
				return b.noticesCount - a.noticesCount;
			});
			break;
		case 'filename-desc':
			sortedFiles.sort((a, b) => {
				// Primary: file name Z-A
				const nameCompare = b.file.localeCompare(a.file);
				if (nameCompare !== 0) return nameCompare;
				// Secondary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Tertiary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Quaternary: notices (high first)
				return b.noticesCount - a.noticesCount;
			});
			break;
	}
	
	return sortedFiles;
}
