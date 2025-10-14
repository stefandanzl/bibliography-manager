import { App, TFile, Notice, normalizePath, TFolder } from "obsidian";
import { SourceData, SourceType } from "./sourceManager";

export class SourceService {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get the sources folder for a given file, checking frontmatter first, then using default
	 */
	async getSourcesFolder(file: TFile, defaultSourcesFolder: string): Promise<string> {
		const fileCache = this.app.metadataCache.getFileCache(file);
		const frontmatterSourcesFolder = fileCache?.frontmatter?.typst_bib;

		if (frontmatterSourcesFolder && typeof frontmatterSourcesFolder === "string") {
			return normalizePath(frontmatterSourcesFolder);
		}

		return normalizePath(defaultSourcesFolder);
	}

	/**
	 * Create a markdown file for a source with proper frontmatter and content
	 */
	async createSourceFile(sourceData: SourceData, sourcesFolder: string): Promise<TFile | null> {
		try {
			// Ensure sources folder exists
			const sourceTypeFolder = this.getSourceTypeFolder(sourceData);
			const fullPath = normalizePath(`${sourcesFolder}/${sourceTypeFolder}`);

			await this.ensureFolderExists(fullPath);

			// Generate filename from title
			const filename = this.generateFilename(sourceData.title, fullPath);
			const filePath = normalizePath(`${fullPath}/${filename}.md`);

			// Generate file content
			const content = this.generateSourceFileContent(sourceData);

			// Create file using Obsidian API
			const file = await this.app.vault.create(filePath, content);

			new Notice(`Source created: ${filename}.md`);
			return file;
		} catch (error) {
			console.error("Failed to create source file:", error);
			new Notice(`Failed to create source file: ${error instanceof Error ? error.message : "Unknown error"}`);
			return null;
		}
	}

	/**
	 * Get subfolder name based on source type
	 */
	private getSourceTypeFolder(sourceData: SourceData): string {
		const category = sourceData.category?.[0]?.toLowerCase();
		switch (category) {
			case "book":
				return "Books";
			case "paper":
				return "Papers";
			case "website":
				return "Websites";
			case "thesis":
				return "Theses";
			case "report":
				return "Reports";
			default:
				return "Other";
		}
	}

	/**
	 * Generate a safe filename from title
	 */
	private generateFilename(title: string, folderPath: string): string {
		if (!title) {
			title = "Untitled Source";
		}

		// Remove special characters and normalize
		let filename = title
			.replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
			.replace(/\s+/g, " ") // Replace multiple spaces with single space
			.trim();

		// Limit length
		if (filename.length > 50) {
			filename = filename.substring(0, 47) + "...";
		}

		// Check for duplicates and add suffix if needed
		const finalFilename = this.getUniqueFilename(folderPath, filename);
		return finalFilename;
	}

	/**
	 * Get unique filename by checking existing files and adding "copy" suffix if needed
	 */
	private getUniqueFilename(folderPath: string, baseFilename: string): string {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			return baseFilename;
		}

		let filename = baseFilename;
		let counter = 1;

		while (true) {
			const filePath = normalizePath(`${folderPath}/${filename}.md`);
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);

			if (!existingFile) {
				break;
			}

			if (counter === 1) {
				filename = `${baseFilename} (copy)`;
			} else {
				filename = `${baseFilename} (copy ${counter})`;
			}
			counter++;
		}

		return filename;
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const parts = folderPath.split("/");
		let currentPath = "";

		for (const part of parts) {
			if (!part) continue;

			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folder = this.app.vault.getAbstractFileByPath(currentPath);

			if (!folder) {
				await this.app.vault.createFolder(currentPath);
			} else if (!(folder instanceof TFolder)) {
				throw new Error(`Path ${currentPath} exists but is not a folder`);
			}
		}
	}

	/**
	 * Generate the complete file content with frontmatter and structure
	 */
	private generateSourceFileContent(sourceData: SourceData): string {
		// Start with frontmatter
		let content = "---\n";

		// Add all fields from sourceData, handling arrays properly
		Object.entries(sourceData).forEach(([key, value]) => {
			if (value === undefined || value === null) return;

			if (Array.isArray(value)) {
				if (value.length > 0) {
					content += `${key}: ${JSON.stringify(value)}\n`;
				}
			} else if (typeof value === "string") {
				content += `${key}: "${value}"\n`;
			} else {
				content += `${key}: ${value}\n`;
			}
		});

		content += "---\n\n";

		// Add basic structure
		content += "# Inhaltsangabe\n\n";
		content += "# Zusammenfassung\n\n";

		return content;
	}

	/**
	 * Find all source files in the sources folder
	 */
	async findAllSourceFiles(sourcesFolder: string): Promise<TFile[]> {
		const sourceFiles: TFile[] = [];

		try {
			const folder = this.app.vault.getAbstractFileByPath(sourcesFolder);
			if (!(folder instanceof TFolder)) {
				return sourceFiles;
			}

			// Recursively search for markdown files
			await this.searchSourceFilesRecursive(folder, sourceFiles);
		} catch (error) {
			console.error("Error finding source files:", error);
		}

		return sourceFiles;
	}

	/**
	 * Recursively search for source files
	 */
	private async searchSourceFilesRecursive(folder: TFolder, sourceFiles: TFile[]): Promise<void> {
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				const cache = this.app.metadataCache.getFileCache(child);
				if (cache?.frontmatter?.notetype === "source") {
					sourceFiles.push(child);
				}
			} else if (child instanceof TFolder) {
				await this.searchSourceFilesRecursive(child, sourceFiles);
			}
		}
	}

	/**
	 * Generate BibTeX content from all source files
	 */
	async generateBibTeXFromSources(sourcesFolder: string): Promise<string> {
		const sourceFiles = await this.findAllSourceFiles(sourcesFolder);
		const bibtexEntries: string[] = [];

		for (const file of sourceFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			if (frontmatter && frontmatter.notetype === "source") {
				const bibtexEntry = this.convertFrontmatterToBibTeX(frontmatter);
				if (bibtexEntry) {
					bibtexEntries.push(bibtexEntry);
				}
			}
		}

		return bibtexEntries.join("\n\n");
	}

	/**
	 * Convert frontmatter data to BibTeX entry
	 */
	private convertFrontmatterToBibTeX(frontmatter: any): string | null {
		if (!frontmatter.citekey) {
			return null;
		}

		// Map BibTeX type from our custom types
		const bibType = this.mapToBibTeXType(frontmatter.bibtype, frontmatter.category?.[0]);

		let entry = `@${bibType}{${frontmatter.citekey},\n`;

		// Add various fields
		const fields = [
			["title", frontmatter.title],
			["author", this.formatAuthorsForBibTeX(frontmatter.author)],
			["year", frontmatter.year],
			["publisher", frontmatter.publisher],
			["journal", frontmatter.journal],
			["volume", frontmatter.volume],
			["number", frontmatter.number],
			["pages", frontmatter.pages],
			["doi", frontmatter.doi],
			["isbn", frontmatter.isbn],
			["url", frontmatter.url],
			["abstract", frontmatter.abstract]
		];

		fields.forEach(([key, value]) => {
			if (value && typeof value === "string") {
				entry += `  ${key} = {${value}},\n`;
			}
		});

		// Remove trailing comma and close entry
		entry = entry.replace(/,\n$/, "\n");
		entry += "}\n";

		return entry;
	}

	/**
	 * Map our source types to BibTeX types
	 */
	private mapToBibTeXType(bibType: string, category: string): string {
		if (bibType && bibType !== "misc") {
			return bibType;
		}

		const categoryLower = category?.toLowerCase();
		switch (categoryLower) {
			case "book":
				return "book";
			case "paper":
				return "article";
			case "website":
				return "online";
			case "thesis":
				return "phdthesis";
			case "report":
				return "techreport";
			default:
				return "misc";
		}
	}

	/**
	 * Format authors array for BibTeX
	 */
	private formatAuthorsForBibTeX(authors: string[]): string | null {
		if (!authors || authors.length === 0) {
			return null;
		}

		return authors.map(author => {
			// Try to format as "Last, First" if not already in that format
			if (author.includes(",")) {
				return author;
			}
			const parts = author.split(/\s+/);
			if (parts.length >= 2) {
				const first = parts.slice(0, -1).join(" ");
				const last = parts[parts.length - 1];
				return `${last}, ${first}`;
			}
			return author;
		}).join(" and ");
	}
}