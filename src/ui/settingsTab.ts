import BibliographyManagerPlugin from "../main";
import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	AbstractInputSuggest,
	Notice,
} from "obsidian";
import {
	BibliographySettings,
	FORMAT_EXTENSION_MAPPING,
} from "../types/interfaces";
import { DEFAULT_SETTINGS } from "src/types/settings";
import { FolderSuggest, TemplateFileSuggest } from "./inputSuggest";
import { loadTemplateFile } from "src/utils/template";

export class BibliographySettingTab extends PluginSettingTab {
	plugin: BibliographyManagerPlugin; // Using any to avoid circular dependency
	filenamePreviewValue: HTMLDivElement;

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
			.setDesc(
				"Base filename for generated bibliography files (without extension)"
			)
			.addText((text) => {
				text.setPlaceholder("bibliography")
					.setValue(this.plugin.settings.bibliographyFilename)
					.onChange(async (value) => {
						this.plugin.settings.bibliographyFilename = value;
						await this.plugin.saveSettings();
						this.updateBibliographyFilenamePreview();
					});
			});

		// Add bibliography output folder selector
		new Setting(containerEl)
			.setName("Bibliography output folder")
			.setDesc(
				"Folder where bibliography files will be created (leave empty to use sources folder)"
			)
			.addText((text) => {
				text.setPlaceholder("sources")
					.setValue(this.plugin.settings.bibliographyOutputFolder)
					.onChange(async (value) => {
						this.plugin.settings.bibliographyOutputFolder = value;
						await this.plugin.saveSettings();
						this.updateBibliographyFilenamePreview();
					});

				// Add folder suggestions
				new FolderSuggest(this.app, text.inputEl);
			});

		// Add bibliography format selector
		new Setting(containerEl)
			.setName("Bibliography format")
			.setDesc("Choose the export format for your bibliography")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("bibtex", "BibTeX (.bib)")
					.addOption("csl-json", "CSL JSON (.json)")
					.addOption("hayagriva", "Hayagriva (.yaml)")
					.setValue(this.plugin.settings.bibliographyFormat)
					.onChange(async (value) => {
						const oldFormat =
							this.plugin.settings.bibliographyFormat;
						this.plugin.settings.bibliographyFormat = value as
							| "bibtex"
							| "csl-json"
							| "hayagriva";

						// Show warning about filename extension
						if (oldFormat !== value) {
							new Notice(
								`⚠️ Format changed from ${oldFormat} to ${value}. The file extension will be automatically updated to ${FORMAT_EXTENSION_MAPPING[value]} when generating bibliography.`
							);
						}

						await this.plugin.saveSettings();
						this.updateBibliographyFilenamePreview();
					});
			});

		// Add bibliography filename preview
		const filenamePreviewDiv = containerEl.createDiv();
		filenamePreviewDiv.style.marginTop = "10px";
		filenamePreviewDiv.style.marginBottom = "20px";
		filenamePreviewDiv.style.padding = "10px";
		filenamePreviewDiv.style.backgroundColor =
			"var(--background-secondary)";
		filenamePreviewDiv.style.borderRadius = "5px";
		filenamePreviewDiv.style.border =
			"1px solid var(--background-modifier-border)";

		const previewLabel = filenamePreviewDiv.createEl("div", {
			text: "Final bibliography filename:",
			cls: "setting-item-description",
		});

		const previewValue = filenamePreviewDiv.createEl("div", {
			cls: "setting-item-name",
		});
		previewValue.style.fontWeight = "bold";

		// Store references for updating
		this.filenamePreviewValue = previewValue;

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
						await loadTemplateFile(this.plugin);
					});

				// Add template file suggestions
				new TemplateFileSuggest(this.app, text.inputEl);
			});

		containerEl.createEl("h3", { text: "Field Mappings" });

		const mappingDetails = new Setting(containerEl)
			.setDesc(
				"Map standard CSL-JSON bibliography fields to your custom frontmatter keys."
			)
			.setName("");

		// Create collapsible section using Setting component
		const mappingContainer = containerEl.createDiv();
		mappingContainer.style.marginTop = "10px";
		mappingContainer.style.marginBottom = "20px";

		// Add toggle button using Setting component
		new Setting(mappingContainer)
			.setName("Show Field Mappings")
			.setDesc("")
			.addToggle((toggle) => {
				toggle.setValue(false);
				toggle.onChange(async (value) => {
					const contentContainer = mappingContainer.querySelector(
						".field-mappings-content"
					);
					if (contentContainer) {
						(contentContainer as HTMLElement).style.display = value
							? "block"
							: "none";
					}
				});
			});

		// Create content container (hidden by default)
		const contentContainer = mappingContainer.createDiv();
		contentContainer.className = "field-mappings-content";
		contentContainer.style.display = "none";
		contentContainer.style.marginTop = "10px";
		contentContainer.style.padding = "15px";
		contentContainer.style.backgroundColor = "var(--background-secondary)";
		contentContainer.style.borderRadius = "5px";
		contentContainer.style.border =
			"1px solid var(--background-modifier-border)";

		// Get default mappings from DEFAULT_SETTINGS
		const defaultMappings = DEFAULT_SETTINGS.fieldMappings;
		const currentMappings = this.plugin.settings.fieldMappings || {};

		// Add column headers
		const headerRow = contentContainer.createDiv();
		headerRow.style.display = "grid";
		headerRow.style.gridTemplateColumns = "1fr 1fr";
		headerRow.style.gap = "10px";
		headerRow.style.fontWeight = "bold";
		headerRow.style.marginBottom = "10px";
		headerRow.style.borderBottom =
			"1px solid var(--background-modifier-border)";
		headerRow.style.paddingBottom = "10px";

		const bibliographyHeader = headerRow.createDiv({
			text: "Bibliography Field",
		});
		const frontmatterHeader = headerRow.createDiv({
			text: "Frontmatter Key",
		});

		// Create input fields for each mapping
		Object.entries(defaultMappings).forEach(
			([bibField, frontmatterKey]) => {
				const fieldRow = contentContainer.createDiv();
				fieldRow.style.display = "grid";
				fieldRow.style.gridTemplateColumns = "1fr 1fr";
				fieldRow.style.gap = "10px";
				fieldRow.style.alignItems = "center";
				fieldRow.style.marginBottom = "8px";

				// Bibliography field column (read-only, left side)
				const bibFieldCell = fieldRow.createDiv();
				bibFieldCell.style.fontFamily = "var(--font-monospace)";
				bibFieldCell.style.fontSize = "var(--font-ui-smaller)";
				bibFieldCell.style.color = "var(--text-muted)";
				bibFieldCell.textContent = bibField;

				// Frontmatter key column (editable, right side)
				const keyCell = fieldRow.createDiv();
				new Setting(keyCell)
					.setName("")
					.setDesc("")
					.addText((text) => {
						text.setPlaceholder(frontmatterKey as string)
							.setValue(
								currentMappings[bibField] ||
									(frontmatterKey as string)
							)
							.onChange(async (value) => {
								if (!this.plugin.settings.fieldMappings) {
									this.plugin.settings.fieldMappings = {};
								}
								if (value.trim()) {
									this.plugin.settings.fieldMappings[
										bibField
									] = value.trim();
								} else {
									delete this.plugin.settings.fieldMappings[
										bibField
									];
								}
								await this.plugin.saveSettings();
							});
					});
			}
		);

		containerEl.createEl("h3", { text: "API Usage" });

		const apiInfo = containerEl.createDiv();
		apiInfo.createEl("p", {
			text: "Other plugins can access this plugin's API to generate bibliography content:",
			cls: "setting-item-description",
		});

		const codeBlock = apiInfo.createEl("pre", { cls: "api-usage-example" });
		codeBlock.createEl("code", {
			text: `const bibPlugin = app.plugins.plugins['bibliography-manager'];
if (bibPlugin?.api) {
  // Generate with custom settings
  const bibContent = await bibPlugin.api.generateBibliography({
    sourcesFolder: 'sources',  // optional, defaults to plugin settings
    format: 'bibtex'           // optional: 'bibtex', 'csl-json', 'hayagriva'
  });

  // Or use plugin defaults
  const bibContent = await bibPlugin.api.generateBibliography();
}`,
		});

		// Initialize filename preview
		this.updateBibliographyFilenamePreview();
	}

	/**
	 * Update the bibliography filename preview based on current settings
	 */
	updateBibliographyFilenamePreview(): void {
		const extension =
			FORMAT_EXTENSION_MAPPING[this.plugin.settings.bibliographyFormat] ||
			".bib";
		const outputFolder =
			this.plugin.settings.bibliographyOutputFolder ||
			this.plugin.settings.sourcesFolder;
		const fullFilename = `${outputFolder}/${this.plugin.settings.bibliographyFilename}${extension}`;
		this.filenamePreviewValue.textContent = fullFilename;
	}
}
