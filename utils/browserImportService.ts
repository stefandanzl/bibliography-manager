import { App, Notice } from "obsidian";

// Browser-compatible import service using direct API calls
export class BrowserImportService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    async lookupDOI(doi: string): Promise<any> {
        try {
            // Clean DOI input
            const cleanDOI = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

            // Use Crossref API directly
            const response = await fetch(`https://api.crossref.org/works/${cleanDOI}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.message) {
                throw new Error("No data found for this DOI");
            }

            const work = data.message;
            return this.formatCrossrefData(work);

        } catch (error) {
            console.error('DOI lookup error:', error);
            throw new Error(`DOI lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    async lookupISBN(isbn: string): Promise<any> {
        try {
            // Clean ISBN input
            const cleanISBN = isbn.replace(/[-\s]/g, "");

            // Use Open Library API
            const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`);
            const data = await response.json();

            const key = `ISBN:${cleanISBN}`;
            if (!data[key]) {
                throw new Error("No data found for this ISBN");
            }

            return this.formatOpenLibraryData(data[key]);

        } catch (error) {
            console.error('ISBN lookup error:', error);
            throw new Error(`ISBN lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    async fetchURLMetadata(url: string): Promise<any> {
        try {
            // For DOI URLs, extract DOI and use DOI lookup
            if (url.includes('doi.org/')) {
                const doi = url.replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
                return await this.lookupDOI(doi);
            }

            // For arXiv URLs, use arXiv API
            if (url.includes('arxiv.org/abs/')) {
                const arxivId = url.match(/arxiv\.org\/abs\/(.+)/)?.[1];
                if (arxivId) {
                    return await this.lookupArXiv(arxivId);
                }
            }

            // For other URLs, return basic website data
            return this.createBasicWebsiteData(url);

        } catch (error) {
            console.error('URL metadata fetch error:', error);
            return this.createBasicWebsiteData(url);
        }
    }

    async lookupArXiv(arxivId: string): Promise<any> {
        try {
            const response = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`);
            const text = await response.text();

            // Parse XML response (basic parsing)
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/xml');
            const entry = doc.querySelector('entry');

            if (!entry) {
                throw new Error("No data found for this arXiv ID");
            }

            const title = entry.querySelector('title')?.textContent || '';
            const summary = entry.querySelector('summary')?.textContent || '';
            const published = entry.querySelector('published')?.textContent || '';
            const year = published ? new Date(published).getFullYear().toString() : '';

            // Extract authors
            const authors = Array.from(entry.querySelectorAll('author name')).map(el => el.textContent || '');

            return {
                title,
                authors,
                year,
                abstract: summary,
                url: `https://arxiv.org/abs/${arxivId}`,
                type: 'preprint'
            };

        } catch (error) {
            console.error('arXiv lookup error:', error);
            throw new Error(`arXiv lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    parseBibTeX(bibtex: string): any {
        try {
            // Simple BibTeX parser (basic implementation)
            const result: any = {};

            // Extract citekey
            const citekeyMatch = bibtex.match(/^@\w+\{([^,]+)/);
            if (citekeyMatch) {
                result.citekey = citekeyMatch[1].trim();
            }

            // Extract type
            const typeMatch = bibtex.match(/^@(\w+)/);
            if (typeMatch) {
                result.bibtype = typeMatch[1].toLowerCase();
            }

            // Extract title
            const titleMatch = bibtex.match(/title\s*=\s*\{([^}]+)\}/);
            if (titleMatch) {
                result.title = titleMatch[1].replace(/\{([^}]+)\}/g, '$1'); // Remove extra braces
            }

            // Extract author
            const authorMatch = bibtex.match(/author\s*=\s*\{([^}]+)\}/);
            if (authorMatch) {
                const authorString = authorMatch[1];
                result.author = this.parseBibTeXAuthors(authorString);
            }

            // Extract year
            const yearMatch = bibtex.match(/year\s*=\s*\{([^}]+)\}/);
            if (yearMatch) {
                result.year = yearMatch[1];
            }

            // Extract journal
            const journalMatch = bibtex.match(/journal\s*=\s*\{([^}]+)\}/);
            if (journalMatch) {
                result.journal = journalMatch[1];
            }

            // Extract publisher
            const publisherMatch = bibtex.match(/publisher\s*=\s*\{([^}]+)\}/);
            if (publisherMatch) {
                result.publisher = publisherMatch[1];
            }

            // Extract volume
            const volumeMatch = bibtex.match(/volume\s*=\s*\{([^}]+)\}/);
            if (volumeMatch) {
                result.volume = volumeMatch[1];
            }

            // Extract number/issue
            const numberMatch = bibtex.match(/number\s*=\s*\{([^}]+)\}/);
            if (numberMatch) {
                result.number = numberMatch[1];
            }

            // Extract pages
            const pagesMatch = bibtex.match(/pages\s*=\s*\{([^}]+)\}/);
            if (pagesMatch) {
                result.pages = pagesMatch[1];
            }

            // Extract DOI
            const doiMatch = bibtex.match(/doi\s*=\s*\{([^}]+)\}/);
            if (doiMatch) {
                result.doi = doiMatch[1];
            }

            // Extract URL
            const urlMatch = bibtex.match(/url\s*=\s*\{([^}]+)\}/);
            if (urlMatch) {
                result.url = urlMatch[1];
            }

            // Extract ISBN
            const isbnMatch = bibtex.match(/isbn\s*=\s*\{([^}]+)\}/);
            if (isbnMatch) {
                result.isbn = isbnMatch[1];
            }

            return result;

        } catch (error) {
            console.error('BibTeX parsing error:', error);
            throw new Error(`BibTeX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    private formatCrossrefData(work: any): any {
        const result: any = {
            title: work.title?.[0] || '',
            authors: this.formatCrossrefAuthors(work.author || []),
            year: work.published?.['date-parts']?.[0]?.[0]?.toString() || '',
            journal: work['container-title']?.[0] || '',
            publisher: work.publisher || '',
            doi: work.DOI || '',
            url: work.URL || '',
            volume: work.volume || '',
            number: work.issue || '',
            pages: work.page || '',
            type: work.type || ''
        };

        // Generate citekey if not present
        if (!result.citekey && result.title && result.authors.length > 0 && result.year) {
            result.citekey = this.generateCitekey(result.title, result.authors, result.year);
        }

        return result;
    }

    private formatOpenLibraryData(book: any): any {
        const authors = book.authors?.map((author: any) => author.name) || [];

        const result: any = {
            title: book.title || '',
            authors,
            year: book.publish_date?.split('-')?.[0] || '',
            publisher: book.publishers?.[0]?.name || '',
            isbn: book.identifiers?.isbn_13?.[0] || book.identifiers?.isbn_10?.[0] || '',
            url: book.url || '',
            pages: book.number_of_pages || '',
            type: 'book'
        };

        // Generate citekey if not present
        if (!result.citekey && result.title && authors.length > 0 && result.year) {
            result.citekey = this.generateCitekey(result.title, authors, result.year);
        }

        return result;
    }

    private createBasicWebsiteData(url: string): any {
        const title = this.extractTitleFromURL(url);

        return {
            title,
            authors: [],
            year: new Date().getFullYear().toString(),
            url,
            type: 'webpage'
        };
    }

    private formatCrossrefAuthors(authors: any[]): string[] {
        return authors.map(author => {
            if (author.literal) return author.literal;
            if (author.family && author.given) {
                return `${author.family}, ${author.given}`;
            }
            if (author.family) return author.family;
            return "Unknown Author";
        });
    }

    private parseBibTeXAuthors(authorString: string): string[] {
        // Split by "and" and clean up
        return authorString.split(/\s+and\s+/).map(author => {
            author = author.trim();

            // Handle "Family, Given" format
            if (author.includes(',')) {
                const [family, given] = author.split(',').map(s => s.trim());
                return `${family}, ${given}`;
            }

            return author;
        });
    }

    private extractTitleFromURL(url: string): string {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split("/").filter(part => part.length > 0);
            const lastPart = pathParts[pathParts.length - 1];

            if (lastPart) {
                return lastPart.replace(/[-_]/g, " ")
                              .replace(/\b\w/g, l => l.toUpperCase());
            } else {
                return urlObj.hostname;
            }
        } catch {
            return "Website Source";
        }
    }

    private generateCitekey(title: string, authors: string[], year: string): string {
        const firstAuthor = authors[0]?.split(',')[0]?.replace(/\s+/g, '') || 'Unknown';
        const titleWords = title.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
        const titleAbbr = titleWords.slice(0, 3).map(w => w.substring(0, 3).toLowerCase()).join('');
        return `${firstAuthor}${year}${titleAbbr}`;
    }
}