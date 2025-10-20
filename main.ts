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
	 * Generate bibliography content from sources
	 * @param config.sourcesFolder - Source files folder (defaults to plugin settings)
	 * @param config.format - Export format: bibtex, csl-json, or hayagriva (defaults to plugin settings)
	 * @returns Bibliography content as string
	 */
	generateBibliography(config?: {
		sourcesFolder?: string;
		format?: "bibtex" | "csl-json" | "hayagriva";
	}): Promise<string>;
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
			this.sourceService = new SourceService(this.app, this.settings);
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
			// Generate bibliography content from sources using existing workflow
			generateBibliography: async (config = {}) => {
				try {
					// Use plugin settings as fallback for all optional parameters
					const sourcesFolder =
						config.sourcesFolder || this.settings.sourcesFolder;
					const format = config.format || this.settings.bibliographyFormat;

					// Use existing sourceService method
					const bibContent = await this.sourceService.generateBibliography(
						sourcesFolder,
						format
					);

					if (!bibContent || bibContent.trim() === "") {
						throw new Error(
							"No sources found or failed to generate bibliography"
						);
					}

					return bibContent;
				} catch (error) {
					console.error("API: Failed to generate bibliography:", error);
					throw error;
				}
			},
		};
	}

	private registerCommands() {
		const commands = getBibliographyCommands(
			this.app,
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
					const outputFolder = this.settings.bibliographyOutputFolder || this.settings.sourcesFolder;
					const bibPath = `${outputFolder}/${this.settings.bibliographyFilename}${extension}`;

					// Generate bibliography using API
					const bibContent = await this.api.generateBibliography();

					// Write to file
					await this.app.vault.adapter.write(bibPath, bibContent);
					new Notice(`Bibliography exported to ${bibPath}`);
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
