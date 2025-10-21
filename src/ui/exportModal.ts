import { Modal, App, Setting, Notice } from "obsidian";
import { SourceService } from "src/sourceService";
import { FORMAT_EXTENSION_MAPPING } from "src/types/interfaces";
import { BibliographySettings } from "src/types/settings";

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
			console.log(
				`🔍 Loading sources for bibliography export, scope: ${scope}`
			);

			if (scope === "vault") {
				// Use sources folder from settings
				const sourcesFolder = this.settings.sourcesFolder;
				console.log(`📂 Using sources folder: ${sourcesFolder}`);

				const sourceFiles = await this.sourceService.findAllSourceFiles(
					sourcesFolder
				);
				console.log(`📄 Found ${sourceFiles.length} source files`);

				// Generate bibliography based on format
				const format = this.settings.bibliographyFormat;
				console.log(`📋 Generating bibliography in format: ${format}`);

				// Use unified generateBibliography function
				this.bibContent = await this.sourceService.generateBibliography(
					sourcesFolder,
					format
				);

				console.log(
					`📊 Generated bibliography content length: ${
						this.bibContent?.length || 0
					}`
				);
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
			const extension =
				FORMAT_EXTENSION_MAPPING[this.settings.bibliographyFormat] ||
				".bib";
			const outputFolder =
				this.settings.bibliographyOutputFolder ||
				this.settings.sourcesFolder;
			const bibPath = `${outputFolder}/${this.settings.bibliographyFilename}${extension}`;

			console.log(`📝 Exporting bibliography to: ${bibPath}`);
			console.log(
				`📊 Content length: ${this.bibContent?.length || 0} characters`
			);

			// Ensure output directory exists
			const outputDir = outputFolder;
			if (
				outputDir &&
				!(await this.app.vault.adapter.exists(outputDir))
			) {
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
