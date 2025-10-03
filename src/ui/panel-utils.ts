import { SEOResults } from "../types";

export function getDisplayPath(fullPath: string): string {
	const parts = fullPath.split('/');
	if (parts.length <= 2) {
		return fullPath; // Return as-is if no parent folder
	}
	return parts.slice(-2).join('/'); // Return last two parts (parent folder + filename)
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
			sortedFiles.sort((a, b) => b.warningsCount - a.warningsCount);
			break;
		case 'warnings-asc':
			sortedFiles.sort((a, b) => a.warningsCount - b.warningsCount);
			break;
		case 'issues-desc':
			sortedFiles.sort((a, b) => b.issuesCount - a.issuesCount);
			break;
		case 'issues-asc':
			sortedFiles.sort((a, b) => a.issuesCount - b.issuesCount);
			break;
		case 'filename-asc':
			sortedFiles.sort((a, b) => {
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				const fileNameCompare = aFileName.localeCompare(bFileName);
				if (fileNameCompare !== 0) return fileNameCompare;
				return a.file.localeCompare(b.file);
			});
			break;
		case 'filename-desc':
			sortedFiles.sort((a, b) => {
				const aFileName = a.file.split('/').pop() || '';
				const bFileName = b.file.split('/').pop() || '';
				const fileNameCompare = bFileName.localeCompare(aFileName);
				if (fileNameCompare !== 0) return fileNameCompare;
				return b.file.localeCompare(a.file);
			});
			break;
	}
	
	return sortedFiles;
}
