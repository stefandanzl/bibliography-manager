import { Notice } from "obsidian";
import { getBibliographyCommands } from "./bibliographyCommands";
import { FORMAT_EXTENSION_MAPPING } from "./types/interfaces";
import BibliographyManagerPlugin from "./main";

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
