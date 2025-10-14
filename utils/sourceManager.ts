import { App, TFile, Notice, normalizePath, Modal } from "obsidian";
import BibliographyManagerPlugin from "../main";

// @ts-ignore - citation-js doesn't have official TypeScript types
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-doi";
import "@citation-js/plugin-isbn";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-wikidata";

// Browser-compatible citation-js with plugins

// Crossref API interface for DOI lookup
interface CrossrefWork {
	title: string[];
	author: Array<{
		given?: string;
		family?: string;
		name?: string;
	}>;
	published?: {
		'date-parts': Array<Array<number>>;
	};
	'DOI': string;
	'container-title'?: string[];
	type: string;
	publisher?: string;
	volume?: string;
	issue?: string;
	page?: string;
	abstract?: string;
	ISBN?: string[];
	URL?: string;
}

// Open Library API interface for ISBN lookup
interface OpenLibraryBook {
	title: string;
	authors: Array<{ name: string }>;
	publish_date?: string;
	publishers?: Array<{ name: string }>;
	identifiers?: {
		isbn_10?: string[];
		isbn_13?: string[];
	};
	number_of_pages?: number;
	publish_places?: Array<{ name: string }>;
	url?: string;
}

// Source data interface matching the frontmatter schema
export interface SourceData {
	citekey: string;
	author: string[];
	category: string[];
	bibtype: string;
	downloadurl?: string;
	imageurl?: string;
	year?: string;
	added?: string;
	started?: string;
	ended?: string;
	rating?: string;
	pages?: number;
	currentpage?: number;
	status?: string;
	filelink?: string;
	title: string;
	notetype: "source";
	aliases?: string[];
	// Additional fields that might come from citation-js
	abstract?: string;
	publisher?: string;
	journal?: string;
	volume?: string;
	number?: string;
	doi?: string;
	isbn?: string;
	url?: string;
}

// Source type detection
export type SourceType = "book" | "paper" | "website" | "thesis" | "report" | "other";

// Import methods
export type ImportMethod = "doi" | "isbn" | "url" | "bibtex";

export class SourceImportModal extends Modal {
	plugin: BibliographyManagerPlugin;
	currentMethod: ImportMethod;
	private onImport: (data: SourceData) => void;

	constructor(app: App, plugin: BibliographyManagerPlugin, onImport: (data: SourceData) => void) {
		super(app);
		this.plugin = plugin;
		this.currentMethod = "doi";
		this.onImport = onImport;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Title
		contentEl.createEl("h2", { text: "Import Source" });

		// Method selection buttons
		const methodContainer = contentEl.createDiv("source-import-methods");
		methodContainer.createEl("h3", { text: "Import Method:" });

		const methodButtons: { method: ImportMethod; label: string; placeholder: string }[] = [
			{ method: "doi", label: "DOI", placeholder: "10.1234/example.doi" },
			{ method: "isbn", label: "ISBN", placeholder: "978-0-123456-78-9" },
			{ method: "url", label: "URL", placeholder: "https://example.com/article" },
			{ method: "bibtex", label: "BibTeX", placeholder: "@article{...}" }
		];

		const inputContainer = contentEl.createDiv("source-import-input");
		const inputEl = inputContainer.createEl("textarea", {
			attr: { placeholder: methodButtons[0].placeholder },
			cls: "source-import-textarea"
		});
		inputEl.rows = 4;

		const methodButtonContainer = methodContainer.createDiv("method-buttons");
		methodButtons.forEach(({ method, label, placeholder }) => {
			const button = methodButtonContainer.createEl("button", {
				text: label,
				cls: `method-button ${this.currentMethod === method ? "active" : ""}`
			});

			button.onclick = () => {
				// Update active state
				methodButtonContainer.querySelectorAll(".method-button").forEach(btn =>
					btn.removeClass("active"));
				button.addClass("active");

				this.currentMethod = method;
				inputEl.placeholder = placeholder;
				inputEl.value = "";
				inputEl.focus();
			};
		});

		// Paste button
		const pasteButton = inputContainer.createEl("button", {
			text: "📋 Paste",
			cls: "paste-button"
		});
		pasteButton.onclick = async () => {
			try {
				const text = await navigator.clipboard.readText();
				inputEl.value = text;
			} catch (error) {
				new Notice("Failed to read clipboard. Please paste manually.");
			}
		};

		// Import button
		const importButton = contentEl.createEl("button", {
			text: "Import Source",
			cls: "mod-cta"
		});
		importButton.onclick = () => this.handleImport(inputEl.value);

		// Add some basic styling
		contentEl.addClass("source-import-modal");
	}

	private async handleImport(input: string): Promise<void> {
		if (!input.trim()) {
			new Notice("Please enter a value to import");
			return;
		}

		try {
			let sourceData: SourceData | null = null;

			switch (this.currentMethod) {
				case "doi":
					sourceData = await this.importFromDOI(input.trim());
					break;
				case "isbn":
					sourceData = await this.importFromISBN(input.trim());
					break;
				case "url":
					sourceData = await this.importFromURL(input.trim());
					break;
				case "bibtex":
					sourceData = await this.importFromBibTeX(input.trim());
					break;
			}

			if (sourceData) {
				this.onImport(sourceData);
				this.close();
			}
		} catch (error) {
			console.error("Import error:", error);
			new Notice(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async importFromDOI(doi: string): Promise<SourceData | null> {
		try {
			// Clean DOI input
			const cleanDOI = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

			const cite = new Cite(cleanDOI);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				throw new Error("No data found for this DOI");
			}

			return this.convertCitationDataToSourceData(data[0], "doi");
		} catch (error) {
			throw new Error(`DOI lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async importFromISBN(isbn: string): Promise<SourceData | null> {
		try {
			// Clean ISBN input
			const cleanISBN = isbn.replace(/[-\s]/g, "");

			const cite = new Cite(cleanISBN);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				throw new Error("No data found for this ISBN");
			}

			return this.convertCitationDataToSourceData(data[0], "isbn");
		} catch (error) {
			throw new Error(`ISBN lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async importFromURL(url: string): Promise<SourceData | null> {
		try {
			const cite = new Cite(url);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				// Fallback to basic website data
				return this.createBasicWebsiteSource(url);
			}

			return this.convertCitationDataToSourceData(data[0], "url");
		} catch (error) {
			// Fallback to basic website data
			return this.createBasicWebsiteSource(url);
		}
	}

	private async importFromBibTeX(bibtex: string): Promise<SourceData | null> {
		try {
			const cite = new Cite(bibtex);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				throw new Error("Invalid BibTeX format");
			}

			return this.convertCitationDataToSourceData(data[0], "bibtex");
		} catch (error) {
			throw new Error(`BibTeX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private convertCitationDataToSourceData(citationData: any, source: string): SourceData {
		// Generate citation key if not present
		let citekey = citationData["citation-key"] || this.generateCitationKey(citationData);

		// Detect source type
		const sourceType = this.detectSourceType(citationData);

		// Extract authors
		const authors = this.extractAuthors(citationData);

		// Extract year
		const year = citationData.issued?.["date-parts"]?.[0]?.[0]?.toString() ||
				   citationData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
				   citationData.year?.toString();

		return {
			citekey,
			author: authors,
			category: [sourceType],
			bibtype: citationData.type || "misc",
			downloadurl: citationData.URL || citationData.url,
			imageurl: undefined,
			year,
			added: new Date().toISOString().split("T")[0],
			title: citationData.title || "Untitled Source",
			notetype: "source",
			aliases: [`@${citekey}`],
			abstract: citationData.abstract,
			publisher: citationData.publisher,
			journal: citationData["container-title"],
			volume: citationData.volume,
			number: citationData.issue,
			doi: citationData.DOI,
			isbn: citationData.ISBN,
			url: citationData.URL || citationData.url,
			pages: citationData.page ? parseInt(citationData.page) : undefined,
		};
	}

	private createBasicWebsiteSource(url: string): SourceData {
		const citekey = this.generateCitationKeyFromURL(url);

		return {
			citekey,
			author: [],
			category: ["website"],
			bibtype: "webpage",
			downloadurl: url,
			imageurl: undefined,
			year: new Date().getFullYear().toString(),
			added: new Date().toISOString().split("T")[0],
			title: this.extractTitleFromURL(url),
			notetype: "source",
			aliases: [`@${citekey}`],
			url,
		};
	}

	private detectSourceType(citationData: any): SourceType {
		const type = citationData.type?.toLowerCase();
		const containerTitle = citationData["container-title"]?.toLowerCase();

		if (type === "article-journal" || containerTitle?.includes("journal")) {
			return "paper";
		}
		if (type === "book" || type === "book-chapter") {
			return "book";
		}
		if (type === "thesis") {
			return "thesis";
		}
		if (type === "report") {
			return "report";
		}
		if (type === "webpage" || citationData.URL) {
			return "website";
		}

		return "other";
	}

	private extractAuthors(citationData: any): string[] {
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

	private generateCitationKey(citationData: any): string {
		const firstAuthor = citationData.author?.[0];
		const year = citationData.issued?.["date-parts"]?.[0]?.[0] ||
					citationData.year ||
					new Date().getFullYear();

		let authorPart = "Unknown";
		if (firstAuthor) {
			if (firstAuthor.family) {
				authorPart = firstAuthor.family;
			} else if (firstAuthor.literal) {
				authorPart = firstAuthor.literal.split(/\s+/)[0];
			}
		}

		const titleWord = citationData.title?.split(/\s+/)[0]?.substring(0, 3).toUpperCase() || "UNK";

		return `${authorPart}${year}${titleWord}`;
	}

	private generateCitationKeyFromURL(url: string): string {
		try {
			const domain = new URL(url).hostname.replace("www.", "");
			const year = new Date().getFullYear();
			const random = Math.random().toString(36).substring(2, 5).toUpperCase();
			return `${domain}${year}${random}`;
		} catch {
			const year = new Date().getFullYear();
			const random = Math.random().toString(36).substring(2, 8).toUpperCase();
			return `WEB${year}${random}`;
		}
	}

	private extractTitleFromURL(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathParts = urlObj.pathname.split("/").filter(part => part.length > 0);
			const lastPart = pathParts[pathParts.length - 1];

			// Convert dashes and underscores to spaces and capitalize
			return lastPart.replace(/[-_]/g, " ")
						  .replace(/\b\w/g, l => l.toUpperCase()) ||
						  urlObj.hostname;
		} catch {
			return "Website Source";
		}
	}
}