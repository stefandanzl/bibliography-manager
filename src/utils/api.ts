import BibliographyManagerPlugin from "src/main";
import {
	BIBLIOGRAPHY_FORMAT_MAPPING,
	FORMAT_EXTENSION_MAPPING,
} from "src/types/interfaces";

// API interface that other plugins can use
export interface BibliographyAPI {
	/** API for managing bibliography exports */
	description: string;
	/**
	 * Export bibliography content from sources
	 * @param sourcesFolder - Source files folder (defaults to plugin settings)
	 * @param outputFilename - Output filename (optional, used for format auto-detection)
	 * @param format - Export format: "bibtex", "csl-json", "hayagriva" (optional, auto-detects if nullish + outputFilename provided)
	 * @returns Promise<string> Generated bibliography content
	 *
	 * @example
	 * // Export using plugin defaults
	 * const bib = await api.exportBibliography();
	 *
	 * @example
	 * // Auto-detect format from filename (format is nullish)
	 * const bib = await api.exportBibliography(undefined, "my-bib.json", null);
	 *
	 * @example
	 * // Specific format with custom filename
	 * const bib = await api.exportBibliography('sources', 'references.bib', 'bibtex');
	 */
	exportBibliography(
		sourcesFolder?: string,
		outputFilename?: string,
		format?: "bibtex" | "csl-json" | "hayagriva" | ""
	): Promise<string>;

	/**
	 * Export bibliography to a file in the vault
	 * @param sourcesFolder Path to folder containing source files (optional, uses plugin setting)
	 * @param outputFilename Output filename (optional, auto-generated if not provided)
	 * @param format Output format ('bibtex', 'csl-json', 'hayagriva') (optional, uses plugin setting)
	 * @returns Promise<string> Path to the created file
	 *
	 * @example
	 * // Export using plugin defaults
	 * const filePath = await api.exportBibliographyToPath();
	 *
	 * @example
	 * // Export to specific folder with custom filename
	 * const filePath = await api.exportBibliographyToPath('sources', 'references.bib', 'bibtex');
	 *
	 * @example
	 * // Auto-detect format from filename (format is nullish)
	 * const filePath = await api.exportBibliographyToPath(undefined, "my-bib.json", null);
	 */
	exportBibliographyToPath(
		sourcesFolder?: string,
		outputFilename?: string,
		format?: "bibtex" | "csl-json" | "hayagriva" | ""
	): Promise<string>;
}

export function createAPI(plugin: BibliographyManagerPlugin): BibliographyAPI {
	return {
		description:
			"Bibliography Manager API - Export citations from source files to various formats (BibTeX, CSL-JSON, Hayagriva). Use exportBibliography() for content string or exportBibliographyToPath() to write directly to vault file.",
		/**
		 * Generate bibliography content from sources
		 * @param sourcesFolder Path to folder containing source files (optional, uses plugin setting)
		 * @param format Output format ('bibtex', 'csl', 'yaml', etc.) (optional, uses plugin setting)
		 * @returns Promise<string> Generated bibliography content
		 *
		 * @example
		 * // Export using plugin defaults
		 * const bib = await api.exportBibliography();
		 *
		 * @example
		 * // Auto-detect format from filename (format is nullish)
		 * const bib = await api.exportBibliography(undefined, null, "my-bib.json");
		 *
		 * @example
		 * // Specific format with custom filename
		 * const bib = await api.exportBibliography('sources', 'bibtex', 'references.bib');
		 */
		exportBibliography: async (
			sourcesFolder?: string,
			outputFilename?: string,
			format?: "bibtex" | "csl-json" | "hayagriva" | ""
		) => {
			try {
				const folder = sourcesFolder || this.settings.sourcesFolder;

				// Smart format detection (only when format is nullish AND outputFilename provided)
				let bibFormat = format || this.settings.bibliographyFormat;
				if (!format && outputFilename) {
					const ext = outputFilename
						.toLowerCase()
						.substring(outputFilename.lastIndexOf("."));
					const detectedFormat = BIBLIOGRAPHY_FORMAT_MAPPING[ext];

					if (!detectedFormat) {
						throw new Error(
							`Unsupported file extension: ${ext}. Supported extensions: .bib, .json, .yaml, .yml`
						);
					}

					bibFormat = detectedFormat as
						| "bibtex"
						| "csl-json"
						| "hayagriva";
				}

				// Use existing sourceService method
				const bibContent =
					await this.sourceService.generateBibliography(
						folder,
						bibFormat
					);

				if (!bibContent || bibContent.trim() === "") {
					throw new Error(
						"No sources found or failed to generate bibliography"
					);
				}

				return bibContent;
			} catch (error) {
				console.error("API: Failed to export bibliography:", error);
				throw error;
			}
		},
		/**
		 * Export bibliography to a file in the vault
		 * @param sourcesFolder Path to folder containing source files (optional, uses plugin setting)
		 * @param format Output format ('bibtex', 'csl-json', 'hayagriva') (optional, uses plugin setting)
		 * @param outputFilename Output filename (optional, auto-generated if not provided)
		 * @returns Promise<string> Path to the created file
		 *
		 * @example
		 * // Export using plugin defaults
		 * const filePath = await api.exportBibliographyToPath();
		 *
		 * @example
		 * // Export to specific folder with custom filename
		 * const filePath = await api.exportBibliographyToPath('sources', 'bibtex', 'references.bib');
		 *
		 * @example
		 * // Auto-detect format from filename (format is nullish)
		 * const filePath = await api.exportBibliographyToPath(undefined, null, "my-bib.json");
		 */
		exportBibliographyToPath: async (
			sourcesFolder?: string,
			outputFilename?: string,
			format?: "bibtex" | "csl-json" | "hayagriva" | ""
		) => {
			try {
				// Generate bibliography content using existing function
				const content = await this.api.exportBibliography(
					sourcesFolder,
					outputFilename,
					format
				);

				if (!content) {
					throw new Error("No bibliography content generated");
				}

				// Generate output path
				const folder = sourcesFolder || this.settings.sourcesFolder;
				const bibFormat = format || this.settings.bibliographyFormat;
				const filename =
					outputFilename ||
					`bibliography${
						FORMAT_EXTENSION_MAPPING[bibFormat] || ".bib"
					}`;

				// Ensure folder exists
				if (!this.app.vault.getAbstractFileByPath(folder)) {
					await this.app.vault.createFolder(folder);
				}

				const filePath = `${folder}/${filename}`;

				// Write content to file
				await this.app.vault.adapter.write(filePath, content);

				console.log(`API: Bibliography exported to ${filePath}`);
				return filePath;
			} catch (error) {
				console.error(
					"API: Failed to export bibliography to path:",
					error
				);
				throw error;
			}
		},
	};
}

export function exposeAPI(plugin: BibliographyManagerPlugin) {
	try {
		// Expose API for other plugins - use safer approach
		if (!(plugin.app as any).plugins.plugins) {
			(plugin.app as any).plugins.plugins = {};
		}
		(plugin.app as any).plugins.plugins["bibliography-manager"] = {
			api: plugin.api,
			version: "1.0.0",
		};
	} catch (error) {
		console.warn("Could not expose plugin API:", error);
	}
}
