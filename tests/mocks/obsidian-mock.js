// Mock Obsidian API
module.exports = {
  App: jest.fn(),
  Editor: jest.fn(),
  MarkdownView: jest.fn(),
  Notice: jest.fn().mockImplementation((message) => {
    console.log(`Notice: ${message}`);
  }),
  Modal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    close: jest.fn(),
    contentEl: {
      empty: jest.fn(),
      createEl: jest.fn(),
      createDiv: jest.fn(),
    },
  })),
  Setting: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDesc: jest.fn().mockReturnThis(),
    addText: jest.fn().mockReturnThis(),
    addTextArea: jest.fn().mockReturnThis(),
    addDropdown: jest.fn().mockReturnThis(),
    addOption: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis(),
    onChange: jest.fn().mockReturnThis(),
    placeholder: jest.fn().mockReturnThis(),
  })),
  parseYaml: jest.fn(),
  stringifyYaml: jest.fn(),
};