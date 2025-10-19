import { App, Plugin, PluginSettingTab, Setting, Notice, AbstractInputSuggest } from "obsidian";
import { BibliographyExporter, CitekeyGenerator } from "./utils/exportbib";
import { SourceService } from "./utils/sourceService";
import { SourceData, setCrossrefUserAgent } from "./utils/sourceManager";
import { getBibliographyCommands } from "./utils/bibliographyCommands";
import * as YAML from "yaml";
import * as Mustache from "mustache";

// Plugin settings interface
export interface BibliographySettings {
	sourcesFolder: string;
	bibliographyFilename: string;
	autoGenerate: boolean;
	supportedFileTypes: string[];
	crossrefEmail: string;
	sourceNoteTemplate: string;
	templateFile: string;
	fieldMappings: Record<string, string>;
	}

// Default settings
const DEFAULT_SETTINGS: BibliographySettings = {
	sourcesFolder: "sources",
	bibliographyFilename: "bibliography.bib",
	autoGenerate: false,
	supportedFileTypes: ["pdf", "epub", "txt"],
	crossrefEmail: "",
	sourceNoteTemplate: `---
notetype: source
citekey: {{citekey}}
title: "{{title}}"
author: [{{#author}}{{.}}{{#unless @last}}, {{/unless}}{{/author}}]
year: {{year}}
bibtype: {{bibtype}}
{{#doi}}doi: {{doi}}{{/doi}}
{{#isbn}}isbn: {{isbn}}{{/isbn}}
{{#publisher}}publisher: {{publisher}}{{/isbn}}
{{#journal}}journal: {{journal}}{{/journal}}
{{#volume}}volume: {{volume}}{{/journal}}
{{#number}}number: {{number}}{{/journal}}
{{#pages}}pages: {{pages}}{{/journal}}
{{#abstract}}abstract: {{abstract}}{{/doi}}
{{#url}}url: {{url}}{{/url}}
{{#downloadurl}}downloadurl: {{downloadurl}}{{/url}}
{{#imageurl}}imageurl: {{imageurl}}{{/url}}
---

# {{title}}

{{#author}}{{.}}{{#unless @last}}, {{/unless}}{{/author}} ({{year}})

{{#abstract}}
## Abstract
{{abstract}}
{{/abstract}}

{{#doi}}DOI: {{doi}}{{/doi}}
{{#url}}URL: {{url}}{{/url}}
`,
	templateFile: "",
	fieldMappings: {
		citekey: "citekey",
		title: "title",
		author: "author",
		year: "year",
		bibtype: "bibtype",
		doi: "doi",
		isbn: "isbn",
		publisher: "publisher",
		journal: "journal",
		volume: "volume",
		number: "number",
		pages: "pages",
		abstract: "abstract",
		url: "url",
		downloadurl: "downloadurl",
		imageurl: "imageurl",
		added: "added",
		started: "started",
		ended: "ended",
		rating: "rating",
		currentpage: "currentpage",
		status: "status",
		filelink: "filelink",
		aliases: "aliases",
		category: "category",
	},
	};

// API interface that other plugins can use
export interface BibliographyAPI {
	/**
	 * Generate BibTeX content from sources
	 */
	generateBibliography(config?: {
		sourcesFolder?: string;
		bibliographyFile?: string;
		includeFiles?: string[];
	}): Promise<string>;

	/**
	 * Export bibliography to a specific path
	 */
	exportBibliographyToPath(config: {
		sourcesFolder?: string;
		outputPath: string;
		format?: "bibtex" | "csl-json";
	}): Promise<string>;

	/**
	 * Get all sources from folder
	 */
	getAllSources(sourcesFolder?: string): Promise<SourceData[]>;

	/**
	 * Import a new source
	 */
	importSource(sourceData: Partial<SourceData>): Promise<string>;

	/**
	 * Generate citekey for source data
	 */
	generateCitekey(sourceData: Partial<SourceData>): string;
}

export default class BibliographyManagerPlugin extends Plugin {
	settings: BibliographySettings;
	sourceService: SourceService;
	bibliographyExporter: BibliographyExporter;
	api: BibliographyAPI;

	async onload() {
		try {
			// Load settings with error handling
			await this.loadSettings();

			// Set User-Agent for Crossref API if email is provided
			setCrossrefUserAgent(this.settings.crossrefEmail, false);

			// Initialize services with error handling
			this.sourceService = new SourceService(this.app);
			this.bibliographyExporter = new BibliographyExporter(
				this.app,
				this.settings
			);

			// Set up API for other plugins
			this.api = this.createAPI();

			// Expose API for other plugins - use safer approach
			this.exposeAPI();

			// Register commands
			this.registerCommands();

			// Add settings tab
			this.addSettingTab(new BibliographySettingTab(this.app, this));

			// Initialize sources folder if it doesn't exist
			await this.initializeSourcesFolder();
		} catch (error) {
			console.error("Error loading Bibliography Manager plugin:", error);
			new Notice(
				"Error loading Bibliography Manager plugin. Check console for details."
			);
		}
	}

	onunload() {
		// Clean up API reference safely
		try {
			if ((this.app as any).plugins?.plugins?.["bibliography-manager"]) {
				delete (this.app as any).plugins.plugins[
					"bibliography-manager"
				];
			}
		} catch (error) {
			console.warn("Error cleaning up plugin API:", error);
		}
		console.log("Bibliography Manager plugin unloaded");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// Load field mappings from YAML file
		await this.loadFieldMappings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update User-Agent for Crossref API if email changed
		setCrossrefUserAgent(this.settings.crossrefEmail, true);
		// Update services with new settings
		this.bibliographyExporter = new BibliographyExporter(
			this.app,
			this.settings
		);
	}

	private async loadFieldMappings(): Promise<void> {
		try {
			const mappingsPath = `${this.manifest.dir}/mappings.yaml`;
			const fileExists = await this.app.vault.adapter.exists(mappingsPath);

			if (fileExists) {
				const mappingsContent = await this.app.vault.adapter.read(mappingsPath);
				const parsedMappings = YAML.parse(mappingsContent) as Record<string, string>;

				// Merge with defaults, keeping user customizations
				this.settings.fieldMappings = {
					...DEFAULT_SETTINGS.fieldMappings,
					...parsedMappings
				};

				console.log("Loaded field mappings from YAML file");
			} else {
				// Create default YAML file if it doesn't exist
				await this.createDefaultMappingsFile();
				console.log("Created default mappings.yaml file");
			}

			// Load template file if specified
			await this.loadTemplateFile();
		} catch (error) {
			console.error("Error loading field mappings:", error);
			// Fall back to default mappings
			this.settings.fieldMappings = DEFAULT_SETTINGS.fieldMappings;
		}
	}

	public async loadTemplateFile(): Promise<void> {
		try {
			if (this.settings.templateFile && this.settings.templateFile.trim() !== "") {
				const templateExists = await this.app.vault.adapter.exists(this.settings.templateFile);

				if (templateExists) {
					const templateContent = await this.app.vault.adapter.read(this.settings.templateFile);
					this.settings.sourceNoteTemplate = templateContent;
					console.log(`Loaded template from file: ${this.settings.templateFile}`);
				} else {
					console.warn(`Template file not found: ${this.settings.templateFile}`);
				}
			}
		} catch (error) {
			console.error("Error loading template file:", error);
			// Fall back to default template
			this.settings.sourceNoteTemplate = DEFAULT_SETTINGS.sourceNoteTemplate;
		}
	}

	private async createDefaultMappingsFile(): Promise<void> {
		try {
			const mappingsPath = `${this.manifest.dir}/mappings.yaml`;
			const defaultMappingsContent = `# Field mappings for bibliography templates
# Format: template-placeholder: frontmatter-property
# This file maps {{placeholder}} names in templates to actual frontmatter property names

# Core bibliographic fields
citekey: citekey
title: title
author: author
year: year
bibtype: bibtype

# Publication details
doi: doi
isbn: isbn
publisher: publisher
journal: journal
volume: volume
number: number
pages: pages

# URLs and resources
abstract: abstract
url: url
downloadurl: downloadurl
imageurl: imageurl

# Reading progress and metadata
added: added
started: started
ended: ended
rating: rating
currentpage: currentpage
status: status

# File and reference data
filelink: filelink
aliases: aliases
category: category

# Optional custom mappings (uncomment and modify as needed)
# Example: Use {{authors}} in template to map to 'author' frontmatter field
# authors: author
# publicationYear: year
# publicationTitle: title
`;
			await this.app.vault.create(mappingsPath, defaultMappingsContent);
		} catch (error) {
			console.error("Error creating default mappings file:", error);
		}
	}

	private createAPI(): BibliographyAPI {
		return {
			// Generate BibTeX content from sources
			generateBibliography: async (config = {}) => {
				try {
					const sourcesFolder =
						config.sourcesFolder || this.settings.sourcesFolder;
					const bibContent =
						await this.sourceService.generateBibTeXFromSources(
							sourcesFolder
						);

					if (!bibContent || bibContent.trim() === "") {
						throw new Error(
							"No sources found or failed to generate bibliography"
						);
					}

					console.log(`Generated bibliography from ${sourcesFolder}`);
					return bibContent;
				} catch (error) {
					console.error("Failed to generate bibliography:", error);
					throw error;
				}
			},

			// Export bibliography to a specific path
			exportBibliographyToPath: async (config) => {
				try {
					const sourcesFolder =
						config.sourcesFolder || this.settings.sourcesFolder;
					const bibContent =
						await this.sourceService.generateBibTeXFromSources(
							sourcesFolder
						);

					// Ensure output directory exists
					const outputDir = config.outputPath.substring(
						0,
						config.outputPath.lastIndexOf("/")
					);
					if (
						outputDir &&
						!(await this.app.vault.adapter.exists(outputDir))
					) {
						await this.app.vault.adapter.mkdir(outputDir);
					}

					// Write bibliography file
					await this.app.vault.adapter.write(
						config.outputPath,
						bibContent
					);

					new Notice(`Bibliography exported to ${config.outputPath}`);
					console.log(
						`Bibliography exported to ${config.outputPath}`
					);
					return config.outputPath;
				} catch (error) {
					console.error("Failed to export bibliography:", error);
					throw error;
				}
			},

			// Get all sources from folder
			getAllSources: async (sourcesFolder?: string) => {
				try {
					const folder = sourcesFolder || this.settings.sourcesFolder;
					const sourceFiles =
						await this.sourceService.findAllSourceFiles(folder);
					const sources: SourceData[] = [];

					for (const file of sourceFiles) {
						const cache = this.app.metadataCache.getFileCache(file);
						const frontmatter = cache?.frontmatter;

						if (frontmatter && frontmatter.notetype === "source") {
							sources.push({
								citekey: frontmatter.citekey || "",
								author: frontmatter.author || [],
								category: frontmatter.category || [],
								bibtype: frontmatter.bibtype || "misc",
								title: frontmatter.title || file.basename,
								notetype: "source",
								year: frontmatter.year?.toString(),
								pages: frontmatter.pages
									? parseInt(frontmatter.pages)
									: undefined,
								abstract: frontmatter.abstract,
								publisher: frontmatter.publisher,
								journal: frontmatter.journal,
								volume: frontmatter.volume,
								number: frontmatter.number,
								doi: frontmatter.doi,
								isbn: frontmatter.isbn,
								url: frontmatter.url,
								downloadurl: frontmatter.downloadurl,
								imageurl: frontmatter.imageurl,
								added: frontmatter.added,
								started: frontmatter.started,
								ended: frontmatter.ended,
								rating: frontmatter.rating,
								currentpage: frontmatter.currentpage,
								status: frontmatter.status,
								filelink: frontmatter.filelink,
								aliases: frontmatter.aliases,
							});
						}
					}

					return sources;
				} catch (error) {
					console.error("Failed to get all sources:", error);
					throw error;
				}
			},

			// Import a new source
			importSource: async (sourceData) => {
				try {
					const sourcesFolder = this.settings.sourcesFolder;
					const newFile = await this.sourceService.createSourceFile(
						sourceData as SourceData,
						sourcesFolder,
						this.settings.sourceNoteTemplate,
						this.settings.fieldMappings
					);

					if (newFile) {
						new Notice(`Source imported: ${newFile.basename}`);
						return newFile.path;
					} else {
						throw new Error("Failed to create source file");
					}
				} catch (error) {
					console.error("Failed to import source:", error);
					throw error;
				}
			},

			// Generate citekey for source data
			generateCitekey: (sourceData) => {
				try {
					const authors = sourceData.author || [];
					const year = sourceData.year
						? parseInt(sourceData.year.toString())
						: new Date().getFullYear();
					const title = sourceData.title || "Untitled";

					return CitekeyGenerator.generateFromTitleAndAuthors(
						title,
						authors,
						year
					);
				} catch (error) {
					console.error("Failed to generate citekey:", error);
					// Fallback to a simple citekey
					const timestamp = Date.now().toString(36);
					return `SRC${timestamp}`;
				}
			},
		};
	}

	private registerCommands() {
		// NOTE: Integration tests - change 'false' to 'true' to enable testing commands
		const commands = getBibliographyCommands(this.app, false, this.settings);

		commands.forEach((command) => {
			this.addCommand(command);
		});

		// Additional plugin-specific commands
		this.addCommand({
			id: "show-sources-folder",
			name: "Show sources folder",
			callback: () => {
				const folder = this.app.vault.getAbstractFileByPath(
					this.settings.sourcesFolder
				);
				if (folder) {
					this.app.workspace.getLeaf(true).openFile(folder as any);
				} else {
					new Notice(
						`Sources folder '${this.settings.sourcesFolder}' not found`
					);
				}
			},
		});

		this.addCommand({
			id: "generate-bibliography-file",
			name: "Generate bibliography file",
			callback: async () => {
				try {
					const bibPath = `${this.settings.sourcesFolder}/${this.settings.bibliographyFilename}`;
					await this.api.exportBibliographyToPath({
						outputPath: bibPath,
					});
				} catch (error) {
					new Notice(
						`Failed to generate bibliography: ${error.message}`
					);
				}
			},
		});
	}

	private exposeAPI() {
		try {
			// Expose API for other plugins - use safer approach
			if (!(this.app as any).plugins.plugins) {
				(this.app as any).plugins.plugins = {};
			}
			(this.app as any).plugins.plugins["bibliography-manager"] = {
				api: this.api,
				version: "1.0.0",
			};
		} catch (error) {
			console.warn("Could not expose plugin API:", error);
		}
	}

	private async initializeSourcesFolder() {
		try {
			// Check if folder exists using adapter to avoid triggering file events
			const folderExists = await this.app.vault.adapter.exists(
				this.settings.sourcesFolder
			);

			if (!folderExists) {
				// Create folder using adapter directly to avoid triggering unnecessary events
				await this.app.vault.adapter.mkdir(this.settings.sourcesFolder);
				console.log(
					`Created sources folder: ${this.settings.sourcesFolder}`
				);
			}
		} catch (error) {
			console.warn("Could not initialize sources folder:", error);
			// Don't throw error - plugin can work without the sources folder
		}
	}
}

// Folder suggestion class for autocompleting folder paths
class FolderSuggest extends AbstractInputSuggest<string> {
	private folders: string[];

	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
		// Get all folders and include root folder
		this.folders = [""].concat(this.app.vault.getAllFolders().map(folder => folder.path));
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase();
		return this.folders.filter(folder =>
			folder.toLowerCase().includes(inputLower)
		);
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.createEl("div", { text: folder || "/" });
	}

	selectSuggestion(folder: string, evt: MouseEvent | KeyboardEvent): void {
		this.inputEl.value = folder;
		this.inputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}

// Template file suggestion class for autocompleting template files
class TemplateFileSuggest extends AbstractInputSuggest<string> {
	private templateFiles: string[];

	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.templateFiles = this.getTemplateFiles();
	}

	private getTemplateFiles(): string[] {
		const files: string[] = [];

		// Get markdown files from all directories
		this.app.vault.getFiles().forEach(file => {
			if (file.extension === "md") {
				// Add files with common template-related names
				const filename = file.basename.toLowerCase();
				if (filename.includes("template") ||
					filename.includes("sourcenote") ||
					filename.includes("bibliography") ||
					filename.includes("note")) {
					files.push(file.path);
				}
			}
		});

		return files.sort();
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase();
		return this.templateFiles.filter(file =>
			file.toLowerCase().includes(inputLower)
		);
	}

	renderSuggestion(filePath: string, el: HTMLElement): void {
		el.createEl("div", { text: filePath });
	}

	selectSuggestion(filePath: string, evt: MouseEvent | KeyboardEvent): void {
		this.inputEl.value = filePath;
		this.inputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}

class BibliographySettingTab extends PluginSettingTab {
	plugin: BibliographyManagerPlugin;

	constructor(app: App, plugin: BibliographyManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Bibliography Manager Settings" });

		new Setting(containerEl)
			.setName("Sources folder")
			.setDesc("Folder where source files are stored")
			.addSearch((search) => {
				search
					.setPlaceholder("sources")
					.setValue(this.plugin.settings.sourcesFolder)
					.onChange(async (value) => {
						this.plugin.settings.sourcesFolder = value;
						await this.plugin.saveSettings();
					});

				// Add folder suggestions
				new FolderSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("Bibliography filename")
			.setDesc("Default filename for generated bibliography files")
			.addText((text) =>
				text
					.setPlaceholder("bibliography.bib")
					.setValue(this.plugin.settings.bibliographyFilename)
					.onChange(async (value) => {
						this.plugin.settings.bibliographyFilename = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-generate on export")
			.setDesc(
				"Automatically generate bibliography when other plugins request it"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoGenerate)
					.onChange(async (value) => {
						this.plugin.settings.autoGenerate = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "DOI Import Settings" });

		new Setting(containerEl)
			.setName("Crossref Email")
			.setDesc("Email for Crossref API 'polite' access (optional but recommended for higher rate limits)")
			.addText((text) =>
				text
					.setPlaceholder("your-email@example.com")
					.setValue(this.plugin.settings.crossrefEmail)
					.onChange(async (value) => {
						this.plugin.settings.crossrefEmail = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Source Note Template" });

		new Setting(containerEl)
			.setName("Template file")
			.setDesc("Load template from a markdown file instead of using the embedded template")
			.addSearch((search) => {
				search
					.setPlaceholder("templates/source-note.md")
					.setValue(this.plugin.settings.templateFile)
					.onChange(async (value) => {
						this.plugin.settings.templateFile = value;
						await this.plugin.saveSettings();
						// Reload template if file is specified
						await this.plugin.loadTemplateFile();
					});

				// Add template file suggestions
				new TemplateFileSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("Note template")
			.setDesc("Template for creating new source notes using Mustache syntax. Available placeholders: {{citekey}}, {{title}}, {{author}}, {{year}}, etc.")
			.addTextArea((text) => {
				text
					.setValue(this.plugin.settings.sourceNoteTemplate)
					.setPlaceholder("Enter your template here...")
					.onChange(async (value) => {
						this.plugin.settings.sourceNoteTemplate = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.width = "100%";
				text.inputEl.style.minHeight = "150px";
			});

		containerEl.createEl("p", {
			text: "Template placeholders are mapped to frontmatter fields using the mappings.yaml file in your plugin folder.",
			cls: "setting-item-description",
		});

		containerEl.createEl("h4", { text: "Available Placeholders" });
		const placeholdersInfo = containerEl.createDiv({ cls: "setting-item-description" });
		placeholdersInfo.innerHTML = `
			<strong>Core fields:</strong> {{citekey}}, {{title}}, {{author}}, {{year}}, {{bibtype}}<br>
			<strong>Publication details:</strong> {{doi}}, {{isbn}}, {{publisher}}, {{journal}}, {{volume}}, {{number}}, {{pages}}<br>
			<strong>Content:</strong> {{abstract}}, {{url}}, {{downloadurl}}, {{imageurl}}<br>
			<strong>Reading progress:</strong> {{added}}, {{started}}, {{ended}}, {{rating}}, {{currentpage}}, {{status}}<br>
			<strong>File data:</strong> {{filelink}}, {{aliases}}, {{category}}
		`;

		containerEl.createEl("p", {
			text: "You can customize the mappings by editing the mappings.yaml file in your plugin folder.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Open field mappings file")
			.setDesc("Edit the YAML file that maps template placeholders to frontmatter fields")
			.addButton((button) => {
				button
					.setButtonText("Open")
					.setCta()
					.onClick(async () => {
						try {
							const mappingsPath = `${this.plugin.manifest.dir}/mappings.yaml`;
							const file = this.plugin.app.vault.getAbstractFileByPath(mappingsPath);
							if (file) {
								await this.plugin.app.workspace.getLeaf(true).openFile(file as any);
							} else {
								new Notice("Field mappings file not found. It will be created automatically.");
							}
						} catch (error) {
							new Notice("Error opening field mappings file.");
						}
					});
			});

		containerEl.createEl("h3", { text: "API Usage" });

		const apiInfo = containerEl.createDiv();
		apiInfo.createEl("p", {
			text: "Other plugins can access this plugin's API through:",
			cls: "setting-item-description",
		});

		const codeBlock = apiInfo.createEl("pre", { cls: "api-usage-example" });
		codeBlock.createEl("code", {
			text: `const bibPlugin = app.plugins.plugins['bibliography-manager'];
if (bibPlugin?.api) {
  const bibContent = await bibPlugin.api.generateBibliography({
    sourcesFolder: 'sources'
  });
}`,
		});
	}
}
