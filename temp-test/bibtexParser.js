"use strict";
// Simple BibTeX parser implementation for Obsidian plugin environment
// Replaces @retorquere/bibtex-parser which has Node.js dependencies
Object.defineProperty(exports, "__esModule", { value: true });
exports.unicodeToLatex = exports.latexToUnicode = exports.parseBibTeX = void 0;
function parseBibTeX(bibtexContent) {
    const entries = [];
    // Split by @ and remove empty entries
    const entryStrings = bibtexContent.split('@').filter(s => s.trim());
    for (const entryString of entryStrings) {
        const entry = parseBibTeXEntry('@' + entryString);
        if (entry) {
            entries.push(entry);
        }
    }
    return entries;
}
exports.parseBibTeX = parseBibTeX;
function parseBibTeXEntry(entryText) {
    // Match the entry header: @type{key,
    const headerMatch = entryText.match(/^@(\w+)\s*\{\s*([^,]+)\s*,/);
    if (!headerMatch)
        return null;
    const [, type, key] = headerMatch;
    // Find the content between the opening brace and the closing brace
    const contentMatch = entryText.match(/^@\w+\s*\{[^,]+,\s*([\s\S]*?)\s*\}\s*$/);
    if (!contentMatch)
        return null;
    const content = contentMatch[1];
    const entry = {
        key: key.trim(),
        type: type.toLowerCase()
    };
    // Parse field-value pairs with better handling of nested braces
    const fieldRegex = /(\w+)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;
    while ((match = fieldRegex.exec(content)) !== null) {
        const [, fieldName, fieldValue] = match;
        // Handle nested braces and extract the full value
        let value = extractFieldValue(content, match.index);
        // Clean up the value by removing outer braces
        value = value.replace(/^\{(.*)\}$/, '$1').trim();
        entry[fieldName.toLowerCase()] = value;
    }
    return entry;
}
// Helper function to extract field value with proper brace handling
function extractFieldValue(content, startIndex) {
    let braceCount = 0;
    let inValue = false;
    let value = '';
    let i = startIndex;
    // Find the equals sign and opening brace
    while (i < content.length && content[i] !== '=')
        i++;
    while (i < content.length && content[i] !== '{')
        i++;
    if (i >= content.length)
        return '';
    i++; // Skip the opening brace
    braceCount = 1;
    while (i < content.length && braceCount > 0) {
        const char = content[i];
        value += char;
        if (char === '{') {
            braceCount++;
        }
        else if (char === '}') {
            braceCount--;
        }
        i++;
    }
    // Remove the final closing brace
    return value.slice(0, -1);
}
// Enhanced LaTeX to Unicode conversion for common cases
function latexToUnicode(text) {
    if (!text)
        return text;
    return text
        // German umlauts (handle both \"U and {\"U} formats)
        .replace(/\{?\\\"\}?([UuAaEeIiOoUu])\}?/g, function (match, letter) {
        const umlauts = {
            'A': 'Ä', 'a': 'ä', 'E': 'Ë', 'e': 'ë',
            'I': 'Ï', 'i': 'ï', 'O': 'Ö', 'o': 'ö',
            'U': 'Ü', 'u': 'ü', 'Y': 'Ÿ', 'y': 'ÿ'
        };
        return umlauts[letter] || match;
    })
        // Acute accents (handle both \'e and {\'e} formats)
        .replace(/\{?\\'\}?([A-Za-z])\}?/g, function (match, letter) {
        const acute = {
            'A': 'Á', 'a': 'á', 'E': 'É', 'e': 'é',
            'I': 'Í', 'i': 'í', 'O': 'Ó', 'o': 'ó',
            'U': 'Ú', 'u': 'ú', 'Y': 'Ý', 'y': 'ý',
            'C': 'Á', 'c': 'á', 'L': 'Ĺ', 'l': 'ĺ',
            'N': 'Ń', 'n': 'ń', 'R': 'Ŕ', 'r': 'ŕ',
            'S': 'Ś', 's': 'ś', 'Z': 'Ź', 'z': 'ź'
        };
        return acute[letter] || match;
    })
        // Common accented characters (handle both braced and unbraced)
        .replace(/\{?\\aa\}?/g, 'å')
        .replace(/\{?\\AA\}?/g, 'Å')
        .replace(/\{?\\ae\}?/g, 'æ')
        .replace(/\{?\\AE\}?/g, 'Æ')
        .replace(/\{?\\o\}?/g, 'ø')
        .replace(/\{?\\O\}?/g, 'Ø')
        .replace(/\{?\\l\}?/g, 'ł')
        .replace(/\{?\\L\}?/g, 'Ł')
        .replace(/\{?\\ss\}?/g, 'ß')
        // Other diacritics (handle both braced and unbraced)
        .replace(/\{?\\`\}?([A-Za-z])\}?/g, function (match, letter) {
        const grave = {
            'A': 'À', 'a': 'à', 'E': 'È', 'e': 'è',
            'I': 'Ì', 'i': 'ì', 'O': 'Ò', 'o': 'ò',
            'U': 'Ù', 'u': 'ù'
        };
        return grave[letter] || match;
    })
        .replace(/\{?\\~\}?([A-Za-z])\}?/g, function (match, letter) {
        const tilde = {
            'A': 'Ã', 'a': 'ã', 'N': 'Ñ', 'n': 'ñ',
            'O': 'Õ', 'o': 'õ'
        };
        return tilde[letter] || match;
    })
        .replace(/\{?\\c\}?([A-Za-z])\}?/g, function (match, letter) {
        const cedilla = {
            'C': 'Ç', 'c': 'ç'
        };
        return cedilla[letter] || match;
    })
        .replace(/\{?\\v\}?([A-Za-z])\}?/g, function (match, letter) {
        const caron = {
            'C': 'Č', 'c': 'č', 'D': 'Ď', 'd': 'ď',
            'E': 'Ě', 'e': 'ě', 'L': 'Ľ', 'l': 'ľ',
            'N': 'Ň', 'n': 'ň', 'R': 'Ř', 'r': 'ř',
            'S': 'Š', 's': 'š', 'T': 'Ť', 't': 'ť',
            'Z': 'Ž', 'z': 'ž'
        };
        return caron[letter] || match;
    })
        .replace(/\{?\\r\}?([A-Za-z])\}?/g, function (match, letter) {
        // Ring above
        return letter === 'A' ? 'Å' : letter === 'a' ? 'å' : match;
    })
        .replace(/\{?\\H\}?([OoUu])\}?/g, function (match, letter) {
        // Double acute accent
        const doubleAcute = {
            'O': 'Ő', 'o': 'ő', 'U': 'Ű', 'u': 'ű'
        };
        return doubleAcute[letter] || match;
    })
        .replace(/\{?\\t\}?([A-Za-z])\}?/g, function (match, letter) {
        // Tie accent
        return letter; // Simplified - would need proper handling
    })
        .replace(/\{?\\d\}?([A-Za-z])\}?/g, function (match, letter) {
        // Dot below
        const dotBelow = {
            'R': 'Ṛ', 'r': 'ṛ', 'S': 'Ṣ', 's': 'ṣ',
            'T': 'Ṭ', 't': 'ṭ', 'D': 'Ḍ', 'd': 'ḋ',
            'H': 'Ḥ', 'h': 'ḥ', 'N': 'Ṇ', 'n': 'ṇ',
            'B': 'Ḅ', 'b': 'ḅ', 'K': 'Ḳ', 'k': 'ḳ',
            'L': 'Ḷ', 'l': 'ḷ', 'M': 'Ṃ', 'm': 'ṃ',
            'V': 'Ṿ', 'v': 'ṿ', 'W': 'Ẇ', 'w': 'ẇ',
            'Y': 'Ỵ', 'y': 'ỵ', 'Z': 'Ẓ', 'z': 'ẓ'
        };
        return dotBelow[letter] || match;
    })
        .replace(/\{?\\dh\}?/g, 'ð')
        .replace(/\{?\\DH\}?/g, 'Ð')
        .replace(/\{?\\th\}?/g, 'þ')
        .replace(/\{?\\TH\}?/g, 'Þ')
        // Math symbols (common ones) - handle both braced and unbraced
        .replace(/\{?\\alpha\}?/g, 'α')
        .replace(/\{?\\beta\}?/g, 'β')
        .replace(/\{?\\gamma\}?/g, 'γ')
        .replace(/\{?\\delta\}?/g, 'δ')
        .replace(/\{?\\epsilon\}?/g, 'ε')
        .replace(/\{?\\zeta\}?/g, 'ζ')
        .replace(/\{?\\eta\}?/g, 'η')
        .replace(/\{?\\theta\}?/g, 'θ')
        .replace(/\{?\\iota\}?/g, 'ι')
        .replace(/\{?\\kappa\}?/g, 'κ')
        .replace(/\{?\\lambda\}?/g, 'λ')
        .replace(/\{?\\mu\}?/g, 'μ')
        .replace(/\{?\\nu\}?/g, 'ν')
        .replace(/\{?\\xi\}?/g, 'ξ')
        .replace(/\{?\\pi\}?/g, 'π')
        .replace(/\{?\\rho\}?/g, 'ρ')
        .replace(/\{?\\sigma\}?/g, 'σ')
        .replace(/\{?\\tau\}?/g, 'τ')
        .replace(/\{?\\upsilon\}?/g, 'υ')
        .replace(/\{?\\phi\}?/g, 'φ')
        .replace(/\{?\\chi\}?/g, 'χ')
        .replace(/\{?\\psi\}?/g, 'ψ')
        .replace(/\{?\\omega\}?/g, 'ω')
        // Uppercase Greek - handle both braced and unbraced
        .replace(/\{?\\Gamma\}?/g, 'Γ')
        .replace(/\{?\\Delta\}?/g, 'Δ')
        .replace(/\{?\\Theta\}?/g, 'Θ')
        .replace(/\{?\\Lambda\}?/g, 'Λ')
        .replace(/\{?\\Xi\}?/g, 'Ξ')
        .replace(/\{?\\Pi\}?/g, 'Π')
        .replace(/\{?\\Sigma\}?/g, 'Σ')
        .replace(/\{?\\Upsilon\}?/g, 'Υ')
        .replace(/\{?\\Phi\}?/g, 'Φ')
        .replace(/\{?\\Psi\}?/g, 'Ψ')
        .replace(/\{?\\Omega\}?/g, 'Ω')
        // Remove braces that might remain (but be careful with nested braces)
        .replace(/\{([^{}]*)\}/g, '$1');
}
exports.latexToUnicode = latexToUnicode;
// Simple Unicode to LaTeX conversion for basic cases
function unicodeToLatex(text) {
    if (!text)
        return text;
    return text
        // Common accented characters
        .replace(/å/g, '\\aa{}')
        .replace(/Å/g, '\\AA{}')
        .replace(/æ/g, '\\ae{}')
        .replace(/Æ/g, '\\AE{}')
        .replace(/ø/g, '\\o{}')
        .replace(/Ø/g, '\\O{}')
        .replace(/ł/g, '\\l{}')
        .replace(/Ł/g, '\\L{}')
        .replace(/ß/g, '\\ss{}')
        // German umlauts
        .replace(/ä/g, '\"a')
        .replace(/Ä/g, '\"A')
        .replace(/ö/g, '\"o')
        .replace(/Ö/g, '\"O')
        .replace(/ü/g, '\"u')
        .replace(/Ü/g, '\"U')
        // Other common European characters
        .replace(/ñ/g, '~n')
        .replace(/Ñ/g, '~N')
        .replace(/ç/g, 'c\\c{}')
        .replace(/Ç/g, 'C\\c{}')
        // Special LaTeX characters
        .replace(/#/g, '\\#')
        .replace(/$/g, '\\$')
        .replace(/%/g, '\\%')
        .replace(/&/g, '\\&')
        .replace(/_/g, '\\_')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/~/g, '\\textasciitilde{}');
}
exports.unicodeToLatex = unicodeToLatex;
