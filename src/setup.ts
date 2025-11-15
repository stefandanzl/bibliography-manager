import { App, Editor, MarkdownView, Notice } from "obsidian";
import { SourceImportModal } from "./ui/importModal";
import { FORMAT_EXTENSION_MAPPING } from "./types/interfaces";
import BibliographyManagerPlugin from "./main";
import { BibliographyExportModal } from "./ui/exportModal";
import { GenerateCitekeyCommand } from "./utils/citekey";
import { BibliographySettings } from "./types/settings";

export function registerCommands(plugin: BibliographyManagerPlugin) {
	const commands = getBibliographyCommands(
		plugin.app,
		plugin.settings,
		plugin
	);

	commands.forEach((command) => {
		plugin.addCommand(command);
	});

	// Additional plugin-specific commands
	plugin.addCommand({
		id: "show-sources-folder",
		name: "Show sources folder",
		callback: () => {
			const folder = plugin.app.vault.getAbstractFileByPath(
				plugin.settings.sourcesFolder
			);
			if (folder) {
				plugin.app.workspace.getLeaf(true).openFile(folder as any);
			} else {
				new Notice(
					`Sources folder '${plugin.settings.sourcesFolder}' not found`
				);
			}
		},
	});

	plugin.addCommand({
		id: "generate-bibliography-file",
		name: "Generate bibliography file",
		callback: async () => {
			try {
				// Generate full filename with extension based on format
				const extension =
					FORMAT_EXTENSION_MAPPING[
						plugin.settings.bibliographyFormat
					] || ".bib";
				const outputFolder =
					plugin.settings.bibliographyOutputFolder ||
					plugin.settings.sourcesFolder;
				const bibPath = `${outputFolder}/${plugin.settings.bibliographyFilename}${extension}`;

				// Generate bibliography using API
				const bibContent = await plugin.api.exportBibliography();

				// Write to file
				await plugin.app.vault.adapter.write(bibPath, bibContent);
				new Notice(`Bibliography exported to ${bibPath}`);
			} catch (error) {
				new Notice(`Failed to generate bibliography: ${error.message}`);
			}
		},
	});
}

// Initialize citation-js properly for browser environment
let CiteConstructor: any = null;
let utilInstance: any = null;

export async function initializeCiteJS() {
	if (CiteConstructor) return CiteConstructor;

	// Use dynamic import for proper module loading
	const citationCore = await import("@citation-js/core");

	// Get the Cite class
	CiteConstructor =
		(citationCore as any).default?.Cite ||
		(citationCore as any).Cite ||
		(citationCore as any).default;

	if (!CiteConstructor) {
		throw new Error("Could not find Cite constructor in citation-js/core");
	}

	// Load bibtex plugin - this is required
	const bibtexPlugin = await import("@citation-js/plugin-bibtex");
	const pluginConfig = (bibtexPlugin as any).default || bibtexPlugin;

	if (!pluginConfig) {
		throw new Error("Could not load @citation-js/plugin-bibtex");
	}

	if (typeof CiteConstructor.add !== "function") {
		throw new Error("Cite constructor does not support plugin loading");
	}

	CiteConstructor.add(pluginConfig);

	return CiteConstructor;
}

// Command definitions - pass app instance and settings
export function getBibliographyCommands(
	app: App,
	settings: BibliographySettings,
	plugin?: BibliographyManagerPlugin
) {
	return [
		{
			id: "generate-citekey",
			name: "Generate citekey for current source",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const command = new GenerateCitekeyCommand(app);
				command.execute(editor, view);
			},
		},
		{
			id: "export-bibliography-manual",
			name: "Export bibliography manually",
			callback: () => {
				new BibliographyExportModal(app, settings).open();
			},
		},
		{
			id: "import-source",
			name: "Import new source",
			callback: () => {
				new SourceImportModal(app, settings, plugin).open();
			},
		},
	];
}
