import { App, TFile, TFolder, stringifyYaml } from "obsidian";
import { CitekeyGenerator } from "./citekey";

export class SourceImporter {
	constructor(
		private app: App,
		private sourcesFolder: string,
		private template?: string
	) {}

	async createSourceFile(sourceData: any, mediaType: string): Promise<TFile> {
		const citekey = CitekeyGenerator.generateFromTitleAndAuthors(
			sourceData.title,
			sourceData.author || [],
			sourceData.year
		);

		// Create readable filename from title
		const filename =
			CitekeyGenerator.sanitizeFilename(sourceData.title) + ".md";
		const sourceFolder = this.app.vault.getAbstractFileByPath(
			this.sourcesFolder
		);
		const targetFolder =
			sourceFolder instanceof TFolder
				? `${sourceFolder.path}/${mediaType}`
				: `${this.sourcesFolder}/${mediaType}`;

		const filePath = `${targetFolder}/${filename}`;

		// Ensure directory exists
		await this.ensureDirectoryExists(targetFolder);

		// Use template if available, otherwise fall back to default markdown generation
		const content =
			this.template && this.template.trim()
				? this.generateSourceFromTemplate({ ...sourceData, citekey })
				: this.generateSourceMarkdown({ ...sourceData, citekey });

		// Create file in vault
		const newFile = await this.app.vault.create(filePath, content);

		return newFile;
	}

	private async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (!(await this.app.vault.adapter.exists(dirPath))) {
			await this.app.vault.adapter.mkdir(dirPath);
		}
	}

	private generateSourceMarkdown(source: any): string {
		const yaml: any = {
			title: source.title,
			author: source.author || [],
			year: source.year,
			citekey: source.citekey,
			type: source.type || "misc",
			tags: ["source"],
		};

		// Add optional fields only if they exist
		if (source.doi) yaml.doi = source.doi;
		if (source.journal) yaml.journal = source.journal;
		if (source.publisher) yaml.publisher = source.publisher;
		if (source.pages) yaml.pages = source.pages;
		if (source.volume) yaml.volume = source.volume;
		if (source.issue) yaml.issue = source.issue;
		if (source.isbn) yaml.isbn = source.isbn;
		if (source.url) yaml.url = source.url;
		if (source.abstract) yaml.abstract = source.abstract;
		if (source.keywords) yaml.keywords = source.keywords;

		const yamlString = stringifyYaml(yaml);

		return `---
${yamlString}
---

# ${source.title}

**Authors:** ${(source.author || []).join(", ")}
**Year:** ${source.year}
${source.journal ? `**Journal:** ${source.journal}` : ""}
${source.publisher ? `**Publisher:** ${source.publisher}` : ""}
${source.doi ? `**DOI:** ${source.doi}` : ""}

## Abstract
${source.abstract || "<!-- Add abstract here -->"}

## Key Points
<!-- Add key findings here -->

## Notes
<!-- Your notes and analysis -->
`;
	}

	private generateSourceFromTemplate(source: any): string {
		// Create template data object with direct field access
		const templateData: Record<string, any> = {};

		// Direct field mapping - template variables match source data fields
		Object.keys(source).forEach((field) => {
			const value = source[field];

			if (value !== undefined && value !== null) {
				// Handle special formatting for certain fields
				if (field === "atcitekey") {
					// Special handling for atcitekey - prepend @ symbol
					templateData[field] = `@${value}`;
				} else if (Array.isArray(value)) {
					// For arrays, provide both array version (for other uses) and pre-formatted YAML array string
					templateData[field] = value; // Keep as array for other uses
					// Format array as YAML array string without using it as object key
					templateData[field + "Array"] = this.formatYamlArray(value); // Pre-formatted YAML array
				} else if (typeof value === "string") {
					templateData[field] = value;
				} else {
					templateData[field] = String(value);
				}
			} else {
				// Set empty arrays for fields that should be arrays, empty strings for others
				if (field === "author" || field === "keywords") {
					templateData[field] = []; // Empty array for YAML
					templateData[field + "Array"] = "[]"; // Empty YAML array string
				} else {
					templateData[field] = "";
				}
			}
		});

		// Add helper fields
		templateData.authorList = Array.isArray(source.author)
			? source.author.join(", ")
			: source.author || "";

		// Add sanitized filename for use in templates
		templateData.filename = CitekeyGenerator.sanitizeFilename(source.title);
		// Add atcitekey for aliases (citekey with @ prefix)
		if (source.citekey) {
			templateData.atcitekey = `@${source.citekey}`;
		}

		console.log(
			"📊 Final template data:",
			JSON.stringify(templateData, null, 2)
		);

		// Render the template
		try {
			const templateToRender = this.template || "";

			if (!templateToRender.trim()) {
				return this.generateSourceMarkdown(source);
			}

			const result = this.renderTemplateWithRegex(
				templateToRender,
				templateData
			);
			return result;
		} catch (error) {
			console.error("ERROR rendering template:", error);
			// Fall back to default markdown generation
			console.warn(
				"Falling back to default markdown generation due to template error"
			);
			return this.generateSourceMarkdown(source);
		}
	}

	private renderTemplateWithRegex(
		template: string,
		data: Record<string, any>
	): string {
		try {
			let result = template;

			// Replace simple {{variable}} placeholders only
			result = result.replace(/\{\{([^}]+)\}\}/g, (match, fieldPath) => {
				const trimmedPath = fieldPath.trim();
				try {
					// Handle nested paths like "data.field"
					const value = this.getNestedValue(data, trimmedPath);
					const resultValue =
						value !== undefined && value !== null
							? String(value)
							: "";
					return resultValue;
				} catch (innerError) {
					console.error(
						`ERROR processing variable "${trimmedPath}":`,
						innerError
					);
					return "";
				}
			});

			return result;
		} catch (error) {
			console.error("CRITICAL ERROR in renderTemplateWithRegex:", error);
			throw error;
		}
	}

	private getNestedValue(obj: any, path: string): any {
		return path.split(".").reduce((current, key) => {
			return current && current[key] !== undefined
				? current[key]
				: undefined;
		}, obj);
	}

	private formatYamlArray(array: any[]): string {
		if (!array || array.length === 0) {
			return "[]";
		}

		// Format each element as a YAML string
		const formattedItems = array.map((item) => {
			if (typeof item === "string") {
				return `"${item.replace(/"/g, '\\"')}"`;
			} else if (typeof item === "number" || typeof item === "boolean") {
				return String(item);
			} else {
				// For objects or complex types, convert to string
				return `"${String(item).replace(/"/g, '\\"')}"`;
			}
		});

		return `[${formattedItems.join(", ")}]`;
	}
}
