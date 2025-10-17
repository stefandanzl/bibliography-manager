import { App, Editor, MarkdownView, Notice, Modal, Setting, parseYaml, stringifyYaml } from 'obsidian';
import { CitekeyGenerator, SourceImporter } from './exportbib';
import { BrowserImportService } from './browserImportService';

export class GenerateCitekeyCommand {
  constructor(private app: App) {}

  async execute(editor: Editor, view: MarkdownView) {
    const file = view.file;
    if (!file) {
      new Notice('No file is currently active');
      return;
    }

    try {
      const content = await this.app.vault.read(file);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!frontmatterMatch) {
        new Notice('No frontmatter found in this file');
        return;
      }

      const yaml = parseYaml(frontmatterMatch[1]);
      const title = yaml.title || file.basename;
      const authors = yaml.author || [];
      const year = yaml.year || new Date().getFullYear();

      if (authors.length === 0) {
        new Notice('No authors found in frontmatter. Please add author field first.');
        return;
      }

      const citekey = CitekeyGenerator.generateFromTitleAndAuthors(title, authors, year);

      // Update frontmatter with citekey
      yaml.citekey = citekey;
      const newYaml = stringifyYaml(yaml);
      const newContent = content.replace(
        /^---\n[\s\S]*?\n---/,
        `---\n${newYaml}---`
      );

      await this.app.vault.modify(file, newContent);
      new Notice(`Generated citekey: ${citekey}`);

    } catch (error) {
      console.error('Error generating citekey:', error);
      new Notice('Error generating citekey. Check console for details.');
    }
  }
}

export class BibliographyExportModal extends Modal {
  private bibContent: string = '';
  private sources: any[] = [];

  constructor(app: App) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Export Bibliography' });

    // Scope selection
    const scopeSetting = new Setting(contentEl)
      .setName('Export scope')
      .setDesc('Choose which sources to include in the bibliography')
      .addDropdown(dropdown => dropdown
        .addOption('vault', 'All sources in vault')
        .addOption('current', 'Sources from current document')
        .setValue('vault')
        .onChange(async (value) => {
          await this.loadSources(value);
        }));

    // Loading indicator
    const loadingEl = contentEl.createDiv({ cls: 'bibliography-loading' });
    loadingEl.createEl('p', { text: 'Loading sources...' });

    // Preview area
    const previewContainer = contentEl.createDiv({ cls: 'bibliography-preview' });
    previewContainer.createEl('h3', { text: 'Preview' });

    const previewEl = previewContainer.createEl('pre', {
      cls: 'bibliography-preview-content',
      text: 'Sources will appear here...'
    });

    // Action buttons
    const buttonContainer = contentEl.createDiv({ cls: 'bibliography-actions' });

    const exportButton = buttonContainer.createEl('button', {
      text: 'Export Bibliography',
      cls: 'mod-cta'
    });

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });

    // Event handlers
    exportButton.onclick = () => this.exportBibliography();
    cancelButton.onclick = () => this.close();

    // Load initial sources
    await this.loadSources('vault');

    // Remove loading indicator
    loadingEl.remove();

    // Update preview when sources change
    this.updatePreview(previewEl);
  }

  private async loadSources(scope: string) {
    try {
      // Implementation would go here to load sources from vault or current document
      // For now, placeholder
      this.sources = [];
      this.bibContent = '% No sources found';
    } catch (error) {
      console.error('Error loading sources:', error);
      new Notice('Error loading sources');
    }
  }

  private updatePreview(previewEl: Element) {
    previewEl.textContent = this.bibContent;
  }

  private async exportBibliography() {
    try {
      // Create bibliography file in root
      const bibPath = 'bibliography.bib';
      await this.app.vault.adapter.write(bibPath, this.bibContent);

      new Notice(`Bibliography exported to ${bibPath}`);
      this.close();
    } catch (error) {
      console.error('Error exporting bibliography:', error);
      new Notice('Error exporting bibliography');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class SourceImportModal extends Modal {
  private sourceData: any = {};
  private mediaType: string = 'Paper';
  private importService: BrowserImportService;

  constructor(app: App) {
    super(app);
    this.importService = new BrowserImportService(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Import Source' });

    // Input method selection
    const methodContainer = contentEl.createDiv({ cls: 'import-methods' });
    methodContainer.createEl('h3', { text: 'Import Method' });

    const urlButton = methodContainer.createEl('button', { text: '🔗 URL' }) as HTMLButtonElement;
    const doiButton = methodContainer.createEl('button', { text: '📄 DOI' }) as HTMLButtonElement;
    const isbnButton = methodContainer.createEl('button', { text: '📖 ISBN' }) as HTMLButtonElement;
    const bibtexButton = methodContainer.createEl('button', { text: '📚 BibTeX' }) as HTMLButtonElement;
    const manualButton = methodContainer.createEl('button', { text: '✏️ Manual' }) as HTMLButtonElement;

    // Source type selection
    const typeContainer = contentEl.createDiv({ cls: 'source-type' });
    typeContainer.createEl('h3', { text: 'Source Type' });

    const typeSetting = new Setting(typeContainer)
      .setName('Media Type')
      .setDesc('Choose the type of source')
      .addDropdown(dropdown => dropdown
        .addOption('Paper', 'Paper')
        .addOption('Book', 'Book')
        .addOption('Website', 'Website')
        .addOption('Other', 'Other')
        .setValue('Paper')
        .onChange((value) => {
          this.mediaType = value;
        }));

    // Dynamic content area
    const contentArea = contentEl.createDiv({ cls: 'import-content' });

    // Action buttons
    const buttonContainer = contentEl.createDiv({ cls: 'import-actions' });

    const importButton = buttonContainer.createEl('button', {
      text: 'Import Source',
      cls: 'mod-cta'
    }) as HTMLButtonElement;

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' }) as HTMLButtonElement;

    // Event handlers
    urlButton.onclick = () => this.showUrlImport(contentArea);
    doiButton.onclick = () => this.showDoiImport(contentArea);
    isbnButton.onclick = () => this.showIsbnImport(contentArea);
    bibtexButton.onclick = () => this.showBibtexImport(contentArea);
    manualButton.onclick = () => this.showManualImport(contentArea);

    importButton.onclick = () => this.importSource();
    cancelButton.onclick = () => this.close();
  }

  private showUrlImport(container: any) {
    container.empty();

    const urlSetting = new Setting(container)
      .setName('URL')
      .setDesc('Enter the URL of the source')
      .addText(text => text
        .setPlaceholder('https://example.com/paper')
        .onChange(value => {
          this.sourceData.url = value;
        }));

    const fetchButton = container.createEl('button', { text: 'Fetch Metadata' }) as HTMLButtonElement;
    fetchButton.onclick = () => this.fetchUrlMetadata();
  }

  private showDoiImport(container: any) {
    container.empty();

    const doiSetting = new Setting(container)
      .setName('DOI')
      .setDesc('Enter the DOI of the source')
      .addText(text => text
        .setPlaceholder('10.1000/xyz123')
        .onChange(value => {
          this.sourceData.doi = value;
        }));

    const lookupButton = container.createEl('button', { text: 'Lookup DOI' }) as HTMLButtonElement;
    lookupButton.onclick = () => this.lookupDoi();
  }

  private showIsbnImport(container: any) {
    container.empty();

    const isbnSetting = new Setting(container)
      .setName('ISBN')
      .setDesc('Enter the ISBN of the book')
      .addText(text => text
        .setPlaceholder('978-0-123456-78-9')
        .onChange(value => {
          this.sourceData.isbn = value;
        }));

    const lookupButton = container.createEl('button', { text: 'Lookup ISBN' }) as HTMLButtonElement;
    lookupButton.onclick = () => this.lookupIsbn();
  }

  private showBibtexImport(container: any) {
    container.empty();

    const bibtexSetting = new Setting(container)
      .setName('BibTeX')
      .setDesc('Paste BibTeX entry')
      .addTextArea(text => text
        .setPlaceholder('@book{Ste10,\n  title = {...},\n  author = {...},\n  year = {2010}\n}')
        .onChange(value => {
          this.sourceData.bibtex = value;
        }));

    const parseButton = container.createEl('button', { text: 'Parse BibTeX' }) as HTMLButtonElement;
    parseButton.onclick = () => this.parseBibtex();
  }

  private showManualImport(container: any) {
    container.empty();

    const titleSetting = new Setting(container)
      .setName('Title')
      .addText(text => text
        .setPlaceholder('Title of the source')
        .onChange(value => {
          this.sourceData.title = value;
        }));

    const authorSetting = new Setting(container)
      .setName('Authors')
      .setDesc('Separate multiple authors with semicolons')
      .addText(text => text
        .setPlaceholder('John Smith; Jane Doe')
        .onChange(value => {
          this.sourceData.author = value.split(';').map(a => a.trim());
        }));

    const yearSetting = new Setting(container)
      .setName('Year')
      .addText(text => text
        .setPlaceholder('2023')
        .onChange(value => {
          this.sourceData.year = parseInt(value);
        }));

    const journalSetting = new Setting(container)
      .setName('Journal/Publisher')
      .addText(text => text
        .setPlaceholder('Journal name or publisher')
        .onChange(value => {
          this.sourceData.journal = value;
        }));

    const generateButton = container.createEl('button', { text: 'Generate Citekey' }) as HTMLButtonElement;
    generateButton.onclick = () => {
      if (this.sourceData.title && this.sourceData.author && this.sourceData.year) {
        const citekey = CitekeyGenerator.generateFromTitleAndAuthors(
          this.sourceData.title,
          this.sourceData.author,
          this.sourceData.year
        );
        this.sourceData.citekey = citekey;
        new Notice(`Generated citekey: ${citekey}`);
      } else {
        new Notice('Please fill in title, authors, and year first');
      }
    };
  }

  private async fetchUrlMetadata() {
    try {
      if (!this.sourceData.url) {
        new Notice('Please enter a URL first');
        return;
      }

      new Notice('Fetching metadata from URL...');

      const citationData = await this.importService.fetchURLMetadata(this.sourceData.url);

      // Update sourceData with fetched metadata
      this.sourceData.title = citationData.title || this.sourceData.title;
      this.sourceData.author = citationData.authors || this.sourceData.author;
      this.sourceData.year = citationData.year || this.sourceData.year;
      this.sourceData.journal = citationData.journal || this.sourceData.journal;
      this.sourceData.publisher = citationData.publisher || this.sourceData.publisher;
      this.sourceData.abstract = citationData.abstract;
      this.sourceData.doi = citationData.doi;
      this.sourceData.url = citationData.url || this.sourceData.url;
      this.sourceData.citekey = citationData.citekey;

      // Generate citekey if not present
      if (!this.sourceData.citekey && this.sourceData.title && this.sourceData.author && this.sourceData.year) {
        this.sourceData.citekey = CitekeyGenerator.generateFromTitleAndAuthors(
          this.sourceData.title,
          this.sourceData.author,
          this.sourceData.year
        );
      }

      new Notice('Metadata fetched successfully');

      // Show updated data to user
      this.showUpdatedData();

    } catch (error) {
      console.error('URL metadata fetch error:', error);
      new Notice(`URL metadata fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async lookupDoi() {
    try {
      if (!this.sourceData.doi) {
        new Notice('Please enter a DOI first');
        return;
      }

      new Notice('Looking up DOI...');

      const citationData = await this.importService.lookupDOI(this.sourceData.doi);

      // Update sourceData with fetched metadata
      this.sourceData.title = citationData.title || this.sourceData.title;
      this.sourceData.author = citationData.authors || this.sourceData.author;
      this.sourceData.year = citationData.year || this.sourceData.year;
      this.sourceData.journal = citationData.journal || this.sourceData.journal;
      this.sourceData.publisher = citationData.publisher || this.sourceData.publisher;
      this.sourceData.abstract = citationData.abstract;
      this.sourceData.doi = citationData.doi || this.sourceData.doi;
      this.sourceData.url = citationData.url || this.sourceData.url;
      this.sourceData.volume = citationData.volume;
      this.sourceData.number = citationData.number;
      this.sourceData.pages = citationData.pages;
      this.sourceData.citekey = citationData.citekey;

      // Generate citekey if not present
      if (!this.sourceData.citekey && this.sourceData.title && this.sourceData.author && this.sourceData.year) {
        this.sourceData.citekey = CitekeyGenerator.generateFromTitleAndAuthors(
          this.sourceData.title,
          this.sourceData.author,
          this.sourceData.year
        );
      }

      new Notice('DOI lookup successful');

      // Show updated data to user
      this.showUpdatedData();

    } catch (error) {
      console.error('DOI lookup error:', error);
      new Notice(`DOI lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async parseBibtex() {
    try {
      if (!this.sourceData.bibtex) {
        new Notice('Please enter BibTeX entry first');
        return;
      }

      new Notice('Parsing BibTeX...');

      const citationData = this.importService.parseBibTeX(this.sourceData.bibtex);

      // Update sourceData with parsed metadata
      this.sourceData.title = citationData.title || this.sourceData.title;
      this.sourceData.author = citationData.authors || this.sourceData.author;
      this.sourceData.year = citationData.year || this.sourceData.year;
      this.sourceData.journal = citationData.journal || this.sourceData.journal;
      this.sourceData.publisher = citationData.publisher || this.sourceData.publisher;
      this.sourceData.doi = citationData.doi;
      this.sourceData.isbn = citationData.isbn;
      this.sourceData.url = citationData.url || this.sourceData.url;
      this.sourceData.volume = citationData.volume;
      this.sourceData.number = citationData.number;
      this.sourceData.pages = citationData.pages;
      this.sourceData.bibtype = citationData.bibtype || "misc";
      this.sourceData.citekey = citationData.citekey;

      // Generate citekey if not present
      if (!this.sourceData.citekey && this.sourceData.title && this.sourceData.author && this.sourceData.year) {
        this.sourceData.citekey = CitekeyGenerator.generateFromTitleAndAuthors(
          this.sourceData.title,
          this.sourceData.author,
          this.sourceData.year
        );
      }

      new Notice('BibTeX parsing successful');

      // Show updated data to user
      this.showUpdatedData();

    } catch (error) {
      console.error('BibTeX parsing error:', error);
      new Notice(`BibTeX parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async lookupIsbn() {
    try {
      if (!this.sourceData.isbn) {
        new Notice('Please enter an ISBN first');
        return;
      }

      new Notice('Looking up ISBN...');

      const citationData = await this.importService.lookupISBN(this.sourceData.isbn);

      // Update sourceData with fetched metadata
      this.sourceData.title = citationData.title || this.sourceData.title;
      this.sourceData.author = citationData.authors || this.sourceData.author;
      this.sourceData.year = citationData.year || this.sourceData.year;
      this.sourceData.publisher = citationData.publisher || this.sourceData.publisher;
      this.sourceData.isbn = citationData.isbn || this.sourceData.isbn;
      this.sourceData.url = citationData.url || this.sourceData.url;
      this.sourceData.pages = citationData.pages;
      this.sourceData.bibtype = citationData.bibtype || "book";
      this.sourceData.citekey = citationData.citekey;

      // Generate citekey if not present
      if (!this.sourceData.citekey && this.sourceData.title && this.sourceData.author && this.sourceData.year) {
        this.sourceData.citekey = CitekeyGenerator.generateFromTitleAndAuthors(
          this.sourceData.title,
          this.sourceData.author,
          this.sourceData.year
        );
      }

      new Notice('ISBN lookup successful');

      // Show updated data to user
      this.showUpdatedData();

    } catch (error) {
      console.error('ISBN lookup error:', error);
      new Notice(`ISBN lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private createBasicWebsiteData(url: string) {
    this.sourceData.title = this.sourceData.title || this.extractTitleFromURL(url);
    this.sourceData.author = this.sourceData.author || [];
    this.sourceData.year = this.sourceData.year || new Date().getFullYear().toString();
    this.sourceData.url = url;
    this.sourceData.type = 'webpage';

    if (!this.sourceData.citekey && this.sourceData.title) {
      this.sourceData.citekey = CitekeyGenerator.generateFromTitleAndAuthors(
        this.sourceData.title,
        this.sourceData.author,
        parseInt(this.sourceData.year)
      );
    }
  }

  private extractAuthors(citationData: any): string[] {
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

  private extractTitleFromURL(url: string): string {
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

  private showUpdatedData() {
    let message = 'Updated data:\n';
    if (this.sourceData.title) message += `Title: ${this.sourceData.title}\n`;
    if (this.sourceData.author && this.sourceData.author.length > 0) {
      message += `Authors: ${this.sourceData.author.join(', ')}\n`;
    }
    if (this.sourceData.year) message += `Year: ${this.sourceData.year}\n`;
    if (this.sourceData.citekey) message += `Citekey: ${this.sourceData.citekey}\n`;

    console.log(message);
  }

  private async importSource() {
    try {
      const importer = new SourceImporter(this.app);
      const newFile = await importer.createSourceFile(this.sourceData, this.mediaType);

      // Open in new tab
      await this.app.workspace.getLeaf(true).openFile(newFile);

      new Notice(`Source imported: ${newFile.basename}`);
      this.close();
    } catch (error) {
      console.error('Error importing source:', error);
      new Notice('Error importing source');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Command definitions - pass app instance
export function getBibliographyCommands(app: App) {
  return [
    {
      id: 'generate-citekey',
      name: 'Generate citekey for current source',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const command = new GenerateCitekeyCommand(app);
        command.execute(editor, view);
      }
    },
    {
      id: 'export-bibliography-manual',
      name: 'Export bibliography manually',
      callback: () => {
        new BibliographyExportModal(app).open();
      }
    },
    {
      id: 'import-source',
      name: 'Import new source',
      callback: () => {
        new SourceImportModal(app).open();
      }
    }
  ];
}