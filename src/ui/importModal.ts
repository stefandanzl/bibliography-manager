import { App, Notice, Modal, Setting } from "obsidian";
// import { CitekeyGenerator, SourceImporter } from "./exportbib";
import BibliographyManagerPlugin from "../main";

// @ts-ignore - citation-js doesn't have official TypeScript types
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-doi";
import "@citation-js/plugin-isbn";
import "@citation-js/plugin-bibtex";
import { loadTemplateFile } from "../utils/template";
import { CitekeyGenerator } from "../utils/citekey";
import { SourceImporter } from "../utils/soureImporter";
import { BibliographySettings } from "src/types/settings";
// Note: wikidata plugin removed to save 2.5MB bundle size

export class SourceImportModal extends Modal {
	private sourceData: any = {};
	private mediaType: string = "default";
	private currentImportMode: string = "";
	private typeDropdown: any; // Reference to the media type dropdown
	private settings: BibliographySettings;
	private plugin?: BibliographyManagerPlugin;

	constructor(
		app: App,
		settings: BibliographySettings,
		plugin?: BibliographyManagerPlugin
	) {
		super(app);
		this.settings = settings;
		this.plugin = plugin;
	}

	/**
	 * Sets the appropriate default media type based on the current import mode
	 */
	private setDefaultMediaType(importMode: string): void {
		this.currentImportMode = importMode;

		// Reset the dropdown to "default" whenever import mode changes
		if (this.typeDropdown) {
			this.typeDropdown.setValue("default");
			this.mediaType = "default";
		}
	}

	/**
	 * Unified function to process citation-js data and update sourceData
	 * Eliminates redundant code across all import methods
	 */
	private processCitationData(citationData: any): void {
		if (!citationData || typeof citationData !== "object") {
			throw new Error("Invalid citation data received");
		}

		// Update core fields - only overwrite if citation has value
		this.sourceData.title = citationData.title || this.sourceData.title;
		this.sourceData.author = citationData.author
			? CitekeyGenerator.extractAuthorsFromCitationData(citationData)
			: this.sourceData.author;
		this.sourceData.year =
			citationData.issued?.["date-parts"]?.[0]?.[0]?.toString() ||
			citationData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
			citationData.year?.toString() ||
			this.sourceData.year;
		this.sourceData.abstract = citationData.abstract;

		// Update bibliographic fields
		this.sourceData.journal =
			citationData["container-title"] || this.sourceData.journal;
		this.sourceData.publisher =
			citationData.publisher || this.sourceData.publisher;
		this.sourceData.doi = citationData.DOI || this.sourceData.doi;
		this.sourceData.isbn = citationData.ISBN || this.sourceData.isbn;
		this.sourceData.url =
			citationData.URL || citationData.url || this.sourceData.url;
		this.sourceData.pages = citationData.page
			? parseInt(citationData.page)
			: undefined;
		this.sourceData.volume = citationData.volume || this.sourceData.volume;
		this.sourceData.number = citationData.issue || this.sourceData.number;

		// Set bibtype based on media type setting
		if (this.mediaType === "default") {
			// Auto-detect from citation data with import mode-specific defaults
			if (citationData.type) {
				this.sourceData.bibtype = citationData.type;
			} else {
				// Fallback to import mode defaults if no type detected
				switch (this.currentImportMode) {
					case "isbn":
						this.sourceData.bibtype = "book";
						break;
					case "url":
						this.sourceData.bibtype = "webpage";
						break;
					case "bibtex":
					case "doi":
					default:
						this.sourceData.bibtype = "article"; // Paper default
						break;
				}
			}
		} else {
			// Use manually selected type
			this.sourceData.bibtype =
				this.mediaType === "Book"
					? "book"
					: this.mediaType === "Website"
					? "webpage"
					: this.mediaType === "Paper"
					? "article"
					: this.mediaType === "Other"
					? "misc"
					: citationData.type || "misc";
		}

		// Handle keywords if they exist
		if (citationData.keyword) {
			this.sourceData.keywords = Array.isArray(citationData.keyword)
				? citationData.keyword
				: [citationData.keyword];
		}

		// Generate citekey if not present and we have required data
		if (
			!this.sourceData.citekey &&
			this.sourceData.title &&
			this.sourceData.author &&
			this.sourceData.year
		) {
			this.sourceData.citekey =
				CitekeyGenerator.generateFromTitleAndAuthors(
					this.sourceData.title,
					this.sourceData.author,
					parseInt(this.sourceData.year)
				);
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Import Source" });

		// Input method selection
		const methodContainer = contentEl.createDiv({ cls: "import-methods" });
		methodContainer.createEl("h3", { text: "Import Method" });

		const bibtexButton = methodContainer.createEl("button", {
			text: "📚 BibTeX",
		}) as HTMLButtonElement;
		const doiButton = methodContainer.createEl("button", {
			text: "📄 DOI",
		}) as HTMLButtonElement;
		const isbnButton = methodContainer.createEl("button", {
			text: "📖 ISBN",
		}) as HTMLButtonElement;
		const urlButton = methodContainer.createEl("button", {
			text: "🔗 URL",
		}) as HTMLButtonElement;
		const manualButton = methodContainer.createEl("button", {
			text: "✏️ Manual",
		}) as HTMLButtonElement;

		// Source type selection
		const typeContainer = contentEl.createDiv({ cls: "source-type" });
		typeContainer.createEl("h3", { text: "Source Type" });

		const typeSetting = new Setting(typeContainer)
			.setName("Media Type")
			.setDesc("Choose the type of source")
			.addDropdown((dropdown) => {
				this.typeDropdown = dropdown;
				return dropdown
					.addOption("default", "Default")
					.addOption("Paper", "Paper")
					.addOption("Book", "Book")
					.addOption("Website", "Website")
					.addOption("Other", "Other")
					.setValue("default")
					.onChange((value) => {
						this.mediaType = value;
					});
			});

		// Dynamic content area
		const contentArea = contentEl.createDiv({ cls: "import-content" });

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: "import-actions" });

		const importButton = buttonContainer.createEl("button", {
			text: "Import Source",
			cls: "mod-cta",
		}) as HTMLButtonElement;

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		}) as HTMLButtonElement;

		// Event handlers
		urlButton.onclick = () => this.showUrlImport(contentArea);
		doiButton.onclick = () => this.showDoiImport(contentArea);

		isbnButton.onclick = () => this.showIsbnImport(contentArea);
		bibtexButton.onclick = () => this.showBibtexImport(contentArea);
		manualButton.onclick = () => this.showManualImport(contentArea);

		importButton.onclick = () => this.importSource();
		cancelButton.onclick = () => this.close();
	}

	private showUrlImport(container: any) {
		container.empty();
		this.setDefaultMediaType("url");

		const urlSetting = new Setting(container)
			.setName("URL")
			.setDesc("Enter the URL of the source")
			.addText((text) =>
				text
					.setPlaceholder("https://example.com/paper")
					.onChange((value) => {
						this.sourceData.url = value;
					})
			);

		const fetchButton = container.createEl("button", {
			text: "Fetch Metadata",
		}) as HTMLButtonElement;
		fetchButton.onclick = () => this.fetchUrlMetadata();
	}

	private showDoiImport(container: any) {
		container.empty();
		this.setDefaultMediaType("doi");

		const doiSetting = new Setting(container)
			.setName("DOI")
			.setDesc("Enter the DOI of the source")
			.addText((text) =>
				text.setPlaceholder("10.1000/xyz123").onChange((value) => {
					this.sourceData.doi = value;
				})
			);

		const lookupButton = container.createEl("button", {
			text: "Lookup DOI",
		}) as HTMLButtonElement;
		lookupButton.onclick = () => this.lookupDoi();
	}

	private showIsbnImport(container: any) {
		container.empty();
		this.setDefaultMediaType("isbn");

		const isbnSetting = new Setting(container)
			.setName("ISBN")
			.setDesc("Enter the ISBN of the book")
			.addText((text) =>
				text.setPlaceholder("978-0-123456-78-9").onChange((value) => {
					this.sourceData.isbn = value;
				})
			);

		const lookupButton = container.createEl("button", {
			text: "Lookup ISBN",
		}) as HTMLButtonElement;
		lookupButton.onclick = () => this.lookupIsbn();
	}

	private showBibtexImport(container: any) {
		container.empty();
		this.setDefaultMediaType("bibtex");

		const bibtexSetting = new Setting(container)
			.setName("BibTeX")
			.setDesc("Paste BibTeX entry")
			.addTextArea((text) =>
				text
					.setPlaceholder(
						"@book{Ste10,\n  title = {...},\n  author = {...},\n  year = {2010}\n}"
					)
					.onChange((value) => {
						this.sourceData.bibtex = value;
					})
			);

		const parseButton = container.createEl("button", {
			text: "Parse BibTeX",
		}) as HTMLButtonElement;
		parseButton.onclick = () => this.parseBibtex();
	}

	private showManualImport(container: any) {
		container.empty();
		this.setDefaultMediaType("manual");

		const titleSetting = new Setting(container)
			.setName("Title")
			.addText((text) =>
				text.setPlaceholder("Title of the source").onChange((value) => {
					this.sourceData.title = value;
				})
			);

		const authorSetting = new Setting(container)
			.setName("Authors")
			.setDesc("Separate multiple authors with semicolons")
			.addText((text) =>
				text
					.setPlaceholder("John Smith; Jane Doe")
					.onChange((value) => {
						this.sourceData.author = value
							.split(";")
							.map((a) => a.trim());
					})
			);

		const yearSetting = new Setting(container)
			.setName("Year")
			.addText((text) =>
				text.setPlaceholder("2023").onChange((value) => {
					this.sourceData.year = parseInt(value);
				})
			);

		const journalSetting = new Setting(container)
			.setName("Journal/Publisher")
			.addText((text) =>
				text
					.setPlaceholder("Journal name or publisher")
					.onChange((value) => {
						this.sourceData.journal = value;
					})
			);

		const generateButton = container.createEl("button", {
			text: "Generate Citekey",
		}) as HTMLButtonElement;
		generateButton.onclick = () => {
			if (
				this.sourceData.title &&
				this.sourceData.author &&
				this.sourceData.year
			) {
				const citekey = CitekeyGenerator.generateFromTitleAndAuthors(
					this.sourceData.title,
					this.sourceData.author,
					this.sourceData.year
				);
				this.sourceData.citekey = citekey;
				new Notice(`Generated citekey: ${citekey}`);
			} else {
				new Notice("Please fill in title, authors, and year first");
			}
		};
	}

	private async fetchUrlMetadata() {
		try {
			if (!this.sourceData.url) {
				new Notice("Please enter a URL first");
				return;
			}

			new Notice("Fetching metadata from URL...");

			const cite = await Cite.async(this.sourceData.url);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				// Fallback to basic website data
				this.createBasicWebsiteData(this.sourceData.url);
				new Notice("Created basic website entry (no metadata found)");
				return;
			}

			// Use unified function to process citation data (includes citekey generation)
			this.processCitationData(data[0]);

			new Notice("Metadata fetched successfully");

			// Show updated data to user
			this.showUpdatedData();
		} catch (error) {
			console.error("URL metadata fetch error:", error);
			// Fallback to basic website data
			this.createBasicWebsiteData(this.sourceData.url);
			new Notice("Created basic website entry (metadata fetch failed)");
		}
	}

	private async lookupDoi() {
		try {
			if (!this.sourceData.doi) {
				new Notice("Please enter a DOI first");
				return;
			}

			new Notice("Looking up DOI...");

			// Clean DOI input
			const cleanDOI = this.sourceData.doi.replace(
				/^https?:\/\/(?:dx\.)?doi\.org\//,
				""
			);

			const cite = await Cite.async(cleanDOI);
			const data = await cite.format("data", { format: "object" });

			console.warn("Lookup DOI");
			console.log(data);
			if (!data || data.length === 0) {
				throw new Error("No data found for this DOI");
			}
			// Use unified function to process citation data
			this.processCitationData(data[0]);

			// DOI-specific bibtype fallback (for academic papers)
			if (
				!this.sourceData.bibtype ||
				this.sourceData.bibtype === "misc"
			) {
				this.sourceData.bibtype = "paper";
			}

			new Notice("DOI lookup successful");

			// Show updated data to user
			this.showUpdatedData();
		} catch (error) {
			console.error("DOI lookup error:", error);
			new Notice(
				`DOI lookup failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	private async parseBibtex() {
		try {
			if (!this.sourceData.bibtex) {
				new Notice("Please enter BibTeX entry first");
				return;
			}

			new Notice("Parsing BibTeX...");

			const cite = await Cite.async(this.sourceData.bibtex);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				throw new Error("Invalid BibTeX format");
			}

			// Use unified function to process citation data
			this.processCitationData(data[0]);

			// BibTeX processing complete (all fields handled by unified function)

			new Notice("BibTeX parsing successful");

			// Show updated data to user
			this.showUpdatedData();
		} catch (error) {
			console.error("BibTeX parsing error:", error);
			new Notice(
				`BibTeX parsing failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	private async lookupIsbn() {
		try {
			if (!this.sourceData.isbn) {
				new Notice("Please enter an ISBN first");
				return;
			}

			new Notice("Looking up ISBN...");

			// Clean ISBN input
			const cleanISBN = this.sourceData.isbn.replace(/[-\s]/g, "");

			const cite = await Cite.async(cleanISBN);
			const data = await cite.format("data", { format: "object" });

			if (!data || data.length === 0) {
				throw new Error("No data found for this ISBN");
			}

			// Use unified function to process citation data
			this.processCitationData(data[0]);

			new Notice("ISBN lookup successful");

			// Show updated data to user
			this.showUpdatedData();
		} catch (error) {
			console.error("ISBN lookup error:", error);
			new Notice(
				`ISBN lookup failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	private createBasicWebsiteData(url: string) {
		this.sourceData.title =
			this.sourceData.title || CitekeyGenerator.extractTitleFromURL(url);
		this.sourceData.author = this.sourceData.author || [];
		this.sourceData.year =
			this.sourceData.year || new Date().getFullYear().toString();
		this.sourceData.url = url;
		this.sourceData.type = "webpage";

		if (!this.sourceData.citekey && this.sourceData.title) {
			this.sourceData.citekey =
				CitekeyGenerator.generateFromTitleAndAuthors(
					this.sourceData.title,
					this.sourceData.author,
					parseInt(this.sourceData.year)
				);
		}
	}

	private showUpdatedData() {
		let message = "Updated data:\n";
		if (this.sourceData.title)
			message += `Title: ${this.sourceData.title}\n`;
		if (this.sourceData.author && this.sourceData.author.length > 0) {
			message += `Authors: ${this.sourceData.author.join(", ")}\n`;
		}
		if (this.sourceData.year) message += `Year: ${this.sourceData.year}\n`;
		if (this.sourceData.citekey)
			message += `Citekey: ${this.sourceData.citekey}\n`;

		console.log(message);
	}

	private async importSource() {
		try {
			// Load template file right before using it
			if (this.plugin) {
				await loadTemplateFile(this.plugin);
			}

			const importer = new SourceImporter(
				this.app,
				this.settings.sourcesFolder,
				this.settings.sourceNoteTemplate
			);
			const newFile = await importer.createSourceFile(
				this.sourceData,
				this.mediaType
			);

			// Open in new tab
			await this.app.workspace.getLeaf(true).openFile(newFile);

			new Notice(`Source imported: ${newFile.basename}`);
			this.close();
		} catch (error) {
			console.error("Error importing source:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("File already exists")) {
				// Special handling for duplicate files
				new Notice(
					"⚠️ Duplicate Source Detected\n\nA source file with this citekey already exists. Try importing with a different title or check your sources folder for duplicates."
				);
			} else {
				// Generic error for other issues
				new Notice(`Error importing source\n\n${errorMessage}`);
			}
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
