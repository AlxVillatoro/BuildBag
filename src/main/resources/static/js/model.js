// Configuration model. Pure functions with no DOM access: rendering, validation, generation and
// persistence all read this one structure, so they cannot disagree.
//
// config = {
//   schemaVersion, projectName, projectDescription, version, outputFileName, domainKeyPattern, domainCount,
//   globalProperties: [section], domainProperties: [section],
//   values: { "concrete.key": "value" },   // only values that differ from the property default
//   confirmed: Set("concrete.key")
// }
// section = { category, properties: [prop] }
// prop = { key, label, type, default, description, required, needsConfirmation, ...optional behaviour }
// A per-domain property may carry domainDefaults: { domainId: value }, the value that domain had in the imported file.

export const DEFAULT_DOMAIN_PATTERN = 'domain{N}';
export const MAX_DOMAINS = 50;
export const MAX_REPEAT = 50;

export const SCOPES = { global: 'globalProperties', domain: 'domainProperties' };

export const PROPERTY_TYPES = [
    { value: 'text', label: 'Texto' },
    { value: 'number', label: 'Número' },
    { value: 'boolean', label: 'Sí / No' },
    { value: 'url', label: 'URL' },
    { value: 'password', label: 'Contraseña' },
    { value: 'html', label: 'HTML con vista previa' },
    { value: 'select', label: 'Lista de opciones' }
];

export const PRESET_LISTS = {
    mexicoStates: {
        label: 'Estados de México',
        options: ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
            'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
            'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro',
            'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz',
            'Yucatán', 'Zacatecas'].map((label, i) => ({ value: String(i + 1), label }))
    },
    paymentPeriods: {
        label: 'Periodos de pago',
        options: ['Semanal', 'Decenal', 'Catorcenal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral',
            'Cuatrimestral', 'Semestral', 'Anual'].map((label, i) => ({ value: String(i + 1), label }))
    }
};

const LEGACY_PLACEHOLDER_DESCRIPTION = /^(Propiedad( importada)?: |Descripción de la propiedad$)/;
const DOMAIN_COUNT_KEY = /(dominios?|domains?)[._-]?(total|count|num)|(total|count|num)[a-z]*[._-]?(dominios?|domains?)/i;
const DOMAIN_ID_KEY = /[._-]id_?domain$/i;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------- key helpers

function domainKeyRegex(pattern) {
    const parts = String(pattern || '').split('{N}');
    if (parts.length !== 2 || !(parts[0] || parts[1])) return null;
    return new RegExp(`(?<![A-Za-z0-9])(${escapeRegExp(parts[0])})(\\d+)(${escapeRegExp(parts[1])})`, 'i');
}

/** "app.domain2.url" with "domain{N}" gives { template: "app.domain{N}.url", id: 2 }; null if it does not match. */
export function matchDomainKey(key, pattern) {
    const regex = domainKeyRegex(pattern);
    const match = regex && regex.exec(key);
    if (!match) return null;
    const template = key.slice(0, match.index) + match[1] + '{N}' + match[3] + key.slice(match.index + match[0].length);
    return { template, id: Number(match[2]) };
}

export function detectDomainPattern(keys) {
    const candidates = [DEFAULT_DOMAIN_PATTERN, 'dominio{N}'];
    return candidates.find(pattern => keys.some(key => matchDomainKey(key, pattern))) || DEFAULT_DOMAIN_PATTERN;
}

export function labelFromKey(key) {
    const last = String(key).split('.').pop().replace(/\{N\}|\[N\]/g, '');
    return last
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ') || String(key);
}

/** Section title for a key with no explicit section: its first two segments, leaving out the property name. */
export function sectionTitleFromKey(key) {
    const parts = String(key).split('.');
    if (parts.length < 2) return 'General';
    return parts.slice(0, Math.min(2, parts.length - 1))
        .map(part => part.replace(/\{N\}|\[N\]/g, ''))
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' - ');
}

function fillDomain(key, domainId) {
    return domainId === null || domainId === undefined ? key : key.split('{N}').join(domainId);
}

function fillRepeat(key, placeholder, index) {
    return key.includes(placeholder) ? key.split(placeholder).join(index) : `${key}${index}`;
}

// ---------------------------------------------------------------- property index

const indexes = new WeakMap();

function propertyIndex(config) {
    let index = indexes.get(config);
    if (!index) {
        index = new Map();
        for (const [scope, listName] of Object.entries(SCOPES)) {
            for (const section of config[listName]) {
                for (const prop of section.properties) index.set(prop.key, { prop, scope });
            }
        }
        indexes.set(config, index);
    }
    return index;
}

/** Must be called after any change to sections, properties or their keys. */
export function structureChanged(config) {
    indexes.delete(config);
}

export function allKeys(config) {
    return [...propertyIndex(config).keys()];
}

export function domainCountKey(config) {
    for (const [key, { prop, scope }] of propertyIndex(config)) {
        if (scope === 'global' && DOMAIN_COUNT_KEY.test(key) && /^\d+$/.test(String(prop.default))) return key;
    }
    return null;
}

// ---------------------------------------------------------------- fields and values

/** The concrete keys one property produces: one, one per repetition. */
export function fieldsOfProperty(config, prop, domainId = null) {
    const repeat = prop.repeatBasedOn;
    if (!repeat || !repeat.key) {
        return [{ key: fillDomain(prop.key, domainId), prop, domainId, repeatIndex: null }];
    }
    const fields = [];
    const count = repeatCount(config, prop, domainId);
    for (let i = 1; i <= count; i++) {
        const key = fillDomain(fillRepeat(prop.key, repeat.placeholder || '[N]', i), domainId);
        fields.push({ key, prop, domainId, repeatIndex: i });
    }
    return fields;
}

function repeatCount(config, prop, domainId) {
    const count = parseInt(readKey(config, prop.repeatBasedOn.key, domainId), 10) || 0;
    return clamp(count, 0, MAX_REPEAT);
}

export function domainIds(config) {
    return Array.from({ length: config.domainCount }, (_, i) => i + 1);
}

/** Walks every field of the configuration in output order. Rendering shows a subset of this same walk. */
export function* allFields(config) {
    for (const section of config.globalProperties) {
        for (const prop of section.properties) yield* fieldsOfProperty(config, prop);
    }
    for (const domainId of domainIds(config)) {
        for (const section of config.domainProperties) {
            for (const prop of section.properties) yield* fieldsOfProperty(config, prop, domainId);
        }
    }
}

function defaultOf(field) {
    const { prop, domainId, repeatIndex } = field;
    if (prop.autoFillDomainId && domainId !== null) return String(domainId);
    if (domainId !== null && prop.domainDefaults && prop.domainDefaults[domainId] !== undefined) {
        return prop.domainDefaults[domainId];
    }
    if (repeatIndex !== null) {
        const value = Array.isArray(prop.default) ? prop.default[repeatIndex - 1] : '';
        return value === undefined || value === null ? '' : String(value);
    }
    return Array.isArray(prop.default) || prop.default === undefined || prop.default === null ? '' : String(prop.default);
}

export function optionsOf(config, prop, domainId) {
    const source = prop.dynamicOptionsFrom;
    if (source && source.key) {
        const separator = source.separator || ',';
        return String(readKey(config, source.key, domainId) || '')
            .split(separator)
            .map(value => value.trim())
            .filter(Boolean)
            .map(value => ({ value, label: value }));
    }
    return prop.options || [];
}

export function getValue(config, field) {
    const stored = config.values[field.key];
    const value = stored !== undefined ? stored : defaultOf(field);
    if (field.prop.type === 'select') {
        const options = optionsOf(config, field.prop, field.domainId).filter(option => !option.disabled);
        if (options.length && !options.some(option => option.value === value)) return options[0].value;
    }
    return value;
}

export function setValue(config, field, value) {
    if (getValue(config, field) !== value) config.confirmed.delete(field.key);
    if (value === defaultOf(field)) delete config.values[field.key];
    else config.values[field.key] = value;
}

export function isModified(config, field) {
    return config.values[field.key] !== undefined;
}

/** The value the field goes back to when restored. */
export function originalValue(field) {
    return defaultOf(field);
}

export function restoreValue(config, field) {
    setValue(config, field, defaultOf(field));
}

/** Gives every domain the value this field has. Returns the fields of all the domains. */
export function copyToAllDomains(config, field) {
    const value = getValue(config, field);
    const fields = domainIds(config)
        .flatMap(id => fieldsOfProperty(config, field.prop, id))
        .filter(candidate => candidate.repeatIndex === field.repeatIndex);
    fields.forEach(candidate => setValue(config, candidate, value));
    return fields;
}

/** Current value of the property named by a template key, resolved for the given domain. */
function readKey(config, key, domainId) {
    const entry = propertyIndex(config).get(key);
    if (!entry) return undefined;
    const id = entry.scope === 'domain' ? domainId : null;
    return getValue(config, { key: fillDomain(key, id), prop: entry.prop, domainId: id, repeatIndex: null });
}

export function isChecked(value) {
    return normalizeBoolean(value) === 'true';
}

export function booleanValue(prop, checked) {
    if (prop.booleanType === 'number') return checked ? '1' : '0';
    return checked ? 'true' : 'false';
}

function normalizeBoolean(value) {
    const text = String(value).toLowerCase().trim();
    if (['true', '1', 'on', 'yes'].includes(text)) return 'true';
    if (['false', '0', 'off', 'no'].includes(text)) return 'false';
    return text;
}

export function isVisible(config, prop, domainId = null, seen = new Set()) {
    const dependency = prop.dependsOn;
    if (!dependency || !dependency.key) return true;
    const source = propertyIndex(config).get(dependency.key);
    if (!source || seen.has(dependency.key)) return true;
    seen.add(dependency.key);
    if (!isVisible(config, source.prop, domainId, seen)) return false;
    return normalizeBoolean(readKey(config, dependency.key, domainId)) === normalizeBoolean(dependency.value);
}

// ---------------------------------------------------------------- validation

export function needsConfirmation(prop, value) {
    if (!prop.needsConfirmation) return false;
    if (prop.type === 'number') return Boolean(prop.confirmOnZero) && (value === '' || value === '0');
    return ['text', 'url', 'password', 'html'].includes(prop.type);
}

const ISSUE_MESSAGES = {
    required: 'Este valor es obligatorio',
    range: 'El valor está fuera del rango permitido',
    confirm: 'Falta confirmar este valor'
};

export function issueMessage(issue) {
    return ISSUE_MESSAGES[issue] || '';
}

export function fieldIssue(config, field) {
    const { prop } = field;
    const value = getValue(config, field);
    if (prop.required && String(value).trim() === '') return 'required';
    if (prop.type === 'number' && value !== '') {
        const number = Number(value);
        const belowMin = prop.min !== undefined && prop.min !== '' && number < Number(prop.min);
        const aboveMax = prop.max !== undefined && prop.max !== '' && number > Number(prop.max);
        if (belowMin || aboveMax) return 'range';
    }
    if (needsConfirmation(prop, value) && !config.confirmed.has(field.key)) return 'confirm';
    return null;
}

/** Fields that block the download. Hidden fields never count. */
export function pendingFields(config) {
    const pending = [];
    for (const field of allFields(config)) {
        if (!isVisible(config, field.prop, field.domainId)) continue;
        const issue = fieldIssue(config, field);
        if (issue) pending.push({ field, issue });
    }
    return pending;
}

// ---------------------------------------------------------------- normalization

function normalizeOption(option) {
    const value = String(option.value ?? '');
    const normalized = { value, label: String(option.label ?? value) };
    if (option.disabled || option.enabled === false) normalized.disabled = true;
    return normalized;
}

function normalizeProperty(source, raw, helpers) {
    const prop = { ...source };
    delete prop.id;
    delete prop.category;
    delete prop.isDomain;
    delete prop.dependsOnRowList;
    delete prop.isDynamicLanguageCount;
    delete prop.isDynamicRowList;

    prop.key = String(source.key ?? '');
    prop.label = source.label || labelFromKey(prop.key);
    prop.type = source.type || 'text';
    prop.default = source.default !== undefined ? source.default : source.defaultValue;
    delete prop.defaultValue;
    if (prop.default === undefined || prop.default === null) prop.default = '';
    if (!Array.isArray(prop.default)) prop.default = String(prop.default);
    prop.description = LEGACY_PLACEHOLDER_DESCRIPTION.test(source.description || '') ? '' : (source.description || '');
    prop.required = Boolean(source.required);
    prop.needsConfirmation = Boolean(source.needsConfirmation);

    // Project-specific types stored by older versions become their generic equivalents
    if (PRESET_LISTS[prop.type]) {
        prop.options = raw[prop.type] || PRESET_LISTS[prop.type].options;
        prop.type = 'select';
    } else if (prop.type === 'dynamicSelect') {
        prop.type = 'select';
        if (helpers.rowListKey) prop.dynamicOptionsFrom = { key: helpers.rowListKey, separator: ',' };
    } else if (prop.type === 'dynamicLanguages') {
        prop.type = 'text';
        prop.key = 'portal.languages.language[N]';
        prop.needsConfirmation = true;
        prop.default = Array.isArray(source.default) && source.default.length ? source.default : ['es', 'en', 'fr'];
        if (helpers.languageCountKey) {
            prop.repeatBasedOn = { key: helpers.languageCountKey, placeholder: '[N]', label: 'Idioma' };
        }
    }

    if (prop.type === 'boolean') {
        prop.booleanType = prop.booleanType || (/^[01]$/.test(prop.default) ? 'number' : 'string');
    } else {
        delete prop.booleanType;
    }
    if (Array.isArray(prop.options)) prop.options = prop.options.map(normalizeOption);
    if (prop.dependsOn && !prop.dependsOn.key) delete prop.dependsOn;
    if (prop.repeatBasedOn && !prop.repeatBasedOn.key) delete prop.repeatBasedOn;
    if (prop.dynamicOptionsFrom && !prop.dynamicOptionsFrom.key) delete prop.dynamicOptionsFrom;
    return prop;
}

function legacyFlatSections(properties) {
    const sections = new Map();
    for (const prop of properties) {
        const title = prop.category || 'General';
        if (!sections.has(title)) sections.set(title, { category: title, properties: [] });
        sections.get(title).properties.push(prop);
    }
    return [...sections.values()];
}

/** Turns any configuration JSON, from this or an earlier version, into the shape described at the top of this file. */
export function normalizeConfig(raw) {
    const usable = raw && typeof raw === 'object' && !Array.isArray(raw)
        && (raw.globalProperties || raw.domainProperties || raw.properties);
    if (!usable) throw new Error('El archivo no tiene la estructura de una configuración de BuildBag');

    const rawGlobal = raw.globalProperties || (raw.properties ? legacyFlatSections(raw.properties) : []);
    const rawDomain = raw.domainProperties || [];
    const rawProps = [...rawGlobal, ...rawDomain].flatMap(section => section.properties || []);
    const helpers = {
        languageCountKey: (rawProps.find(prop => prop.isDynamicLanguageCount) || {}).key,
        rowListKey: (rawProps.find(prop => prop.isDynamicRowList) || {}).key
    };
    const sections = list => list.map(section => ({
        category: String(section.category || 'General'),
        properties: (section.properties || []).map(prop => normalizeProperty(prop, raw, helpers))
    }));

    const config = {
        schemaVersion: 2,
        projectName: raw.projectName || '',
        projectDescription: raw.projectDescription || '',
        version: raw.version || '1.0.0',
        outputFileName: raw.outputFileName || 'config.properties',
        domainKeyPattern: raw.domainKeyPattern || DEFAULT_DOMAIN_PATTERN,
        domainCount: 0,
        globalProperties: sections(rawGlobal),
        domainProperties: sections(rawDomain).filter(section => section.properties.length > 0),
        values: { ...(raw.values || {}) },
        confirmed: new Set(raw.confirmed || [])
    };
    for (const section of config.domainProperties) {
        for (const prop of section.properties) {
            if (DOMAIN_ID_KEY.test(prop.key)) prop.autoFillDomainId = true;
        }
    }

    if (config.domainProperties.length > 0) {
        const legacyDomains = Array.isArray(raw._domainValues) ? raw._domainValues : null;
        const countKey = domainCountKey(config);
        const countFromKey = countKey ? parseInt(readKey(config, countKey), 10) : NaN;
        const count = raw.domainCount ?? (legacyDomains ? legacyDomains.length : (countFromKey || 2));
        config.domainCount = clamp(count, 1, MAX_DOMAINS);
        if (legacyDomains) importLegacyDomainValues(config, legacyDomains);
        syncDomainCountField(config);
    }
    return config;
}

function importLegacyDomainValues(config, legacyDomains) {
    const index = propertyIndex(config);
    for (const domain of legacyDomains) {
        for (const [template, value] of Object.entries(domain.properties || {})) {
            const entry = index.get(template);
            if (!entry || entry.scope !== 'domain') continue;
            const field = { key: fillDomain(template, domain.id), prop: entry.prop, domainId: domain.id, repeatIndex: null };
            const text = typeof value === 'boolean' ? booleanValue(entry.prop, value) : String(value);
            setValue(config, field, text);
        }
    }
}

/** The JSON stored in the database and offered as an export. */
export function serializeConfig(config) {
    return { ...config, confirmed: [...config.confirmed] };
}

export function emptyConfig() {
    return normalizeConfig({
        projectName: 'Nueva configuración',
        globalProperties: [],
        domainProperties: []
    });
}

// ---------------------------------------------------------------- domains

function syncDomainCountField(config) {
    const countKey = domainCountKey(config);
    if (!countKey) return;
    const { prop } = propertyIndex(config).get(countKey);
    setValue(config, { key: countKey, prop, domainId: null, repeatIndex: null }, String(config.domainCount));
}

/** Changes the number of domains, forgetting the values of the ones removed. Returns the count applied. */
export function setDomainCount(config, requested) {
    const count = clamp(parseInt(requested, 10) || 1, 1, MAX_DOMAINS);
    for (let id = count + 1; id <= config.domainCount; id++) {
        for (const section of config.domainProperties) {
            for (const prop of section.properties) {
                for (const field of fieldsOfProperty(config, prop, id)) {
                    delete config.values[field.key];
                    config.confirmed.delete(field.key);
                }
                if (prop.domainDefaults) delete prop.domainDefaults[id];
            }
        }
    }
    config.domainCount = count;
    syncDomainCountField(config);
    return count;
}

/**
 * Moves the global properties whose key matches the pattern to per-domain sections, merging app.domain1.url and
 * app.domain2.url into app.domain{N}.url and keeping each domain's value.
 */
export function applyDomainPattern(config, pattern) {
    config.domainKeyPattern = pattern;
    const templates = new Map();
    for (const section of config.domainProperties) {
        for (const prop of section.properties) templates.set(prop.key, prop);
    }

    const sectionFor = title => {
        let section = config.domainProperties.find(candidate => candidate.category === title);
        if (!section) {
            section = { category: title, properties: [] };
            config.domainProperties.push(section);
        }
        return section;
    };

    let maxId = config.domainCount;
    for (const section of config.globalProperties) {
        section.properties = section.properties.filter(prop => {
            const match = prop.repeatBasedOn ? null : matchDomainKey(prop.key, pattern);
            if (!match) return true;
            const fileValue = String(prop.default);
            const stored = config.values[prop.key];
            const value = stored !== undefined ? stored : fileValue;
            let target = templates.get(match.template);
            if (!target) {
                target = { ...prop, key: match.template };
                if (DOMAIN_ID_KEY.test(target.key)) target.autoFillDomainId = true;
                templates.set(match.template, target);
                sectionFor(section.category.replace(/\s*\d+\s*$/, '')).properties.push(target);
            }
            if (fileValue !== String(target.default) && !target.autoFillDomainId) {
                target.domainDefaults = { ...target.domainDefaults, [match.id]: fileValue };
            }
            delete config.values[prop.key];
            const field = { key: prop.key, prop: target, domainId: match.id, repeatIndex: null };
            if (value !== defaultOf(field)) config.values[prop.key] = value;
            maxId = Math.max(maxId, match.id);
            return false;
        });
    }
    config.globalProperties = config.globalProperties.filter(section => section.properties.length > 0);
    config.domainCount = clamp(maxId, 0, MAX_DOMAINS);
    structureChanged(config);
    syncDomainCountField(config);
}

// ---------------------------------------------------------------- structure editing

export function uniqueKey(config, base = 'nueva.propiedad') {
    const keys = propertyIndex(config);
    if (!keys.has(base)) return base;
    let n = 2;
    while (keys.has(`${base}${n}`)) n++;
    return `${base}${n}`;
}

export function addSection(config, title = 'Nueva categoría') {
    config.globalProperties.push({ category: title, properties: [] });
    structureChanged(config);
}

export function addProperty(config, scope, sectionIndex) {
    const key = uniqueKey(config);
    const prop = {
        key: scope === 'domain' ? adaptKeyToScope(key, 'domain', config.domainKeyPattern) : key,
        label: 'Nueva propiedad',
        type: 'text',
        default: '',
        description: '',
        required: false,
        needsConfirmation: false
    };
    config[SCOPES[scope]][sectionIndex].properties.push(prop);
    structureChanged(config);
    return prop;
}

export function removeProperty(config, scope, sectionIndex, propIndex) {
    config[SCOPES[scope]][sectionIndex].properties.splice(propIndex, 1);
    structureChanged(config);
    dropDomainsIfUnused(config);
}

export function removeSection(config, scope, sectionIndex) {
    config[SCOPES[scope]].splice(sectionIndex, 1);
    structureChanged(config);
    dropDomainsIfUnused(config);
}

function dropDomainsIfUnused(config) {
    if (!config.domainProperties.some(section => section.properties.length > 0)) config.domainCount = 0;
}

function adaptKeyToScope(key, scope, pattern) {
    if (scope === 'global') return fillDomain(key, 1);
    if (key.includes('{N}')) return key;
    const match = matchDomainKey(key, pattern);
    if (match) return match.template;
    const parts = key.split('.');
    parts.splice(Math.max(parts.length - 1, 0), 0, pattern);
    return parts.join('.');
}

function concreteKeys(config, prop, scope) {
    const ids = scope === 'domain' ? Array.from({ length: Math.max(config.domainCount, 1) }, (_, i) => i + 1) : [null];
    return ids.flatMap(id => fieldsOfProperty(config, prop, id).map(field => field.key));
}

/** Changes a property's key, carrying its values and confirmations over to the keys it now produces. */
function rekeyProperty(config, prop, newKey, fromScope, toScope) {
    const before = concreteKeys(config, prop, fromScope);
    prop.key = newKey;
    const after = concreteKeys(config, prop, toScope);
    const moved = before.map(key => ({ key, value: config.values[key], confirmed: config.confirmed.delete(key) }));
    moved.forEach(({ key }) => delete config.values[key]);
    moved.forEach(({ value, confirmed }, i) => {
        if (i >= after.length) return;
        if (value !== undefined) config.values[after[i]] = value;
        if (confirmed) config.confirmed.add(after[i]);
    });
}

function ensureDomainCount(config) {
    if (config.domainProperties.some(section => section.properties.length > 0) && config.domainCount < 1) {
        config.domainCount = 1;
    }
}

/** to.index is the position among the target's properties before moving; without it the property goes last. */
export function moveProperty(config, from, to) {
    const source = config[SCOPES[from.scope]][from.section];
    const [prop] = source.properties.splice(from.prop, 1);
    if (from.scope !== to.scope) {
        rekeyProperty(config, prop, adaptKeyToScope(prop.key, to.scope, config.domainKeyPattern), from.scope, to.scope);
    }
    const target = config[SCOPES[to.scope]][to.section].properties;
    const sameSection = from.scope === to.scope && from.section === to.section;
    const index = to.index === undefined ? target.length : to.index - (sameSection && to.index > from.prop ? 1 : 0);
    target.splice(index, 0, prop);
    structureChanged(config);
    ensureDomainCount(config);
    dropDomainsIfUnused(config);
}

/** toIndex is the position among the sections before moving. */
export function moveSection(config, scope, fromIndex, toIndex) {
    const sections = config[SCOPES[scope]];
    const [section] = sections.splice(fromIndex, 1);
    sections.splice(toIndex - (toIndex > fromIndex ? 1 : 0), 0, section);
    structureChanged(config);
}

export function sortSection(config, scope, sectionIndex) {
    const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    config[SCOPES[scope]][sectionIndex].properties.sort((a, b) => collator.compare(a.key, b.key));
    structureChanged(config);
}

/** Switches a whole section between global and per-domain. */
export function toggleSectionScope(config, scope, sectionIndex) {
    const target = scope === 'global' ? 'domain' : 'global';
    const [section] = config[SCOPES[scope]].splice(sectionIndex, 1);
    for (const prop of section.properties) {
        rekeyProperty(config, prop, adaptKeyToScope(prop.key, target, config.domainKeyPattern), scope, target);
    }
    config[SCOPES[target]].push(section);
    structureChanged(config);
    ensureDomainCount(config);
    dropDomainsIfUnused(config);
}

/** Renames a property everywhere it is referenced. Returns false if the new key is already taken. */
export function renameProperty(config, prop, newKey) {
    if (newKey === prop.key) return true;
    if (!newKey || propertyIndex(config).has(newKey)) return false;
    const oldKey = prop.key;
    const { scope } = propertyIndex(config).get(oldKey);
    rekeyProperty(config, prop, newKey, scope, scope);
    for (const { prop: other } of propertyIndex(config).values()) {
        if (other.dependsOn && other.dependsOn.key === oldKey) other.dependsOn.key = newKey;
        if (other.repeatBasedOn && other.repeatBasedOn.key === oldKey) other.repeatBasedOn.key = newKey;
        if (other.dynamicOptionsFrom && other.dynamicOptionsFrom.key === oldKey) other.dynamicOptionsFrom.key = newKey;
    }
    structureChanged(config);
    return true;
}
