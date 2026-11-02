// The panel has one flow: open a configuration (import, saved or empty), review it, save it and download the file.
// Every entry point ends in openConfig(), every save goes through persist(), and every change to the structure goes
// through structureEdited(), so there is one working copy of the configuration, held in `work`.

import { api, session } from './api.js';
import {
    addProperty, addSection, allFields, applyDomainPattern, booleanValue, copyToAllDomains, domainCountKey, domainIds,
    emptyConfig, fieldsOfProperty, getValue, isChecked, isModified, isVisible, issueMessage, MAX_DOMAINS, moveProperty,
    moveSection, needsConfirmation, normalizeConfig, pendingFields, PRESET_LISTS, removeProperty, removeSection,
    renameProperty, restoreValue, SCOPES, serializeConfig, setDomainCount, setValue, sortSection, structureChanged,
    toggleSectionScope
} from './model.js';
import { configFromProperties, generateProperties } from './properties.js';
import {
    allKeysHtml, domainTabsHtml, dynamicOptionsHtml, htmlPreviewDocument, inspectorHtml, isCompactView, renderSections,
    sidebarHtml
} from './render.js';
import { ask, debounce, downloadFile, esc, toast } from './ui.js';

const $ = id => document.getElementById(id);
const NEW_CATEGORY = '__new__';
const VIEW_KEY = 'panelView';

function savedView() {
    try {
        return localStorage.getItem(VIEW_KEY) === 'compact' ? 'compact' : 'guided';
    } catch (_) {
        return 'guided';
    }
}

// Status refreshes run on every keystroke over thousands of elements. Writing an unchanged value still makes the
// browser recompute the layout of the whole table, so these only touch the DOM when something really changed.
function setHidden(element, hidden) {
    if (element.hidden !== hidden) element.hidden = hidden;
}

function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
}

const inputOf = key => document.querySelector(`:is(input, select, textarea)[data-key="${CSS.escape(key)}"]`);
const isCompact = () => isCompactView(ui);

/** The open configuration and its place in the database. Null when nothing is open. */
let work = null;
/** View state that survives re-rendering. */
const ui = {
    structure: false, editing: null, collapsed: new Set(), activeDomain: 1, view: savedView(), selectedKey: null
};
/** What is on screen right now: concrete key to field, plus the context of the last render. */
let rendered = { fields: new Map(), nextId: 1 };
/** Categories with their configurations, as last returned by the server. */
let catalog = [];

// ---------------------------------------------------------------- opening a configuration

async function confirmDiscard() {
    if (!work || !work.dirty) return true;
    return ask({
        title: 'Hay cambios sin guardar',
        message: `Si continúas se perderán los cambios en "${work.config.projectName}".`,
        confirmLabel: 'Descartar cambios',
        danger: true
    });
}

function openConfig(config, meta = {}) {
    work = {
        config,
        id: meta.id ?? null,
        categoryId: meta.categoryId ?? null,
        categoryName: null,
        subcategory: meta.subcategory ?? '',
        dirty: meta.dirty ?? false
    };
    ui.editing = null;
    ui.collapsed.clear();
    ui.activeDomain = 1;
    ui.selectedKey = null;
    setStructureMode(Boolean(meta.structure));
    $('search').value = '';
    $('only-pending').checked = false;
    $('only-modified').checked = false;
    $('welcome').hidden = true;
    $('workspace').hidden = false;
    $('sidebar').hidden = false;
    renderAll();
    window.scrollTo(0, 0);
}

function closeConfig() {
    work = null;
    $('welcome').hidden = false;
    $('workspace').hidden = true;
    $('sidebar').hidden = true;
    $('config-select').value = '';
    document.title = 'Panel de configuración - BuildBag';
}

async function loadFromServer(id) {
    const dto = await api(`/api/configs/${id}`);
    const bytes = Uint8Array.from(atob(dto.contentBase64), char => char.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    const config = normalizeConfig(raw);
    config.projectName = dto.name;
    openConfig(config, {
        id: dto.id,
        categoryId: dto.categoryId,
        subcategory: dto.subcategory || raw.subcategory || ''
    });
}

async function importFile(file) {
    if (!(await confirmDiscard())) return;
    try {
        const text = await file.text();
        const name = file.name.toLowerCase();
        if (!name.endsWith('.properties') && !name.endsWith('.json')) {
            throw new Error('Formato no soportado. Usa .properties o .json');
        }
        const config = name.endsWith('.json') ? normalizeConfig(JSON.parse(text)) : configFromProperties(text, file.name);
        openConfig(config, { dirty: true });
        $('config-select').value = '';
        const count = [...allFields(config)].length;
        toast(`"${file.name}" abierto con ${count} propiedades. Revísalas y guarda cuando quieras.`, 'info');
    } catch (error) {
        toast(error instanceof SyntaxError ? 'El archivo JSON no es válido' : error.message, 'error');
    }
}

// ---------------------------------------------------------------- rendering

function renderAll() {
    const { config } = work;
    rendered = { config, ui, fields: new Map(), nextId: 1 };
    document.body.classList.toggle('view-compact', isCompact());
    document.querySelectorAll('[data-action="set-view"]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.view === (isCompact() ? 'compact' : 'guided')));
        button.disabled = ui.structure;
    });
    renderSections(rendered, $('global-sections'), 'global');
    renderDomains();
    $('all-keys').innerHTML = allKeysHtml(config);
    renderChrome();
    renderInspector();
    applyFilters();
    refreshStatus();
}

function renderInspector() {
    const field = isCompact() && ui.selectedKey ? rendered.fields.get(ui.selectedKey) : null;
    const inspector = $('inspector');
    inspector.hidden = !field;
    document.querySelectorAll('.grid__row.is-selected').forEach(row => row.classList.remove('is-selected'));
    inspector.innerHTML = field ? inspectorHtml(work.config, field) : '';
    if (!field) return;
    const row = document.querySelector(`.grid__row[data-row-key="${CSS.escape(ui.selectedKey)}"]`);
    const input = inputOf(ui.selectedKey);
    (row || (input && input.closest('.grid__row')) || inspector).classList.add('is-selected');
    refreshModifiedMarks();
}

function selectField(key) {
    if (ui.selectedKey === key || !rendered.fields.has(key)) return;
    ui.selectedKey = key;
    renderInspector();
}

function refreshModifiedMarks() {
    document.querySelectorAll('[data-modified-for]').forEach(element => {
        setHidden(element, work.config.values[element.dataset.modifiedFor] === undefined);
    });
}

function renderDomains() {
    const { config } = work;
    const hasDomains = config.domainCount > 0;
    $('domains').hidden = !hasDomains && config.domainProperties.length === 0;
    $('domain-tabs').hidden = isCompact();
    if (!hasDomains) {
        $('domain-tabs').innerHTML = '';
        $('domain-sections').innerHTML = '';
        return;
    }
    ui.activeDomain = Math.min(ui.activeDomain, config.domainCount);
    // Fields of the previous domain must no longer resolve once they are off screen
    for (const [key, field] of rendered.fields) {
        if (field.domainId !== null) rendered.fields.delete(key);
    }
    renderSections(rendered, $('domain-sections'), 'domain', ui.activeDomain);
    $('domain-tabs').innerHTML = domainTabsHtml(domainIds(config), ui.activeDomain);
    $('remove-domain').hidden = config.domainCount <= 1;
}

function renderChrome() {
    const { config } = work;
    $('project-name').textContent = config.projectName || 'Sin nombre';
    document.title = `${config.projectName || 'Sin nombre'} - BuildBag`;
    const meta = [`v${config.version}`, config.outputFileName];
    if (work.subcategory) meta.push(work.subcategory);
    if (config.projectDescription) meta.push(config.projectDescription);
    $('project-meta').textContent = meta.join(' · ');
    $('sidebar').innerHTML = sidebarHtml(config, ui.activeDomain, isCompact());
    $('structure-actions').hidden = !ui.structure;
    renderSaveStatus();
}

function renderSaveStatus() {
    const status = $('save-status');
    if (!work.id) {
        status.textContent = 'Sin guardar';
        status.className = 'badge badge--warning';
    } else if (work.dirty) {
        status.textContent = 'Cambios sin guardar';
        status.className = 'badge badge--warning';
    } else {
        status.textContent = 'Guardado';
        status.className = 'badge badge--success';
    }
    $('save-button').classList.toggle('btn--attention', work.dirty || !work.id);
}

function fieldsOnScreen() {
    return [...rendered.fields.values()];
}

/** Recomputes everything derived from the values: visibility, pending marks, counters and progress. */
function refreshStatus() {
    if (!work) return;
    const { config } = work;
    const pending = pendingFields(config);

    document.querySelectorAll('[data-prop-row]').forEach(row => {
        const [scope, section, index] = row.dataset.path.split(':');
        const prop = config[SCOPES[scope]][section].properties[index];
        if (row.dataset.domain === 'all') {
            refreshDomainRow(row, prop);
            return;
        }
        const domainId = row.dataset.domain ? Number(row.dataset.domain) : null;
        const visible = isVisible(config, prop, domainId);
        // While editing the structure conditional properties stay reachable, marked instead of hidden
        setHidden(row, !visible && !ui.structure);
        row.classList.toggle('is-conditional', !visible && ui.structure);
    });

    const issues = new Map(pending.map(({ field, issue }) => [field.key, issue]));
    document.querySelectorAll('[data-issue-for]').forEach(element => {
        const issue = issues.get(element.dataset.issueFor);
        // Unchecked confirmations are already visible in the checkbox next to the input
        const message = issue && issue !== 'confirm' ? issueMessage(issue) : '';
        setText(element, message);
        setHidden(element, !message);
        const cell = element.closest('.grid__cell');
        if (cell) cell.classList.toggle('is-pending', Boolean(issue));
    });
    refreshModifiedMarks();
    document.querySelectorAll('[data-section-id]').forEach(element => refreshSection(element, issues));

    const sectionOfProp = new Map();
    for (const [scope, list] of Object.entries(SCOPES)) {
        config[list].forEach((section, index) => {
            for (const prop of section.properties) sectionOfProp.set(prop, `${scope}:${index}`);
        });
    }
    const counts = new Map();
    for (const { field } of pending) {
        const section = sectionOfProp.get(field.prop);
        counts.set(section, (counts.get(section) || 0) + 1);
    }
    document.querySelectorAll('[data-nav]').forEach(item => {
        const [scope] = item.dataset.nav.split(':');
        const count = counts.get(item.dataset.nav) || 0;
        const badge = item.querySelector('[data-nav-count]');
        setText(badge, String(count));
        setHidden(badge, count === 0);
        badge.title = scope === 'domain' ? 'Pendientes en todos los dominios' : 'Pendientes';
    });

    const byDomain = new Map();
    for (const { field } of pending) {
        if (field.domainId !== null) byDomain.set(field.domainId, (byDomain.get(field.domainId) || 0) + 1);
    }
    document.querySelectorAll('[data-domain-pending]').forEach(element => {
        const count = byDomain.get(Number(element.dataset.domainPending)) || 0;
        setText(element, String(count));
        setHidden(element, count === 0);
    });

    const total = visibleFieldCount();
    const done = total - pending.length;
    const percent = total === 0 ? 100 : Math.round((done / total) * 100);
    const text = $('progress-text');
    if (text) {
        setText(text, pending.length === 0
            ? `Todo revisado (${total} propiedades)`
            : `${done} de ${total} revisadas · ${pending.length} pendientes`);
        $('progress-fill').style.width = `${percent}%`;
        $('progress-bar').setAttribute('aria-valuenow', String(percent));
        setHidden($('next-pending'), pending.length === 0);
    }
    const modified = [...allFields(config)].filter(field => isModified(config, field)).length;
    setText($('modified-count'), modified ? ` (${modified})` : '');
    if ($('only-pending').checked || $('only-modified').checked) applyFilters();
}

/** A grid row spans every domain: each cell follows its own dependencies, and the row marks differing values. */
function refreshDomainRow(row, prop) {
    const { config } = work;
    const values = new Set();
    let anyVisible = false;
    row.querySelectorAll('[data-cell-domain]').forEach(cell => {
        const visible = isVisible(config, prop, Number(cell.dataset.cellDomain));
        cell.classList.toggle('is-unavailable', !visible);
        if (!visible) return;
        anyVisible = true;
        const input = cell.querySelector(':is(input, select, textarea)[data-key]');
        if (input && !prop.autoFillDomainId) values.add(getValue(config, rendered.fields.get(input.dataset.key)));
    });
    setHidden(row, !anyVisible && row.querySelector('[data-cell-domain]') !== null);
    row.classList.toggle('has-differences', values.size > 1);
}

const scheduleStatus = (() => {
    let scheduled = false;
    return () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            refreshStatus();
        });
    };
})();

function visibleFieldCount() {
    let count = 0;
    for (const field of allFields(work.config)) {
        if (isVisible(work.config, field.prop, field.domainId)) count++;
    }
    return count;
}

function refreshSection(element, issues) {
    const rows = [...element.querySelectorAll('[data-prop-row]')];
    const visible = rows.filter(row => !row.hidden);
    const notice = element.querySelector('[data-hidden-notice]');
    if (notice) setHidden(notice, rows.length === 0 || visible.length > 0);

    const fields = fieldsInSection(element.dataset.sectionId);
    const pendingCount = fields.filter(field => issues.has(field.key)).length;
    const counter = element.querySelector('[data-section-count]');
    const propCount = rows.length === 1 ? '1 propiedad' : `${rows.length} propiedades`;
    setText(counter, pendingCount ? `${propCount} · ${pendingCount} pendientes` : propCount);
    counter.classList.toggle('section__count--pending', pendingCount > 0);

    const tools = element.querySelector('[data-section-tools]');
    setHidden(tools, !fields.some(field => issues.get(field.key) === 'confirm'));
}

function fieldsInSection(sectionId) {
    const [scope, index] = sectionId.split(':');
    const { config } = work;
    const shown = isCompact() ? domainIds(config) : [ui.activeDomain];
    const ids = scope === 'domain' ? shown : [null];
    return config[SCOPES[scope]][index].properties.flatMap(prop => ids
        .filter(id => isVisible(config, prop, id))
        .flatMap(id => fieldsOfProperty(config, prop, id)));
}

const isFiltering = () => Boolean($('search').value.trim()) || $('only-pending').checked || $('only-modified').checked;

function applyFilters() {
    const term = $('search').value.trim().toLowerCase();
    const onlyPending = $('only-pending').checked;
    const onlyModified = $('only-modified').checked;
    const filtering = isFiltering();
    const pendingKeys = onlyPending ? new Set(pendingFields(work.config).map(({ field }) => field.key)) : null;

    document.querySelectorAll('[data-section-id]').forEach(section => {
        let matches = 0;
        section.querySelectorAll('[data-prop-row]').forEach(row => {
            const byTerm = !term || row.dataset.search.includes(term);
            const byPending = !onlyPending
                || [...row.querySelectorAll('[data-key]')].some(input => pendingKeys.has(input.dataset.key));
            const byModified = !onlyModified
                || [...row.querySelectorAll('[data-key]')].some(input => work.config.values[input.dataset.key] !== undefined);
            const show = byTerm && byPending && byModified;
            row.classList.toggle('is-filtered', !show);
            if (show && !row.hidden) matches++;
        });
        section.classList.toggle('is-filtered', filtering && matches === 0);
        section.open = filtering ? matches > 0 : !ui.collapsed.has(section.dataset.sectionId);
    });
}

function markDirty() {
    if (!work.dirty) {
        work.dirty = true;
        renderSaveStatus();
    }
}

/** Call after any change to sections or properties: re-renders the form from the model. */
function structureEdited() {
    structureChanged(work.config);
    markDirty();
    renderAll();
}

function setStructureMode(enabled) {
    ui.structure = enabled;
    if (!enabled) ui.editing = null;
    $('structure-toggle').checked = enabled;
    document.body.classList.toggle('structure-mode', enabled);
}

// ---------------------------------------------------------------- catalog of saved configurations

async function refreshCatalog() {
    catalog = await api('/api/configs/with-categories');
    const select = $('config-select');
    const groups = catalog.filter(category => category.configurations.length > 0).map(category => (
        `<optgroup label="${esc(category.name)}">${category.configurations.map(config => (
            `<option value="${config.id}">${esc(config.name)}${config.subcategory ? ` (${esc(config.subcategory)})` : ''}</option>`
        )).join('')}</optgroup>`
    )).join('');
    select.innerHTML = `<option value="">${groups ? 'Abrir configuración guardada…' : 'Aún no hay configuraciones guardadas'}</option>${groups}`;
    select.value = work && work.id ? String(work.id) : '';
}

// ---------------------------------------------------------------- saving

/** The single way to write to the server: updates the open configuration, or creates it if it is new or a copy. */
async function persist({ asCopy = false } = {}) {
    const { config } = work;
    const body = {
        name: config.projectName,
        subcategory: work.subcategory,
        categoryId: work.categoryName ? null : work.categoryId,
        categoryName: work.categoryName,
        json: JSON.stringify(serializeConfig(config))
    };
    const dto = work.id && !asCopy
        ? await api(`/api/configs/${work.id}`, { method: 'PUT', body })
        : await api('/api/configs', { method: 'POST', body });
    work.id = dto.id;
    work.categoryId = dto.categoryId;
    work.categoryName = null;
    work.dirty = false;
    renderChrome();
    refreshStatus();
    await refreshCatalog();
    toast(`"${dto.name}" guardada`);
}

async function save({ asCopy = false } = {}) {
    if (!work.id || asCopy) {
        openDetails(asCopy ? 'copy' : 'save');
        return;
    }
    try {
        await persist();
    } catch (error) {
        toast(error.message, 'error');
    }
}

// ---------------------------------------------------------------- details dialog

let detailsMode = 'details';

function openDetails(mode) {
    detailsMode = mode;
    const { config } = work;
    const form = $('details-form');
    const select = $('detail-category');
    select.innerHTML = `<option value="">Selecciona una categoría…</option>
        ${catalog.map(category => `<option value="${category.id}">${esc(category.name)}</option>`).join('')}
        <option value="${NEW_CATEGORY}">+ Nueva categoría</option>`;
    select.value = work.categoryName ? NEW_CATEGORY : (work.categoryId ?? '');

    form.elements.name.value = mode === 'copy' ? `${config.projectName} (copia)` : config.projectName;
    form.elements.newCategory.value = work.categoryName || '';
    form.elements.subcategory.value = work.subcategory;
    form.elements.description.value = config.projectDescription;
    form.elements.version.value = config.version;
    form.elements.outputFileName.value = config.outputFileName;
    form.elements.domainKeyPattern.value = config.domainKeyPattern;
    syncNewCategoryField();

    $('details-title').textContent = {
        save: 'Guardar configuración', copy: 'Guardar como copia', details: 'Detalles de la configuración'
    }[mode];
    $('details-submit').textContent = mode === 'details' ? 'Aplicar' : 'Guardar';
    $('details-error').hidden = true;
    $('details-dialog').showModal();
}

function syncNewCategoryField() {
    const isNew = $('detail-category').value === NEW_CATEGORY;
    $('detail-new-category-field').hidden = !isNew;
    $('detail-new-category').required = isNew;
}

async function submitDetails(event) {
    event.preventDefault();
    const { config } = work;
    const values = Object.fromEntries(new FormData(event.target));
    const showError = message => {
        $('details-error').textContent = message;
        $('details-error').hidden = false;
    };

    const pattern = values.domainKeyPattern.trim();
    if (!values.name.trim()) {
        showError('Escribe un nombre para la configuración.');
        return;
    }
    if (pattern.split('{N}').length !== 2) {
        showError('El patrón de dominio debe incluir {N} una sola vez, por ejemplo domain{N}.');
        return;
    }
    const isNewCategory = values.category === NEW_CATEGORY;
    if (detailsMode !== 'details' && !values.category) {
        showError('Selecciona o crea una categoría para guardar.');
        return;
    }

    config.projectName = values.name.trim();
    config.projectDescription = values.description.trim();
    config.version = values.version.trim() || '1.0.0';
    config.outputFileName = values.outputFileName.trim();
    work.subcategory = values.subcategory.trim();
    work.categoryName = isNewCategory ? values.newCategory.trim() : null;
    work.categoryId = isNewCategory || !values.category ? null : Number(values.category);
    if (pattern !== config.domainKeyPattern) applyDomainPattern(config, pattern);

    if (detailsMode === 'details') {
        $('details-dialog').close();
        structureEdited();
        return;
    }
    try {
        await persist({ asCopy: detailsMode === 'copy' });
        $('details-dialog').close();
        renderAll();
    } catch (error) {
        showError(error.message);
    }
}

// ---------------------------------------------------------------- navigation

function revealField(field) {
    const needsDomainSwitch = !isCompact() && field.domainId !== null && field.domainId !== ui.activeDomain;
    if (needsDomainSwitch) switchDomain(field.domainId);

    const input = inputOf(field.key);
    const row = input && input.closest('[data-prop-row]');
    if (!row) return;
    const section = row.closest('details.section');
    if (section) section.open = true;
    row.classList.remove('is-filtered');
    input.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    row.classList.add('is-highlighted');
    setTimeout(() => row.classList.remove('is-highlighted'), 2000);
    input.focus({ preventScroll: true });
}

function switchDomain(id) {
    ui.activeDomain = id;
    ui.editing = null;
    renderDomains();
    $('sidebar').innerHTML = sidebarHtml(work.config, ui.activeDomain, isCompact());
    applyFilters();
    refreshStatus();
}

function changeDomainCount(requested) {
    const applied = setDomainCount(work.config, requested);
    if (applied !== parseInt(requested, 10)) toast(`El número de dominios debe estar entre 1 y ${MAX_DOMAINS}`, 'error');
    markDirty();
    ui.activeDomain = Math.min(ui.activeDomain, applied);
    renderAll();
    return applied;
}

// ---------------------------------------------------------------- value changes

function pathOf(element) {
    const [scope, section, prop] = element.closest('[data-path]').dataset.path.split(':');
    return { scope, section: Number(section), prop: Number(prop) };
}

function propAt({ scope, section, prop }) {
    return work.config[SCOPES[scope]][section].properties[prop];
}

const updateHtmlPreview = debounce((key, html) => {
    const frame = [...document.querySelectorAll('[data-preview-for]')].find(element => element.dataset.previewFor === key);
    if (frame) frame.srcdoc = htmlPreviewDocument(html);
}, 200);

function handleFieldInput(input) {
    const field = rendered.fields.get(input.dataset.key);
    if (!field) return;
    const { config } = work;
    const value = input.type === 'checkbox' ? booleanValue(field.prop, input.checked) : input.value;
    setValue(config, field, value);
    markDirty();
    reflectValue(field, input);
    scheduleStatus();
}

/** Updates everything on screen that depends on a field's value, once the model already has it. */
function reflectValue(field, input) {
    const { config } = work;
    const value = getValue(config, field);

    if (input.type === 'checkbox') {
        input.closest('.switch').querySelector('.switch__label').textContent = input.checked ? 'Habilitado' : 'Deshabilitado';
    }
    if (field.prop.type === 'html') updateHtmlPreview(field.key, value);

    const confirmBox = document.querySelector(`[data-confirm-key="${CSS.escape(field.key)}"]`);
    if (confirmBox) {
        confirmBox.checked = config.confirmed.has(field.key);
        confirmBox.closest('.confirm').hidden = !needsConfirmation(field.prop, value);
    }

    // Selects fed by this property change with every keystroke
    for (const other of fieldsOnScreen()) {
        const source = other.prop.dynamicOptionsFrom;
        if (source && source.key === field.prop.key && other.domainId === field.domainId) {
            const select = inputOf(other.key);
            if (select) select.innerHTML = dynamicOptionsHtml(config, other);
        }
    }
}

/** Writes a value that changed from outside the input (restore, copy to all) back into its control. */
function syncControl(field) {
    const input = inputOf(field.key);
    if (!input) return;
    const value = getValue(work.config, field);
    if (input.type === 'checkbox') input.checked = isChecked(value);
    else input.value = value;
    reflectValue(field, input);
    handleFieldChange(input);
}

/** Up, down and Enter move between rows of the grid, staying in the same column. */
function moveInGrid(input, step) {
    const cell = input.closest('.grid__cell');
    if (!cell) return false;
    const cellsOf = row => [...row.querySelectorAll(':scope > .grid__cell')];
    const column = cellsOf(cell.parentElement).indexOf(cell);
    const rows = [...document.querySelectorAll('.grid__row')].filter(row => row.checkVisibility());
    for (let i = rows.indexOf(cell.parentElement) + step; i >= 0 && i < rows.length; i += step) {
        const cells = cellsOf(rows[i]);
        const target = cells[Math.min(column, cells.length - 1)];
        const next = target.classList.contains('is-unavailable') ? null : target.querySelector(':is(input, select, textarea)[data-key]');
        if (next) {
            next.focus();
            if (next.select) next.select();
            return true;
        }
    }
    return false;
}

/** Changes that alter how many fields exist are applied when the input settles, not on every keystroke. */
function handleFieldChange(input) {
    const field = rendered.fields.get(input.dataset.key);
    if (!field) return;
    const { config } = work;
    if (field.key === domainCountKey(config) && config.domainCount > 0) {
        changeDomainCount(input.value);
        return;
    }
    const drivesRepeat = Object.values(SCOPES)
        .flatMap(list => config[list])
        .flatMap(section => section.properties)
        .some(prop => prop.repeatBasedOn && prop.repeatBasedOn.key === field.prop.key);
    if (drivesRepeat) renderAll();
}

// ---------------------------------------------------------------- structure editing

function applyPropertyEdit(input) {
    const { config } = work;
    const path = pathOf(input);
    const prop = propAt(path);
    const edit = input.dataset.edit;
    const value = input.type === 'checkbox' ? input.checked : input.value;

    switch (edit) {
        case 'key':
            if (!renameProperty(config, prop, value.trim())) {
                toast(value.trim() ? 'Ya existe una propiedad con esa clave' : 'La clave no puede estar vacía', 'error');
            }
            break;
        case 'type':
            prop.type = value;
            if (value === 'boolean') prop.booleanType = prop.booleanType || 'string';
            if (value !== 'select') delete prop.dynamicOptionsFrom;
            if (value === 'url') prop.checkService = true;
            break;
        case 'move': {
            const [scope, section] = value.split(':');
            moveProperty(config, path, { scope, section: Number(section) });
            ui.editing = `${scope}:${section}:${config[SCOPES[scope]][section].properties.length - 1}`;
            break;
        }
        case 'repeat':
            if (value) prop.repeatBasedOn = { key: '', placeholder: '[N]', label: 'Item' };
            else delete prop.repeatBasedOn;
            break;
        case 'dynamic':
            if (value) prop.dynamicOptionsFrom = { key: '', separator: ',' };
            else delete prop.dynamicOptionsFrom;
            break;
        case 'preset':
            if (value) prop.options = PRESET_LISTS[value].options.map(option => ({ ...option }));
            break;
        case 'option-value':
        case 'option-label':
            prop.options[input.dataset.option][edit === 'option-value' ? 'value' : 'label'] = value;
            break;
        case 'dependsOn.key':
            if (value.trim()) prop.dependsOn = { key: value.trim(), value: prop.dependsOn ? prop.dependsOn.value : '' };
            else delete prop.dependsOn;
            break;
        case 'dependsOn.value':
        case 'repeatBasedOn.key':
        case 'repeatBasedOn.placeholder':
        case 'repeatBasedOn.label':
        case 'dynamicOptionsFrom.key':
        case 'dynamicOptionsFrom.separator': {
            const [group, name] = edit.split('.');
            prop[group][name] = value;
            break;
        }
        default:
            prop[edit] = value;
    }
    structureEdited();
}

function applySectionEdit(input) {
    const [scope, index] = input.closest('[data-section]').dataset.section.split(':');
    if (input.dataset.sectionEdit === 'title') {
        work.config[SCOPES[scope]][index].category = input.value.trim() || 'Sin nombre';
        structureEdited();
    } else {
        rearrange(() => toggleSectionScope(work.config, scope, Number(index)));
    }
}

function sectionIdOf(section) {
    for (const [scope, list] of Object.entries(SCOPES)) {
        const index = work.config[list].indexOf(section);
        if (index >= 0) return `${scope}:${index}`;
    }
    return null;
}

function pathOfProp(prop) {
    for (const [scope, list] of Object.entries(SCOPES)) {
        for (const [index, section] of work.config[list].entries()) {
            const position = section.properties.indexOf(prop);
            if (position >= 0) return `${scope}:${index}:${position}`;
        }
    }
    return null;
}

/** Runs a change that shifts sections or properties, keeping collapsed sections and the open editor on the same items. */
function rearrange(change) {
    const { config } = work;
    const collapsed = [...ui.collapsed].map(id => {
        const [scope, index] = id.split(':');
        return config[SCOPES[scope]][index];
    });
    const edited = ui.editing ? propAtPath(ui.editing) : null;
    change();
    ui.collapsed = new Set(collapsed.map(sectionIdOf).filter(Boolean));
    ui.editing = edited ? pathOfProp(edited) : null;
    structureEdited();
}

function propAtPath(path) {
    const [scope, section, prop] = path.split(':');
    return propAt({ scope, section: Number(section), prop: Number(prop) });
}

/** After re-rendering, keeps the keyboard on the arrow just used so it can be pressed again. */
function focusArrow(selector, action, direction) {
    const container = document.querySelector(selector);
    if (!container) return;
    const arrow = container.querySelector(`[data-action="${action}"][data-direction="${direction}"]`);
    const fallback = container.querySelector(`[data-action="${action}"]:not([disabled])`);
    const target = arrow && !arrow.disabled ? arrow : fallback;
    if (target) target.focus();
}

// ---------------------------------------------------------------- drag and drop

let drag = null;
let dropTarget = null;

function clearDropMarks() {
    document.querySelectorAll('.drop-before, .drop-after, .drop-inside').forEach(element => {
        element.classList.remove('drop-before', 'drop-after', 'drop-inside');
    });
    dropTarget = null;
}

function findDropTarget(event) {
    const section = event.target.closest('.section');
    if (!section) return null;
    const [scope, index] = section.dataset.sectionId.split(':');
    const before = element => {
        const box = element.getBoundingClientRect();
        return event.clientY < box.top + box.height / 2;
    };
    if (drag.type === 'section') {
        return scope === drag.scope && section !== drag.element
            ? { element: section, scope, section: Number(index), before: before(section) } : null;
    }
    const row = event.target.closest('[data-prop-row]');
    if (row === drag.element) return null;
    if (!row) return { element: section, scope, section: Number(index), inside: true };
    const { prop } = pathOf(row);
    return { element: row, scope, section: Number(index), prop, before: before(row) };
}

function dropTo(target) {
    if (drag.type === 'section') {
        const { scope, index } = drag;
        const toIndex = target.section + (target.before ? 0 : 1);
        rearrange(() => moveSection(work.config, scope, index, toIndex));
        return;
    }
    const toIndex = target.inside ? undefined : target.prop + (target.before ? 0 : 1);
    rearrange(() => moveProperty(work.config, drag.from, { scope: target.scope, section: target.section, index: toIndex }));
}

// ---------------------------------------------------------------- actions

function setAllSectionsOpen(open) {
    document.querySelectorAll('[data-section-id]').forEach(section => {
        section.open = open;
    });
}

async function checkService(key) {
    const input = [...document.querySelectorAll('[data-key]')].find(element => element.dataset.key === key);
    const status = [...document.querySelectorAll('[data-status-for]')].find(element => element.dataset.statusFor === key);
    if (!input || !status) return;
    const url = input.value.trim();
    const show = (state, text) => {
        status.hidden = false;
        status.dataset.state = state;
        status.textContent = text;
    };
    if (!url) {
        show('offline', 'Sin URL');
        return;
    }
    show('checking', 'Verificando…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        // Without CORS the status code is unreadable: a completed request only proves the server answered
        await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
        show('online', 'Responde');
    } catch (_) {
        show('offline', 'No responde');
    } finally {
        clearTimeout(timeout);
    }
}

const actions = {
    logout: async () => {
        if (!(await confirmDiscard())) return;
        window.removeEventListener('beforeunload', warnBeforeLeaving);
        session.end();
        window.location.href = '/login';
    },
    'new-config': async () => {
        if (!(await confirmDiscard())) return;
        const config = emptyConfig();
        addSection(config, 'General');
        openConfig(config, { dirty: true, structure: true });
    },
    import: () => $('file-input').click(),
    save: () => save(),
    'save-copy': () => save({ asCopy: true }),
    'edit-details': () => openDetails('details'),
    'close-config': async () => {
        if (await confirmDiscard()) closeConfig();
    },
    'delete-config': async () => {
        if (!work.id) {
            if (await confirmDiscard()) closeConfig();
            return;
        }
        const accepted = await ask({
            title: 'Eliminar configuración',
            message: `"${work.config.projectName}" se eliminará definitivamente.`,
            confirmLabel: 'Eliminar',
            danger: true
        });
        if (!accepted) return;
        try {
            await api(`/api/configs/${work.id}`, { method: 'DELETE' });
            closeConfig();
            await refreshCatalog();
            toast('Configuración eliminada');
        } catch (error) {
            toast(error.message, 'error');
        }
    },
    preview: () => {
        $('preview-title').textContent = `Vista previa - ${work.config.outputFileName}`;
        $('preview-content').textContent = generateProperties(work.config);
        $('preview-dialog').showModal();
    },
    'copy-preview': async () => {
        try {
            await navigator.clipboard.writeText($('preview-content').textContent);
            toast('Copiado al portapapeles');
        } catch (_) {
            toast('No se pudo copiar', 'error');
        }
    },
    download: () => {
        const pending = pendingFields(work.config);
        if (pending.length > 0) {
            revealField(pending[0].field);
            toast(`Faltan ${pending.length} propiedades por revisar antes de descargar`, 'error');
            return;
        }
        const { config } = work;
        downloadFile(config.outputFileName, generateProperties(config), 'text/plain');
        toast(`"${config.outputFileName}" descargado`);
    },
    'export-json': () => {
        const name = `${(work.config.projectName || 'configuracion').trim().replace(/\s+/g, '-')}.json`;
        downloadFile(name, JSON.stringify(serializeConfig(work.config), null, 2), 'application/json');
        toast(`Exportado como "${name}"`);
    },
    'check-all-services': async () => {
        const fields = fieldsOnScreen().filter(field => field.prop.checkService);
        if (fields.length === 0) {
            toast('Esta configuración no tiene servicios por verificar', 'info');
            return;
        }
        await Promise.all(fields.map(field => checkService(field.key)));
        toast('Verificación terminada', 'info');
    },
    'check-service': target => checkService(target.dataset.key),
    'toggle-password': target => {
        const input = target.closest('.input-group').querySelector('input');
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        target.setAttribute('aria-pressed', String(!showing));
    },
    'goto-section': target => {
        const section = $(target.dataset.target);
        if (!section) return;
        section.open = true;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    'goto-key': target => {
        const key = target.dataset.key;
        const field = [...allFields(work.config)].find(candidate => (
            candidate.prop.key === key && (candidate.domainId === null || candidate.domainId === ui.activeDomain)
        ));
        if (field) revealField(field);
    },
    'set-view': target => {
        ui.view = target.dataset.view;
        try {
            localStorage.setItem(VIEW_KEY, ui.view);
        } catch (_) {
            // The view still applies until the page is reloaded
        }
        renderAll();
    },
    'close-inspector': () => {
        ui.selectedKey = null;
        renderInspector();
    },
    'restore-value': target => {
        const field = rendered.fields.get(target.dataset.key);
        if (!field) return;
        restoreValue(work.config, field);
        markDirty();
        syncControl(field);
        scheduleStatus();
        toast('Valor restaurado', 'info');
    },
    'copy-to-domains': target => {
        const field = rendered.fields.get(target.dataset.key);
        if (!field) return;
        const fields = copyToAllDomains(work.config, field);
        markDirty();
        fields.forEach(syncControl);
        scheduleStatus();
        toast(`Valor copiado a los ${fields.length} dominios`);
    },
    'move-prop': target => {
        const from = pathOf(target);
        const direction = target.dataset.direction;
        const prop = propAt(from);
        const index = direction === 'up' ? from.prop - 1 : from.prop + 2;
        rearrange(() => moveProperty(work.config, from, { scope: from.scope, section: from.section, index }));
        focusArrow(`.prop[data-path="${pathOfProp(prop)}"]`, 'move-prop', direction);
    },
    'move-section': target => {
        const [scope, value] = target.closest('[data-section]').dataset.section.split(':');
        const from = Number(value);
        const direction = target.dataset.direction;
        const section = work.config[SCOPES[scope]][from];
        rearrange(() => moveSection(work.config, scope, from, direction === 'up' ? from - 1 : from + 2));
        focusArrow(`.section__structure[data-section="${sectionIdOf(section)}"]`, 'move-section', direction);
    },
    'sort-section': target => {
        const [scope, index] = target.dataset.section.split(':');
        rearrange(() => sortSection(work.config, scope, Number(index)));
    },
    'next-pending': () => {
        const [first] = pendingFields(work.config);
        if (first) revealField(first.field);
    },
    'confirm-section': target => {
        for (const field of fieldsInSection(target.dataset.section)) {
            if (needsConfirmation(field.prop, getValue(work.config, field))) work.config.confirmed.add(field.key);
        }
        markDirty();
        document.querySelectorAll('[data-confirm-key]').forEach(box => {
            box.checked = work.config.confirmed.has(box.dataset.confirmKey);
        });
        refreshStatus();
    },
    'expand-all': () => {
        ui.collapsed.clear();
        setAllSectionsOpen(true);
    },
    'collapse-all': () => setAllSectionsOpen(false),
    'switch-domain': target => switchDomain(Number(target.dataset.domain)),
    'add-domain': () => {
        const next = work.config.domainCount + 1;
        if (next > MAX_DOMAINS) {
            toast(`El máximo es de ${MAX_DOMAINS} dominios`, 'error');
            return;
        }
        ui.activeDomain = changeDomainCount(next);
        switchDomain(ui.activeDomain);
    },
    'remove-domain': async () => {
        const last = work.config.domainCount;
        const accepted = await ask({
            title: `Quitar el dominio ${last}`,
            message: 'Se perderán los valores configurados para ese dominio.',
            confirmLabel: 'Quitar',
            danger: true
        });
        if (accepted) changeDomainCount(last - 1);
    },
    'close-dialog': target => target.closest('dialog').close(),
    'add-section': () => {
        addSection(work.config);
        structureEdited();
    },
    'delete-section': async target => {
        const [scope, index] = target.dataset.section.split(':');
        const section = work.config[SCOPES[scope]][index];
        const accepted = section.properties.length === 0 || await ask({
            title: 'Eliminar categoría',
            message: `"${section.category}" y sus ${section.properties.length} propiedades se eliminarán.`,
            confirmLabel: 'Eliminar',
            danger: true
        });
        if (!accepted) return;
        rearrange(() => removeSection(work.config, scope, Number(index)));
    },
    'add-prop': target => {
        const [scope, index] = target.dataset.section.split(':');
        addProperty(work.config, scope, Number(index));
        ui.editing = `${scope}:${index}:${work.config[SCOPES[scope]][index].properties.length - 1}`;
        ui.collapsed.delete(`${scope}:${index}`);
        structureEdited();
        document.querySelector('[data-editor] [data-edit="key"]').focus();
    },
    'edit-prop': target => {
        ui.editing = ui.editing === target.dataset.path ? null : target.dataset.path;
        renderAll();
    },
    'delete-prop': target => {
        const { scope, section, prop } = pathOf(target);
        rearrange(() => removeProperty(work.config, scope, section, prop));
    },
    'add-option': target => {
        const prop = propAt(pathOf(target));
        prop.options = [...(prop.options || []), { value: '', label: '' }];
        structureEdited();
    },
    'remove-option': target => {
        propAt(pathOf(target)).options.splice(Number(target.dataset.option), 1);
        structureEdited();
    }
};

function warnBeforeLeaving(event) {
    if (work && work.dirty) {
        event.preventDefault();
        event.returnValue = '';
    }
}

// ---------------------------------------------------------------- wiring

document.addEventListener('click', event => {
    const openMenu = document.querySelector('details.menu[open]');
    if (openMenu && !event.target.closest('summary')) openMenu.open = false;

    const target = event.target.closest('[data-action]');
    if (target && actions[target.dataset.action]) actions[target.dataset.action](target, event);
});

$('workspace').addEventListener('input', event => {
    if (event.target.dataset.key) handleFieldInput(event.target);
});

$('workspace').addEventListener('focusin', event => {
    if (!isCompact()) return;
    const key = event.target.dataset.key || event.target.dataset.confirmKey;
    if (key && !event.target.dataset.action) selectField(key);
});

$('workspace').addEventListener('click', event => {
    const heading = isCompact() && event.target.closest('.grid__label');
    const row = heading && heading.closest('.grid__row');
    if (row && row.dataset.rowKey) selectField(row.dataset.rowKey);
});

$('workspace').addEventListener('keydown', event => {
    if (!isCompact() || !event.target.dataset.key || event.target.matches('select, textarea')) return;
    const step = { ArrowDown: 1, Enter: 1, ArrowUp: -1 }[event.key];
    if (step && moveInGrid(event.target, step)) event.preventDefault();
});

$('workspace').addEventListener('dragstart', event => {
    const handle = event.target.closest('[data-drag]');
    if (!handle) return;
    if (handle.dataset.drag === 'prop') {
        drag = { type: 'prop', from: pathOf(handle), element: handle.closest('[data-prop-row]') };
    } else {
        const [scope, index] = handle.closest('[data-section]').dataset.section.split(':');
        drag = { type: 'section', scope, index: Number(index), element: handle.closest('.section') };
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', '');
    event.dataTransfer.setDragImage(drag.element, 16, 16);
    drag.element.classList.add('is-dragging');
});

$('workspace').addEventListener('dragover', event => {
    if (!drag) return;
    clearDropMarks();
    const target = findDropTarget(event);
    if (!target) return;
    event.preventDefault();
    dropTarget = target;
    const mark = target.inside ? 'drop-inside' : (target.before ? 'drop-before' : 'drop-after');
    target.element.classList.add(mark);
});

$('workspace').addEventListener('drop', event => {
    if (!drag || !dropTarget) return;
    event.preventDefault();
    const target = dropTarget;
    clearDropMarks();
    dropTo(target);
    // Re-rendering removed the dragged element, so its dragend never reaches this listener
    drag = null;
});

$('workspace').addEventListener('dragend', () => {
    if (drag) drag.element.classList.remove('is-dragging');
    drag = null;
    clearDropMarks();
});

$('workspace').addEventListener('change', event => {
    const { target } = event;
    if (target.dataset.key) handleFieldChange(target);
    else if (target.dataset.edit) applyPropertyEdit(target);
    else if (target.dataset.sectionEdit) applySectionEdit(target);
    else if (target.dataset.confirmKey) {
        if (target.checked) work.config.confirmed.add(target.dataset.confirmKey);
        else work.config.confirmed.delete(target.dataset.confirmKey);
        markDirty();
        refreshStatus();
    }
});

// `toggle` does not bubble, so it is observed during capture
$('workspace').addEventListener('toggle', event => {
    const id = event.target.dataset && event.target.dataset.sectionId;
    if (!id || isFiltering()) return;
    if (event.target.open) ui.collapsed.delete(id);
    else ui.collapsed.add(id);
}, true);

$('structure-toggle').addEventListener('change', event => {
    setStructureMode(event.target.checked);
    renderAll();
});
$('search').addEventListener('input', debounce(applyFilters, 120));
$('only-pending').addEventListener('change', applyFilters);
$('only-modified').addEventListener('change', applyFilters);
$('detail-category').addEventListener('change', syncNewCategoryField);
$('details-form').addEventListener('submit', submitDetails);

$('file-input').addEventListener('change', event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) importFile(file);
});

$('config-select').addEventListener('change', async event => {
    const id = event.target.value;
    const previous = work && work.id ? String(work.id) : '';
    if (!id || !(await confirmDiscard())) {
        event.target.value = previous;
        return;
    }
    try {
        await loadFromServer(id);
    } catch (error) {
        event.target.value = previous;
        toast(error instanceof SyntaxError ? 'El contenido guardado no es válido' : error.message, 'error');
    }
});

document.addEventListener('dragover', event => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    $('dropzone').classList.add('is-dragging');
});
document.addEventListener('dragleave', event => {
    if (!event.relatedTarget) $('dropzone').classList.remove('is-dragging');
});
document.addEventListener('drop', event => {
    event.preventDefault();
    $('dropzone').classList.remove('is-dragging');
    const [file] = event.dataTransfer.files;
    if (file) importFile(file);
});

document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && work) {
        event.preventDefault();
        save();
    }
});

window.addEventListener('beforeunload', warnBeforeLeaving);

async function start() {
    if (!session.token) {
        window.location.href = '/login';
        return;
    }
    try {
        const { username } = await api('/api/auth/validate');
        $('username').textContent = username;
        await refreshCatalog();
    } catch (error) {
        if (error.status !== 401) toast(error.message, 'error');
    }
}

start();
