import BibliographyManagerPlugin from "main";
import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	AbstractInputSuggest,
	Notice,
} from "obsidian";

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
export const DEFAULT_SETTINGS: BibliographySettings = {
	sourcesFolder: "sources",
	bibliographyFilename: "bibliography.bib",
	autoGenerate: false,
	supportedFileTypes: ["pdf", "epub", "txt"],
	crossrefEmail: "",
	sourceNoteTemplate: `---
citekey: {{citekey}}
title: "{{title}}"
author: {{authorArray}}
keywords: {{keywordsArray}}
bibtype: {{bibtype}}
aliases: [{{atcitekey}}]
filename: {{filename}}
doi: {{doi}}
isbn: {{isbn}}
publisher: {{publisher}}
journal: {{journal}}
volume: {{volume}}
number: {{number}}
pages: {{pages}}
abstract: {{abstract}}
year: {{year}}
url: {{url}}
downloadurl: {{downloadurl}}
imageurl: {{imageurl}}
---

# {{title}}

{{author}}

({{year}})

## Abstract
{{abstract}}

**Keywords:** {{keywords}}

**File:** [{{filename}}.pdf](./{{filename}}.pdf)

DOI: {{doi}}
URL: {{url}}
`,
	templateFile: "",
	fieldMappings: {
		citekey: "citekey",
		atcitekey: "citekey",
		title: "title",
		author: "author",
		keywords: "keywords",
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

// Folder suggestion class for autocompleting folder paths
class FolderSuggest extends AbstractInputSuggest<string> {
	private folders: string[];

	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
		// Get all folders and include root folder
		this.folders = [""].concat(
			this.app.vault.getAllFolders().map((folder) => folder.path)
		);
	}

	getInstructions(): string {
		return "Type to filter folders";
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase();
		return this.folders.filter((folder) =>
			folder.toLowerCase().includes(inputLower)
		);
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.createEl("div", { text: folder || "/" });
	}

	selectSuggestion(folder: string, evt: MouseEvent | KeyboardEvent): void {
		this.inputEl.value = folder;
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}

// Template file suggestion class for autocompleting markdown files
class TemplateFileSuggest extends AbstractInputSuggest<string> {
	private filesAndFolders: string[];

	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.filesAndFolders = this.getAllMarkdownFiles();
	}

	private getAllMarkdownFiles(): string[] {
		const items: string[] = [];
		const folders = this.app.vault.getAllFolders().map(folder => folder.path);

		// Add root folder and all other folders first
		items.push(""); // root
		folders.forEach(folder => {
			items.push(folder);
		});

		// Then add all markdown files
		this.app.vault.getFiles().forEach(file => {
			if (file.extension === "md") {
				items.push(file.path);
			}
		});

		return items.sort();
	}

	getInstructions(): string {
		return "Type to filter markdown files and folders";
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase();
		return this.filesAndFolders.filter(item =>
			item.toLowerCase().includes(inputLower)
		);
	}

	renderSuggestion(item: string, el: HTMLElement): void {
		// Show empty string as "/" for root folder
		const displayText = item === "" ? "/" : item;
		el.createEl("div", { text: displayText });
	}

	selectSuggestion(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.inputEl.value = item;
		this.inputEl.dispatchEvent(new Event("input"));
		this.close();
	}
}

export class BibliographySettingTab extends PluginSettingTab {
	plugin: BibliographyManagerPlugin; // Using any to avoid circular dependency

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
			.addText((text) => {
				text.setPlaceholder("sources")
					.setValue(this.plugin.settings.sourcesFolder)
					.onChange(async (value) => {
						this.plugin.settings.sourcesFolder = value;
						await this.plugin.saveSettings();
					});

				// Add folder suggestions to the input element
				new FolderSuggest(this.app, text.inputEl);
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
			.setDesc(
				"Email for Crossref API 'polite' access (optional but recommended for higher rate limits)"
			)
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
			.setDesc(
				"Path to markdown file used as template for new source notes (leave empty to use default template)"
			)
			.addText((text) => {
				text.setPlaceholder("templates/source-note.md")
					.setValue(this.plugin.settings.templateFile)
					.onChange(async (value) => {
						this.plugin.settings.templateFile = value;
						await this.plugin.saveSettings();
						// Reload template if file is specified
						await this.plugin.loadTemplateFile();
					});

				// Add template file suggestions
				new TemplateFileSuggest(this.app, text.inputEl);
			});

		containerEl.createEl("p", {
			text: "Template placeholders are mapped to frontmatter fields using the mappings.yaml file in your plugin folder. Leave template file empty to use the default template.",
			cls: "setting-item-description",
		});

		containerEl.createEl("h4", { text: "Available Placeholders" });
		const placeholdersInfo = containerEl.createDiv({
			cls: "setting-item-description",
		});
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
			.setDesc(
				"Edit the YAML file that maps template placeholders to frontmatter fields"
			)
			.addButton((button) => {
				button
					.setButtonText("Open")
					.setCta()
					.onClick(async () => {
						try {
							const mappingsPath = `${this.plugin.manifest.dir}/mappings.yaml`;
							const file =
								this.plugin.app.vault.getAbstractFileByPath(
									mappingsPath
								);
							if (file) {
								await this.plugin.app.workspace
									.getLeaf(true)
									.openFile(file as any);
							} else {
								new Notice(
									"Field mappings file not found. It will be created automatically."
								);
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
