/**
 * Enhanced JATS XML to Markdown formatter using DOMParser
 * Provides proper markdown formatting with structure preservation
 * Lightweight alternative to heavy libraries like Stencila Encoda
 */
export class JatsFormatter {
    /**
     * Convert JATS XML content to properly formatted markdown
     * Uses DOMParser for enhanced formatting, falls back to simple HTML tag stripping
     */
    static async formatJatsToMarkdown(content: string): Promise<string> {
        if (!content || !content.trim()) {
            return '';
        }

        try {
            // Check if content contains JATS XML tags
            if (this.isJatsContent(content)) {
                return this.formatWithDOMParser(content);
            } else {
                // Fall back to simple HTML stripping for non-JATS content
                return this.stripHtml(content);
            }
        } catch (error) {
            console.error('Error formatting JATS content:', error);
            // Final fallback - return original content if both methods fail
            return content;
        }
    }

    /**
     * Detect if content contains JATS XML tags
     */
    private static isJatsContent(content: string): boolean {
        const jatsTags = [
            /<jats:.*?>/gi,
            /<\/jats:.*?>/gi,
            /<jats:/gi
        ];

        return jatsTags.some(pattern => pattern.test(content));
    }

    /**
     * Use DOMParser for enhanced JATS to Markdown conversion
     */
    private static formatWithDOMParser(jatsContent: string): string {
        try {
            // Parse the JATS content
            const parser = new DOMParser();
            const doc = parser.parseFromString(jatsContent, 'text/html');

            // Process the document to convert to enhanced markdown
            return this.processNodeToMarkdown(doc.body);
        } catch (error) {
            console.error('DOMParser conversion failed:', error);
            // Fall back to simple HTML tag stripping
            return this.stripHtml(jatsContent);
        }
    }

    /**
     * Recursively process DOM nodes to convert to enhanced markdown
     */
    private static processNodeToMarkdown(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const tagName = element.tagName.toLowerCase();

            // Handle JATS-specific tags
            if (tagName.startsWith('jats:')) {
                return this.processJatsElement(element);
            }

            // Handle standard HTML tags
            let result = '';

            // Process child nodes
            for (let i = 0; i < element.childNodes.length; i++) {
                result += this.processNodeToMarkdown(element.childNodes[i]);
            }

            // Add markdown formatting based on element type
            switch (tagName) {
                case 'p':
                    return result + '\n\n';
                case 'strong':
                case 'b':
                    return `**${result}**`;
                case 'em':
                case 'i':
                    return `*${result}*`;
                case 'code':
                    return `\`${result}\``;
                case 'ul':
                    return result + '\n';
                case 'ol':
                    return result + '\n';
                case 'li':
                    return `- ${result}\n`;
                case 'h1':
                    return `# ${result}\n\n`;
                case 'h2':
                    return `## ${result}\n\n`;
                case 'h3':
                    return `### ${result}\n\n`;
                case 'h4':
                    return `#### ${result}\n\n`;
                case 'h5':
                    return `##### ${result}\n\n`;
                case 'h6':
                    return `###### ${result}\n\n`;
                case 'blockquote':
                    return `> ${result}\n\n`;
                case 'br':
                    return '\n';
                default:
                    return result;
            }
        }

        return '';
    }

    /**
     * Process JATS-specific elements
     */
    private static processJatsElement(element: Element): string {
        const jatsTag = element.tagName.toLowerCase().replace('jats:', '');

        // Map JATS tags to markdown formatting
        switch (jatsTag) {
            case 'p':
            case 'article-title':
            case 'chapter-title':
                return this.processNodeToMarkdown(element) + '\n\n';
            case 'bold':
                return `**${this.processNodeToMarkdown(element)}**`;
            case 'italic':
                return `*${this.processNodeToMarkdown(element)}*`;
            case 'monospace':
                return `\`${this.processNodeToMarkdown(element)}\``;
            case 'list':
                // Could support ordered lists in the future by checking list-type attribute
                return this.processNodeToMarkdown(element) + '\n';
            case 'list-item':
                return `- ${this.processNodeToMarkdown(element)}\n`;
            case 'sec':
                const title = element.querySelector('jats\\:title');
                let result = '';
                if (title) {
                    result = `## ${this.processNodeToMarkdown(title)}\n\n`;
                }
                // Process other content in the section
                for (let i = 0; i < element.childNodes.length; i++) {
                    if (element.childNodes[i] !== title) {
                        result += this.processNodeToMarkdown(element.childNodes[i]);
                    }
                }
                return result;
            case 'title':
                return this.processNodeToMarkdown(element);
            case 'abstract':
                return '\n' + this.processNodeToMarkdown(element) + '\n';
            case 'kwd':
                return `**${this.processNodeToMarkdown(element)}**`;
            case 'kwd-group':
                const keywords = Array.from(element.querySelectorAll('jats\\:kwd'))
                    .map(kwd => this.processNodeToMarkdown(kwd))
                    .join(', ');
                return `**Keywords:** ${keywords}\n\n`;
            default:
                // For unknown JATS tags, just process their content
                return this.processNodeToMarkdown(element);
        }
    }

    /**
     * Simple HTML tag stripping for fallback
     */
    private static stripHtml(content: string): string {
        return content
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Enhanced JATS to plain text conversion for preview purposes
     */
    static async convertJatsWithPreview(jatsContent: string): Promise<{
        html: string;
        markdown: string;
    }> {
        try {
            if (!this.isJatsContent(jatsContent)) {
                const text = this.stripHtml(jatsContent);
                return {
                    html: text.replace(/\n/g, '<br>'),
                    markdown: text
                };
            }

            // Use DOMParser for conversion
            const parser = new DOMParser();
            const doc = parser.parseFromString(jatsContent, 'text/html');

            // Get plain text version
            const plainText = doc.body.textContent || '';

            // Get enhanced markdown version
            const markdownContent = this.formatWithDOMParser(jatsContent);

            return {
                html: plainText.replace(/\n/g, '<br>'),
                markdown: markdownContent
            };
        } catch (error) {
            console.error('Enhanced JATS conversion failed:', error);
            const text = this.stripHtml(jatsContent);
            return {
                html: text.replace(/\n/g, '<br>'),
                markdown: text
            };
        }
    }
}