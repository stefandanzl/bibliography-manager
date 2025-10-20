import {
	App,
	TFile,
	Notice,
	normalizePath,
	TFolder,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import { SourceData, SourceType, BibliographySettings } from "./types";
import { BIB_FIELDS, DEFAULT_SETTINGS } from "./settings";
import { CitekeyGenerator } from "./exportbib";

// Dynamic imports for citation-js modules
let CiteConstructor: any = null;
let utilInstance: any = null;
let citationUtil: any = null;

async function initializeCiteJS() {
	if (CiteConstructor) return CiteConstructor;

	// Use dynamic import for proper module loading
	const citationCore = await import("@citation-js/core");
	const bibtexPlugin = await import("@citation-js/plugin-bibtex");
	const hayagrivaPlugin = await import("@citation-js/plugin-hayagriva");

	// Get the Cite class and util
	CiteConstructor =
		(citationCore as any).default?.Cite ||
		(citationCore as any).Cite ||
		(citationCore as any).default;

	// Get the util object
	citationUtil = (citationCore as any).default?.util || (citationCore as any).util;

	if (!CiteConstructor) {
		throw new Error("Could not find Cite constructor in citation-js/core");
	}

	// Load bibtex plugin
	const bibtexConfig = (bibtexPlugin as any).default || bibtexPlugin;
	if (typeof CiteConstructor.add === "function") {
		CiteConstructor.add(bibtexConfig);
	}

	// Load hayagriva plugin
	const hayagrivaConfig = (hayagrivaPlugin as any).default || hayagrivaPlugin;
	if (typeof CiteConstructor.add === "function") {
		CiteConstructor.add(hayagrivaConfig);
	}

	// Enable using `id` as the cite key label
	const plugins = CiteConstructor.plugins || {};
	if (plugins.config && plugins.config.get) {
		try {
			plugins.config.get("@bibtex").format.useIdAsLabel = true;
		} catch (e) {
			console.log("Could not configure bibtex plugin format:", e);
		}
	}

	return CiteConstructor;
}

// Initialize citation-js on module load (but still async)
initializeCiteJS().then(() => {
	console.log("Citation-js plugins loaded");
}).catch(err => {
	console.error("Failed to initialize citation-js:", err);
});

// Cite factory that ensures initialization is complete
const createCite = async function(...args: any[]) {
	if (!CiteConstructor) {
		await initializeCiteJS();
	}
	return new CiteConstructor(...args);
};

// Export util as well
export const util = citationUtil || {
	// Provide basic util functions if citation-js not ready
	setUserAgent: (userAgent: string) => {
		console.log("Setting User-Agent (not fully initialized):", userAgent);
	}
};

// Export Cite as both factory and constructor for backward compatibility
export const Cite = createCite;
export { createCite };

// console.warn("GAAAAAAAAAAAA");
// console.log(new Cite());

export class SourceService {
	app: App;
	settings: BibliographySettings;

	constructor(app: App, settings?: BibliographySettings) {
		this.app = app;
		this.settings = settings || DEFAULT_SETTINGS;
	}

	/**
	 * Get the sources folder for a given file, checking frontmatter first, then using default
	 */
	async getSourcesFolder(
		file: TFile,
		defaultSourcesFolder: string
	): Promise<string> {
		const fileCache = this.app.metadataCache.getFileCache(file);
		const frontmatterSourcesFolder = fileCache?.frontmatter?.typst_bib;

		if (
			frontmatterSourcesFolder &&
			typeof frontmatterSourcesFolder === "string"
		) {
			return normalizePath(frontmatterSourcesFolder);
		}

		return normalizePath(defaultSourcesFolder);
	}

	/**
	 * Create a markdown file for a source with proper frontmatter and content
	 */
	async createSourceFile(
		sourceData: SourceData,
		sourcesFolder: string,
		template?: string
	): Promise<TFile | null> {
		try {
			// Ensure sources folder exists
			const sourceTypeFolder = this.getSourceTypeFolder(sourceData);
			const fullPath = normalizePath(
				`${sourcesFolder}/${sourceTypeFolder}`
			);

			await this.ensureFolderExists(fullPath);

			// Generate filename from title
			const filename = this.generateFilename(sourceData.title, fullPath);
			const filePath = normalizePath(`${fullPath}/${filename}.md`);

			// Generate file content
			const content = this.generateSourceFileContent(
				sourceData,
				template
			);

			// Create file using Obsidian API
			const file = await this.app.vault.create(filePath, content);

			new Notice(`Source created: ${filename}.md`);
			return file;
		} catch (error) {
			console.error("Failed to create source file:", error);
			new Notice(
				`Failed to create source file: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
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
	private getUniqueFilename(
		folderPath: string,
		baseFilename: string
	): string {
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
				throw new Error(
					`Path ${currentPath} exists but is not a folder`
				);
			}
		}
	}

	/**
	 * Generate the complete file content with frontmatter and structure
	 */
	private generateSourceFileContent(
		sourceData: SourceData,
		template?: string
	): string {
		// If template is provided, use regex rendering (simplified)
		if (template) {
			return this.renderTemplate(template, sourceData);
		}
		console.warn("No template loaded! Fallback template used:");
		// Fallback to original behavior
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
	 * Render template using shared utility from exportbib.ts
	 */
	private renderTemplate(template: string, sourceData: SourceData): string {
		// Import the template rendering function dynamically to avoid circular dependencies
		// This is a temporary workaround - in a full refactor, this would be in a shared utilities module
		const templateData: Record<string, any> = {};

		// Direct field mapping - template variables match source data fields
		Object.keys(sourceData).forEach((field) => {
			const value = sourceData[field as keyof SourceData];

			if (value !== undefined && value !== null) {
				// Handle special formatting for certain fields
				if (field === "atcitekey") {
					// Special handling for atcitekey - prepend @ symbol
					templateData[field] = `@${value}`;
				} else if (Array.isArray(value)) {
					// For arrays, provide both array version and pre-formatted YAML array string
					templateData[field] = value; // Keep as array for other uses
					templateData[field + "Array"] = this.formatYamlArray(value); // Pre-formatted YAML array
				} else if (typeof value === "string") {
					templateData[field] = value;
				} else {
					templateData[field] = String(value);
				}
			} else {
				// Set empty arrays for fields that should be arrays, empty strings for others
				if (field === "author" || field === "keywords") {
					templateData[field] = []; // Empty array for YAML
					templateData[field + "Array"] = "[]"; // Empty YAML array string
				} else {
					templateData[field] = "";
				}
			}
		});

		// Add helper fields
		templateData.authorList = Array.isArray(sourceData.author)
			? sourceData.author.join(", ")
			: sourceData.author || "";
		// Add atcitekey for aliases (citekey with @ prefix)
		if (sourceData.citekey) {
			templateData.atcitekey = `@${sourceData.citekey}`;
		}

		// Simple regex replacement for template variables
		let result = template;
		result = result.replace(/\{\{([^}]+)\}\}/g, (match, fieldPath) => {
			const trimmedPath = fieldPath.trim();
			const value = templateData[trimmedPath];
			return value !== undefined && value !== null ? String(value) : "";
		});

		return result;
	}

	/**
	 * Find all source files in the sources folder
	 */
	async findAllSourceFiles(sourcesFolder: string): Promise<TFile[]> {
		const sourceFiles: TFile[] = [];

		try {
			const folder = this.app.vault.getAbstractFileByPath(sourcesFolder);
			if (!(folder instanceof TFolder)) {
				console.warn(
					`⚠️ Sources folder not found or not a folder: ${sourcesFolder}`
				);
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
	private async searchSourceFilesRecursive(
		folder: TFolder,
		sourceFiles: TFile[]
	): Promise<void> {
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				const cache = this.app.metadataCache.getFileCache(child);
				const hasCitekey = cache?.frontmatter?.citekey;
				if (hasCitekey) {
					sourceFiles.push(child);
				} else {
					console.warn(`Source file without citekey: ${child.name}`);
				}
			} else if (child instanceof TFolder) {
				await this.searchSourceFilesRecursive(child, sourceFiles);
			}
		}
	}

	/**
	 * Generate bibliography in specified format from all source files
	 * @param sourcesFolder - Folder containing source files
	 * @param format - Output format: 'bibtex', 'csl-json', or 'hayagriva'
	 */
	async generateBibliography(
		sourcesFolder: string,
		format: "bibtex" | "csl-json" | "hayagriva"
	): Promise<string> {
		const sourceFiles = await this.findAllSourceFiles(sourcesFolder);
		let citeData: any[] = [];
		const seenCitekeys = new Map<string, { file: TFile; count: number }>();
		let duplicatesFound = 0;

		for (const file of sourceFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			if (frontmatter) {
				const citekey = frontmatter.citekey;

				if (!citekey) {
					continue;
				}

				// Check for duplicates
				if (seenCitekeys.has(citekey)) {
					duplicatesFound++;
					const existing = seenCitekeys.get(citekey)!;
					console.log(
						`%cDUPLICATE CITEKEY FOUND: ${citekey}%c\nOriginal: ${existing.file.path}\nDuplicate: ${file.path}`,
						"color: #7f6df2; font-weight: bold;",
						"color: #7f6df2;"
					);

					// Update count for reporting
					existing.count++;
				} else {
					// First occurrence of this citekey
					seenCitekeys.set(citekey, { file, count: 1 });

					// Convert frontmatter to citation-js format
					const citationEntry =
						this.convertFrontmatterToCitationJS(frontmatter);
					if (citationEntry) {
						citeData.push(citationEntry);
					}
				}
			}
		}

		// Proper deduplication - remove duplicates and keep only first occurrence
		if (duplicatesFound > 0) {
			console.warn(
				`Found ${duplicatesFound} duplicate citekeys during bibliography generation`
			);

			// Deduplicate citeData array, keeping first occurrence of each citekey
			const uniqueCiteData = [];
			const processedCitekeys = new Set<string>();

			for (const entry of citeData) {
				if (!processedCitekeys.has(entry.id)) {
					uniqueCiteData.push(entry);
					processedCitekeys.add(entry.id);
				}
			}

			console.log(
				`Deduplicated from ${citeData.length} to ${uniqueCiteData.length} entries`
			);
			new Notice(
				`Found ${duplicatesFound} duplicate sources. Deduplicated to ${uniqueCiteData.length} unique entries.`
			);

			// Replace citeData with deduplicated version
			citeData = uniqueCiteData;
		}

		if (citeData.length === 0) {
			console.warn(`No valid source data found for ${format} generation`);
			return "";
		}

		try {
			// Use citation-js to format as requested
			const cite = await Cite(citeData);

			switch (format) {
				case "bibtex":
					return cite.format("bibtex", {
						format: "text",
						lang: "en-US",
					});
				case "hayagriva":
					let yamlOutput = cite.format("hayagriva");

					// Post-process YAML to add missing type: misc entries
					try {
						// Parse YAML back to object
						const yamlData = parseYaml(yamlOutput);

						// Add type: misc to entries that don't have a type
						if (yamlData && typeof yamlData === "object") {
							Object.keys(yamlData).forEach((citekey) => {
								const entry = yamlData[citekey];
								if (
									entry &&
									typeof entry === "object" &&
									!entry.type
								) {
									entry.type = "misc";
								}
							});

							// Convert back to YAML string
							yamlOutput = stringifyYaml(yamlData);
						}
					} catch (error) {
						console.warn(
							"Failed to post-process Hayagriva YAML, continuing with original output:",
							error
						);
						// Continue with original output if parsing fails
					}

					return yamlOutput;
				case "csl-json":
					// return cite.format("data", { format: "object" });
					return JSON.stringify(citeData, null, 2);
				default:
					throw new Error(`Unsupported format: ${format}`);
			}
		} catch (error) {
			console.error(
				`Error generating ${format} with citation-js:`,
				error
			);
			throw new Error(`Failed to generate ${format}: ${error.message}`);
		}
	}

	/**
	 * Map our source types to CSL-JSON/BibTeX types
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
				return "webpage";
			case "thesis":
				return "thesis";
			case "report":
				return "report";
			default:
				return "article";
		}
	}

	private formatYamlArray(array: any[]): string {
		if (!array || array.length === 0) {
			return "[]";
		}

		// Format each element as a YAML string
		const formattedItems = array.map((item) => {
			if (typeof item === "string") {
				return `"${item.replace(/"/g, '\\"')}"`;
			} else if (typeof item === "number" || typeof item === "boolean") {
				return String(item);
			} else {
				// For objects or complex types, convert to string
				return `"${String(item).replace(/"/g, '\\"')}"`;
			}
		});

		return `[${formattedItems.join(", ")}]`;
	}

	/**
	 * Convert frontmatter data to citation-js format using field mappings
	 */
	private convertFrontmatterToCitationJS(frontmatter: any): any | null {
		if (!frontmatter.citekey) {
			return null;
		}

		// Get field mappings from settings
		const mappings = this.settings.fieldMappings;

		// Mappings are now: bibliography field -> frontmatter key
		// So we can use them directly

		// Create citation-js entry
		const citationEntry: any = {
			id: frontmatter[mappings.id] || frontmatter.citekey,
			type: this.mapToBibTeXType(
				frontmatter[mappings.type] || frontmatter.bibtype,
				frontmatter.category?.[0]
			),
		};

		// Map fields using mappings directly
		for (const bibField of BIB_FIELDS) {
			const frontmatterKey = mappings[bibField];
			if (frontmatterKey && frontmatter[frontmatterKey]) {
				const value = frontmatter[frontmatterKey];

				// Handle arrays specially for author and keywords
				if (bibField === "author" && Array.isArray(value)) {
					citationEntry.author = value;
				} else if (bibField === "keyword" && Array.isArray(value)) {
					citationEntry.keyword = value;
				} else if (Array.isArray(value) && value.length > 0) {
					// Convert other arrays to strings
					citationEntry[bibField] = value.join(", ");
				} else if (
					!Array.isArray(value) &&
					value &&
					value.toString().trim() !== ""
				) {
					citationEntry[bibField] = value;
				}
			}
		}

		// Handle special fields that need specific formatting
		const yearKey = mappings["issued"] || "year";
		if (frontmatter[yearKey]) {
			if (typeof frontmatter[yearKey] === "string") {
				// Extract year from date string if needed
				const yearMatch = frontmatter[yearKey].match(/\d{4}/);
				if (yearMatch) {
					citationEntry.issued = { "date-parts": [[yearMatch[0]]] };
				}
			} else if (typeof frontmatter[yearKey] === "number") {
				citationEntry.issued = {
					"date-parts": [[frontmatter[yearKey]]],
				};
			}
		}

		const doiKey = mappings["DOI"] || "doi";
		if (frontmatter[doiKey] && typeof frontmatter[doiKey] === "string") {
			// Clean up DOI - remove URL prefix if present
			let doi = frontmatter[doiKey];
			if (doi.startsWith("https://doi.org/")) {
				doi = doi.replace("https://doi.org/", "");
			} else if (doi.startsWith("http://dx.doi.org/")) {
				doi = doi.replace("http://dx.doi.org/", "");
			} else if (doi.startsWith("doi:")) {
				doi = doi.replace("doi:", "").trim();
			}
			citationEntry.DOI = doi;
		}

		return citationEntry;
	}
}
