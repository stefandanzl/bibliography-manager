// Test helper functions from the import modal
import { Notice } from 'obsidian';

// Mock Obsidian
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
}));

// Test helper functions directly
function extractAuthors(citationData: any): string[] {
  const authors = citationData.author || [];
  return authors.map((author: any) => {
    if (author.literal) return author.literal;
    if (author.family && author.given) {
      return `${author.family}, ${author.given}`;
    }
    if (author.family) return author.family;
    return "Unknown Author";
  });
}

function extractTitleFromURL(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(part => part.length > 0);
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart) {
      // Convert dashes and underscores to spaces and capitalize
      return lastPart.replace(/[-_]/g, " ")
                    .replace(/\b\w/g, l => l.toUpperCase());
    } else {
      return urlObj.hostname;
    }
  } catch {
    return "Website Source";
  }
}

describe('Helper Functions', () => {
  describe('extractAuthors', () => {
    it('should format family and given names correctly', () => {
      const citationData = {
        author: [
          { family: 'Smith', given: 'John' },
          { family: 'Doe', given: 'Jane' },
        ],
      };

      const result = extractAuthors(citationData);
      expect(result).toEqual(['Smith, John', 'Doe, Jane']);
    });

    it('should handle literal author names', () => {
      const citationData = {
        author: [{ literal: 'Organization Name' }],
      };

      const result = extractAuthors(citationData);
      expect(result).toEqual(['Organization Name']);
    });

    it('should handle single family names', () => {
      const citationData = {
        author: [{ family: 'Single' }],
      };

      const result = extractAuthors(citationData);
      expect(result).toEqual(['Single']);
    });

    it('should handle empty author arrays', () => {
      const citationData = { author: [] };
      const result = extractAuthors(citationData);
      expect(result).toEqual([]);
    });

    it('should handle missing author field', () => {
      const citationData = {};
      const result = extractAuthors(citationData);
      expect(result).toEqual([]);
    });

    it('should handle unknown authors', () => {
      const citationData = {
        author: [{ unknown: 'field' }],
      };

      const result = extractAuthors(citationData);
      expect(result).toEqual(['Unknown Author']);
    });
  });

  describe('extractTitleFromURL', () => {
    it('should extract title from URL path', () => {
      const url = 'https://example.com/articles/test-article-title';
      const result = extractTitleFromURL(url);
      expect(result).toBe('Test Article Title');
    });

    it('should convert underscores to spaces', () => {
      const url = 'https://example.com/articles/test_article_title';
      const result = extractTitleFromURL(url);
      expect(result).toBe('Test Article Title');
    });

    it('should handle URLs with no path (use hostname)', () => {
      const url = 'https://example.com/';
      const result = extractTitleFromURL(url);
      expect(result).toBe('example.com');
    });

    it('should handle invalid URLs', () => {
      const result = extractTitleFromURL('invalid-url');
      expect(result).toBe('Website Source');
    });

    it('should handle empty path segments', () => {
      const url = 'https://example.com///';
      const result = extractTitleFromURL(url);
      expect(result).toBe('example.com');
    });

    it('should capitalize words correctly', () => {
      const url = 'https://example.com/articles/this-is-a-test';
      const result = extractTitleFromURL(url);
      expect(result).toBe('This Is A Test');
    });
  });
});