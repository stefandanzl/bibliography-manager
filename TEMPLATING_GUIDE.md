# Bibliography Manager - Templating Guide

## Overview

The Bibliography Manager plugin uses a simple template system to generate source note files from bibliographic data. Templates can use placeholders that are replaced with actual data when creating new source files.

## Template Syntax

The templating system uses a simple `{{variable}}` syntax. No complex conditionals or loops are needed - if a variable has no value, it will be rendered as empty.

### Basic Syntax

```
{{variableName}}
```

### Available Template Variables

#### Core Fields
- `{{citekey}}` - Unique citation identifier (e.g., "Smi23")
- `{{title}}` - Title of the work
- `{{author}}` - Author names as comma-separated string
- `{{authorArray}}` - Author names as YAML array format `["Smith, J.", "Doe, J."]`
- `{{year}}` - Publication year
- `{{bibtype}}` - Bibliography type (book, article, etc.)

#### Publication Details
- `{{doi}}` - Digital Object Identifier
- `{{isbn}}` - ISBN number
- `{{publisher}}` - Publisher name
- `{{journal}}` - Journal name (for articles)
- `{{volume}}` - Volume number
- `{{number}}` - Issue number
- `{{pages}}` - Page numbers
- `{{keywords}}` - Keywords as comma-separated string
- `{{keywordsArray}}` - Keywords as YAML array format `["keyword1", "keyword2"]`

#### Content and Links
- `{{abstract}}` - Abstract text
- `{{url}}` - URL to the source
- `{{downloadurl}}` - Direct download URL
- `{{imageurl}}` - URL to cover image
- `{{filename}}` - Sanitized filename (clean title, safe for filesystem)
- `{{atcitekey}}` - Citekey with "@" prefix (e.g., "@Smi23")

#### Reading Progress
- `{{added}}` - Date when source was added
- `{{started}}` - Date when reading started
- `{{ended}}` - Date when reading completed
- `{{rating}}` - Rating value
- `{{currentpage}}` - Current reading progress page number
- `{{status}}` - Reading status

#### File Data
- `{{filelink}}` - Link to the source file
- `{{aliases}}` - Note aliases

## Template Examples

### Basic Template

```markdown
---
citekey: {{citekey}}
title: "{{title}}"
author: {{authorArray}}
keywords: {{keywordsArray}}
bibtype: {{bibtype}}
year: {{year}}
doi: {{doi}}
url: {{url}}
---

# {{title}}

{{author}}

({{year}})

## Abstract
{{abstract}}

**Keywords:** {{keywords}}

**DOI:** {{doi}}

**URL:** {{url}}
```

### Academic Paper Template

```markdown
---
citekey: {{citekey}}
title: "{{title}}"
author: {{authorArray}}
keywords: {{keywordsArray}}
bibtype: {{bibtype}}
aliases: [{{atcitekey}}]
year: {{year}}
doi: {{doi}}
journal: {{journal}}
volume: {{volume}}
number: {{number}}
pages: {{pages}}
publisher: {{publisher}}
filename: {{filename}}
---

# {{title}}

**Authors:** {{author}}

**Journal:** {{journal}}, {{volume}}({{number}}), {{pages}} ({{year}})

## Abstract
{{abstract}}

## Keywords
{{keywords}}

## Files and Links
- **PDF:** [{{filename}}.pdf](./{{filename}}.pdf)
- **DOI:** [{{doi}}](https://doi.org/{{doi}})
- **Publisher:** {{publisher}}

## Notes
<!-- Your research notes here -->

## Key Findings
<!-- Key insights from this paper -->

## Related Work
<!-- Connections to other papers -->
```

### Book Template

```markdown
---
citekey: {{citekey}}
title: "{{title}}"
author: {{authorArray}}
bibtype: {{bibtype}}
aliases: [{{atcitekey}}]
year: {{year}}
isbn: {{isbn}}
publisher: {{publisher}}
pages: {{pages}}
filename: {{filename}}
---

# {{title}}

**Author:** {{author}}

**Publisher:** {{publisher}} ({{year}})

**ISBN:** {{isbn}}

**Pages:** {{pages}}

## Summary
{{abstract}}

## Files
- **Book:** [{{filename}}.pdf](./{{filename}}.pdf)
- **Cover:** [Cover Image]({{imageurl}})

## Reading Progress
- **Started:** {{started}}
- **Current Page:** {{currentpage}}
- **Finished:** {{ended}}
- **Rating:** {{rating}}/5

## Chapter Notes
<!-- Chapter by chapter notes -->

## Key Quotes
<!-- Important quotes from the book -->

## Personal Reflection
<!-- Your thoughts and analysis -->
```

### Website/Online Resource Template

```markdown
---
citekey: {{citekey}}
title: "{{title}}"
author: {{authorArray}}
bibtype: {{bibtype}}
aliases: [{{atcitekey}}]
year: {{year}}
url: {{url}}
added: {{added}}
filename: {{filename}}
---

# {{title}}

**Author:** {{author}}

**URL:** [{{title}}]({{url}})

**Added:** {{added}}

## Content Summary
{{abstract}}

## Archive
- **Saved Version:** [{{filename}}.html](./{{filename}}.html)
- **Direct Link:** [Original URL]({{url}})

## Notes
<!-- Your notes on this resource -->
```

## Array Formatting

The plugin provides both raw array values and pre-formatted YAML array strings:

### Using Raw Arrays
```markdown
keywords: {{keywords}}  # Outputs: keyword1, keyword2, keyword3
```

### Using YAML Arrays (Recommended for Frontmatter)
```markdown
keywords: {{keywordsArray}}  # Outputs: ["keyword1", "keyword2", "keyword3"]
author: {{authorArray}}     # Outputs: ["Smith, J.", "Doe, J."]
```

## Filename Sanitization

The `{{filename}}` variable is automatically sanitized for filesystem safety:

- Removes HTML/XML tags and entities (`<i>`, `&amp;`, etc.)
- Strips LaTeX formatting (`\textit{}`, `$`, `{}`)
- Replaces punctuation with hyphens
- Removes invalid filename characters (`<`, `>`, `:`, `"`, `/`, `\`, `|`, `?`, `*`)
- Normalizes spaces and hyphens

**Example:**
```
Title: "A Study of \textit{Machine Learning}: <i>Results & Analysis</i>"
Filename: "A-Study-of-Machine-Learning-Results-Analysis"
```

## Custom Templates

1. **Create a template file** in your vault (e.g., `templates/my-source-template.md`)
2. **Configure the plugin** to use your template:
   - Go to Settings → Bibliography Manager → Template file
   - Enter the path to your template file
3. **Customize** the template using any of the available variables

## Field Mappings

Template variables are mapped to actual data fields through the `mappings.yaml` file. You can customize which data fields correspond to which template variables by editing this file.

Default mappings include:
- `citekey` → `citekey`
- `title` → `title`
- `author` → `author`
- `year` → `year`
- `doi` → `doi`
- etc.

## Tips and Best Practices

1. **Use YAML arrays** for frontmatter fields: `{{authorArray}}`, `{{keywordsArray}}`
2. **Include file links** using the filename variable: `[{{filename}}.pdf](./{{filename}}.pdf)`
3. **Add DOIs as clickable links**: `[{{doi}}](https://doi.org/{{doi}})`
4. **Keep templates simple** - no complex conditionals needed
5. **Test your templates** by importing a source via DOI to see the rendered output
6. **Use consistent naming** across your template files for better organization

## Troubleshooting

### Empty Values
If a template variable has no data, it will render as empty. This is normal behavior.

### Array Display
For author and keyword fields, use the `Array` versions (`{{authorArray}}`, `{{keywordsArray}}`) in YAML frontmatter for proper formatting.

### Special Characters
The filename variable automatically handles special characters and ensures filesystem-safe names.

## Example Output

When importing a paper with DOI `10.1000/182`, a template might generate:

```markdown
---
citekey: Smi23
title: "A Study of Machine Learning"
author: ["Smith, John", "Doe, Jane"]
keywords: ["machine learning", "AI", "neural networks"]
bibtype: article
aliases: [@Smi23]
year: 2023
doi: 10.1000/182
journal: "Journal of Computer Science"
volume: 45
number: 2
pages: "123-145"
publisher: "Academic Press"
filename: "A-Study-of-Machine-Learning"
---

# A Study of Machine Learning

**Authors:** Smith, John, Doe, Jane

**Journal:** Journal of Computer Science, 45(2), 123-145 (2023)

## Abstract
This paper presents a comprehensive study of machine learning techniques...

## Keywords
machine learning, AI, neural networks

## Files and Links
- **PDF:** [A-Study-of-Machine-Learning.pdf](./A-Study-of-Machine-Learning.pdf)
- **DOI:** [10.1000/182](https://doi.org/10.1000/182)
- **Publisher:** Academic Press
```

## Support

If you have issues with templates or need help with custom formatting, please check the plugin documentation or create an issue on the plugin repository.