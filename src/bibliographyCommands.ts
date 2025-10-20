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
import { BibliographySettings } from "./types";
import { CitekeyGenerator, SourceImporter } from "./exportbib";
import BibliographyManagerPlugin from "./main";
import { SourceService } from "./sourceService";

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
		this.sourceService = new SourceService(app, settings);
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

				// Use unified generateBibliography function
				this.bibContent = await this.sourceService.generateBibliography(
					sourcesFolder,
					format
				);

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
			const extensionMap: Record<string, string> = {
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
			this.sourceData.author = CitekeyGenerator.extractAuthorsFromCitationData(citationData);
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
			this.sourceData.author = CitekeyGenerator.extractAuthorsFromCitationData(citationData);
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
			this.sourceData.author = CitekeyGenerator.extractAuthorsFromCitationData(citationData);
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
			this.sourceData.author = CitekeyGenerator.extractAuthorsFromCitationData(citationData);
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

// Command definitions - pass app instance and settings
export function getBibliographyCommands(
	app: App,
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
	];
}
