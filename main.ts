import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { BibliographyExporter, SourceImporter, CitekeyGenerator } from './utils/exportbib';
import { SourceService } from './utils/sourceService';
import { SourceImportModal, SourceData } from './utils/sourceManager';
import { getBibliographyCommands } from './utils/bibliographyCommands';

// Plugin settings interface
export interface BibliographySettings {
	sourcesFolder: string;
	bibliographyFilename: string;
	autoGenerate: boolean;
	supportedFileTypes: string[];
}

// Default settings
const DEFAULT_SETTINGS: BibliographySettings = {
	sourcesFolder: 'sources',
	bibliographyFilename: 'bibliography.bib',
	autoGenerate: false,
	supportedFileTypes: ['pdf', 'epub', 'txt']
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
		format?: 'bibtex' | 'csl-json';
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
		console.log('Loading Bibliography Manager plugin');

		// Load settings
		await this.loadSettings();

		// Initialize services
		this.sourceService = new SourceService(this.app);
		this.bibliographyExporter = new BibliographyExporter(this.app, this.settings);

		// Set up API for other plugins
		this.api = this.createAPI();

		// Expose API for other plugins
		(this.app as any).plugins.plugins['bibliography-manager'] = {
			api: this.api
		};

		// Register commands
		this.registerCommands();

		// Add settings tab
		this.addSettingTab(new BibliographySettingTab(this.app, this));

		// Initialize sources folder if it doesn't exist
		await this.initializeSourcesFolder();

		console.log('Bibliography Manager plugin loaded');
	}

	onunload() {
		// Clean up API reference
		if ((this.app as any).plugins.plugins['bibliography-manager']) {
			delete (this.app as any).plugins.plugins['bibliography-manager'];
		}
		console.log('Bibliography Manager plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update services with new settings
		this.bibliographyExporter = new BibliographyExporter(this.app, this.settings);
	}

	private createAPI(): BibliographyAPI {
		return {
			// Generate BibTeX content from sources
			generateBibliography: async (config = {}) => {
				try {
					const sourcesFolder = config.sourcesFolder || this.settings.sourcesFolder;
					const bibContent = await this.sourceService.generateBibTeXFromSources(sourcesFolder);

					if (!bibContent || bibContent.trim() === '') {
						throw new Error('No sources found or failed to generate bibliography');
					}

					console.log(`Generated bibliography from ${sourcesFolder}`);
					return bibContent;
				} catch (error) {
					console.error('Failed to generate bibliography:', error);
					throw error;
				}
			},

			// Export bibliography to a specific path
			exportBibliographyToPath: async (config) => {
				try {
					const sourcesFolder = config.sourcesFolder || this.settings.sourcesFolder;
					const bibContent = await this.sourceService.generateBibTeXFromSources(sourcesFolder);

					// Ensure output directory exists
					const outputDir = config.outputPath.substring(0, config.outputPath.lastIndexOf('/'));
					if (outputDir && !(await this.app.vault.adapter.exists(outputDir))) {
						await this.app.vault.adapter.mkdir(outputDir);
					}

					// Write bibliography file
					await this.app.vault.adapter.write(config.outputPath, bibContent);

					new Notice(`Bibliography exported to ${config.outputPath}`);
					console.log(`Bibliography exported to ${config.outputPath}`);
					return config.outputPath;
				} catch (error) {
					console.error('Failed to export bibliography:', error);
					throw error;
				}
			},

			// Get all sources from folder
			getAllSources: async (sourcesFolder?: string) => {
				try {
					const folder = sourcesFolder || this.settings.sourcesFolder;
					const sourceFiles = await this.sourceService.findAllSourceFiles(folder);
					const sources: SourceData[] = [];

					for (const file of sourceFiles) {
						const cache = this.app.metadataCache.getFileCache(file);
						const frontmatter = cache?.frontmatter;

						if (frontmatter && frontmatter.notetype === "source") {
							sources.push({
								citekey: frontmatter.citekey || '',
								author: frontmatter.author || [],
								category: frontmatter.category || [],
								bibtype: frontmatter.bibtype || 'misc',
								title: frontmatter.title || file.basename,
								notetype: 'source',
								year: frontmatter.year?.toString(),
								pages: frontmatter.pages ? parseInt(frontmatter.pages) : undefined,
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
								aliases: frontmatter.aliases
							});
						}
					}

					return sources;
				} catch (error) {
					console.error('Failed to get all sources:', error);
					throw error;
				}
			},

			// Import a new source
			importSource: async (sourceData) => {
				try {
					const sourcesFolder = this.settings.sourcesFolder;
					const newFile = await this.sourceService.createSourceFile(
						sourceData as SourceData,
						sourcesFolder
					);

					if (newFile) {
						new Notice(`Source imported: ${newFile.basename}`);
						return newFile.path;
					} else {
						throw new Error('Failed to create source file');
					}
				} catch (error) {
					console.error('Failed to import source:', error);
					throw error;
				}
			},

			// Generate citekey for source data
			generateCitekey: (sourceData) => {
				try {
					const authors = sourceData.author || [];
					const year = sourceData.year ? parseInt(sourceData.year.toString()) : new Date().getFullYear();
					const title = sourceData.title || 'Untitled';

					return CitekeyGenerator.generateFromTitleAndAuthors(title, authors, year);
				} catch (error) {
					console.error('Failed to generate citekey:', error);
					// Fallback to a simple citekey
					const timestamp = Date.now().toString(36);
					return `SRC${timestamp}`;
				}
			}
		};
	}

	private registerCommands() {
		const commands = getBibliographyCommands(this.app);

		commands.forEach(command => {
			this.addCommand(command);
		});

		// Additional plugin-specific commands
		this.addCommand({
			id: 'show-sources-folder',
			name: 'Show sources folder',
			callback: () => {
				const folder = this.app.vault.getAbstractFileByPath(this.settings.sourcesFolder);
				if (folder) {
					this.app.workspace.getLeaf(true).openFile(folder as any);
				} else {
					new Notice(`Sources folder '${this.settings.sourcesFolder}' not found`);
				}
			}
		});

		this.addCommand({
			id: 'generate-bibliography-file',
			name: 'Generate bibliography file',
			callback: async () => {
				try {
					const bibPath = `${this.settings.sourcesFolder}/${this.settings.bibliographyFilename}`;
					await this.api.exportBibliographyToPath({
						outputPath: bibPath
					});
				} catch (error) {
					new Notice(`Failed to generate bibliography: ${error.message}`);
				}
			}
		});
	}

	private async initializeSourcesFolder() {
		try {
			const folder = this.app.vault.getAbstractFileByPath(this.settings.sourcesFolder);
			if (!folder) {
				await this.app.vault.createFolder(this.settings.sourcesFolder);
				console.log(`Created sources folder: ${this.settings.sourcesFolder}`);
			}
		} catch (error) {
			console.error('Failed to initialize sources folder:', error);
		}
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

		containerEl.createEl('h2', { text: 'Bibliography Manager Settings' });

		new Setting(containerEl)
			.setName('Sources folder')
			.setDesc('Folder where source files are stored')
			.addText(text => text
				.setPlaceholder('sources')
				.setValue(this.plugin.settings.sourcesFolder)
				.onChange(async (value) => {
					this.plugin.settings.sourcesFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bibliography filename')
			.setDesc('Default filename for generated bibliography files')
			.addText(text => text
				.setPlaceholder('bibliography.bib')
				.setValue(this.plugin.settings.bibliographyFilename)
				.onChange(async (value) => {
					this.plugin.settings.bibliographyFilename = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-generate on export')
			.setDesc('Automatically generate bibliography when other plugins request it')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoGenerate)
				.onChange(async (value) => {
					this.plugin.settings.autoGenerate = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'API Usage' });

		const apiInfo = containerEl.createDiv();
		apiInfo.createEl('p', {
			text: 'Other plugins can access this plugin\'s API through:',
			cls: 'setting-item-description'
		});

		const codeBlock = apiInfo.createEl('pre', { cls: 'api-usage-example' });
		codeBlock.createEl('code', {
			text: `const bibPlugin = app.plugins.plugins['bibliography-manager'];
if (bibPlugin?.api) {
  const bibContent = await bibPlugin.api.generateBibliography({
    sourcesFolder: 'sources'
  });
}`
		});
	}
}