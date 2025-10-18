import {
	App,
	TFile,
	TFolder,
	Notice,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import type { BibliographySettings } from "../main";
import { SourceData, generateBibtex, parseBibTeX } from "./bibtexImport";


export interface BibliographyConfig {
	mode: "directory" | "file";
	path: string;
}

export class BibliographyExporter {
	constructor(private app: App, private settings: BibliographySettings) {}

	parseBibliographyConfig(frontmatter: any): BibliographyConfig | null {
		const typstBib = frontmatter.typst_bib;
		if (!typstBib) return null;

		// Auto-detect by extension
		if (typstBib.endsWith(".bib")) {
			return { mode: "file", path: typstBib }; // Copy existing file
		} else {
			return { mode: "directory", path: typstBib }; // Generate from sources
		}
	}

	async exportBibliography(
		config: BibliographyConfig,
		outputDir: string
	): Promise<string> {
		const bibFilename =
			this.settings.bibliographyFilename || "bibliography.bib";

		if (config.mode === "file") {
			return this.copyExistingBibFile(
				config.path,
				outputDir,
				bibFilename
			);
		} else {
			return this.generateBibliographyFromSources(
				config,
				outputDir,
				bibFilename
			);
		}
	}

	private async copyExistingBibFile(
		sourcePath: string,
		outputDir: string,
		bibFilename: string
	): Promise<string> {
		const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(sourceFile instanceof TFile)) {
			throw new Error(`Bibliography file not found: ${sourcePath}`);
		}

		const outputPath = `${outputDir}/${bibFilename}`;
		const content = await this.app.vault.read(sourceFile);

		// Create output directory if it doesn't exist
		await this.ensureDirectoryExists(outputDir);

		// Write bibliography file
		await this.app.vault.adapter.write(outputPath, content);

		return outputPath;
	}

	private async generateBibliographyFromSources(
		config: BibliographyConfig,
		outputDir: string,
		bibFilename: string
	): Promise<string> {
		// For now, we'll use a placeholder for the current file since it's not passed in
		const currentFile = this.app.workspace.getActiveFile();

		const sources = await this.collectSources(config, currentFile);
		const bibContent = await this.generateBibtex(sources);
		const outputPath = `${outputDir}/${bibFilename}`;

		// Create output directory if it doesn't exist
		await this.ensureDirectoryExists(outputDir);

		// Write bibliography file
		await this.app.vault.adapter.write(outputPath, bibContent);

		// Count unique sources (after deduplication)
		const dedupResult = this.deduplicateSources(sources);
		const message =
			dedupResult.duplicatesFound > 0
				? `Generated bibliography with ${dedupResult.uniqueSources.length} unique sources (${dedupResult.duplicatesFound} duplicates removed)`
				: `Generated bibliography with ${dedupResult.uniqueSources.length} sources`;

		new Notice(message);
		return outputPath;
	}

	private async collectSources(
		config: BibliographyConfig | null,
		currentFile: TFile | null
	): Promise<SourceData[]> {
		const sourcesMap = new Map<string, SourceData>(); // Use citekey as key

		// Priority 1: typst_bib directory sources
		if (config && config.mode === "directory") {
			const typstBibSources = await this.collectFromDirectory(
				config.path
			);
			// Deduplicate within typst_bib directory
			typstBibSources.forEach((source) => {
				if (!sourcesMap.has(source.citekey)) {
					sourcesMap.set(source.citekey, source);
				} else {
					console.warn(
						`Duplicate citekey in ${config.path}: ${source.citekey} (file: ${source.filepath}), keeping first occurrence`
					);
				}
			});
		}

		// Priority 2: Global sources directory (only if typst_bib not provided or for additional sources)
		const globalSources = await this.collectFromDirectory("sources");
		globalSources.forEach((source) => {
			if (!sourcesMap.has(source.citekey)) {
				sourcesMap.set(source.citekey, source);
			} else {
				console.warn(
					`Duplicate citekey in sources directory: ${source.citekey} (file: ${source.filepath}), keeping first occurrence`
				);
			}
		});

		return Array.from(sourcesMap.values());
	}

	private async collectFromDirectory(dirPath: string): Promise<SourceData[]> {
		const sources: SourceData[] = [];
		const dir = this.app.vault.getAbstractFileByPath(dirPath);

		if (!(dir instanceof TFolder)) {
			return sources;
		}

		// Collect all markdown files in the directory and subdirectories
		const markdownFiles = this.getAllMarkdownFiles(dir);

		for (const file of markdownFiles) {
			const source = await this.extractSourceFromFile(file);
			if (source) {
				sources.push(source);
			}
		}

		return sources;
	}

	private getAllMarkdownFiles(folder: TFolder): TFile[] {
		const files: TFile[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.getAllMarkdownFiles(child));
			}
		}

		return files;
	}

	private async extractSourceFromFile(
		file: TFile
	): Promise<SourceData | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

			if (!frontmatterMatch) return null;

			const yaml = parseYaml(frontmatterMatch[1]);

			// Only process files that have a citekey
			if (!yaml.citekey) return null;

			return {
				citekey: yaml.citekey,
				title: yaml.title || file.basename,
				author: yaml.author || [],
				year: yaml.year?.toString() || new Date().getFullYear().toString(),
				bibtype: yaml.type || "misc",
				category: yaml.category || ["other"],
				downloadurl: yaml.downloadurl || yaml.url,
				imageurl: yaml.imageurl,
				added: yaml.added,
				started: yaml.started,
				ended: yaml.ended,
				rating: yaml.rating,
				pages: yaml.pages ? parseInt(yaml.pages) : undefined,
				currentpage: yaml.currentpage ? parseInt(yaml.currentpage) : undefined,
				status: yaml.status,
				filelink: yaml.filelink,
				notetype: "source",
				aliases: yaml.aliases,
				abstract: yaml.abstract,
				publisher: yaml.publisher,
				journal: yaml.journal,
				volume: yaml.volume,
				number: yaml.number || yaml.issue,
				doi: yaml.doi,
				isbn: yaml.isbn,
				url: yaml.url,
			};
		} catch (error) {
			console.error(`Error extracting source from ${file.path}:`, error);
			return null;
		}
	}

	async generateBibtex(sources: SourceData[]): Promise<string> {
		if (sources.length === 0) {
			return "% No sources found";
		}

		// Deduplicate sources by citekey
		const deduplicatedSources = this.deduplicateSources(sources);

		// If we found duplicates, notify the user
		if (deduplicatedSources.duplicatesFound > 0) {
			const duplicateCitekeys = Array.from(
				deduplicatedSources.duplicateCitekeys.keys()
			);
			console.warn(
				`Found ${deduplicatedSources.duplicatesFound} duplicate citekeys:`,
				duplicateCitekeys
			);
			console.warn("Duplicate sources details:");
			deduplicatedSources.duplicateCitekeys.forEach(
				(duplicates, citekey) => {
					console.warn(
						`- ${citekey}: found ${duplicates.length} instances`
					);
					duplicates.forEach((dup) =>
						console.warn(`  * ${dup.filepath || "unknown location"}`)
					);
				}
			);

			// Show notice to user
			new Notice(
				`Found ${deduplicatedSources.duplicatesFound} duplicate sources. Check console for details and clean up your source files.`
			);
		}

		console.log(
			`DEBUG: Original sources: ${sources.length}, Unique sources: ${deduplicatedSources.uniqueSources.length}`
		);

		// Use the new generateBibtex function from bibtexImport.ts
		return generateBibtex(deduplicatedSources.uniqueSources);
	}

	/**
	 * Deduplicate sources by citekey, keeping the first occurrence
	 * @returns Object with unique sources, duplicate count, and duplicate details
	 */
	private deduplicateSources(sources: SourceData[]): {
		uniqueSources: SourceData[];
		duplicatesFound: number;
		duplicateCitekeys: Map<string, SourceData[]>;
	} {
		console.log("DEBUG: Starting deduplication process...");
		const sourcesMap = new Map<string, SourceData>();
		const duplicateCitekeys = new Map<string, SourceData[]>();
		let duplicatesFound = 0;

		for (const source of sources) {
			const location = source.filepath || "unknown location";
			console.log(
				`DEBUG: Processing citekey: "${source.citekey}" from "${location}"`
			);

			if (sourcesMap.has(source.citekey)) {
				// This is a duplicate
				duplicatesFound++;
				console.log(
					`DEBUG: DUPLICATE FOUND for citekey: "${source.citekey}"`
				);

				// Track duplicates for reporting
				if (!duplicateCitekeys.has(source.citekey)) {
					// Add the original source to the duplicates list for reference
					const original = sourcesMap.get(source.citekey)!;
					duplicateCitekeys.set(source.citekey, [original]);
				}
				duplicateCitekeys.get(source.citekey)!.push(source);

				// Keep the first occurrence (already in sourcesMap)
				console.warn(
					`Duplicate citekey found: ${source.citekey} (location: ${location}), keeping first occurrence`
				);
			} else {
				// First occurrence of this citekey
				console.log(
					`DEBUG: First occurrence of citekey: "${source.citekey}"`
				);
				sourcesMap.set(source.citekey, source);
			}
		}

		const uniqueSources = Array.from(sourcesMap.values());
		console.log(
			`DEBUG: Deduplication complete. Found ${duplicatesFound} duplicates, ${uniqueSources.length} unique sources`
		);

		return {
			uniqueSources,
			duplicatesFound,
			duplicateCitekeys,
		};
	}

	
	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (!(await this.app.vault.adapter.exists(dirPath))) {
			await this.app.vault.adapter.mkdir(dirPath);
		}
	}
}

export class CitekeyGenerator {
	static generateCitekey(authors: string[], year: number): string {
		if (authors.length === 0) return "Unknown" + year.toString().slice(-2);

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
			// Multiple authors: first 2 letters of first 2 authors + year
			const firstAuthor = this.extractLastName(authors[0]);
			const secondAuthor = this.extractLastName(authors[1]);
			const base = (
				firstAuthor.substring(0, 2) + secondAuthor.substring(0, 2)
			).toLowerCase();
			return base + yearSuffix;
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
		const citekey = this.generateCitekey(authors, year);
		return citekey;
	}

	static sanitizeFilename(title: string): string {
		return title
			.replace(/[<>:"/\\|?*]/g, "") // Remove invalid filename characters
			.replace(/\s+/g, " ") // Replace multiple spaces with single space
			.trim();
	}
}

export class SourceImporter {
	constructor(private app: App) {}

	async createSourceFile(sourceData: any, mediaType: string): Promise<TFile> {
		const citekey = CitekeyGenerator.generateFromTitleAndAuthors(
			sourceData.title,
			sourceData.author || [],
			sourceData.year
		);

		// Create readable filename from title
		let baseFilename = CitekeyGenerator.sanitizeFilename(sourceData.title);
		const sourceFolder = this.app.vault.getAbstractFileByPath("sources");
		const targetFolder =
			sourceFolder instanceof TFolder
				? `${sourceFolder.path}/${mediaType}`
				: `sources/${mediaType}`;

		// Ensure directory exists
		await this.ensureDirectoryExists(targetFolder);

		// Find a unique filename to avoid conflicts
		let filename = baseFilename + ".md";
		let filePath = `${targetFolder}/${filename}`;
		let counter = 1;

		// Keep adding suffixes until we find an unused filename
		while (await this.app.vault.adapter.exists(filePath)) {
			filename = `${baseFilename} (${counter}).md`;
			filePath = `${targetFolder}/${filename}`;
			counter++;
		}

		const content = this.generateSourceMarkdown({ ...sourceData, citekey });

		// Create file in vault
		const newFile = await this.app.vault.create(filePath, content);

		return newFile;
	}

	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (!(await this.app.vault.adapter.exists(dirPath))) {
			await this.app.vault.adapter.mkdir(dirPath);
		}
	}

	private generateSourceMarkdown(source: any): string {
		const yaml: any = {
			title: source.title,
			author: source.author || [],
			year: source.year,
			citekey: source.citekey,
			type: source.type || "misc",
			tags: ["source"],
		};

		// Add optional fields only if they exist
		if (source.doi) yaml.doi = source.doi;
		if (source.journal) yaml.journal = source.journal;
		if (source.publisher) yaml.publisher = source.publisher;
		if (source.pages) yaml.pages = source.pages;
		if (source.volume) yaml.volume = source.volume;
		if (source.issue) yaml.issue = source.issue;
		if (source.isbn) yaml.isbn = source.isbn;
		if (source.url) yaml.url = source.url;
		if (source.abstract) yaml.abstract = source.abstract;
		if (source.keywords) yaml.keywords = source.keywords;

		const yamlString = stringifyYaml(yaml);

		return `---
${yamlString}
---

# ${source.title}

**Authors:** ${(source.author || []).join(", ")}
**Year:** ${source.year}
${source.journal ? `**Journal:** ${source.journal}` : ""}
${source.publisher ? `**Publisher:** ${source.publisher}` : ""}
${source.doi ? `**DOI:** ${source.doi}` : ""}

## Abstract
${source.abstract || "<!-- Add abstract here -->"}

## Key Points
<!-- Add key findings here -->

## Notes
<!-- Your notes and analysis -->
`;
	}
}
