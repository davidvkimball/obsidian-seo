import { SEOResults } from "../types";

export function getDisplayPath(fullPath: string): string {
	// Remove leading slash if present and split
	const cleanPath = fullPath.startsWith('/') ? fullPath.slice(1) : fullPath;
	const parts = cleanPath.split('/');
	if (parts.length <= 1) {
		return cleanPath; // Return as-is if no parent folder (just filename)
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
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				return aFileName.localeCompare(bFileName);
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
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				return aFileName.localeCompare(bFileName);
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
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				return aFileName.localeCompare(bFileName);
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
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				return aFileName.localeCompare(bFileName);
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
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				return aFileName.localeCompare(bFileName);
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
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				return aFileName.localeCompare(bFileName);
			});
			break;
		case 'filename-asc':
			sortedFiles.sort((a, b) => {
				// Primary: file name A-Z
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				const nameCompare = aFileName.localeCompare(bFileName);
				if (nameCompare !== 0) return nameCompare;
				
				// Secondary: parent folder A-Z (root files first)
				const aParts = a.file.split('/');
				const bParts = b.file.split('/');
				const aParent = aParts.length > 1 ? (aParts[aParts.length - 2] || '') : '';
				const bParent = bParts.length > 1 ? (bParts[bParts.length - 2] || '') : '';
				const parentCompare = aParent.localeCompare(bParent);
				if (parentCompare !== 0) return parentCompare;
				
				// Tertiary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Quaternary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Quinary: notices (high first)
				return b.noticesCount - a.noticesCount;
			});
			break;
		case 'filename-desc':
			sortedFiles.sort((a, b) => {
				// Primary: file name Z-A
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				const nameCompare = bFileName.localeCompare(aFileName);
				if (nameCompare !== 0) return nameCompare;
				
				// Secondary: parent folder Z-A (root files last)
				const aParts = a.file.split('/');
				const bParts = b.file.split('/');
				const aParent = aParts.length > 1 ? (aParts[aParts.length - 2] || '') : '';
				const bParent = bParts.length > 1 ? (bParts[bParts.length - 2] || '') : '';
				const parentCompare = bParent.localeCompare(aParent);
				if (parentCompare !== 0) return parentCompare;
				
				// Tertiary: issues (high first)
				if (b.issuesCount !== a.issuesCount) {
					return b.issuesCount - a.issuesCount;
				}
				// Quaternary: warnings (high first)
				if (b.warningsCount !== a.warningsCount) {
					return b.warningsCount - a.warningsCount;
				}
				// Quinary: notices (high first)
				return b.noticesCount - a.noticesCount;
			});
			break;
	}
	
	return sortedFiles;
}
