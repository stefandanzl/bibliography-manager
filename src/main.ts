import { App, Plugin, Notice } from "obsidian";
import { BibliographyExporter } from "./exportbib";
require("@citation-js/plugin-hayagriva");
import { SourceService } from "./sourceService";
import { setCrossrefUserAgent } from "./utils/crossref";
// import { BibliographySettingTab } from "./settings";

// Import settings and defaults from settings and types files
import { DEFAULT_SETTINGS } from "./types/settings";
import {
	BibliographySettings,
	FORMAT_EXTENSION_MAPPING,
} from "./types/interfaces";
import { BibliographySettingTab } from "./ui/settingsTab";
import { BibliographyAPI, createAPI, exposeAPI } from "./utils/api";
import { initializeSourcesFolder } from "./utils/sources";
import { registerCommands } from "./setup";

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
			this.api = createAPI(this);

			// Expose API for other plugins - use safer approach
			// exposeAPI(this);

			// Register commands
			registerCommands(this);

			// Add settings tab
			this.addSettingTab(new BibliographySettingTab(this.app, this));

			// Initialize sources folder if it doesn't exist
			await initializeSourcesFolder(this);
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
}
