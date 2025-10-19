import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Modal,
	Setting,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import { BibliographySettings } from "../settings";
import { CitekeyGenerator, SourceImporter } from "./exportbib";
import BibliographyManagerPlugin from "../main";
import { SourceService } from "./sourceService";
import {
	testDOIBasic,
	testDOIFormats,
	testDOIErrorHandling,
	testDOIOutputFormats,
	runAllDOITests,
} from "../tests/integration/doi-tests";
import { DOITestModal } from "../tests/integration/test-modal";

// @ts-ignore - citation-js doesn't have official TypeScript types
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-doi";
import "@citation-js/plugin-isbn";
import "@citation-js/plugin-bibtex";
import "@citation-js/plugin-wikidata";

export class GenerateCitekeyCommand {
	constructor(private app: App) {}

	async execute(editor: Editor, view: MarkdownView) {
		const file = view.file;
		if (!file) {
			new Notice("No file is currently active");
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

			if (!frontmatterMatch) {
				new Notice("No frontmatter found in this file");
				return;
			}

			const yaml = parseYaml(frontmatterMatch[1]);
			const title = yaml.title || file.basename;
			const authors = yaml.author || [];
			const year = yaml.year || new Date().getFullYear();

			if (authors.length === 0) {
				new Notice(
					"No authors found in frontmatter. Please add author field first."
				);
				return;
			}

			const citekey = CitekeyGenerator.generateFromTitleAndAuthors(
				title,
				authors,
				year
			);

			// Update frontmatter with citekey
			yaml.citekey = citekey;

			// Add @citekey to aliases if not already present
			if (!yaml.aliases) {
				yaml.aliases = [`@${citekey}`];
			} else if (Array.isArray(yaml.aliases)) {
				if (!yaml.aliases.includes(`@${citekey}`)) {
					yaml.aliases.push(`@${citekey}`);
				}
			} else {
				// Convert string alias to array and add @citekey
				const existingAliases = typeof yaml.aliases === 'string' ? [yaml.aliases] : [];
				yaml.aliases = [...existingAliases, `@${citekey}`];
			}

			const newYaml = stringifyYaml(yaml);
			const newContent = content.replace(
				/^---\n[\s\S]*?\n---/,
				`---\n${newYaml}---`
			);

			await this.app.vault.modify(file, newContent);
			new Notice(`Generated citekey: ${citekey}`);
		} catch (error) {
			console.error("Error generating citekey:", error);
			new Notice("Error generating citekey. Check console for details.");
		}
	}
}

export class BibliographyExportModal extends Modal {
	private bibContent: string = "";
	private sources: any[] = [];
	private settings: BibliographySettings;
	private sourceService: SourceService;

	constructor(app: App, settings: BibliographySettings) {
		super(app);
		this.settings = settings;
		this.sourceService = new SourceService(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Export Bibliography" });

		// Scope selection
		const scopeSetting = new Setting(contentEl)
			.setName("Export scope")
			.setDesc("Choose which sources to include in the bibliography")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("vault", "All sources in vault")
					.addOption("current", "Sources from current document")
					.setValue("vault")
					.onChange(async (value) => {
						await this.loadSources(value);
					})
			);

		// Loading indicator
		const loadingEl = contentEl.createDiv({ cls: "bibliography-loading" });
		loadingEl.createEl("p", { text: "Loading sources..." });

		// Preview area
		const previewContainer = contentEl.createDiv({
			cls: "bibliography-preview",
		});
		previewContainer.createEl("h3", { text: "Preview" });

		const previewEl = previewContainer.createEl("pre", {
			cls: "bibliography-preview-content",
			text: "Sources will appear here...",
		});

		// Action buttons
		const buttonContainer = contentEl.createDiv({
			cls: "bibliography-actions",
		});

		const exportButton = buttonContainer.createEl("button", {
			text: "Export Bibliography",
			cls: "mod-cta",
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});

		// Event handlers
		exportButton.onclick = () => this.exportBibliography();
		cancelButton.onclick = () => this.close();

		// Load initial sources
		await this.loadSources("vault");

		// Remove loading indicator
		loadingEl.remove();

		// Update preview when sources change
		this.updatePreview(previewEl);
	}

	private async loadSources(scope: string) {
		try {
			console.log(`🔍 Loading sources for bibliography export, scope: ${scope}`);

			if (scope === "vault") {
				// Use sources folder from settings
				const sourcesFolder = this.settings.sourcesFolder;
				console.log(`📂 Using sources folder: ${sourcesFolder}`);

				const sourceFiles = await this.sourceService.findAllSourceFiles(sourcesFolder);
				console.log(`📄 Found ${sourceFiles.length} source files`);

				// Generate bibliography based on format
				const format = this.settings.bibliographyFormat;
				console.log(`📋 Generating bibliography in format: ${format}`);

				if (format === "hayagriva") {
					this.bibContent = await this.sourceService.generateHayagrivaFromSources(sourcesFolder);
				} else {
					this.bibContent = await this.sourceService.generateBibTeXFromSources(sourcesFolder);
				}

				console.log(`📊 Generated bibliography content length: ${this.bibContent?.length || 0}`);
			} else {
				// Current document scope - would need to extract sources from current file
				// For now, fall back to vault scope
				await this.loadSources("vault");
			}
		} catch (error) {
			console.error("Error loading sources:", error);
			this.bibContent = `% Error: ${error.message}`;
		}
	}

	private updatePreview(previewEl: Element) {
		previewEl.textContent = this.bibContent;
	}

	private async exportBibliography() {
		try {
			// Generate full filename with extension based on format
			const extensionMap = {
				"bibtex": ".bib",
				"csl-json": ".json",
				"hayagriva": ".yaml"
			};
			const extension = extensionMap[this.settings.bibliographyFormat] || ".bib";
			const outputFolder = this.settings.bibliographyOutputFolder || this.settings.sourcesFolder;
			const bibPath = `${outputFolder}/${this.settings.bibliographyFilename}${extension}`;

			console.log(`📝 Exporting bibliography to: ${bibPath}`);
			console.log(`📊 Content length: ${this.bibContent?.length || 0} characters`);

			// Ensure output directory exists
			const outputDir = outputFolder;
			if (outputDir && !(await this.app.vault.adapter.exists(outputDir))) {
				console.log(`📁 Creating output directory: ${outputDir}`);
				await this.app.vault.adapter.mkdir(outputDir);
			}

			await this.app.vault.adapter.write(bibPath, this.bibContent);

			new Notice(`Bibliography exported to ${bibPath}`);
			console.log(`✅ Bibliography successfully exported to ${bibPath}`);
			this.close();
		} catch (error) {
			console.error("Error exporting bibliography:", error);
			new Notice(`Error exporting bibliography: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class SourceImportModal extends Modal {
	private sourceData: any = {};
	private mediaType: string = "Paper";
	private settings: BibliographySettings;
	private plugin?: BibliographyManagerPlugin;

	constructor(app: App, settings: BibliographySettings, plugin?: BibliographyManagerPlugin) {
		super(app);
		this.settings = settings;
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Import Source" });

		// Input method selection
		const methodContainer = contentEl.createDiv({ cls: "import-methods" });
		methodContainer.createEl("h3", { text: "Import Method" });

		const urlButton = methodContainer.createEl("button", {
			text: "🔗 URL",
		}) as HTMLButtonElement;
		const doiButton = methodContainer.createEl("button", {
			text: "📄 DOI",
		}) as HTMLButtonElement;
		const isbnButton = methodContainer.createEl("button", {
			text: "📖 ISBN",
		}) as HTMLButtonElement;
		const bibtexButton = methodContainer.createEl("button", {
			text: "📚 BibTeX",
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
			.addDropdown((dropdown) =>
				dropdown
					.addOption("Paper", "Paper")
					.addOption("Book", "Book")
					.addOption("Website", "Website")
					.addOption("Other", "Other")
					.setValue("Paper")
					.onChange((value) => {
						this.mediaType = value;
					})
			);

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

			const citationData = data[0];

			// Update sourceData with fetched metadata
			this.sourceData.title = citationData.title || this.sourceData.title;
			this.sourceData.author = this.extractAuthors(citationData);
			this.sourceData.year =
				citationData.issued?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.year?.toString() ||
				this.sourceData.year;
			this.sourceData.journal =
				citationData["container-title"] || this.sourceData.journal;
			this.sourceData.publisher =
				citationData.publisher || this.sourceData.publisher;
			this.sourceData.abstract = citationData.abstract;
			this.sourceData.doi = citationData.DOI;
			this.sourceData.url =
				citationData.URL || citationData.url || this.sourceData.url;

			// Generate citekey if not present
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
						this.sourceData.year
					);
			}

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

			if (!data || data.length === 0) {
				throw new Error("No data found for this DOI");
			}

			const citationData = data[0];

			// Update sourceData with fetched metadata
			this.sourceData.title = citationData.title || this.sourceData.title;
			this.sourceData.author = this.extractAuthors(citationData);
			this.sourceData.year =
				citationData.issued?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.year?.toString() ||
				this.sourceData.year;
			this.sourceData.journal =
				citationData["container-title"] || this.sourceData.journal;
			this.sourceData.publisher =
				citationData.publisher || this.sourceData.publisher;
			this.sourceData.abstract = citationData.abstract;
			this.sourceData.doi = citationData.DOI || this.sourceData.doi;
			this.sourceData.url =
				citationData.URL || citationData.url || this.sourceData.url;
			this.sourceData.volume = citationData.volume;
			this.sourceData.number = citationData.issue;
			this.sourceData.pages = citationData.page
				? parseInt(citationData.page)
				: undefined;

			// Generate citekey if not present
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
						this.sourceData.year
					);
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

			const citationData = data[0];

			// Update sourceData with parsed metadata
			this.sourceData.title = citationData.title || this.sourceData.title;
			this.sourceData.author = this.extractAuthors(citationData);
			this.sourceData.year =
				citationData.issued?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.year?.toString() ||
				this.sourceData.year;
			this.sourceData.journal =
				citationData["container-title"] || this.sourceData.journal;
			this.sourceData.publisher =
				citationData.publisher || this.sourceData.publisher;
			this.sourceData.abstract = citationData.abstract;
			this.sourceData.doi = citationData.DOI;
			this.sourceData.isbn = citationData.ISBN;
			this.sourceData.url =
				citationData.URL || citationData.url || this.sourceData.url;
			this.sourceData.volume = citationData.volume;
			this.sourceData.number = citationData.issue;
			this.sourceData.pages = citationData.page
				? parseInt(citationData.page)
				: undefined;
			this.sourceData.bibtype = citationData.type || "misc";

			// Generate citekey if not present
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
						this.sourceData.year
					);
			}

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

			const citationData = data[0];

			// Update sourceData with fetched metadata
			this.sourceData.title = citationData.title || this.sourceData.title;
			this.sourceData.author = this.extractAuthors(citationData);
			this.sourceData.year =
				citationData.issued?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
				citationData.year?.toString() ||
				this.sourceData.year;
			this.sourceData.publisher =
				citationData.publisher || this.sourceData.publisher;
			this.sourceData.abstract = citationData.abstract;
			this.sourceData.isbn = citationData.ISBN || this.sourceData.isbn;
			this.sourceData.url =
				citationData.URL || citationData.url || this.sourceData.url;
			this.sourceData.pages = citationData.page
				? parseInt(citationData.page)
				: undefined;
			this.sourceData.bibtype = citationData.type || "book";

			// Generate citekey if not present
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
						this.sourceData.year
					);
			}

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
			this.sourceData.title || this.extractTitleFromURL(url);
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

	private extractTitleFromURL(url: string): string {
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
				await this.plugin.loadTemplateFile();
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
			const errorMessage = error instanceof Error ? error.message : "Unknown error";

			if (errorMessage.includes("File already exists")) {
				// Special handling for duplicate files
				new Notice("⚠️ Duplicate Source Detected\n\nA source file with this citekey already exists. Try importing with a different title or check your sources folder for duplicates.");
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

// DOI Plugin Format Showcase
export async function testDOIPluginFormats(app: App) {
	const { Notice } = require("obsidian");

	try {
		new Notice("Testing DOI plugin output formats...");

		// Test DOI
		const testDOI = "10.1038/nature12373";
		const cite = await Cite.async(testDOI);

		// Get basic data first using the correct format: 'object' approach
		const data = await cite.format("data", { format: "object" });

		// Comprehensive format testing with proper typing
		const formatResults: Record<
			string,
			{
				description: string;
				success: boolean;
				result?: any;
				error?: string;
			}
		> = {};

		// All available output formats from citation.js
		const formats = [
			{ name: "bibtex", description: "BibTeX format for LaTeX" },
			{ name: "json", description: "JSON format" },
			{ name: "html", description: "HTML format for web display" },
			{ name: "text", description: "Plain text citation" },
			{ name: "ris", description: "RIS format for reference managers" },
			{ name: "ndjson", description: "Newline delimited JSON" },
			{ name: "cite", description: "Simple citation format" },
			{ name: "citation", description: "Full citation format" },
			{ name: "csl", description: "CSL-JSON format" },
			{ name: "bibliography", description: "Bibliography format" },
		];

		// Test each format using the correct API
		for (const format of formats) {
			try {
				const result = await cite.format(format.name);
				formatResults[format.name] = {
					description: format.description,
					success: true,
					result: result,
				};
			} catch (error: any) {
				formatResults[format.name] = {
					description: format.description,
					success: false,
					error: error.message,
				};
			}
		}

		// Test formats with options using the correct API
		const formatsWithOptions: Record<string, any> = {};

		// BibTeX with different styles using proper options
		try {
			formatsWithOptions["bibtex_apa"] = await cite.format("bibtex", {
				format: "string",
				type: "html",
				style: "apa",
			});
		} catch (e: any) {
			formatsWithOptions["bibtex_apa"] = `Error: ${e.message}`;
		}

		try {
			formatsWithOptions["bibtex_mla"] = await cite.format("bibtex", {
				format: "string",
				type: "html",
				style: "mla",
			});
		} catch (e: any) {
			formatsWithOptions["bibtex_mla"] = `Error: ${e.message}`;
		}

		// HTML with different styles
		try {
			formatsWithOptions["html_apa"] = await cite.format("html", {
				style: "apa",
				lang: "en-US",
			});
		} catch (e: any) {
			formatsWithOptions["html_apa"] = `Error: ${e.message}`;
		}

		try {
			formatsWithOptions["html_mla"] = await cite.format("html", {
				style: "mla",
				lang: "en-US",
			});
		} catch (e: any) {
			formatsWithOptions["html_mla"] = `Error: ${e.message}`;
		}

		// Create results modal
		const modal = new Modal(app);
		modal.titleEl.setText("DOI Plugin - Output Format Showcase");

		const content = modal.contentEl.createDiv();

		// Introduction
		content.createEl("p", {
			text: `Testing DOI: ${testDOI}`,
			cls: "doi-info",
		});

		// Basic data access section
		content.createEl("h3", { text: "1. Basic Data Access (CSL-JSON)" });
		content.createEl("p", {
			text: "This is the fundamental data format used for processing:",
		});
		content.createEl("pre", {
			text: JSON.stringify(data, null, 2),
			cls: "code-block",
		});

		// Format results section
		content.createEl("h3", { text: "2. Available Output Formats" });

		const formatContainer = content.createDiv({ cls: "format-grid" });

		for (const [formatName, result] of Object.entries(formatResults)) {
			const formatDiv = formatContainer.createDiv({ cls: "format-item" });

			formatDiv.createEl("h4", {
				text: formatName.toUpperCase(),
				cls: result.success ? "format-success" : "format-error",
			});

			formatDiv.createEl("p", {
				text: result.description,
				cls: "format-description",
			});

			if (result.success) {
				const previewDiv = formatDiv.createDiv({
					cls: "format-preview",
				});
				previewDiv.createEl("pre", {
					text:
						typeof result.result === "string"
							? result.result.length > 200
								? result.result.substring(0, 200) + "..."
								: result.result
							: JSON.stringify(result.result, null, 2).substring(
									0,
									200
							  ) + "...",
					cls: "preview-code",
				});

				if (
					typeof result.result === "string" &&
					result.result.length > 200
				) {
					previewDiv.createEl("p", {
						text: `(${result.result.length} characters total)`,
						cls: "preview-info",
					});
				}
			} else {
				formatDiv.createEl("p", {
					text: `❌ Error: ${result.error}`,
					cls: "error-message",
				});
			}
		}

		// Formats with options section
		content.createEl("h3", { text: "3. Formats with Options" });

		for (const [optionName, result] of Object.entries(formatsWithOptions)) {
			const optionDiv = content.createDiv({ cls: "option-item" });
			optionDiv.createEl("h4", {
				text: optionName.replace("_", " ").toUpperCase(),
			});

			if (typeof result === "string" && result.startsWith("Error:")) {
				optionDiv.createEl("p", {
					text: result,
					cls: "error-message",
				});
			} else {
				optionDiv.createEl("pre", {
					text: result,
					cls: "option-code",
				});
			}
		}

		// Usage examples
		content.createEl("h3", { text: "4. Usage Examples" });
		content.createEl("p", {
			text: "Here's how to use different output formats:",
		});

		const examples = [
			{
				title: "Get structured data for processing:",
				code: `const cite = new Cite("10.1038/nature12373");
const data = await cite.format("data", { format: "object" });`,
			},
			{
				title: "Generate BibTeX for LaTeX:",
				code: `const bibtex = await cite.format("bibtex");`,
			},
			{
				title: "Generate HTML with APA style:",
				code: `const html = await cite.format("html", { style: "apa" });`,
			},
			{
				title: "Get plain text citation:",
				code: `const text = await cite.format("text");`,
			},
			{
				title: "Export to RIS format:",
				code: `const ris = await cite.format("ris");`,
			},
		];

		// Format API explanation
		content.createEl("h3", { text: "5. Citation.js Format API" });
		content.createEl("p", {
			text: "The citation.js formatter follows this signature:",
		});
		content.createEl("pre", {
			text: `formatter(csl[] data, ...options) {}

// First argument: Array of CSL-JSON data
// Additional arguments: Configuration options
// Example with multiple options:
cite.format('html', { style: 'apa' }, { lang: 'en-US' })`,
			cls: "api-explanation",
		});

		content.createEl("p", { text: "Key points about the API:" });
		const apiPoints = [
			"• Takes CSL-JSON array as first argument",
			"• Accepts multiple option objects",
			"• Common options: format, type, style, lang, entry",
			"• Returns formatted string or structured data",
		];

		const apiPointsContainer = content.createDiv({ cls: "api-points" });
		apiPoints.forEach((point) => {
			apiPointsContainer.createEl("p", { text: point });
		});

		const exampleContainer = content.createDiv({ cls: "examples" });
		examples.forEach((example) => {
			const exampleDiv = exampleContainer.createDiv({
				cls: "example-item",
			});
			exampleDiv.createEl("h4", { text: example.title });
			exampleDiv.createEl("pre", {
				text: example.code,
				cls: "example-code",
			});
		});

		// Alternative to format: "object"
		content.createEl("h3", { text: "5. Alternative Methods" });
		content.createEl("p", {
			text: "Instead of format: 'object', you can also use:",
		});

		const alternatives = [
			"Direct data access: cite.data",
			"Default format: await cite.format('data')",
			"Async format: await cite.formatAsync('data', { format: 'object' })",
		];

		const altContainer = content.createDiv({ cls: "alternatives" });
		alternatives.forEach((alt) => {
			altContainer.createEl("pre", {
				text: alt,
				cls: "alt-code",
			});
		});

		// Add CSS styling
		const style = document.createElement("style");
		style.textContent = `
            .doi-info {
                background: var(--background-secondary-alt);
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 15px;
                text-align: center;
                font-weight: bold;
            }
            .code-block {
                background: var(--background-secondary-alt);
                padding: 12px;
                border-radius: 4px;
                overflow-x: auto;
                margin: 10px 0;
                font-size: 0.85em;
                max-height: 300px;
                overflow-y: auto;
            }
            .format-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 15px;
                margin: 15px 0;
            }
            .format-item {
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                padding: 12px;
                background: var(--background-primary);
            }
            .format-success {
                color: var(--text-success) !important;
            }
            .format-error {
                color: var(--text-error) !important;
            }
            .format-description {
                font-size: 0.9em;
                margin: 5px 0 10px 0;
                color: var(--text-muted);
            }
            .format-preview {
                margin-top: 10px;
            }
            .preview-code {
                background: var(--background-secondary);
                padding: 8px;
                border-radius: 4px;
                font-size: 0.8em;
                white-space: pre-wrap;
                word-break: break-all;
            }
            .preview-info {
                font-size: 0.75em;
                color: var(--text-muted);
                margin-top: 5px;
            }
            .error-message {
                color: var(--text-error);
                font-size: 0.9em;
            }
            .option-item {
                margin: 10px 0;
                padding: 10px;
                background: var(--background-secondary-alt);
                border-radius: 4px;
            }
            .option-code {
                background: var(--background-secondary);
                padding: 10px;
                border-radius: 4px;
                font-size: 0.85em;
                white-space: pre-wrap;
            }
            .examples {
                margin: 15px 0;
            }
            .example-item {
                margin: 10px 0;
            }
            .example-item h4 {
                color: var(--text-accent);
                margin-bottom: 5px;
            }
            .example-code {
                background: var(--background-secondary);
                padding: 10px;
                border-radius: 4px;
                font-size: 0.9em;
            }
            .alternatives {
                background: var(--background-secondary-alt);
                padding: 15px;
                border-radius: 6px;
                margin: 10px 0;
            }
            .alt-code {
                background: var(--background-secondary);
                padding: 8px;
                border-radius: 4px;
                margin: 5px 0;
                font-family: monospace;
            }
        `;
		modal.containerEl.appendChild(style);

		// Success message
		content.createEl("div", {
			text: "✅ DOI plugin working perfectly! All output formats available.",
			cls: "success-message",
		});

		modal.open();
		new Notice("DOI plugin format test completed!");
	} catch (error) {
		console.error("DOI format test failed:", error);
		new Notice(`Error: ${error.message}`);
	}
}

// Command definitions - pass app instance and settings
export function getBibliographyCommands(
	app: App,
	includeTests: boolean = false,
	settings: BibliographySettings,
	plugin?: BibliographyManagerPlugin
) {
	return [
		{
			id: "generate-citekey",
			name: "Generate citekey for current source",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const command = new GenerateCitekeyCommand(app);
				command.execute(editor, view);
			},
		},
		{
			id: "export-bibliography-manual",
			name: "Export bibliography manually",
			callback: () => {
				new BibliographyExportModal(app, settings).open();
			},
		},
		{
			id: "import-source",
			name: "Import new source",
			callback: () => {
				new SourceImportModal(app, settings, plugin).open();
			},
		},
		{
			id: "test-doi-basic",
			name: "Test basic DOI functionality",
			callback: () => {
				testDOIBasic(app);
			},
		},
		{
			id: "test-doi-formats",
			name: "Test different DOI formats",
			callback: () => {
				testDOIFormats(app);
			},
		},
		{
			id: "test-doi-error-handling",
			name: "Test DOI error handling",
			callback: () => {
				testDOIErrorHandling(app);
			},
		},
		{
			id: "test-doi-output-formats",
			name: "Test citation output formats",
			callback: () => {
				testDOIOutputFormats(app);
			},
		},
		{
			id: "test-doi-comprehensive",
			name: "Run comprehensive DOI test suite",
			callback: () => {
				runAllDOITests(app);
			},
		},
		{
			id: "open-doi-test-modal",
			name: "Open interactive test modal",
			callback: () => {
				new DOITestModal(app).open();
			},
		},
	];
}
