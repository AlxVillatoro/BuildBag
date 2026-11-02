// .properties file format: reading (keeping the comments that explain each property) and writing.
// Follows the syntax of java.util.Properties, the format the generated files are consumed with.

import {
    applyDomainPattern, detectDomainPattern, domainIds, fieldsOfProperty, getValue, labelFromKey, matchDomainKey,
    normalizeConfig, sectionTitleFromKey
} from './model.js';

const BANNER_LINE = /^[-=*#_~\s]{3,}$/;
const INLINE_BANNER = /^[-=*#_~]{2,}\s*(.+?)\s*[-=*#_~]{2,}$/;
const COMMENTED_OUT_PROPERTY = /^[\w.[\]{}-]+\s*[=:]/;
const GENERATED_DOMAIN_BANNER = /^dominio\s+\d+$/i;
const MAX_SECTION_TITLE = 60;
// A comment that points back, such as "<- otro ejemplo", explains the property above it
const POINTS_BACK = /^(<-+|<=+|\^+|←|↑)\s*/;

// ---------------------------------------------------------------- reading

function unescape(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char !== '\\') {
            out += char;
            continue;
        }
        const next = text[++i];
        if (next === undefined) break;
        if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.substr(i + 1, 4))) {
            out += String.fromCharCode(parseInt(text.substr(i + 1, 4), 16));
            i += 4;
        } else {
            out += { t: '\t', n: '\n', r: '\r', f: '\f' }[next] || next;
        }
    }
    return out;
}

function splitKeyValue(line) {
    let end = 0;
    while (end < line.length && !/[=:\s]/.test(line[end])) {
        end += line[end] === '\\' ? 2 : 1;
    }
    let start = end;
    while (start < line.length && /\s/.test(line[start])) start++;
    if (line[start] === '=' || line[start] === ':') start++;
    while (start < line.length && /\s/.test(line[start])) start++;
    return { key: unescape(line.slice(0, end)), value: unescape(line.slice(start)) };
}

function endsInContinuation(line) {
    const trailing = line.match(/\\*$/)[0].length;
    return trailing % 2 === 1;
}

/** Splits a comment block into its banner title, if it has one, and the remaining explanatory lines. */
function readCommentBlock(lines) {
    let lastBanner = -1;
    lines.forEach((line, i) => {
        if (BANNER_LINE.test(line)) lastBanner = i;
    });
    if (lastBanner >= 0) {
        const bannerText = lines.slice(0, lastBanner).filter(line => line && !BANNER_LINE.test(line));
        return { banner: bannerText, title: bannerText[0] || null, text: lines.slice(lastBanner + 1).filter(Boolean) };
    }
    const inline = lines.length ? INLINE_BANNER.exec(lines[0]) : null;
    if (inline) return { banner: [inline[1]], title: inline[1], text: lines.slice(1).filter(Boolean) };
    return { banner: null, title: null, text: lines.filter(Boolean) };
}

function looksLikeSectionTitle(line) {
    return line.length <= MAX_SECTION_TITLE
        && /^[\p{L}\p{N}]/u.test(line)
        && !line.endsWith('.')
        && !COMMENTED_OUT_PROPERTY.test(line);
}

/**
 * Reads a .properties file. A comment right above a property describes it. A comment right below a property, or one
 * pointing back at it ("<- ..."), adds to that property. A banner opens a section, and so does a short title-like
 * comment with blank lines on both sides. Any other comment on its own is kept for the next property, so no
 * explanation is lost.
 */
export function parseProperties(content) {
    const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
    const entries = new Map();
    let header = null;
    let section = null;
    let comments = [];
    let carried = [];
    let previous = null;
    let afterProperty = false;
    let commentFollowsProperty = false;

    const openSection = title => {
        section = GENERATED_DOMAIN_BANNER.test(title) ? null : title;
    };

    const addToPrevious = text => {
        if (text.length > 0) previous.description = [previous.description, ...text].filter(Boolean).join('\n');
    };

    /** Hands the lines pointing back to the previous property and returns the others. */
    const withoutBackReferences = text => {
        if (!previous) return text;
        addToPrevious(text.filter(line => POINTS_BACK.test(line)).map(line => line.replace(POINTS_BACK, '')));
        return text.filter(line => !POINTS_BACK.test(line));
    };

    const closeFloatingComment = () => {
        if (comments.length === 0) return;
        const block = readCommentBlock(comments);
        comments = [];
        const isFileStart = entries.size === 0 && section === null && header === null;
        const lineCount = block.banner ? block.banner.length : block.text.length;

        if (isFileStart && lineCount > 1) {
            header = block.banner || block.text;
            return;
        }
        if (block.title) {
            openSection(block.title);
            return;
        }
        const text = withoutBackReferences(block.text);
        if (text.length === 0 || text.every(line => COMMENTED_OUT_PROPERTY.test(line))) return;
        if (previous && commentFollowsProperty) addToPrevious(text);
        else if (text.length === 1 && looksLikeSectionTitle(text[0])) openSection(text[0]);
        else carried.push(...text);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimStart();
        if (!line) {
            closeFloatingComment();
            afterProperty = false;
        } else if (line[0] === '#' || line[0] === '!') {
            if (comments.length === 0) commentFollowsProperty = afterProperty;
            comments.push(line.slice(1).trim());
        } else {
            let logical = line;
            while (endsInContinuation(logical) && i + 1 < lines.length) {
                logical = logical.slice(0, -1) + lines[++i].trimStart();
            }
            const block = readCommentBlock(comments);
            if (block.title) openSection(block.title);
            const description = [...carried, ...withoutBackReferences(block.text)].join('\n');
            comments = [];
            carried = [];
            const { key, value } = splitKeyValue(logical);
            if (key) {
                previous = { key, value, description, section };
                entries.set(key, previous);
            }
            afterProperty = true;
        }
    }
    return { entries: [...entries.values()], header: header || [] };
}

const FLAG_KEY = /(enable|disable|active|activ|habilit|flag|is[A-Z_.-]|has[A-Z_.-]|use[A-Z_.-])/;
const SECRET_KEY = /(password|passwd|pwd|secret|contrase|token|api[._-]?key)/i;

function inferType(key, value) {
    if (value === 'true' || value === 'false') return { type: 'boolean', booleanType: 'string' };
    if ((value === '1' || value === '0') && FLAG_KEY.test(key)) return { type: 'boolean', booleanType: 'number' };
    if (SECRET_KEY.test(key)) return { type: 'password' };
    if (/^\d+$/.test(value)) return { type: 'number' };
    if (/^https?:\/\//i.test(value)) return { type: 'url', checkService: true };
    if (/<[a-z][\s\S]*>/i.test(value)) return { type: 'html' };
    return { type: 'text' };
}

function readHeader(lines) {
    const info = { description: [], version: null, title: null };
    for (const line of lines) {
        const version = /^versi[oó]n:\s*(.+)$/i.exec(line);
        if (version) info.version = version[1];
        else if (!/^generado:/i.test(line)) info.description.push(line);
    }
    return info;
}

function projectNameFromFile(fileName) {
    const base = fileName.replace(/\.properties$/i, '').replace(/[-_]+/g, ' ').trim();
    return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Builds a complete configuration from the text of a .properties file. */
export function configFromProperties(content, fileName) {
    const { entries, header } = parseProperties(content);
    if (entries.length === 0) throw new Error('No se encontraron propiedades en el archivo');

    const pattern = detectDomainPattern(entries.map(entry => entry.key));
    const sections = new Map();
    for (const entry of entries) {
        const match = matchDomainKey(entry.key, pattern);
        const title = entry.section || sectionTitleFromKey(match ? match.template : entry.key);
        if (!sections.has(title)) sections.set(title, { category: title, properties: [] });
        const inferred = inferType(entry.key, entry.value);
        sections.get(title).properties.push({
            key: entry.key,
            label: labelFromKey(entry.key),
            default: entry.value,
            description: entry.description,
            required: false,
            needsConfirmation: inferred.type === 'text' || inferred.type === 'url',
            ...inferred
        });
    }

    const info = readHeader(header);
    const config = normalizeConfig({
        projectName: info.description[0] || projectNameFromFile(fileName),
        projectDescription: info.description.slice(1).join('\n'),
        version: info.version || '1.0.0',
        outputFileName: fileName,
        domainKeyPattern: pattern,
        globalProperties: [...sections.values()]
    });
    applyDomainPattern(config, pattern);
    return config;
}

// ---------------------------------------------------------------- writing

export function escapeKey(key) {
    return key.replace(/[\\ =:#!\t\n\r\f]/g, char => (
        { '\t': '\\t', '\n': '\\n', '\r': '\\r', '\f': '\\f' }[char] || `\\${char}`
    ));
}

export function escapeValue(value) {
    return String(value)
        .replace(/[\\\t\n\r\f]/g, char => ({ '\\': '\\\\', '\t': '\\t', '\n': '\\n', '\r': '\\r', '\f': '\\f' }[char]))
        .replace(/^ +/, spaces => '\\ '.repeat(spaces.length));
}

function commentLines(text) {
    return String(text).split(/\r\n|\r|\n/).map(line => `# ${line}`.trimEnd());
}

function banner(char, width, lines) {
    const rule = `# ${char.repeat(width)}`;
    return [rule, ...lines.flatMap(commentLines), rule];
}

function propertyLines(config, prop, domainId) {
    const lines = [];
    fieldsOfProperty(config, prop, domainId).forEach(field => {
        const comment = field.repeatIndex === null || field.repeatIndex === 1 ? prop.description : '';
        const hint = field.repeatIndex === null ? [] : [`${prop.label} ${field.repeatIndex}`];
        if (comment) lines.push(...commentLines(comment));
        lines.push(...hint.flatMap(commentLines));
        lines.push(`${escapeKey(field.key)}=${escapeValue(getValue(config, field))}`);
        if (comment) lines.push('');
    });
    return lines;
}

function sectionLines(config, section, domainId, width) {
    if (section.properties.length === 0) return [];
    const body = section.properties.flatMap(prop => propertyLines(config, prop, domainId));
    if (body[body.length - 1] !== '') body.push('');
    return [...banner('-', width, [section.category]), ...body];
}

/** The final file. Hidden fields are written too: the consuming application may still read those keys. */
export function generateProperties(config, now = new Date()) {
    const headerLines = [config.projectName || 'Configuración'];
    if (config.projectDescription) headerLines.push(config.projectDescription);
    headerLines.push(`Versión: ${config.version}`, `Generado: ${now.toLocaleString('es-MX')}`);

    const lines = [...banner('=', 50, headerLines), ''];
    for (const section of config.globalProperties) {
        lines.push(...sectionLines(config, section, null, 50));
    }
    for (const domainId of domainIds(config)) {
        lines.push(...banner('=', 50, [`Dominio ${domainId}`]), '');
        for (const section of config.domainProperties) {
            lines.push(...sectionLines(config, section, domainId, 40));
        }
    }
    return lines.join('\n');
}
