// HTML for the panel. Every value coming from a configuration file goes through esc(); events are handled in panel.js
// through data-* attributes, so nothing from the file ever ends up inside executable code.

import {
    allKeys, domainIds, fieldsOfProperty, getValue, isChecked, isVisible, needsConfirmation, optionsOf, originalValue,
    PRESET_LISTS, PROPERTY_TYPES, SCOPES
} from './model.js';
import { esc, icon } from './ui.js';

const selectOptions = (options, selected) => options.map(option => (
    `<option value="${esc(option.value)}"${option.value === selected ? ' selected' : ''}${option.disabled ? ' disabled' : ''}>`
    + `${esc(option.label)}${option.disabled ? ' (deshabilitado)' : ''}</option>`
)).join('');

/** The compact layout only applies while filling in values; editing the structure needs the room of the guided one. */
export function isCompactView(ui) {
    return ui.view === 'compact' && !ui.structure;
}

export function dynamicOptionsHtml(config, field) {
    return selectOptions(optionsOf(config, field.prop, field.domainId), getValue(config, field));
}

/** Document for the sandboxed preview frame: no scripts run and it has no access to this page. */
export function htmlPreviewDocument(html) {
    return html.trim() || '<p style="color:#6b7280;font-style:italic;font-family:sans-serif">Sin contenido</p>';
}

// ---------------------------------------------------------------- field controls

function controlHtml(config, field, id, compact = false) {
    const { prop, key } = field;
    const value = getValue(config, field);
    // In the compact grid a domain column has no visible label of its own
    const name = compact ? ` aria-label="${esc(prop.label)}${field.domainId === null ? '' : `, dominio ${field.domainId}`}"` : '';
    const data = `id="${id}" data-key="${esc(key)}"${name}`;

    switch (prop.type) {
        case 'boolean':
            return `<label class="switch">
                <input type="checkbox" ${data}${isChecked(value) ? ' checked' : ''}>
                <span class="switch__track" aria-hidden="true"></span>
                <span class="switch__label">${isChecked(value) ? 'Habilitado' : 'Deshabilitado'}</span>
            </label>`;
        case 'select':
            return `<select class="input" ${data}>${dynamicOptionsHtml(config, field)}</select>`;
        case 'password':
            return `<div class="input-group">
                <input type="password" class="input" autocomplete="off" ${data} value="${esc(value)}">
                <div class="input-action"><button type="button" class="btn btn--icon btn--ghost" data-action="toggle-password" aria-pressed="false" aria-label="Mostrar u ocultar">${icon('eye')}</button></div>
            </div>`;
        case 'number':
            return `<input type="number" class="input input--short" ${data} value="${esc(value)}"`
                + `${prop.min !== undefined && prop.min !== '' ? ` min="${esc(prop.min)}"` : ''}`
                + `${prop.max !== undefined && prop.max !== '' ? ` max="${esc(prop.max)}"` : ''}>`;
        case 'html':
            if (compact) return `<textarea class="input input--code" rows="1" ${data}>${esc(value)}</textarea>`;
            return `<textarea class="input input--code" rows="6" ${data}>${esc(value)}</textarea>${htmlPreviewHtml(key, value)}`;
        case 'url':
            return `<input type="text" inputmode="url" spellcheck="false" class="input" placeholder="https://" ${data} value="${esc(value)}">`;
        default:
            return `<input type="text" class="input" ${data} value="${esc(value)}">`;
    }
}

function htmlPreviewHtml(key, value) {
    return `<details class="html-preview" open>
        <summary>Vista previa</summary>
        <iframe sandbox="" title="Vista previa del HTML" data-preview-for="${esc(key)}" srcdoc="${esc(htmlPreviewDocument(value))}"></iframe>
    </details>`;
}

function confirmHtml(config, field) {
    const value = getValue(config, field);
    const needed = needsConfirmation(field.prop, value);
    const canAppear = field.prop.needsConfirmation && (field.prop.type !== 'number' || field.prop.confirmOnZero);
    if (!canAppear) return '';
    return `<label class="check confirm"${needed ? '' : ' hidden'} title="Marca para confirmar que revisaste este valor">
        <input type="checkbox" data-confirm-key="${esc(field.key)}"${config.confirmed.has(field.key) ? ' checked' : ''}> <span class="confirm__text">Confirmado</span>
    </label>`;
}

function serviceCheckHtml(field) {
    if (!field.prop.checkService) return '';
    return `<div class="service">
        <button type="button" class="btn btn--small" data-action="check-service" data-key="${esc(field.key)}">${icon('check')}<span>Verificar</span></button>
        <span class="service__status" data-status-for="${esc(field.key)}" hidden></span>
    </div>`;
}

/** "Modified / restore" and "copy to all domains". What it restores to is not revealed for passwords. */
function valueToolsHtml(config, field) {
    const original = originalValue(field);
    const restoreHint = field.prop.type === 'password' ? 'Volver al valor original'
        : `Volver al valor original: ${original === '' ? '(vacío)' : original}`;
    const canCopy = field.domainId !== null && config.domainCount > 1 && !field.prop.autoFillDomainId;
    return `<div class="value-tools">
        <span class="value-tools__modified" data-modified-for="${esc(field.key)}" hidden>
            <i class="modified-dot" aria-hidden="true"></i>Modificado
            <button type="button" class="link" data-action="restore-value" data-key="${esc(field.key)}" title="${esc(restoreHint)}">Restaurar</button>
        </span>
        ${canCopy ? `<button type="button" class="link" data-action="copy-to-domains" data-key="${esc(field.key)}">Copiar a todos los dominios</button>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- property rows

function badgesHtml(prop) {
    const badges = [];
    if (prop.required) badges.push('<span class="badge badge--danger">Requerido</span>');
    if (prop.repeatBasedOn && prop.repeatBasedOn.key) badges.push('<span class="badge">Repetible</span>');
    if (prop.dynamicOptionsFrom && prop.dynamicOptionsFrom.key) badges.push('<span class="badge">Opciones dinámicas</span>');
    return badges.join('');
}

function propertyHtml(ctx, prop, scope, sectionIndex, propIndex, domainId) {
    const { config, ui } = ctx;
    const path = `${scope}:${sectionIndex}:${propIndex}`;
    const fields = fieldsOfProperty(config, prop, domainId);
    const isRepeat = Boolean(prop.repeatBasedOn && prop.repeatBasedOn.key);
    const displayKey = isRepeat || domainId === null ? prop.key : fields[0].key;
    const description = prop.description
        ? `<p class="prop__description">${esc(prop.description)}</p>`
        : (ui.structure ? '<p class="prop__description prop__description--missing">Sin descripción: agrégala para guiar a quien configure este archivo.</p>' : '');

    const controls = fields.map(field => {
        const id = `field-${ctx.nextId++}`;
        ctx.fields.set(field.key, field);
        if (isRepeat) {
            return `<div class="repeat-item">
                <label for="${id}">${esc(prop.repeatBasedOn.label || 'Item')} ${field.repeatIndex}</label>
                ${controlHtml(config, field, id)}${confirmHtml(config, field)}${valueToolsHtml(config, field)}
            </div>`;
        }
        return `<div class="prop__control" data-control-for="${esc(field.key)}">
            ${controlHtml(config, field, id)}
            ${confirmHtml(config, field)}
            ${serviceCheckHtml(field)}
            ${valueToolsHtml(config, field)}
            <p class="prop__issue" data-issue-for="${esc(field.key)}" hidden></p>
        </div>`;
    }).join('');

    const firstId = `field-${ctx.nextId - fields.length}`;
    const label = !isRepeat && fields.length
        ? `<label class="prop__label" for="${firstId}">${esc(prop.label)}</label>`
        : `<span class="prop__label">${esc(prop.label)}</span>`;
    const emptyRepeat = isRepeat && fields.length === 0
        ? `<p class="form-hint">Indica una cantidad mayor a 0 en <code>${esc(prop.repeatBasedOn.key)}</code>.</p>` : '';
    const hidden = isVisible(config, prop, domainId) || ui.structure ? '' : ' hidden';
    const search = `${prop.key} ${prop.label} ${prop.description || ''}`.toLowerCase();

    const siblings = config[SCOPES[scope]][sectionIndex].properties.length;
    const structure = ui.structure ? `<div class="prop__tools">
        <span class="drag-handle" draggable="true" data-drag="prop" title="Arrastra para reordenar">${icon('grip')}</span>
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="move-prop" data-direction="up"${propIndex === 0 ? ' disabled' : ''} title="Subir" aria-label="Subir propiedad">${icon('arrow-up')}</button>
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="move-prop" data-direction="down"${propIndex === siblings - 1 ? ' disabled' : ''} title="Bajar" aria-label="Bajar propiedad">${icon('arrow-down')}</button>
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="edit-prop" data-path="${path}" aria-expanded="${ui.editing === path}" title="Editar propiedad" aria-label="Editar propiedad">${icon('edit')}</button>
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="delete-prop" data-path="${path}" title="Eliminar propiedad" aria-label="Eliminar propiedad">${icon('trash')}</button>
    </div>` : '';

    return `<article class="prop${isRepeat ? ' prop--repeat' : ''}" data-prop-row data-path="${path}" data-domain="${domainId ?? ''}" data-search="${esc(search)}"${hidden}>
        <div class="prop__info">
            <div class="prop__heading">${label}${badgesHtml(prop)}</div>
            <code class="prop__key">${esc(displayKey)}</code>
            ${description}
        </div>
        <div class="prop__controls${isRepeat ? ' prop__controls--repeat' : ''}">${controls}${emptyRepeat}</div>
        ${structure}
        ${ui.editing === path ? propertyEditorHtml(ctx, prop, scope, sectionIndex, propIndex) : ''}
    </article>`;
}

// ---------------------------------------------------------------- compact grid
// Built from rows with content-visibility instead of a <table>: table rows cannot skip painting, and a wide grid with
// thousands of inputs inside a scroller took over a second per keystroke to composite. ARIA roles keep the semantics.

function gridCellHtml(ctx, field, id) {
    const { config } = ctx;
    return `<div role="cell" class="grid__cell"${field.domainId === null ? '' : ` data-cell-domain="${field.domainId}"`}>
        <div class="grid__value">
            ${controlHtml(config, field, id, true)}
            <i class="modified-dot" data-modified-for="${esc(field.key)}" title="Modificado" hidden></i>
            ${confirmHtml(config, field)}
            ${serviceCheckHtml(field)}
        </div>
        <p class="prop__issue" data-issue-for="${esc(field.key)}" hidden></p>
    </div>`;
}

function gridRowsHtml(ctx, prop, scope, sectionIndex, propIndex, ids) {
    const { config } = ctx;
    const path = `${scope}:${sectionIndex}:${propIndex}`;
    const perColumn = ids.map(id => fieldsOfProperty(config, prop, id));
    const rowCount = Math.max(...perColumn.map(fields => fields.length));
    const isRepeat = Boolean(prop.repeatBasedOn && prop.repeatBasedOn.key);
    const search = esc(`${prop.key} ${prop.label} ${prop.description || ''}`.toLowerCase());
    const rowData = `data-prop-row data-path="${path}" data-domain="${scope === 'domain' ? 'all' : ''}" data-search="${search}"`;
    const heading = (labelText, target, keyText) => `<div role="rowheader" class="grid__label" title="${esc(prop.description)}">
        <span class="grid__heading">
            ${target ? `<label class="prop__label" for="${target}">${esc(labelText)}</label>` : `<span class="prop__label">${esc(labelText)}</span>`}
            ${badgesHtml(prop)}
            <span class="badge badge--diff">Difiere</span>
        </span>
        <code class="prop__key">${esc(keyText)}</code>
    </div>`;

    if (rowCount === 0) {
        return `<div role="row" class="grid__row" ${rowData}>
            ${heading(prop.label, null, prop.key)}
            <div role="cell" class="grid__cell grid__cell--wide"><p class="form-hint">Indica una cantidad mayor a 0 en <code>${esc(prop.repeatBasedOn.key)}</code>.</p></div>
        </div>`;
    }

    const rows = [];
    for (let row = 0; row < rowCount; row++) {
        const firstId = `field-${ctx.nextId}`;
        const cells = perColumn.map(fields => {
            const field = fields[row];
            if (!field) return '<div role="cell" class="grid__cell is-unavailable"></div>';
            const id = `field-${ctx.nextId++}`;
            ctx.fields.set(field.key, field);
            return gridCellHtml(ctx, field, id);
        }).join('');
        const first = perColumn.map(fields => fields[row]).find(Boolean);
        const labelText = isRepeat ? `${prop.repeatBasedOn.label || prop.label} ${row + 1}` : prop.label;
        rows.push(`<div role="row" class="grid__row" ${rowData} data-row-key="${esc(first.key)}">
            ${heading(labelText, firstId, scope === 'domain' && !isRepeat ? prop.key : first.key)}
            ${cells}
        </div>`);
    }
    return rows.join('');
}

function gridHtml(ctx, section, scope, sectionIndex) {
    if (section.properties.length === 0) return '';
    const ids = scope === 'domain' ? domainIds(ctx.config) : [null];
    const columns = ids.map(id => (id === null ? '<div role="columnheader" class="grid__column">Valor</div>'
        : `<div role="columnheader" class="grid__column">Dominio ${id}<span class="tab__pending" data-domain-pending="${id}" hidden></span></div>`)).join('');
    const rows = section.properties
        .map((prop, propIndex) => gridRowsHtml(ctx, prop, scope, sectionIndex, propIndex, ids))
        .join('');
    return `<div class="grid-scroll">
        <div role="table" aria-label="${esc(section.category)}" class="grid" style="--columns:${ids.length}">
            <div role="row" class="grid__head"><div role="columnheader" class="grid__label">Propiedad</div>${columns}</div>
            ${rows}
        </div>
    </div>`;
}

/** Fixed panel of the compact view: the comment of the selected property, so reading it never moves the rows. */
export function inspectorHtml(config, field) {
    const { prop, key } = field;
    return `<div class="inspector__text">
            <div class="inspector__title"><strong>${esc(prop.label)}</strong> <code class="prop__key">${esc(key)}</code> ${badgesHtml(prop)}</div>
            ${prop.description
                ? `<p class="prop__description">${esc(prop.description)}</p>`
                : '<p class="prop__description prop__description--missing">Esta propiedad no tiene descripción.</p>'}
            ${prop.type === 'html' ? htmlPreviewHtml(key, getValue(config, field)) : ''}
        </div>
        <div class="inspector__actions">
            ${valueToolsHtml(config, field)}
            <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="close-inspector" aria-label="Cerrar panel" title="Cerrar">${icon('close')}</button>
        </div>`;
}

// ---------------------------------------------------------------- structure editor

const editField = (label, control, wide = false) => (
    `<div class="form-field${wide ? ' form-field--wide' : ''}"><label>${esc(label)}${control}</label></div>`
);
const editInput = (edit, value, extra = '') => (
    `<input class="input input--small" data-edit="${edit}" value="${esc(value ?? '')}" ${extra}>`
);
const editCheck = (edit, label, checked, title = '') => (
    `<label class="check"${title ? ` title="${esc(title)}"` : ''}><input type="checkbox" data-edit="${edit}"${checked ? ' checked' : ''}> ${esc(label)}</label>`
);
const keyInput = (edit, value) => editInput(edit, value, 'list="all-keys" placeholder="Clave de otra propiedad" spellcheck="false"');

function sectionChoices(config, scope, sectionIndex) {
    return Object.keys(SCOPES).flatMap(candidate => config[SCOPES[candidate]].map((section, index) => (
        `<option value="${candidate}:${index}"${candidate === scope && index === sectionIndex ? ' selected' : ''}>`
        + `${esc(section.category)} (${candidate === 'domain' ? 'por dominio' : 'global'})</option>`
    ))).join('');
}

function optionsEditorHtml(prop) {
    const rows = (prop.options || []).map((option, index) => `<div class="option-row">
        <input class="input input--small" placeholder="Valor" data-edit="option-value" data-option="${index}" value="${esc(option.value)}">
        <input class="input input--small" placeholder="Etiqueta" data-edit="option-label" data-option="${index}" value="${esc(option.label)}">
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="remove-option" data-option="${index}" aria-label="Quitar opción">${icon('close')}</button>
    </div>`).join('');
    const presets = Object.entries(PRESET_LISTS)
        .map(([name, list]) => `<option value="${name}">${esc(list.label)}</option>`).join('');
    return `<fieldset class="editor__group">
        <legend>Opciones de la lista</legend>
        ${rows || '<p class="form-hint">Todavía no hay opciones.</p>'}
        <div class="editor__row">
            <button type="button" class="btn btn--small" data-action="add-option">${icon('plus')}<span>Agregar opción</span></button>
            <select class="input input--small input--auto" data-edit="preset" aria-label="Usar una lista predefinida">
                <option value="">Usar lista predefinida…</option>${presets}
            </select>
        </div>
    </fieldset>`;
}

function propertyEditorHtml(ctx, prop, scope, sectionIndex, propIndex) {
    const { config } = ctx;
    const missingDomainKey = scope === 'domain' && !prop.key.includes('{N}');
    return `<div class="editor" data-editor data-path="${scope}:${sectionIndex}:${propIndex}">
        ${missingDomainKey ? '<p class="notice notice--warning">La clave debe incluir {N}; sin él todos los dominios usarían la misma clave.</p>' : ''}
        <div class="form-grid">
            ${editField('Clave', editInput('key', prop.key, 'spellcheck="false"'))}
            ${editField('Etiqueta', editInput('label', prop.label))}
            ${editField('Tipo', `<select class="input input--small" data-edit="type">${selectOptions(PROPERTY_TYPES, prop.type)}</select>`)}
            ${prop.repeatBasedOn ? '' : editField('Valor por defecto', editInput('default', Array.isArray(prop.default) ? '' : prop.default))}
            ${editField('Categoría', `<select class="input input--small" data-edit="move">${sectionChoices(config, scope, sectionIndex)}</select>`)}
            ${prop.type === 'boolean' ? editField('Formato en el archivo', `<select class="input input--small" data-edit="booleanType">
                ${selectOptions([{ value: 'string', label: 'true / false' }, { value: 'number', label: '1 / 0' }], prop.booleanType)}
            </select>`) : ''}
            ${prop.type === 'number' ? editField('Mínimo', editInput('min', prop.min, 'type="number"')) + editField('Máximo', editInput('max', prop.max, 'type="number"')) : ''}
        </div>
        ${editField('Descripción (se muestra como guía y se escribe como comentario en el archivo)',
            `<textarea class="input input--small" rows="3" data-edit="description" placeholder="Explica para qué sirve esta propiedad y qué valores acepta">${esc(prop.description)}</textarea>`, true)}
        <div class="editor__row">
            ${editCheck('required', 'Requerido', prop.required)}
            ${editCheck('needsConfirmation', 'Pedir confirmación', prop.needsConfirmation)}
            ${prop.type === 'number' ? editCheck('confirmOnZero', 'Confirmar solo si es 0', prop.confirmOnZero) : ''}
            ${prop.type === 'url' || prop.checkService ? editCheck('checkService', 'Verificar servicio', prop.checkService) : ''}
            ${editCheck('repeat', 'Repetible', prop.repeatBasedOn, 'Repite el campo N veces según otra propiedad numérica')}
            ${prop.type === 'select' ? editCheck('dynamic', 'Opciones dinámicas', prop.dynamicOptionsFrom, 'Toma las opciones de los valores separados por coma de otra propiedad') : ''}
        </div>
        <fieldset class="editor__group">
            <legend>Mostrar solo si…</legend>
            <div class="form-grid">
                ${editField('Depende de', keyInput('dependsOn.key', prop.dependsOn && prop.dependsOn.key))}
                ${editField('Tiene el valor', editInput('dependsOn.value', prop.dependsOn && prop.dependsOn.value, prop.dependsOn ? '' : 'disabled'))}
            </div>
        </fieldset>
        ${prop.repeatBasedOn ? `<fieldset class="editor__group">
            <legend>Repetición</legend>
            <div class="form-grid">
                ${editField('Se repite según', keyInput('repeatBasedOn.key', prop.repeatBasedOn.key))}
                ${editField('Marcador en la clave', editInput('repeatBasedOn.placeholder', prop.repeatBasedOn.placeholder))}
                ${editField('Etiqueta de cada elemento', editInput('repeatBasedOn.label', prop.repeatBasedOn.label))}
            </div>
        </fieldset>` : ''}
        ${prop.dynamicOptionsFrom ? `<fieldset class="editor__group">
            <legend>Opciones dinámicas</legend>
            <div class="form-grid">
                ${editField('Tomar opciones de', keyInput('dynamicOptionsFrom.key', prop.dynamicOptionsFrom.key))}
                ${editField('Separador', editInput('dynamicOptionsFrom.separator', prop.dynamicOptionsFrom.separator))}
            </div>
        </fieldset>` : ''}
        ${prop.type === 'select' && !prop.dynamicOptionsFrom ? optionsEditorHtml(prop) : ''}
    </div>`;
}

// ---------------------------------------------------------------- sections

function hiddenNoticeHtml(section) {
    const dependencies = new Map();
    for (const prop of section.properties) {
        if (!prop.dependsOn || !prop.dependsOn.key) continue;
        if (!dependencies.has(prop.dependsOn.key)) dependencies.set(prop.dependsOn.key, new Set());
        dependencies.get(prop.dependsOn.key).add(prop.dependsOn.value);
    }
    if (dependencies.size === 0) return '';
    const items = [...dependencies].map(([key, values]) => {
        const expected = [...values].map(value => `"${esc(value)}"`).join(' o ');
        return `<li><button type="button" class="link" data-action="goto-key" data-key="${esc(key)}">${esc(key)}</button> debe ser ${expected}</li>`;
    }).join('');
    return `<div class="notice notice--warning" data-hidden-notice hidden>
        <strong>Las opciones de esta categoría están ocultas.</strong> Para verlas, cambia:
        <ul>${items}</ul>
    </div>`;
}

function sectionHtml(ctx, section, scope, sectionIndex, domainId) {
    const { ui, config } = ctx;
    const id = `${scope}:${sectionIndex}`;
    const rows = isCompactView(ui)
        ? gridHtml(ctx, section, scope, sectionIndex)
        : section.properties
            .map((prop, propIndex) => propertyHtml(ctx, prop, scope, sectionIndex, propIndex, domainId))
            .join('');
    const sectionCount = config[SCOPES[scope]].length;
    const empty = section.properties.length === 0
        ? '<p class="section__empty">Esta categoría aún no tiene propiedades.</p>' : '';
    const structure = ui.structure ? `<div class="section__structure" data-section="${id}">
        <span class="drag-handle" draggable="true" data-drag="section" title="Arrastra para reordenar la categoría">${icon('grip')}</span>
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="move-section" data-direction="up"${sectionIndex === 0 ? ' disabled' : ''} title="Subir categoría" aria-label="Subir categoría">${icon('arrow-up')}</button>
        <button type="button" class="btn btn--icon btn--ghost btn--small" data-action="move-section" data-direction="down"${sectionIndex === sectionCount - 1 ? ' disabled' : ''} title="Bajar categoría" aria-label="Bajar categoría">${icon('arrow-down')}</button>
        <label class="form-field form-field--inline">Nombre <input class="input input--small" data-section-edit="title" value="${esc(section.category)}"></label>
        <label class="check"><input type="checkbox" data-section-edit="scope"${scope === 'domain' ? ' checked' : ''}> Se repite por dominio</label>
        <div class="toolbar__spacer"></div>
        <button type="button" class="btn btn--small btn--ghost" data-action="sort-section" data-section="${id}" title="Ordena las propiedades de esta categoría por su clave">${icon('sort')}<span>Ordenar A-Z</span></button>
        <button type="button" class="btn btn--small" data-action="add-prop" data-section="${id}">${icon('plus')}<span>Agregar propiedad</span></button>
        <button type="button" class="btn btn--small btn--ghost" data-action="delete-section" data-section="${id}">${icon('trash')}<span>Eliminar categoría</span></button>
    </div>` : '';

    return `<details class="section" id="section-${scope}-${sectionIndex}" data-section-id="${id}"${ui.collapsed.has(id) ? '' : ' open'}>
        <summary class="section__header">
            ${icon('chevron', 'section__chevron')}
            <h3>${esc(section.category)}</h3>
            <span class="section__count" data-section-count></span>
        </summary>
        <div class="section__body">
            ${structure}
            <div class="section__tools" data-section-tools hidden>
                <button type="button" class="btn btn--small btn--ghost" data-action="confirm-section" data-section="${id}">${icon('check')}<span>Confirmar todo</span></button>
            </div>
            ${rows}${empty}
            ${hiddenNoticeHtml(section)}
        </div>
    </details>`;
}

/** Fills `container` with the sections of a scope. Rendered in one assignment so the browser only parses once. */
export function renderSections(ctx, container, scope, domainId = null) {
    container.innerHTML = ctx.config[SCOPES[scope]]
        .map((section, index) => sectionHtml(ctx, section, scope, index, domainId))
        .join('');
}

export function domainTabsHtml(ids, activeId) {
    return ids.map(id => `<button type="button" class="tab" role="tab" aria-selected="${id === activeId}" data-action="switch-domain" data-domain="${id}">
        Dominio ${id}<span class="tab__pending" data-domain-pending="${id}" hidden></span>
    </button>`).join('');
}

export function sidebarHtml(config, activeDomain, compact = false) {
    const link = (scope, section, index) => `<button type="button" class="nav-item" data-action="goto-section" data-target="section-${scope}-${index}" data-nav="${scope}:${index}">
        <span>${esc(section.category)}</span><span class="nav-item__count" data-nav-count hidden></span>
    </button>`;
    const globals = config.globalProperties.map((section, index) => link('global', section, index)).join('');
    const domains = config.domainProperties.map((section, index) => link('domain', section, index)).join('');
    return `<div class="progress">
            <div class="progress__label"><span id="progress-text"></span></div>
            <div class="progress__bar" role="progressbar" aria-labelledby="progress-text" id="progress-bar"><i id="progress-fill"></i></div>
            <button type="button" class="link" id="next-pending" data-action="next-pending" hidden>Ir a lo siguiente pendiente</button>
        </div>
        <nav aria-label="Categorías">
            ${globals ? `<h2>Propiedades globales</h2>${globals}` : ''}
            ${domains ? `<h2>${compact ? 'Por dominio' : `Dominio ${activeDomain}`}</h2>${domains}` : ''}
        </nav>`;
}

export function allKeysHtml(config) {
    return allKeys(config).map(key => `<option value="${esc(key)}"></option>`).join('');
}
