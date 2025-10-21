import BibliographyManagerPlugin from "src/main";

export async function initializeSourcesFolder(
	plugin: BibliographyManagerPlugin
) {
	try {
		// Check if folder exists using adapter to avoid triggering file events
		const folderExists = await plugin.app.vault.adapter.exists(
			plugin.settings.sourcesFolder
		);

		if (!folderExists) {
			// Create folder using adapter directly to avoid triggering unnecessary events
			await plugin.app.vault.adapter.mkdir(plugin.settings.sourcesFolder);
			console.log(
				`Created sources folder: ${plugin.settings.sourcesFolder}`
			);
		}
	} catch (error) {
		console.warn("Could not initialize sources folder:", error);
		// Don't throw error - plugin can work without the sources folder
	}
}
