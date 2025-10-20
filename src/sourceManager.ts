import { App, Notice, Modal } from "obsidian";
import BibliographyManagerPlugin from "./main";
import { SourceData, SourceType, ImportMethod } from "./types";
import { CitekeyGenerator } from "./exportbib";
import { JatsFormatter } from "./jatsFormatter";

// Import from sourceService to use dynamic loading
import { Cite, util } from "./sourceService";
// Note: citation-js plugins are now dynamically loaded in sourceService

// Set User-Agent for Crossref API if email is provided
export function setCrossrefUserAgent(email: string, showNotifications: boolean = true) {
    if (email) {
        try {
            // Try to get version - works in both Node.js and browser
            let version = "unknown";
            try {
                if (typeof require !== 'undefined') {
                    version = require("@citation-js/core").version;
                } else if (typeof window !== 'undefined') {
                    // Browser environment - try to get version from global
                    version = (window as any).citationjs?.version || "unknown";
                }
            } catch (e) {
                console.warn("Could not get citation-js version:", e);
            }

            // Set User-Agent - util should be available from @citation-js/core
            const userAgent = `Bibliography-Manager-Obsidian-Plugin (mailto:${email}) Citation.js/${version}`;
            if (typeof util !== 'undefined') {
                util.setUserAgent(userAgent);
                console.log("User-Agent set:", userAgent);
            } else {
                console.warn("citation-js util not available, User-Agent not set");
            }
        } catch (error) {
            console.error("Failed to set User-Agent:", error);
        }
    } else if (showNotifications) {
        // Show notification that no email is provided
        if (typeof window !== 'undefined' && (window as any).app) {
            // Obsidian environment
            const { Notice } = require("obsidian");
            new Notice("No Crossref email provided. DOI lookups may have lower rate limits. Add your email in plugin settings for better performance.", 8000);
        }
        console.warn("No Crossref email provided. Add your email in plugin settings for better API rate limits.");
    }
}



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

			const citation = await Cite.async(cleanDOI);
			const data = citation.data;

			if (!data || data.length === 0) {
				throw new Error("No data found for this DOI");
			}

			return this.convertCitationDataToSourceData(data[0]);
		} catch (error) {
			throw new Error(`DOI lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async importFromISBN(isbn: string): Promise<SourceData | null> {
		try {
			// Clean ISBN input
			const cleanISBN = isbn.replace(/[-\s]/g, "");

			const citation = await Cite.async(cleanISBN);
			const data = citation.data;

			if (!data || data.length === 0) {
				throw new Error("No data found for this ISBN");
			}

			return this.convertCitationDataToSourceData(data[0]);
		} catch (error) {
			throw new Error(`ISBN lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async importFromURL(url: string): Promise<SourceData | null> {
		try {
			const citation = await Cite.async(url);
			const data = citation.data;

			if (!data || data.length === 0) {
				// Fallback to basic website data
				return this.createBasicWebsiteSource(url);
			}

			return this.convertCitationDataToSourceData(data[0]);
		} catch (error) {
			// Fallback to basic website data
			return this.createBasicWebsiteSource(url);
		}
	}

	private async importFromBibTeX(bibtex: string): Promise<SourceData | null> {
		try {
			const citation = await Cite.async(bibtex);
			const data = citation.data;

			if (!data || data.length === 0) {
				throw new Error("Invalid BibTeX format");
			}

			return this.convertCitationDataToSourceData(data[0]);
		} catch (error) {
			throw new Error(`BibTeX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async convertCitationDataToSourceData(citationData: any): Promise<SourceData> {
		// Extract authors using shared CitekeyGenerator method
		const authors = CitekeyGenerator.extractAuthorsFromCitationData(citationData);

		// Extract year
		const year = citationData.issued?.["date-parts"]?.[0]?.[0] ||
				   citationData.published?.["date-parts"]?.[0]?.[0] ||
				   citationData.year ||
				   new Date().getFullYear();

		// Generate citation key if not present, using CitekeyGenerator
		let citekey = citationData["citation-key"] ||
			CitekeyGenerator.generateFromTitleAndAuthors(
				citationData.title || "Untitled Source",
				authors,
				year
			);

		// Detect source type
		const sourceType = this.detectSourceType(citationData);

		return {
			citekey,
			author: authors,
			category: [sourceType],
			bibtype: citationData.type || "misc",
			downloadurl: citationData.URL || citationData.url,
			imageurl: undefined,
			year: year?.toString(),
			added: new Date().toISOString().split("T")[0],
			title: citationData.title || "Untitled Source",
			aliases: [`@${citekey}`],
			abstract: citationData.abstract,
			abstractmd: citationData.abstract ? await JatsFormatter.formatJatsToMarkdown(citationData.abstract) : undefined,
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
		const title = CitekeyGenerator.extractTitleFromURL(url);
		const year = new Date().getFullYear();

		// Generate citekey for website source
		const citekey = CitekeyGenerator.generateFromTitleAndAuthors(
			title,
			[],
			year
		);

		return {
			citekey,
			author: [],
			category: ["website"],
			bibtype: "webpage",
			downloadurl: url,
			imageurl: undefined,
			year: year.toString(),
			added: new Date().toISOString().split("T")[0],
			title: title,
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

	}