import { App, TFile, Notice } from "obsidian";
import BibliographyManagerPlugin from "../main";
import { parseBibTeX as parseBibTeXInternal, latexToUnicode, unicodeToLatex, ParsedBibTeXEntry } from "./bibtexParser";

// Export the parse function with the correct name
export const parse = parseBibTeXInternal;

// Crossref API interface for DOI lookup
interface CrossrefWork {
	title: string[];
	author: Array<{
		given?: string;
		family?: string;
		name?: string;
	}>;
	published?: {
		'date-parts': Array<Array<number>>;
	};
	'DOI': string;
	'container-title'?: string[];
	type: string;
	publisher?: string;
	volume?: string;
	issue?: string;
	page?: string;
	abstract?: string;
	ISBN?: string[];
	URL?: string;
}

// Open Library API interface for ISBN lookup
interface OpenLibraryBook {
	title: string;
	authors: Array<{ name: string }>;
	publish_date?: string;
	publishers?: Array<{ name: string }>;
	identifiers?: {
		isbn_10?: string[];
		isbn_13?: string[];
	};
	number_of_pages?: number;
	publish_places?: Array<{ name: string }>;
	url?: string;
}

// Source data interface matching the frontmatter schema
export interface SourceData {
	citekey: string;
	author: string[];
	category: string[];
	bibtype: string;
	downloadurl?: string;
	imageurl?: string;
	year?: string;
	added?: string;
	started?: string;
	ended?: string;
	rating?: string;
	pages?: number;
	currentpage?: number;
	status?: string;
	filelink?: string;
	title: string;
	notetype: "source";
	aliases?: string[];
	// Additional fields that might come from external sources
	abstract?: string;
	publisher?: string;
	journal?: string;
	volume?: string;
	number?: string;
	doi?: string;
	isbn?: string;
	url?: string;
	filepath?: string; // Path to the source file (used in exportbib.ts)
}

// Source type detection
export type SourceType = "book" | "paper" | "website" | "thesis" | "report" | "other";

// Import methods
export type ImportMethod = "doi" | "isbn" | "url" | "bibtex";

/**
 * Convert LaTeX to Unicode for better display
 */
export function convertLatexToUnicode(text: string): string {
	try {
		return latexToUnicode(text);
	} catch (error) {
		console.warn("Failed to convert LaTeX to Unicode:", error);
		return text;
	}
}

/**
 * Convert Unicode to LaTeX for BibTeX export
 */
export function convertUnicodeToLatex(text: string): string {
	try {
		return unicodeToLatex(text);
	} catch (error) {
		console.warn("Failed to convert Unicode to LaTeX:", error);
		return text;
	}
}

/**
 * Parse BibTeX content using our simple parser
 */
export function parseBibTeX(bibtexContent: string): SourceData[] {
	try {
		const parsed = parseBibTeXInternal(bibtexContent);
		const sources: SourceData[] = [];

		for (const entry of parsed) {
			const sourceData = convertBibtexEntryToSourceData(entry);
			if (sourceData) {
				sources.push(sourceData);
			}
		}

		return sources;
	} catch (error) {
		throw new Error(`BibTeX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Convert bibtex-parser entry to SourceData
 */
function convertBibtexEntryToSourceData(entry: ParsedBibTeXEntry): SourceData | null {
	if (!entry.type || !entry.key) {
		return null;
	}

	const sourceType = detectSourceTypeFromBibtex(entry.type);
	const authors = extractAuthorsFromBibtex(entry.author);
	const year = entry.year?.toString();

	return {
		citekey: entry.key,
		author: authors,
		category: [sourceType],
		bibtype: entry.type,
		downloadurl: entry.url,
		imageurl: undefined,
		year,
		added: new Date().toISOString().split("T")[0],
		title: convertLatexToUnicode(entry.title || "Untitled Source"),
		notetype: "source",
		aliases: [`@${entry.key}`],
		abstract: entry.abstract ? convertLatexToUnicode(entry.abstract) : undefined,
		publisher: entry.publisher ? convertLatexToUnicode(entry.publisher) : undefined,
		journal: entry.journal ? convertLatexToUnicode(entry.journal) : undefined,
		volume: entry.volume,
		number: entry.number || entry.issue,
		doi: entry.doi,
		isbn: entry.isbn,
		url: entry.url,
		pages: entry.pages ? parseInt(entry.pages) : undefined,
	};
}

/**
 * Fetch metadata from DOI using Crossref API
 */
export async function fetchFromDOI(doi: string): Promise<SourceData | null> {
	try {
		// Clean DOI input
		const cleanDOI = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

		const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`);

		if (!response.ok) {
			throw new Error(`Crossref API error: ${response.status}`);
		}

		const data = await response.json();

		if (!data.message) {
			throw new Error("No data found for this DOI");
		}

		return convertCrossrefDataToSourceData(data.message, cleanDOI);
	} catch (error) {
		throw new Error(`DOI lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Convert Crossref API response to SourceData
 */
function convertCrossrefDataToSourceData(crossrefData: any, doi: string): SourceData {
	const sourceType = detectSourceTypeFromCrossref(crossrefData);
	const authors = extractAuthorsFromCrossref(crossrefData.author);
	const year = crossrefData.published?.["date-parts"]?.[0]?.[0]?.toString() ||
				 crossrefData.issued?.["date-parts"]?.[0]?.[0]?.toString();

	const title = crossrefData.title?.[0] || "Untitled Source";

	return {
		citekey: generateCitationKey(crossrefData),
		author: authors,
		category: [sourceType],
		bibtype: mapCrossrefTypeToBibtex(crossrefData.type),
		doi,
		url: crossrefData.URL,
		year,
		added: new Date().toISOString().split("T")[0],
		title,
		notetype: "source",
		aliases: [`@${generateCitationKey(crossrefData)}`],
		abstract: crossrefData.abstract,
		publisher: crossrefData.publisher,
		journal: crossrefData["container-title"]?.[0],
		volume: crossrefData.volume,
		number: crossrefData.issue,
		pages: crossrefData.page ? parseInt(crossrefData.page) : undefined,
	};
}

/**
 * Fetch metadata from ISBN using Open Library API
 */
export async function fetchFromISBN(isbn: string): Promise<SourceData | null> {
	try {
		// Clean ISBN input
		const cleanISBN = isbn.replace(/[-\s]/g, "");

		const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`);

		if (!response.ok) {
			throw new Error(`Open Library API error: ${response.status}`);
		}

		const data = await response.json();

		const bookKey = `ISBN:${cleanISBN}`;
		if (!data[bookKey]) {
			throw new Error("No data found for this ISBN");
		}

		return convertOpenLibraryDataToSourceData(data[bookKey], cleanISBN);
	} catch (error) {
		throw new Error(`ISBN lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Convert Open Library API response to SourceData
 */
function convertOpenLibraryDataToSourceData(bookData: any, isbn: string): SourceData {
	const authors = bookData.authors?.map((author: any) => author.name) || [];
	const year = bookData.publish_date?.split(/\s+/)?.pop() || "";
	const title = bookData.title || "Untitled Source";

	return {
		citekey: generateCitationKeyFromBookData(bookData, authors, year),
		author: authors,
		category: ["book"],
		bibtype: "book",
		isbn,
		url: bookData.url,
		year,
		added: new Date().toISOString().split("T")[0],
		title,
		notetype: "source",
		aliases: [`@${generateCitationKeyFromBookData(bookData, authors, year)}`],
		publisher: bookData.publishers?.[0]?.name,
		pages: bookData.number_of_pages,
	};
}

/**
 * Create basic website source when no metadata is found
 */
export function createBasicWebsiteSource(url: string): SourceData {
	const citekey = generateCitationKeyFromURL(url);

	return {
		citekey,
		author: [],
		category: ["website"],
		bibtype: "webpage",
		downloadurl: url,
		imageurl: undefined,
		year: new Date().getFullYear().toString(),
		added: new Date().toISOString().split("T")[0],
		title: extractTitleFromURL(url),
		notetype: "source",
		aliases: [`@${citekey}`],
		url,
	};
}

/**
 * Generate BibTeX from SourceData using unicode2latex
 */
export function generateBibtexFromSource(source: SourceData): string {
	const fields: string[] = [];

	// Add required fields
	fields.push(`title = {${convertUnicodeToLatex(source.title)}}`);

	if (source.author && source.author.length > 0) {
		const authorStr = source.author.map(author => {
			// Handle "Last, First" format
			if (author.includes(",")) {
				return author;
			}
			// Convert "First Last" to "Last, First"
			const parts = author.trim().split(/\s+/);
			if (parts.length >= 2) {
				return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
			}
			return author;
		}).join(" and ");
		fields.push(`author = {${authorStr}}`);
	}

	if (source.year) {
		fields.push(`year = {${source.year}}`);
	}

	// Add optional fields
	const optionalFields = [
		{ key: "publisher", value: source.publisher },
		{ key: "journal", value: source.journal },
		{ key: "volume", value: source.volume },
		{ key: "number", value: source.number },
		{ key: "pages", value: source.pages?.toString() },
		{ key: "doi", value: source.doi },
		{ key: "isbn", value: source.isbn },
		{ key: "url", value: source.url },
		{ key: "abstract", value: source.abstract },
	];

	for (const field of optionalFields) {
		if (field.value) {
			fields.push(`${field.key} = {${convertUnicodeToLatex(field.value)}}`);
		}
	}

	return `@${source.bibtype}{${source.citekey},
  ${fields.join(",\n  ")}
}`;
}

/**
 * Generate multiple BibTeX entries
 */
export function generateBibtex(sources: SourceData[]): string {
	if (sources.length === 0) {
		return "% No sources found";
	}

	return sources.map(source => generateBibtexFromSource(source)).join("\n\n");
}

// Helper functions

function detectSourceTypeFromBibtex(bibtexType: string): SourceType {
	const type = bibtexType.toLowerCase();

	switch (type) {
		case "article":
		case "article-journal":
			return "paper";
		case "book":
		case "book-chapter":
		case "inbook":
			return "book";
		case "thesis":
		case "phdthesis":
		case "mastersthesis":
			return "thesis";
		case "report":
		case "techreport":
			return "report";
		case "misc":
		case "webpage":
		case "online":
			return "website";
		default:
			return "other";
	}
}

function detectSourceTypeFromCrossref(crossrefData: any): SourceType {
	const type = crossrefData.type?.toLowerCase();
	const containerTitle = crossrefData["container-title"]?.[0]?.toLowerCase();

	if (type === "journal-article" || containerTitle?.includes("journal")) {
		return "paper";
	}
	if (type === "book" || type === "book-chapter" || type === "monograph") {
		return "book";
	}
	if (type === "dissertation" || type === "thesis") {
		return "thesis";
	}
	if (type === "report" || type === "report-series") {
		return "report";
	}
	if (type === "posted-content" || crossrefData.URL) {
		return "website";
	}

	return "other";
}

function mapCrossrefTypeToBibtex(crossrefType: string): string {
	const typeMap: { [key: string]: string } = {
		"journal-article": "article",
		"book": "book",
		"book-chapter": "inbook",
		"dissertation": "phdthesis",
		"thesis": "phdthesis",
		"report": "techreport",
		"posted-content": "misc",
		"proceedings-article": "inproceedings",
	};

	return typeMap[crossrefType] || "misc";
}

function extractAuthorsFromBibtex(authorField: any): string[] {
	if (!authorField) return [];

	if (typeof authorField === "string") {
		// Handle "Last, First and Last2, First2" format
		return authorField.split(" and ").map(author => author.trim());
	}

	if (Array.isArray(authorField)) {
		return authorField.map(author => {
			if (typeof author === "string") return author;
			if (author.literal) return author.literal;
			if (author.family && author.given) {
				return `${author.family}, ${author.given}`;
			}
			if (author.family) return author.family;
			return "Unknown Author";
		});
	}

	return [];
}

function extractAuthorsFromCrossref(authors: any[]): string[] {
	if (!authors || !Array.isArray(authors)) return [];

	return authors.map(author => {
		if (author.name) return author.name;
		if (author.family && author.given) {
			return `${author.family}, ${author.given}`;
		}
		if (author.family) return author.family;
		return "Unknown Author";
	});
}

function generateCitationKey(crossrefData: any): string {
	const firstAuthor = crossrefData.author?.[0];
	const year = crossrefData.published?.["date-parts"]?.[0]?.[0] ||
				crossrefData.issued?.["date-parts"]?.[0]?.[0] ||
				new Date().getFullYear();

	let authorPart = "Unknown";
	if (firstAuthor) {
		if (firstAuthor.family) {
			authorPart = firstAuthor.family;
		} else if (firstAuthor.name) {
			authorPart = firstAuthor.name.split(/\s+/)[0];
		}
	}

	const titleWord = crossrefData.title?.[0]?.split(/\s+/)[0]?.substring(0, 3).toUpperCase() || "UNK";

	return `${authorPart}${year}${titleWord}`;
}

function generateCitationKeyFromBookData(bookData: any, authors: string[], year: string): string {
	let authorPart = "Unknown";
	if (authors.length > 0) {
		authorPart = authors[0].split(/\s+/)[0];
	}

	const titleWord = bookData.title?.split(/\s+/)[0]?.substring(0, 3).toUpperCase() || "UNK";

	return `${authorPart}${year || new Date().getFullYear()}${titleWord}`;
}

function generateCitationKeyFromURL(url: string): string {
	try {
		const domain = new URL(url).hostname.replace("www.", "");
		const year = new Date().getFullYear();
		const random = Math.random().toString(36).substring(2, 5).toUpperCase();
		return `${domain}${year}${random}`;
	} catch {
		const year = new Date().getFullYear();
		const random = Math.random().toString(36).substring(2, 8).toUpperCase();
		return `WEB${year}${random}`;
	}
}

function extractTitleFromURL(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathParts = urlObj.pathname.split("/").filter(part => part.length > 0);
		const lastPart = pathParts[pathParts.length - 1];

		// Convert dashes and underscores to spaces and capitalize
		return lastPart.replace(/[-_]/g, " ")
					  .replace(/\b\w/g, l => l.toUpperCase()) ||
					  urlObj.hostname;
	} catch {
		return "Website Source";
	}
}