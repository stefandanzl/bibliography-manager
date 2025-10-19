import { App, Plugin, Notice } from "obsidian";
import { BibliographyExporter, CitekeyGenerator } from "./utils/exportbib";
require('@citation-js/plugin-hayagriva');
import { SourceService } from "./utils/sourceService";
import { SourceData, setCrossrefUserAgent } from "./utils/sourceManager";
import { getBibliographyCommands } from "./utils/bibliographyCommands";
import { BibliographySettingTab } from "./settings";

// Import settings and defaults from settings file
import { BibliographySettings, DEFAULT_SETTINGS } from "./settings";

// API interface that other plugins can use
export interface BibliographyAPI {
	/**
	 * Generate BibTeX content from sources
	 */
	generateBibliography(config?: {
		sourcesFolder?: string;
		bibliographyFile?: string;
		includeFiles?: string[];
		format?: "bibtex" | "csl-json" | "hayagriva";
	}): Promise<string>;

	/**
	 * Export bibliography to a specific path
	 */
	exportBibliographyToPath(config: {
		sourcesFolder?: string;
		outputPath: string;
		format?: "bibtex" | "csl-json" | "hayagriva";
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

	public async loadTemplateFile(): Promise<void> {
		try {
			// Always reset to default template first
			this.settings.sourceNoteTemplate =
				DEFAULT_SETTINGS.sourceNoteTemplate;

			// Load from external file if specified
			if (
				this.settings.templateFile &&
				this.settings.templateFile.trim() !== ""
			) {
				const templateExists = await this.app.vault.adapter.exists(
					this.settings.templateFile
				);

				if (templateExists) {
					const templateContent = await this.app.vault.adapter.read(
						this.settings.templateFile
					);
					this.settings.sourceNoteTemplate = templateContent;
					console.log(
						`Loaded template from file: ${this.settings.templateFile}`
					);
									} else {
					console.warn(
						`Template file not found: ${this.settings.templateFile}`
					);
					new Notice(
						`Template file not found: ${this.settings.templateFile}\nUsing default template.`
					);
				}
			}
		} catch (error) {
			console.error("Error loading template file:", error);
			// Fall back to default template
			this.settings.sourceNoteTemplate =
				DEFAULT_SETTINGS.sourceNoteTemplate;
		}
	}

	private createAPI(): BibliographyAPI {
		return {
			// Generate bibliography content from sources
			generateBibliography: async (config = {}) => {
				try {
					const sourcesFolder =
						config.sourcesFolder || this.settings.sourcesFolder;
					const format = config.format || this.settings.bibliographyFormat;

					let bibContent;
					if (format === "hayagriva") {
						bibContent =
							await this.sourceService.generateHayagrivaFromSources(
								sourcesFolder
							);
					} else if (format === "csl-json") {
						// For now, fall back to BibTeX for CSL-JSON until we implement proper CSL-JSON generation
						bibContent =
							await this.sourceService.generateBibTeXFromSources(
								sourcesFolder
							);
					} else {
						bibContent =
							await this.sourceService.generateBibTeXFromSources(
								sourcesFolder
							);
					}

					if (!bibContent || bibContent.trim() === "") {
						throw new Error(
							"No sources found or failed to generate bibliography"
						);
					}

					console.log(`Generated ${format} bibliography from ${sourcesFolder}`);
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

					let bibContent;
					const format = config.format || this.settings.bibliographyFormat;
					console.log(`🔧 Exporting bibliography in format: ${format}`);

					if (format === "hayagriva") {
						bibContent =
							await this.sourceService.generateHayagrivaFromSources(
								sourcesFolder
							);
					} else {
						bibContent =
							await this.sourceService.generateBibTeXFromSources(
								sourcesFolder
							);
					}

					console.log(`📊 Generated content length: ${bibContent?.length || 0} characters`);
					console.log(`📝 Writing to path: ${config.outputPath}`);

					// Ensure output directory exists
					const outputDir = config.outputPath.substring(
						0,
						config.outputPath.lastIndexOf("/")
					);
					console.log(`📁 Output directory: ${outputDir}`);

					if (
						outputDir &&
						!(await this.app.vault.adapter.exists(outputDir))
					) {
						console.log(`📁 Creating directory: ${outputDir}`);
						await this.app.vault.adapter.mkdir(outputDir);
					}

					// Write bibliography file
					console.log(`✍️ Writing bibliography file...`);
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

						if (frontmatter && frontmatter.citekey) {
							sources.push({
								citekey: frontmatter.citekey || "",
								author: frontmatter.author || [],
								category: frontmatter.category || [],
								bibtype: frontmatter.bibtype || "misc",
								title: frontmatter.title || file.basename,
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
						this.settings.sourceNoteTemplate
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
		const commands = getBibliographyCommands(
			this.app,
			false,
			this.settings,
			this
		);

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
					// Generate full filename with extension based on format
					const extensionMap = {
						"bibtex": ".bib",
						"csl-json": ".json",
						"hayagriva": ".yaml"
					};
					const extension = extensionMap[this.settings.bibliographyFormat] || ".bib";
					const bibPath = `${this.settings.sourcesFolder}/${this.settings.bibliographyFilename}${extension}`;

					await this.api.exportBibliographyToPath({
						outputPath: bibPath,
						format: this.settings.bibliographyFormat
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
