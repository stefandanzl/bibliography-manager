import { Notice } from "obsidian";
import BibliographyManagerPlugin from "src/main";
import { DEFAULT_SETTINGS } from "src/types/settings";

export async function loadTemplateFile(
	plugin: BibliographyManagerPlugin
): Promise<void> {
	try {
		// Always reset to default template first
		plugin.settings.sourceNoteTemplate =
			DEFAULT_SETTINGS.sourceNoteTemplate;

		// Load from external file if specified
		if (
			plugin.settings.templateFile &&
			plugin.settings.templateFile.trim() !== ""
		) {
			const templateExists = await plugin.app.vault.adapter.exists(
				plugin.settings.templateFile
			);

			if (templateExists) {
				const templateContent = await plugin.app.vault.adapter.read(
					plugin.settings.templateFile
				);
				plugin.settings.sourceNoteTemplate = templateContent;
				console.log(
					`Loaded template from file: ${plugin.settings.templateFile}`
				);
			} else {
				console.warn(
					`Template file not found: ${plugin.settings.templateFile}`
				);
				new Notice(
					`Template file not found: ${plugin.settings.templateFile}\nUsing default template.`
				);
			}
		}
	} catch (error) {
		console.error("Error loading template file:", error);
		// Fall back to default template
		plugin.settings.sourceNoteTemplate =
			DEFAULT_SETTINGS.sourceNoteTemplate;
	}
}
