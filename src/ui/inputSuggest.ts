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

// Folder suggestion class for autocompleting folder paths
export class FolderSuggest extends AbstractInputSuggest<string> {
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
export class TemplateFileSuggest extends AbstractInputSuggest<string> {
	private filesAndFolders: string[];

	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.filesAndFolders = this.getAllMarkdownFiles();
	}

	private getAllMarkdownFiles(): string[] {
		const items: string[] = [];
		const folders = this.app.vault
			.getAllFolders()
			.map((folder) => folder.path);

		// Add root folder and all other folders first
		items.push(""); // root
		folders.forEach((folder) => {
			items.push(folder);
		});

		// Then add all markdown files
		this.app.vault.getFiles().forEach((file) => {
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
		return this.filesAndFolders.filter((item) =>
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
