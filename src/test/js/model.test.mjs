// Run with: node --test src/test/js
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    addProperty, addSection, allFields, applyDomainPattern, booleanValue, copyToAllDomains, emptyConfig, fieldIssue,
    fieldsOfProperty, getValue, isModified, isVisible, matchDomainKey, moveProperty, moveSection, normalizeConfig,
    originalValue, pendingFields, renameProperty, restoreValue, serializeConfig, setDomainCount, setValue, sortSection,
    toggleSectionScope
} from '../../main/resources/static/js/model.js';
import {
    configFromProperties, escapeKey, escapeValue, generateProperties, parseProperties
} from '../../main/resources/static/js/properties.js';

const only = (config, key) => {
    for (const list of [config.globalProperties, config.domainProperties]) {
        for (const section of list) {
            const prop = section.properties.find(candidate => candidate.key === key);
            if (prop) return prop;
        }
    }
    throw new Error(`no property ${key}`);
};
const toKeyValues = config => Object.fromEntries([...allFields(config)].map(f => [f.key, getValue(config, f)]));
const field = (config, key, domainId = null) => fieldsOfProperty(config, only(config, key), domainId)[0];

test('a comment above a property becomes its description', () => {
    const { entries } = parseProperties('# URL del servicio\n# usada para firmar\nservice.url=http://a\nother=1\n');
    assert.equal(entries[0].description, 'URL del servicio\nusada para firmar');
    assert.equal(entries[1].description, '');
});

test('banners and short standalone comments open sections', () => {
    const { entries } = parseProperties([
        '# ------', '# Base de datos', '# ------', '# Cadena de conexión', 'db.url=x',
        '', '# Correo', '', 'mail.host=y'
    ].join('\n'));
    assert.equal(entries[0].section, 'Base de datos');
    assert.equal(entries[0].description, 'Cadena de conexión');
    assert.equal(entries[1].section, 'Correo');
});

test('a long standalone comment is kept for the next property', () => {
    const long = 'Este comentario es demasiado largo para ser el título de una sección dentro del archivo';
    const { entries } = parseProperties(`a=1\n\n# ${long}\n\nb=2\n`);
    assert.equal(entries[1].description, long);
});

test('commented-out properties are not mistaken for sections or explanations', () => {
    const { entries } = parseProperties('a=1\n\n# old.key=5\n\nb=2\n');
    assert.equal(entries[1].section, null);
    assert.equal(entries[1].description, '');
});

test('the parser follows java.util.Properties syntax', () => {
    const values = Object.fromEntries(parseProperties([
        'a = 1',
        'b:2',
        'c 3',
        'path=C:\\\\temp\\\\x',
        'long=uno \\',
        '   dos',
        'escaped\\ key=v',
        'uni=caf\\u00e9',
        'text=l1\\nl2',
        'url=https://x:8080/a=b',
        'empty=',
        '   ! comment',
        'crlf=ok\r'
    ].join('\n')).entries.map(entry => [entry.key, entry.value]));
    assert.deepEqual(values, {
        a: '1', b: '2', c: '3', path: 'C:\\temp\\x', long: 'uno dos', 'escaped key': 'v', uni: 'café',
        text: 'l1\nl2', url: 'https://x:8080/a=b', empty: '', crlf: 'ok'
    });
});

test('types are inferred without turning counters into switches', () => {
    const config = configFromProperties([
        'a.enabled=true', 'a.flagActive=1', 'a.retries=1', 'a.count=7', 'a.url=https://x', 'a.dbPassword=s3',
        'a.tpl=<b>hola</b>', 'a.name=x'
    ].join('\n'), 'app.properties');
    const types = Object.fromEntries(config.globalProperties.flatMap(s => s.properties).map(p => [p.key, p.type]));
    assert.deepEqual(types, {
        'a.enabled': 'boolean', 'a.flagActive': 'boolean', 'a.retries': 'number', 'a.count': 'number',
        'a.url': 'url', 'a.dbPassword': 'password', 'a.tpl': 'html', 'a.name': 'text'
    });
    assert.equal(only(config, 'a.flagActive').booleanType, 'number');
});

test('import merges numbered domains and keeps the value of each one', () => {
    const config = configFromProperties([
        '# Nombre', 'app.name=x',
        '# URL del dominio', 'app.domain1.url=https://uno', 'app.domain1.iddomain=1',
        'app.domain2.url=https://dos', 'app.domain2.iddomain=2'
    ].join('\n'), 'app.properties');

    assert.equal(config.domainCount, 2);
    assert.equal(config.domainProperties.flatMap(s => s.properties).length, 2);
    assert.equal(only(config, 'app.domain{N}.url').description, 'URL del dominio');
    assert.equal(only(config, 'app.domain{N}.iddomain').autoFillDomainId, true);
    assert.deepEqual(toKeyValues(config), {
        'app.name': 'x',
        'app.domain1.url': 'https://uno', 'app.domain1.iddomain': '1',
        'app.domain2.url': 'https://dos', 'app.domain2.iddomain': '2'
    });
});

test('a custom domain pattern can be applied after importing', () => {
    const config = configFromProperties('app.tenant1.url=a\napp.tenant2.url=b\nsubtenant3.x=c\n', 'app.properties');
    assert.equal(config.domainCount, 0);
    applyDomainPattern(config, 'tenant{N}');
    assert.equal(config.domainCount, 2);
    assert.equal(only(config, 'subtenant3.x').type, 'text');
    assert.deepEqual(toKeyValues(config), { 'subtenant3.x': 'c', 'app.tenant1.url': 'a', 'app.tenant2.url': 'b' });
});

test('generated files parse back to the same keys, values, comments and sections', () => {
    const source = [
        '# ---', '# Portal', '# ---', '# Nombre visible', '# en dos líneas', 'portal.name=Año ñ',
        '# Ruta', 'portal.path=C:\\\\dir', 'portal.html=<p>a</p>\\n<p>b</p>',
        '', '# ---', '# Dominios', '# ---', '# Host', 'x.domain1.host=uno', 'x.domain2.host=dos'
    ].join('\n');
    const first = configFromProperties(source, 'portal.properties');
    const text = generateProperties(first, new Date(0));
    const second = configFromProperties(text, 'portal.properties');

    assert.deepEqual(toKeyValues(second), toKeyValues(first));
    assert.deepEqual(toKeyValues(first)['portal.path'], 'C:\\dir');
    assert.equal(only(second, 'portal.name').description, 'Nombre visible\nen dos líneas');
    assert.equal(second.globalProperties[0].category, 'Portal');
    assert.equal(second.domainProperties[0].category, 'Dominios');
    assert.equal(only(second, 'x.domain{N}.host').description, 'Host');
    assert.equal(second.projectName, first.projectName);
    assert.equal(second.version, first.version);
});

test('escaping keeps every value on one valid line', () => {
    assert.equal(escapeValue('a\nb\\c\td'), 'a\\nb\\\\c\\td');
    assert.equal(escapeValue('  x y'), '\\ \\ x y');
    assert.equal(escapeKey('a b=c:d#e'), 'a\\ b\\=c\\:d\\#e');

    const config = normalizeConfig({
        globalProperties: [{ category: 'A', properties: [{ key: 'k', default: 'x\ny', description: 'uno\ndos' }] }]
    });
    const text = generateProperties(config, new Date(0));
    assert.ok(text.includes('# uno\n# dos\nk=x\\ny\n'));
});

test('saved JSON round-trips, including values and confirmations', () => {
    const config = configFromProperties('# D\na.b=1x\nc.domain1.d=2x\nc.domain2.d=3x\n', 'f.properties');
    setValue(config, field(config, 'a.b'), 'nuevo');
    config.confirmed.add('a.b');
    const restored = normalizeConfig(JSON.parse(JSON.stringify(serializeConfig(config))));
    assert.deepEqual(toKeyValues(restored), toKeyValues(config));
    assert.ok(restored.confirmed.has('a.b'));
    assert.equal(restored.domainCount, 2);
});

test('values equal to the default are not stored, and editing clears the confirmation', () => {
    const config = normalizeConfig({
        globalProperties: [{ category: 'A', properties: [{ key: 'k', default: 'x', needsConfirmation: true }] }]
    });
    const f = field(config, 'k');
    assert.equal(fieldIssue(config, f), 'confirm');
    config.confirmed.add('k');
    assert.equal(fieldIssue(config, f), null);
    setValue(config, f, 'y');
    assert.equal(config.values.k, 'y');
    assert.equal(fieldIssue(config, f), 'confirm');
    setValue(config, f, 'x');
    assert.deepEqual(config.values, {});
});

test('dependencies cascade and hidden fields do not block the download', () => {
    const config = normalizeConfig({
        globalProperties: [{
            category: 'A',
            properties: [
                { key: 'a', type: 'boolean', default: 'false', booleanType: 'string' },
                { key: 'b', type: 'boolean', default: '1', booleanType: 'number', dependsOn: { key: 'a', value: 'true' } },
                { key: 'c', default: '', required: true, dependsOn: { key: 'b', value: '1' } }
            ]
        }]
    });
    assert.equal(isVisible(config, only(config, 'c')), false);
    assert.equal(pendingFields(config).length, 0);

    setValue(config, field(config, 'a'), booleanValue(only(config, 'a'), true));
    assert.equal(isVisible(config, only(config, 'c')), true);
    assert.deepEqual(pendingFields(config).map(p => p.issue), ['required']);
});

test('a dependency on an unknown key does not hide the property', () => {
    const config = normalizeConfig({
        globalProperties: [{ category: 'A', properties: [{ key: 'a', dependsOn: { key: 'nope', value: '1' } }] }]
    });
    assert.equal(isVisible(config, only(config, 'a')), true);
});

test('pending fields cover every domain, not only the visible one', () => {
    const config = normalizeConfig({
        domainCount: 3,
        domainProperties: [{ category: 'D', properties: [{ key: 'x.domain{N}.y', default: '', required: true }] }]
    });
    assert.deepEqual(pendingFields(config).map(p => p.field.key), ['x.domain1.y', 'x.domain2.y', 'x.domain3.y']);
});

test('repeatable properties and dynamic options follow their source field', () => {
    const config = normalizeConfig({
        globalProperties: [{
            category: 'A',
            properties: [
                { key: 'count', type: 'number', default: '2' },
                { key: 'lang[N]', default: ['es', 'en'], repeatBasedOn: { key: 'count', placeholder: '[N]', label: 'Idioma' } },
                { key: 'rows', default: 'a, b' },
                { key: 'row', type: 'select', dynamicOptionsFrom: { key: 'rows' } }
            ]
        }]
    });
    assert.deepEqual(toKeyValues(config), { count: '2', lang1: 'es', lang2: 'en', rows: 'a, b', row: 'a' });

    setValue(config, field(config, 'count'), '3');
    setValue(config, field(config, 'rows'), 'z');
    assert.deepEqual(toKeyValues(config), { count: '3', lang1: 'es', lang2: 'en', lang3: '', rows: 'z', row: 'z' });
});

test('the domain count field and the number of domains stay in sync', () => {
    const config = normalizeConfig({
        globalProperties: [{ category: 'A', properties: [{ key: 'x.dominios.total', type: 'number', default: '2' }] }],
        domainProperties: [{ category: 'D', properties: [{ key: 'x.domain{N}.y', default: 'v' }] }]
    });
    assert.equal(config.domainCount, 2);
    setValue(config, field(config, 'x.domain{N}.y', 2), 'dos');
    setDomainCount(config, 3);
    assert.equal(getValue(config, field(config, 'x.dominios.total')), '3');
    setDomainCount(config, 1);
    assert.equal(config.values['x.domain2.y'], undefined);
    assert.equal(setDomainCount(config, 9999), 50);
});

test('legacy documents are migrated', () => {
    const config = normalizeConfig({
        projectName: 'Legado',
        mexicoStates: [{ value: '9', label: 'CDMX' }],
        globalProperties: [{
            category: 'General',
            properties: [
                { key: 'estado', type: 'mexicoStates', default: '9', description: 'Propiedad: estado' },
                { key: 'periodo', type: 'paymentPeriods', default: '3' },
                { key: 'portal.languages.total', type: 'number', default: '2', isDynamicLanguageCount: true },
                { key: 'languages', type: 'dynamicLanguages', default: ['es', 'en'] },
                { key: 'rows', default: 'x,y', isDynamicRowList: true },
                { key: 'row', type: 'dynamicSelect', dependsOnRowList: 'rows' },
                { key: 'flag', type: 'boolean', default: 'true' },
                { key: 'hrvertical.portalfirma.dominios.totalconfigurados', type: 'number', default: '1' }
            ]
        }],
        domainProperties: [{
            category: 'Dominio',
            properties: [
                { key: 'hrvertical.portalfirma.domain{N}.iddomain', type: 'number', default: '0' },
                { key: 'hrvertical.portalfirma.domain{N}.activo', type: 'boolean', default: '0', booleanType: 'number' },
                { key: 'hrvertical.portalfirma.domain{N}.host', default: 'h' }
            ]
        }],
        _domainValues: [
            { id: 1, properties: { 'hrvertical.portalfirma.domain{N}.host': 'uno', 'hrvertical.portalfirma.domain{N}.activo': true } },
            { id: 2, properties: { 'hrvertical.portalfirma.domain{N}.host': 'dos', 'hrvertical.portalfirma.domain{N}.activo': false } }
        ]
    });

    assert.equal(only(config, 'estado').type, 'select');
    assert.equal(only(config, 'estado').options[0].label, 'CDMX');
    assert.equal(only(config, 'estado').description, '');
    assert.equal(only(config, 'periodo').options.length, 10);
    assert.equal(only(config, 'flag').booleanType, 'string');
    assert.equal(config.domainCount, 2);

    const values = toKeyValues(config);
    assert.equal(values['portal.languages.language1'], 'es');
    assert.equal(values['portal.languages.language2'], 'en');
    assert.equal(values.row, 'x');
    assert.equal(values['hrvertical.portalfirma.domain2.iddomain'], '2');
    assert.equal(values['hrvertical.portalfirma.domain1.host'], 'uno');
    assert.equal(values['hrvertical.portalfirma.domain2.host'], 'dos');
    assert.equal(values['hrvertical.portalfirma.domain1.activo'], '1');
    assert.equal(values['hrvertical.portalfirma.dominios.totalconfigurados'], '2');
});

test('the flat format documented for the API is accepted', () => {
    const config = normalizeConfig({ projectName: 'P', properties: [{ key: 'a', defaultValue: '1', category: 'Cat' }] });
    assert.equal(config.globalProperties[0].category, 'Cat');
    assert.deepEqual(toKeyValues(config), { a: '1' });
    assert.throws(() => normalizeConfig({ foo: 1 }), /estructura/);
    assert.throws(() => normalizeConfig([]), /estructura/);
});

test('an unusable file reports the problem', () => {
    assert.throws(() => configFromProperties('# solo comentarios\n', 'x.properties'), /No se encontraron/);
});

test('editing the structure keeps references and values consistent', () => {
    const config = emptyConfig();
    addSection(config, 'S');
    const a = addProperty(config, 'global', 0);
    const b = addProperty(config, 'global', 0);
    b.dependsOn = { key: a.key, value: 'x' };
    setValue(config, field(config, a.key), 'x');

    assert.equal(renameProperty(config, a, b.key), false, 'duplicate keys are refused');
    assert.equal(renameProperty(config, a, 'nueva.clave'), true);
    assert.equal(b.dependsOn.key, 'nueva.clave');
    assert.equal(config.values['nueva.clave'], 'x');

    toggleSectionScope(config, 'global', 0);
    assert.equal(config.domainCount, 1);
    assert.equal(config.domainProperties[0].properties[0].key, 'nueva.domain{N}.clave');

    addSection(config, 'G');
    moveProperty(config, { scope: 'domain', section: 0, prop: 0 }, { scope: 'global', section: 0 });
    assert.equal(config.globalProperties[0].properties[0].key, 'nueva.domain1.clave');
});

test('renaming or moving a property keeps the values of every domain', () => {
    const config = normalizeConfig({
        domainCount: 2,
        globalProperties: [{ category: 'G', properties: [{ key: 'solo', default: 'd' }] }],
        domainProperties: [{ category: 'D', properties: [{ key: 'x.domain{N}.y', default: 'd', needsConfirmation: true }] }]
    });
    setValue(config, field(config, 'x.domain{N}.y', 1), 'uno');
    setValue(config, field(config, 'x.domain{N}.y', 2), 'dos');
    config.confirmed.add('x.domain2.y');
    setValue(config, field(config, 'solo'), 'cambiado');

    assert.equal(renameProperty(config, only(config, 'x.domain{N}.y'), 'z.domain{N}.w'), true);
    assert.deepEqual(toKeyValues(config), { solo: 'cambiado', 'z.domain1.w': 'uno', 'z.domain2.w': 'dos' });
    assert.ok(config.confirmed.has('z.domain2.w'));
    assert.ok(!config.confirmed.has('x.domain2.y'));

    moveProperty(config, { scope: 'global', section: 0, prop: 0 }, { scope: 'domain', section: 0 });
    assert.equal(toKeyValues(config)['domain1.solo'], 'cambiado');
    assert.equal(config.values.solo, undefined);
});

test('a freshly imported file has nothing modified, in any domain', () => {
    const config = configFromProperties('a.b=1x\nc.domain1.d=uno\nc.domain2.d=dos\n', 'f.properties');
    assert.equal([...allFields(config)].filter(f => isModified(config, f)).length, 0);

    const second = field(config, 'c.domain{N}.d', 2);
    assert.equal(getValue(config, second), 'dos');
    setValue(config, second, 'cambiado');
    assert.equal(isModified(config, second), true);
    assert.equal(originalValue(second), 'dos');

    restoreValue(config, second);
    assert.equal(isModified(config, second), false);
    assert.equal(getValue(config, second), 'dos');
});

test('values from the file survive saving, and removing a domain forgets them', () => {
    const config = configFromProperties('c.domain1.d=uno\nc.domain2.d=dos\n', 'f.properties');
    const restored = normalizeConfig(JSON.parse(JSON.stringify(serializeConfig(config))));
    assert.deepEqual(toKeyValues(restored), { 'c.domain1.d': 'uno', 'c.domain2.d': 'dos' });

    setDomainCount(restored, 1);
    setDomainCount(restored, 2);
    assert.equal(getValue(restored, field(restored, 'c.domain{N}.d', 2)), 'uno');
});

test('restoring clears the confirmation only if the value really changes', () => {
    const config = normalizeConfig({
        globalProperties: [{ category: 'A', properties: [{ key: 'k', default: 'x', needsConfirmation: true }] }]
    });
    const f = field(config, 'k');
    setValue(config, f, 'y');
    config.confirmed.add('k');
    restoreValue(config, f);
    assert.equal(config.confirmed.has('k'), false);
    config.confirmed.add('k');
    restoreValue(config, f);
    assert.equal(config.confirmed.has('k'), true);
});

test('a value can be copied to every domain', () => {
    const config = normalizeConfig({
        domainCount: 3,
        domainProperties: [{ category: 'D', properties: [{ key: 'x.domain{N}.y', default: 'd', needsConfirmation: true }] }]
    });
    setValue(config, field(config, 'x.domain{N}.y', 2), 'igual');
    config.confirmed.add('x.domain3.y');
    copyToAllDomains(config, field(config, 'x.domain{N}.y', 2));
    assert.deepEqual(toKeyValues(config), { 'x.domain1.y': 'igual', 'x.domain2.y': 'igual', 'x.domain3.y': 'igual' });
    assert.equal(config.confirmed.has('x.domain3.y'), false, 'a value that changed must be reviewed again');
});

test('properties and sections can be reordered and the file follows that order', () => {
    const keys = section => section.properties.map(prop => prop.key);
    const config = normalizeConfig({
        globalProperties: [
            { category: 'A', properties: [{ key: 'a1' }, { key: 'a2' }, { key: 'a3' }] },
            { category: 'B', properties: [{ key: 'b10' }, { key: 'b9' }] }
        ]
    });
    const [sectionA, sectionB] = config.globalProperties;

    moveProperty(config, { scope: 'global', section: 0, prop: 0 }, { scope: 'global', section: 0, index: 2 });
    assert.deepEqual(keys(sectionA), ['a2', 'a1', 'a3'], 'moves down one');
    moveProperty(config, { scope: 'global', section: 0, prop: 2 }, { scope: 'global', section: 0, index: 0 });
    assert.deepEqual(keys(sectionA), ['a3', 'a2', 'a1'], 'moves to the top');
    moveProperty(config, { scope: 'global', section: 0, prop: 0 }, { scope: 'global', section: 1, index: 1 });
    assert.deepEqual(keys(sectionB), ['b10', 'a3', 'b9'], 'goes into another section at a position');

    sortSection(config, 'global', 1);
    assert.deepEqual(keys(sectionB), ['a3', 'b9', 'b10'], 'numbers sort naturally');

    moveSection(config, 'global', 0, 2);
    assert.deepEqual(config.globalProperties.map(s => s.category), ['B', 'A']);
    moveSection(config, 'global', 1, 0);
    assert.deepEqual(config.globalProperties.map(s => s.category), ['A', 'B']);
    moveSection(config, 'global', 0, 2);

    const order = [...generateProperties(config, new Date(0)).matchAll(/^(\w+)=/gm)].map(match => match[1]);
    assert.deepEqual(order, ['a3', 'b9', 'b10', 'a2', 'a1']);
    assert.deepEqual(
        Object.keys(toKeyValues(normalizeConfig(JSON.parse(JSON.stringify(serializeConfig(config)))))),
        order, 'the order is saved');
});

test('moving a key into a domain section always yields a per-domain key', () => {
    assert.deepEqual(matchDomainKey('Domain12.x', 'domain{N}'), { template: 'Domain{N}.x', id: 12 });
    assert.equal(matchDomainKey('subdomain1.x', 'domain{N}'), null);
    assert.equal(matchDomainKey('a.b', 'sin-numero'), null);
});
