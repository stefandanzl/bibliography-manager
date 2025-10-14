import { App, Editor, MarkdownView, Notice, Modal, Setting, parseYaml, stringifyYaml } from 'obsidian';
import { CitekeyGenerator, SourceImporter } from './exportbib';

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

  constructor(app: App) {
    super(app);
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
    new Notice('URL metadata fetching not implemented yet');
  }

  private async lookupDoi() {
    new Notice('DOI lookup not implemented yet');
  }

  private async parseBibtex() {
    new Notice('BibTeX parsing not implemented yet');
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