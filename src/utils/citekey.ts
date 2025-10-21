export class CitekeyGenerator {
	static generateCitekey(
		authors: string[],
		year: number,
		title?: string
	): string {
		if (authors.length === 0) {
			// If no authors, use first 5 letters from title
			if (title && title.trim().length > 0) {
				const cleanTitle = title
					.replace(/<[^>]*>/g, "") // Remove HTML
					.replace(/&[^;]+;/g, "") // Remove HTML entities
					.replace(/\\[a-zA-Z]+\{([^}]+)\}/g, "$1") // Remove LaTeX
					.replace(/[{}$]/g, "") // Remove math symbols
					.replace(/[,:;]/g, " ") // Replace punctuation
					.replace(/[—–]/g, "-") // Replace dashes
					.replace(/[<>:"/\\|?*]/g, "") // Remove invalid chars
					.trim();
				const titleBase = cleanTitle.substring(0, 5).toLowerCase();
				return (
					titleBase.charAt(0).toUpperCase() +
					titleBase.substring(1) +
					year.toString().slice(-2)
				);
			} else {
				return "Unknown" + year.toString().slice(-2);
			}
		}

		const yearSuffix = year.toString().slice(-2);

		if (authors.length === 1) {
			// One author: first 3 letters of lastname + year
			const lastName = this.extractLastName(authors[0]);
			const base = lastName.substring(0, 3);
			return (
				base.charAt(0).toUpperCase() +
				base.substring(1).toLowerCase() +
				yearSuffix
			);
		} else {
			// Multiple authors: first 2 letters of first 2 authors + year (capitalized)
			const firstAuthor = this.extractLastName(authors[0]);
			const secondAuthor = this.extractLastName(authors[1]);
			const firstInitial = firstAuthor.substring(0, 2);
			const secondInitial = secondAuthor.substring(0, 2);
			const capitalizedBase =
				firstInitial.charAt(0).toUpperCase() +
				firstInitial.substring(1).toLowerCase() +
				secondInitial.charAt(0).toUpperCase() +
				secondInitial.substring(1).toLowerCase();
			return capitalizedBase + yearSuffix;
		}
	}

	private static extractLastName(authorName: string): string {
		// Handle formats: "John Smith", "Smith, John", "J. Smith"
		const parts = authorName.split(",").map((p) => p.trim());
		if (parts.length === 2) {
			return parts[0]; // "Smith, John" -> "Smith"
		} else {
			const words = parts[0].split(" ");
			return words[words.length - 1]; // "John Smith" -> "Smith"
		}
	}

	static generateFromTitleAndAuthors(
		title: string,
		authors: string[],
		year: number
	): string {
		const citekey = this.generateCitekey(authors, year, title);
		return citekey;
	}

	static sanitizeFilename(title: string): string {
		// Create a clean filename from title
		return (
			title
				// Remove HTML/XML tags and entities
				.replace(/<[^>]*>/g, "")
				.replace(/&[^;]+;/g, "")
				// Remove common LaTeX formatting
				.replace(/\\[a-zA-Z]+\{([^}]+)\}/g, "$1") // Remove LaTeX commands like \textit{}
				.replace(/[{}$]/g, "") // Remove remaining LaTeX braces and math symbols
				// Replace common punctuation with spaces (preserve spaces)
				.replace(/[,:;]/g, " ")
				.replace(/[—–]/g, "-") // Replace different types of dashes
				// Remove invalid filename characters
				.replace(/[<>:"/\\|?*]/g, "")
				// Remove leading/trailing hyphens but keep spaces
				.replace(/^-+|-+$/g, "")
				.trim()
		);
	}

	/**
	 * Extract authors from citation-js data format and return as string array
	 */
	static extractAuthorsFromCitationData(citationData: any): string[] {
		const authors = citationData.author || [];
		return authors.map((author: any) => {
			if (author.literal) return author.literal;
			if (author.family && author.given) {
				return `${author.family}, ${author.given}`;
			}
			if (author.family) return author.family;
			return "Unknown Author";
		});
	}

	/**
	 * Extract title from URL as fallback for website sources
	 */
	static extractTitleFromURL(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathParts = urlObj.pathname
				.split("/")
				.filter((part) => part.length > 0);
			const lastPart = pathParts[pathParts.length - 1];

			if (lastPart) {
				// Convert dashes and underscores to spaces and capitalize
				return lastPart
					.replace(/[-_]/g, " ")
					.replace(/\b\w/g, (l) => l.toUpperCase());
			} else {
				return urlObj.hostname;
			}
		} catch {
			return "Website Source";
		}
	}
}
