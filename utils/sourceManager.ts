import { App, Notice, Modal } from "obsidian";
import BibliographyManagerPlugin from "../main";
import {
	SourceData,
	SourceType,
	ImportMethod,
	fetchFromDOI,
	fetchFromISBN,
	createBasicWebsiteSource,
	parseBibTeX
} from "./bibtexImport";

export class SourceImportModal extends Modal {
	plugin: BibliographyManagerPlugin;
	currentMethod: ImportMethod;
	private onImport: (data: SourceData) => void;

	constructor(app: App, plugin: BibliographyManagerPlugin, onImport: (data: SourceData) => void) {
		super(app);
		this.plugin = plugin;
		this.currentMethod = "doi";
		this.onImport = onImport;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Title
		contentEl.createEl("h2", { text: "Import Source" });

		// Method selection buttons
		const methodContainer = contentEl.createDiv("source-import-methods");
		methodContainer.createEl("h3", { text: "Import Method:" });

		const methodButtons: { method: ImportMethod; label: string; placeholder: string }[] = [
			{ method: "doi", label: "DOI", placeholder: "10.1234/example.doi" },
			{ method: "isbn", label: "ISBN", placeholder: "978-0-123456-78-9" },
			{ method: "url", label: "URL", placeholder: "https://example.com/article" },
			{ method: "bibtex", label: "BibTeX", placeholder: "@article{...}" }
		];

		const inputContainer = contentEl.createDiv("source-import-input");
		const inputEl = inputContainer.createEl("textarea", {
			attr: { placeholder: methodButtons[0].placeholder },
			cls: "source-import-textarea"
		});
		inputEl.rows = 4;

		const methodButtonContainer = methodContainer.createDiv("method-buttons");
		methodButtons.forEach(({ method, label, placeholder }) => {
			const button = methodButtonContainer.createEl("button", {
				text: label,
				cls: `method-button ${this.currentMethod === method ? "active" : ""}`
			});

			button.onclick = () => {
				// Update active state
				methodButtonContainer.querySelectorAll(".method-button").forEach(btn =>
					btn.removeClass("active"));
				button.addClass("active");

				this.currentMethod = method;
				inputEl.placeholder = placeholder;
				inputEl.value = "";
				inputEl.focus();
			};
		});

		// Paste button
		const pasteButton = inputContainer.createEl("button", {
			text: "📋 Paste",
			cls: "paste-button"
		});
		pasteButton.onclick = async () => {
			try {
				const text = await navigator.clipboard.readText();
				inputEl.value = text;
			} catch (error) {
				new Notice("Failed to read clipboard. Please paste manually.");
			}
		};

		// Import button
		const importButton = contentEl.createEl("button", {
			text: "Import Source",
			cls: "mod-cta"
		});
		importButton.onclick = () => this.handleImport(inputEl.value);

		// Add some basic styling
		contentEl.addClass("source-import-modal");
	}

	private async handleImport(input: string): Promise<void> {
		if (!input.trim()) {
			new Notice("Please enter a value to import");
			return;
		}

		try {
			let sourceData: SourceData | null = null;

			switch (this.currentMethod) {
				case "doi":
					sourceData = await this.importFromDOI(input.trim());
					break;
				case "isbn":
					sourceData = await this.importFromISBN(input.trim());
					break;
				case "url":
					sourceData = await this.importFromURL(input.trim());
					break;
				case "bibtex":
					sourceData = await this.importFromBibTeX(input.trim());
					break;
			}

			if (sourceData) {
				this.onImport(sourceData);
				this.close();
			}
		} catch (error) {
			console.error("Import error:", error);
			new Notice(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	private async importFromDOI(doi: string): Promise<SourceData | null> {
		return await fetchFromDOI(doi);
	}

	private async importFromISBN(isbn: string): Promise<SourceData | null> {
		return await fetchFromISBN(isbn);
	}

	private async importFromURL(url: string): Promise<SourceData | null> {
		// For URL import, we'll create a basic website source
		// Could be enhanced with web scraping in the future
		return createBasicWebsiteSource(url);
	}

	private async importFromBibTeX(bibtex: string): Promise<SourceData | null> {
		try {
			const sources = parseBibTeX(bibtex);
			if (sources.length === 0) {
				throw new Error("Invalid BibTeX format");
			}
			return sources[0]; // Return the first source found
		} catch (error) {
			throw new Error(`BibTeX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	}