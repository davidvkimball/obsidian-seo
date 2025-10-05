/**
 * Reading level analysis utilities
 * Provides functions to calculate reading level and syllable counting
 */

/**
 * Counts syllables in a word using a simple heuristic
 * @param word - The word to count syllables for
 * @returns Number of syllables in the word
 */
export function countSyllables(word: string): number {
	// Remove punctuation and convert to lowercase
	const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
	
	// Handle empty words
	if (cleanWord.length === 0) return 0;
	
	// Count vowel groups
	let syllables = 0;
	let previousWasVowel = false;
	
	for (let i = 0; i < cleanWord.length; i++) {
		const char = cleanWord[i];
		if (char) {
			const isVowel = /[aeiouy]/.test(char);
			
			if (isVowel && !previousWasVowel) {
				syllables++;
			}
			
			previousWasVowel = isVowel;
		}
	}
	
	// Handle silent 'e' at the end
	if (cleanWord.endsWith('e') && syllables > 1) {
		syllables--;
	}
	
	// Every word has at least one syllable
	return Math.max(1, syllables);
}

/**
 * Gets a human-readable description of the reading level
 * @param level - The Flesch-Kincaid reading level
 * @returns Description of the reading level
 */
export function getReadingLevelDescription(level: number): string {
	if (level <= 6) return "Very easy to read";
	if (level <= 9) return "Easy to read";
	if (level <= 12) return "Moderately easy to read";
	if (level <= 15) return "Moderately difficult to read";
	if (level <= 18) return "Difficult to read";
	return "Very difficult to read";
}
