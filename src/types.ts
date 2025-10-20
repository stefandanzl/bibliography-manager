// Unified types for bibliography manager plugin

export interface SourceData {
	citekey: string;
	title: string;
	author: string[];
	category: string[];
	bibtype: string;
	year?: string;

	// File and media fields
	downloadurl?: string;
	imageurl?: string;
	filelink?: string;
	filepath?: string;

	// Reading progress fields
	added?: string;
	started?: string;
	ended?: string;
	rating?: string;
	pages?: number;
	currentpage?: number;
	status?: string;

	// Bibliographic fields from citation-js
	abstract?: string;
	abstractmd?: string;
	publisher?: string;
	journal?: string;
	volume?: string;
	number?: string;
	doi?: string;
	isbn?: string;
	url?: string;

	// Additional fields
	aliases?: string[];
	keywords?: string[];
	note?: string;
	issue?: string;
}

export type SourceType = "book" | "paper" | "website" | "thesis" | "report" | "other";
export type ImportMethod = "doi" | "isbn" | "url" | "bibtex";

export interface BibliographyConfig {
	mode: "directory" | "file";
	path: string;
}

export interface BibliographySettings {
	sourcesFolder: string;
	bibliographyFilename: string;
	bibliographyOutputFolder: string;
	bibliographyFormat: "bibtex" | "csl-json" | "hayagriva";
	autoGenerate: boolean;
	supportedFileTypes: string[];
	crossrefEmail: string;
	sourceNoteTemplate: string;
	templateFile: string;
	fieldMappings: Record<string, string>;
}