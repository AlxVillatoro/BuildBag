// Configuration Manager for .properties Generator
let configData = null;
let configsIndex = null;
let currentConfigFile = '';
let domains = [];
let currentDomainIndex = 0;
let confirmedRequiredFields = {};
let languageCount = 3;
let languageValues = ['es', 'en', 'fr'];

// Backend integration flag
let isBackendMode = typeof accessToken !== 'undefined' && accessToken !== null;

// Function to load config data from backend
function loadConfigFromData(data) {
    configData = data;
    
    // Reset state
    domains = [];
    currentDomainIndex = 0;
    confirmedRequiredFields = {};
    languageCount = 3;
    languageValues = ['es', 'en', 'fr'];
    
    // Re-render everything (be resilient: don't abort on optional features)
    const errors = [];
    const safeCall = (name, fn) => {
        try {
            fn();
        } catch (err) {
            errors.push({ name, err });
            console.error(`Error in ${name}:`, err);
        }
    };
    
    safeCall('updateProjectHeader', () => updateProjectHeader());
    safeCall('initializeDomains', () => initializeDomains());
    safeCall('renderGlobalProperties', () => renderGlobalProperties());
    safeCall('renderDomainTabs', () => renderDomainTabs());
    safeCall('renderDomainProperties', () => renderDomainProperties());
    safeCall('initializeLanguages', () => initializeLanguages());
    safeCall('initializeDynamicRowList', () => initializeDynamicRowList());
    safeCall('initializeDynamicFields', () => initializeDynamicFields());

    // Ensure the panel UI is visible in backend mode (config.html controls these sections)
    if (typeof window !== 'undefined' && typeof window.showConfigUI === 'function') {
        safeCall('showConfigUI', () => window.showConfigUI());
    }
    
    if (typeof showToast === 'function') {
        if (errors.length === 0) {
            showToast(`Configuración "${configData.projectName || 'Sin nombre'}" cargada correctamente`, 'success');
        } else {
            showToast(`Configuración cargada con advertencias (${errors.length}). Revisa consola.`, 'info');
        }
    }
}

// Function to get current configuration as JSON
function getCurrentConfigJson() {
    if (!configData) return null;
    
    // Clone the config data
    const exportData = JSON.parse(JSON.stringify(configData));
    
    // Update property values from inputs
    if (exportData.properties) {
        exportData.properties.forEach(prop => {
            const input = document.getElementById(`prop_${prop.key}`);
            if (input) {
                if (prop.type === 'boolean') {
                    prop.defaultValue = input.checked ? 'true' : 'false';
                } else {
                    prop.defaultValue = input.value;
                }
            }
        });
    }
    
    return exportData;
}

// Function to clear configuration
function clearConfiguration() {
    configData = null;
    domains = [];
    currentDomainIndex = 0;
    confirmedRequiredFields = {};
    
    // Clear containers
    const globalContainer = document.getElementById('globalPropertiesContainer');
    const domainContainer = document.getElementById('domainPropertiesContainer');
    const domainTabs = document.getElementById('domainTabs');
    const categoriesNav = document.getElementById('globalCategoriesNav');
    
    if (globalContainer) globalContainer.innerHTML = '';
    if (domainContainer) domainContainer.innerHTML = '';
    if (domainTabs) domainTabs.innerHTML = '';
    if (categoriesNav) categoriesNav.innerHTML = '';
}

// Escape HTML to prevent XSS and rendering issues
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Escape HTML for attribute values (also escapes quotes)
function escapeAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Get the domain key pattern from configuration
// This pattern determines which properties belong to domains
// Example: "domain{N}" means properties containing "domain1", "domain2", etc. are domain properties
function getDomainKeyPattern() {
    if (configData && configData.domainKeyPattern) {
        return configData.domainKeyPattern;
    }
    // Default pattern
    return 'domain{N}';
}

// Check if a property key matches the domain pattern
// The pattern uses {N} as placeholder for the domain number
// Example: if pattern is "domain{N}" and key is "app.domain1.name", returns true
function checkIfDomainProperty(key, pattern) {
    if (!pattern || !key) return false;
    
    // Escape special regex characters in the pattern, except {N}
    const escapedPattern = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
        .replace(/\\{N\\}/g, '\\d+');             // Replace escaped {N} with \d+
    
    // Also check for the literal {N} in the key (template form)
    const templatePattern = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\{N\\}/g, '\\{N\\}');
    
    const regex = new RegExp(escapedPattern, 'i');
    const templateRegex = new RegExp(templatePattern, 'i');
    
    return regex.test(key) || templateRegex.test(key);
}

// Convert a domain property key to its template form
// Example: "app.domain1.name" with pattern "domain{N}" becomes "app.domain{N}.name"
function convertToDomainTemplate(key, pattern) {
    if (!pattern || !key) return key;
    
    // Extract the base pattern without {N}
    const patternParts = pattern.split('{N}');
    if (patternParts.length !== 2) return key;
    
    const prefix = patternParts[0];
    const suffix = patternParts[1];
    
    // Escape special regex characters
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace the domain number with {N}
    const regex = new RegExp(`${escapedPrefix}(\\d+)${escapedSuffix}`, 'gi');
    return key.replace(regex, `${prefix}{N}${suffix}`);
}

// Get default Mexico states data
function getDefaultMexicoStates() {
    return [
        { value: "1", label: "Aguascalientes" },
        { value: "2", label: "Baja California" },
        { value: "3", label: "Baja California Sur" },
        { value: "4", label: "Campeche" },
        { value: "5", label: "Chiapas" },
        { value: "6", label: "Chihuahua" },
        { value: "7", label: "Ciudad de México" },
        { value: "8", label: "Coahuila" },
        { value: "9", label: "Colima" },
        { value: "10", label: "Durango" },
        { value: "11", label: "Estado de México" },
        { value: "12", label: "Guanajuato" },
        { value: "13", label: "Guerrero" },
        { value: "14", label: "Hidalgo" },
        { value: "15", label: "Jalisco" },
        { value: "16", label: "Michoacán" },
        { value: "17", label: "Morelos" },
        { value: "18", label: "Nayarit" },
        { value: "19", label: "Nuevo León" },
        { value: "20", label: "Oaxaca" },
        { value: "21", label: "Puebla" },
        { value: "22", label: "Querétaro" },
        { value: "23", label: "Quintana Roo" },
        { value: "24", label: "San Luis Potosí" },
        { value: "25", label: "Sinaloa" },
        { value: "26", label: "Sonora" },
        { value: "27", label: "Tabasco" },
        { value: "28", label: "Tamaulipas" },
        { value: "29", label: "Tlaxcala" },
        { value: "30", label: "Veracruz" },
        { value: "31", label: "Yucatán" },
        { value: "32", label: "Zacatecas" }
    ];
}

// Get default payment periods data
function getDefaultPaymentPeriods() {
    return [
        { value: "1", label: "Semanal", enabled: true },
        { value: "2", label: "Decenal", enabled: true },
        { value: "3", label: "Catorcenal", enabled: true },
        { value: "4", label: "Quincenal", enabled: true },
        { value: "5", label: "Mensual", enabled: true },
        { value: "6", label: "Bimestral", enabled: true },
        { value: "7", label: "Trimestral", enabled: true },
        { value: "8", label: "Cuatrimestral", enabled: true },
        { value: "9", label: "Semestral", enabled: true },
        { value: "10", label: "Anual", enabled: true }
    ];
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Check if we're in backend mode (Thymeleaf panel)
    isBackendMode = typeof accessToken !== 'undefined' && accessToken !== null;
    
    if (isBackendMode) {
        // In backend mode, initialization is handled by the panel
        console.log('Backend mode detected, waiting for configuration load');
        setupEventListeners();
        return;
    }
    
    // Standalone mode - load from files
    try {
        await loadConfigurationsIndex();
        await loadConfiguration(currentConfigFile);
        if (!configData) {
            console.error('Configuration data not loaded');
            return;
        }
        updateProjectHeader();
        initializeDomains();
        renderGlobalProperties();
        renderDomainTabs();
        renderDomainProperties();
        setupEventListeners();
        setupConfigSelector();
        initializeLanguages();
        initializeDynamicRowList();
        initializeDynamicFields();
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});

// Load configurations index
async function loadConfigurationsIndex() {
    try {
        const response = await fetch('configs-index.json');
        if (!response.ok) {
            console.warn('configs-index.json not found, using default config');
            configsIndex = {
                configurations: [
                    { id: 'default', name: 'Default', file: 'config.json', description: 'Configuración por defecto' }
                ]
            };
            return;
        }
        configsIndex = await response.json();
        console.log('Configurations index loaded:', configsIndex);
    } catch (error) {
        console.warn('Error loading configurations index:', error);
        configsIndex = {
            configurations: [
                { id: 'default', name: 'Default', file: 'config.json', description: 'Configuración por defecto' }
            ]
        };
    }
}

// Setup configuration selector
function setupConfigSelector() {
    const selector = document.getElementById('configSelector');
    if (!selector || !configsIndex) return;
    
    // Clear existing options
    selector.innerHTML = '';
    
    // Add configurations from index
    configsIndex.configurations.forEach(config => {
        const option = document.createElement('option');
        option.value = config.file;
        option.textContent = config.name;
        option.title = config.description || '';
        if (config.file === currentConfigFile) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
    
    // Add change listener
    selector.addEventListener('change', async (e) => {
        const selectedFile = e.target.value;
        if (selectedFile && selectedFile !== currentConfigFile) {
            await switchConfiguration(selectedFile);
        }
    });
}

// Switch to a different configuration
async function switchConfiguration(configFile) {
    try {
        showToast('Cargando configuración...', 'info');
        currentConfigFile = configFile;
        await loadConfiguration(configFile);
        
        if (!configData) {
            showToast('Error al cargar la configuración', 'error');
            return;
        }
        
        // Reset state
        domains = [];
        currentDomainIndex = 0;
        confirmedRequiredFields = {};
        languageCount = 3;
        languageValues = ['es', 'en', 'fr'];
        
        // Re-render everything
        updateProjectHeader();
        initializeDomains();
        renderGlobalProperties();
        renderDomainTabs();
        renderDomainProperties();
        initializeLanguages();
        initializeDynamicRowList();
        initializeDynamicFields();
        
        showToast(`Configuración "${configData.projectName || 'Sin nombre'}" cargada correctamente`, 'success');
    } catch (error) {
        console.error('Error switching configuration:', error);
        showToast('Error al cambiar la configuración', 'error');
    }
}

// Load configuration from JSON file
async function loadConfiguration(configFile = 'config.json') {
    try {
        const response = await fetch(configFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        configData = await response.json();
        console.log('Configuration loaded successfully:', configData.projectName || configFile);
    } catch (error) {
        console.error('Error loading configuration:', error);
        showToast('Error al cargar la configuración. Asegúrese de ejecutar desde un servidor web local.', 'error');
    }
}

// Update project header with configuration name
function updateProjectHeader() {
    const titleEl = document.getElementById('projectTitle');
    const subtitleEl = document.getElementById('projectSubtitle');
    
    if (titleEl && configData) {
        titleEl.textContent = configData.projectName || 'Generador de Configuración';
    }
    
    if (subtitleEl && configData) {
        subtitleEl.textContent = configData.projectDescription || '.properties';
    }
    
    // Update page title
    if (configData && configData.projectName) {
        document.title = `${configData.projectName} - Generador de Configuración`;
    }
}

// Open file dialog to load a custom JSON configuration (standalone mode)
function openFileDialogStandalone() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// Load configuration from file input (standalone mode)
async function loadFileFromInputStandalone(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const fileName = file.name;
        const isProperties = fileName.endsWith('.properties');
        
        let newConfig;
        
        if (isProperties) {
            // Parse .properties file and open the editor
            showToast('Abriendo editor de propiedades...', 'info');
            const parsedProperties = parsePropertiesFileForEditor(text, fileName);
            openJsonEditor(parsedProperties, fileName);
            event.target.value = '';
            return;
        } else {
            // Parse JSON file
            newConfig = JSON.parse(text);
            
            // Validate the configuration structure
            if (!newConfig.globalProperties || !newConfig.domainProperties) {
                throw new Error('El archivo JSON no tiene la estructura correcta (requiere globalProperties y domainProperties)');
            }
        }
        
        // Add to the selector if not already there
        const selector = document.getElementById('configSelector');
        const configFileName = isProperties ? fileName.replace('.properties', '.json') : fileName;
        
        // Check if this file is already in the list
        let existingOption = Array.from(selector.options).find(opt => opt.value === configFileName);
        if (!existingOption) {
            // Add new option to the selector
            const option = document.createElement('option');
            option.value = configFileName;
            option.textContent = newConfig.projectName || configFileName.replace('.json', '');
            option.dataset.isCustom = 'true';
            selector.appendChild(option);
            
            // Add to configsIndex
            if (configsIndex) {
                configsIndex.configurations.push({
                    id: configFileName.replace('.json', ''),
                    name: newConfig.projectName || configFileName.replace('.json', ''),
                    file: configFileName,
                    description: newConfig.projectDescription || 'Configuración cargada desde ' + (isProperties ? '.properties' : 'archivo'),
                    isCustom: true
                });
            }
        }
        
        // Store the loaded config data
        configData = newConfig;
        currentConfigFile = configFileName;
        
        // Update selector
        selector.value = configFileName;
        
        // Reset state
        domains = [];
        currentDomainIndex = 0;
        confirmedRequiredFields = {};
        languageCount = 3;
        languageValues = ['es', 'en', 'fr'];
        
        // Re-render everything
        updateProjectHeader();
        initializeDomains();
        renderGlobalProperties();
        renderDomainTabs();
        renderDomainProperties();
        initializeLanguages();
        initializeDynamicRowList();
        initializeDynamicFields();
        
        showToast(`Configuración "${configData.projectName || fileName}" cargada correctamente`, 'success');
        
        // Reset file input
        event.target.value = '';
        
    } catch (error) {
        console.error('Error loading file:', error);
        showToast(`Error al cargar el archivo: ${error.message}`, 'error');
        event.target.value = '';
    }
}

// IMPORTANT: avoid overriding the panel's import handlers in backend mode.
// In backend mode, `config.html` provides `openFileDialog()` and `loadFileFromInput()` with DB/save-banner behavior.
if (typeof window !== 'undefined') {
    try {
        const backend = (typeof accessToken !== 'undefined' && accessToken !== null);
        if (!backend) {
            window.openFileDialog = openFileDialogStandalone;
            window.loadFileFromInput = loadFileFromInputStandalone;
        }
    } catch (_) {
        // ignore
    }
}

// Parse .properties file and convert to JSON configuration
function parsePropertiesFile(content, fileName) {
    const lines = content.split('\n');
    const properties = {};
    const categories = {};
    
    // Parse each line
    lines.forEach(line => {
        // Skip comments and empty lines
        line = line.trim();
        if (!line || line.startsWith('#') || line.startsWith('!')) {
            return;
        }
        
        // Find the first = or :
        const separatorIndex = line.search(/[=:]/);
        if (separatorIndex === -1) return;
        
        const key = line.substring(0, separatorIndex).trim();
        let value = line.substring(separatorIndex + 1).trim();
        
        // Handle multi-line values (ending with \)
        // For simplicity, we'll just use the value as-is
        
        properties[key] = value;
    });
    
    // Group properties by category (first part of the key)
    Object.keys(properties).forEach(key => {
        const parts = key.split('.');
        let categoryName = 'General';
        
        if (parts.length >= 2) {
            // Use first two parts as category
            categoryName = parts.slice(0, 2).join('.');
        }
        
        if (!categories[categoryName]) {
            categories[categoryName] = [];
        }
        
        // Detect property type
        const value = properties[key];
        let type = 'text';
        let booleanType = null;
        
        if (value === 'true' || value === 'false') {
            type = 'boolean';
            booleanType = 'string';
        } else if (value === '1' || value === '0') {
            // Could be boolean or number
            type = 'boolean';
            booleanType = 'number';
        } else if (/^\d+$/.test(value)) {
            type = 'number';
        } else if (value.startsWith('http://') || value.startsWith('https://')) {
            type = 'url';
        } else if (/<[a-z][\s\S]*>/i.test(value)) {
            // Detect HTML content
            type = 'html';
        }
        
        // Check if this is a domain property using configurable pattern
        // Default pattern is "domain{N}" but can be customized
        const domainPattern = getDomainKeyPattern();
        const isDomainProp = checkIfDomainProperty(key, domainPattern);
        
        const prop = {
            key: key,
            label: key.split('.').pop().replace(/([A-Z])/g, ' $1').trim(),
            type: type,
            default: value,
            required: false,
            needsConfirmation: type === 'text' || type === 'url',
            description: `Propiedad importada: ${key}`
        };
        
        if (booleanType) {
            prop.booleanType = booleanType;
        }
        
        if (type === 'url') {
            prop.checkService = true;
        }
        
        categories[categoryName].push(prop);
    });
    
    // Separate global and domain properties
    const globalCategories = [];
    const domainCategories = [];
    
    Object.keys(categories).forEach(categoryName => {
        const props = categories[categoryName];
        const hasDomainProps = props.some(p => /domain\d+|domain\{N\}/i.test(p.key));
        
        if (hasDomainProps) {
            // Convert domain-specific keys to template format using configurable pattern
            const domainPattern = getDomainKeyPattern();
            const templateProps = props.map(p => ({
                ...p,
                key: convertToDomainTemplate(p.key, domainPattern)
            }));
            
            // Remove duplicates (same template key)
            const uniqueProps = [];
            const seenKeys = new Set();
            templateProps.forEach(p => {
                if (!seenKeys.has(p.key)) {
                    seenKeys.add(p.key);
                    uniqueProps.push(p);
                }
            });
            
            domainCategories.push({
                category: categoryName.replace(/domain\d+/gi, 'Dominio'),
                properties: uniqueProps
            });
        } else {
            globalCategories.push({
                category: formatCategoryName(categoryName),
                icon: 'settings',
                properties: props
            });
        }
    });
    
    // Create the JSON configuration
    const projectName = fileName.replace('.properties', '').replace(/-/g, ' ').replace(/_/g, ' ');
    
    return {
        projectName: projectName.charAt(0).toUpperCase() + projectName.slice(1),
        projectDescription: `Configuración importada desde ${fileName}`,
        version: '1.0.0',
        outputFileName: fileName,
        mexicoStates: getDefaultMexicoStates(),
        paymentPeriods: getDefaultPaymentPeriods(),
        globalProperties: globalCategories.length > 0 ? globalCategories : [{
            category: 'Propiedades Generales',
            icon: 'settings',
            properties: []
        }],
        domainProperties: domainCategories.length > 0 ? domainCategories : [{
            category: 'Configuración del Dominio',
            properties: []
        }]
    };
}

// Format category name from property key prefix
function formatCategoryName(name) {
    return name
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' - ')
        .replace(/([A-Z])/g, ' $1')
        .trim();
}

// Download current configuration as JSON
function getConfigJsonForSave() {
    if (!configData) return null;
    
    // Create a copy of the current config with updated values
    const exportConfig = JSON.parse(JSON.stringify(configData));
    
    // Update global property values from the form
    if (exportConfig.globalProperties) {
        exportConfig.globalProperties.forEach(category => {
            category.properties.forEach(prop => {
                const fieldId = `global-${prop.key}`;
                const input = document.getElementById(fieldId);
                if (input) {
                    if (input.type === 'checkbox' && input.classList.contains('toggle-checkbox')) {
                        if (prop.booleanType === 'number') {
                            prop.default = input.checked ? '1' : '0';
                        } else {
                            prop.default = input.checked ? 'true' : 'false';
                        }
                    } else if (input.type !== 'checkbox') {
                        prop.default = input.value;
                    }
                }
            });
        });
    }
    
    // Update domain property values
    if (exportConfig.domainProperties && domains.length > 0) {
        saveDomainValues();
        // Store current domain values in the export
        exportConfig._domainValues = domains.map(d => ({
            id: d.id,
            name: d.name,
            properties: { ...d.properties }
        }));
    }
    
    return exportConfig;
}

function downloadConfigAsJson() {
    if (!configData) {
        showToast('No hay configuración cargada', 'error');
        return;
    }
    
    const exportConfig = getConfigJsonForSave();
    if (!exportConfig) {
        showToast('No hay configuración cargada', 'error');
        return;
    }
    
    const jsonContent = JSON.stringify(exportConfig, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const jsonFileName = currentConfigFile.endsWith('.json') 
        ? currentConfigFile 
        : currentConfigFile.replace('.properties', '.json');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = jsonFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Configuración exportada como "${jsonFileName}"`, 'success');
}

// Initialize domains based on default count
function initializeDomains() {
    // If the configuration has no domain properties, don't initialize domains
    const hasDomainProps = Array.isArray(configData?.domainProperties)
        && configData.domainProperties.some(cat => Array.isArray(cat.properties) && cat.properties.length > 0);
    if (!hasDomainProps) {
        domains = [];
        currentDomainIndex = 0;
        updateRemoveButtonVisibility();
        return;
    }

    const totalDomains = parseInt(getDefaultValue('hrvertical.portalfirma.dominios.totalconfigurados')) || 2;
    domains = [];
    for (let i = 1; i <= totalDomains; i++) {
        domains.push({
            id: i,
            name: `Dominio ${i}`,
            properties: {
                'hrvertical.portalfirma.domain{N}.iddomain': i
            }
        });
    }
    updateRemoveButtonVisibility();
}

// Get default value for a global property
function getDefaultValue(key) {
    for (const category of configData.globalProperties) {
        const prop = category.properties.find(p => p.key === key);
        if (prop) return prop.default;
    }
    return null;
}

// Check if a field needs confirmation based on its type and value
function shouldShowConfirmation(prop, inputValue) {
    // If needsConfirmation is explicitly false, don't show
    if (prop.needsConfirmation === false) return false;
    
    // If needsConfirmation is true
    if (prop.needsConfirmation === true) {
        // For text/url/password types, always show
        if (['text', 'url', 'password'].includes(prop.type)) {
            return true;
        }
        // For number types, only show if confirmOnZero is true and value is 0
        if (prop.type === 'number' && prop.confirmOnZero) {
            return inputValue === '0' || inputValue === '' || inputValue === 0;
        }
    }
    
    return false;
}

// Render global properties
function renderGlobalProperties() {
    const container = document.getElementById('globalPropertiesContainer');
    const navContainer = document.getElementById('globalCategoriesNav');
    container.innerHTML = '';
    navContainer.innerHTML = '';

    configData.globalProperties.forEach((category, index) => {
        try {
            const categoryId = `category-${index}`;
            
            // Render navigation item
            navContainer.innerHTML += `
                <div class="sidebar-item px-3 py-2 rounded-lg cursor-pointer text-gray-300" onclick="scrollToSection('${categoryId}')">
                    <span class="text-sm">${category.category}</span>
                </div>
            `;

            // Render properties for this category
            let propertiesHtml = '';
            category.properties.forEach(prop => {
                propertiesHtml += renderPropertyField(prop, 'global');
            });
            
            // Generate empty category message based on dependencies
            const emptyMessage = generateCategoryEmptyMessage(category.properties);

            // Render category section
            container.innerHTML += `
                <div id="${categoryId}" class="glass-card rounded-2xl overflow-hidden fade-in category-collapsible">
                    <div class="category-header px-6 py-4 cursor-pointer flex items-center justify-between" onclick="toggleCategory('${categoryId}')">
                        <h3 class="text-lg font-semibold text-white">${category.category}</h3>
                        <button type="button" class="category-toggle-btn text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5 transform transition-transform duration-300 category-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                    </div>
                    <div class="category-content p-6 space-y-4">
                        ${propertiesHtml}
                        ${emptyMessage}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering category:', category.category, error);
        }
    });
    
    // Initialize dependencies after rendering
    requestAnimationFrame(() => {
        initializeDependencies();
    });
}

// Generate a message explaining why a category might appear empty
function generateCategoryEmptyMessage(properties) {
    // Find all unique dependencies in this category
    const dependencies = new Map();
    
    properties.forEach(prop => {
        if (prop.dependsOn && prop.dependsOn.key) {
            const key = prop.dependsOn.key;
            if (!dependencies.has(key)) {
                dependencies.set(key, {
                    key: key,
                    values: new Set(),
                    count: 0
                });
            }
            dependencies.get(key).values.add(prop.dependsOn.value);
            dependencies.get(key).count++;
        }
    });
    
    if (dependencies.size === 0) {
        return ''; // No dependencies, no message needed
    }
    
    // Build the message HTML
    let dependencyList = '';
    dependencies.forEach((dep, key) => {
        const valuesArray = Array.from(dep.values);
        const valueText = valuesArray.map(v => `"${v}"`).join(' o ');
        const propLabel = findPropertyLabel(key);
        dependencyList += `
            <li class="flex items-center gap-2 cursor-pointer hover:bg-amber-500/10 rounded p-1 -m-1 transition-colors" 
                onclick="scrollToProperty('${escapeAttr(key)}')" 
                title="Clic para ir a esta propiedad">
                <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span><strong class="text-amber-300 underline decoration-dotted">${escapeHtml(propLabel)}</strong> debe estar en ${valueText}</span>
                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
            </li>
        `;
    });
    
    return `
        <div class="category-empty-message hidden p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div class="flex items-start gap-3">
                <svg class="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <div>
                    <h4 class="font-medium text-amber-300 mb-2">Las opciones de esta categoría están ocultas</h4>
                    <p class="text-sm text-gray-400 mb-3">Para ver las opciones, habilita las siguientes propiedades (haz clic para ir):</p>
                    <ul class="text-sm text-gray-300 space-y-1">
                        ${dependencyList}
                    </ul>
                </div>
            </div>
        </div>
    `;
}

// Scroll to a property by its key
function scrollToProperty(key) {
    // Try to find the input with this key
    const input = document.querySelector(`[data-key="${key}"]`);
    if (input) {
        // Find the property row containing this input
        const propertyRow = input.closest('.property-row');
        if (propertyRow) {
            // First, expand the category if it's collapsed
            const categoryContent = propertyRow.closest('.category-content');
            const categoryCollapsible = propertyRow.closest('.category-collapsible');
            
            if (categoryCollapsible && categoryContent) {
                // Expand the category
                categoryCollapsible.classList.remove('collapsed');
                categoryContent.style.maxHeight = categoryContent.scrollHeight + 'px';
                
                // Rotate chevron
                const chevron = categoryCollapsible.querySelector('.category-chevron');
                if (chevron) {
                    chevron.style.transform = 'rotate(0deg)';
                }
            }
            
            // Scroll to the property with a small delay for category expansion
            setTimeout(() => {
                propertyRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Highlight the property row temporarily
                propertyRow.classList.add('highlight-property');
                setTimeout(() => {
                    propertyRow.classList.remove('highlight-property');
                }, 2000);
            }, 100);
            
            return;
        }
    }
    
    // Fallback: try to find by ID
    const globalInput = document.getElementById(`global-${key}`);
    if (globalInput) {
        const propertyRow = globalInput.closest('.property-row');
        if (propertyRow) {
            propertyRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            propertyRow.classList.add('highlight-property');
            setTimeout(() => {
                propertyRow.classList.remove('highlight-property');
            }, 2000);
        }
    }
}

// Find the label of a property by its key
function findPropertyLabel(key) {
    // Search in global properties
    for (const category of configData.globalProperties || []) {
        for (const prop of category.properties || []) {
            if (prop.key === key) {
                return prop.label || key;
            }
        }
    }
    // Search in domain properties
    for (const category of configData.domainProperties || []) {
        for (const prop of category.properties || []) {
            if (prop.key === key || prop.key.replace(/\{N\}/g, '1') === key) {
                return prop.label || key;
            }
        }
    }
    return key;
}

// Render a single property field
function renderPropertyField(prop, context, domainIndex = null) {
    try {
        // Handle repeatable fields (generic)
        if (prop.repeatBasedOn && prop.repeatBasedOn.key) {
            return renderRepeatableField(prop, context, domainIndex);
        }
        
        // Handle dynamic options select (generic)
        if (prop.dynamicOptionsFrom && prop.dynamicOptionsFrom.key) {
            return renderDynamicOptionsSelect(prop, context, domainIndex);
        }
        
        // Skip dynamic languages field - legacy support
        if (prop.type === 'dynamicLanguages') {
            return renderDynamicLanguagesField(prop);
        }

        const fieldId = domainIndex !== null 
            ? `domain-${domainIndex}-${prop.key.replace(/\{N\}/g, domainIndex)}`
            : `global-${prop.key}`;
        
        const requiredBadge = prop.required 
            ? '<span class="required-badge text-xs px-2 py-0.5 rounded-full text-white">Requerido</span>'
            : '<span class="optional-badge text-xs px-2 py-0.5 rounded-full text-gray-400">Opcional</span>';

        const dependencyClass = prop.dependsOn ? 'dependency-field' : '';
        const dependencyData = prop.dependsOn 
            ? `data-depends-on="${prop.dependsOn.key}" data-depends-value="${prop.dependsOn.value}"`
            : '';

        let inputField = '';
        let defaultValue = prop.default !== undefined && prop.default !== null ? String(prop.default) : '';
        
        // Handle array defaults (like for dynamicLanguages)
        if (Array.isArray(prop.default)) {
            defaultValue = '';
        }
        
        // Auto-fill domain ID
        if (prop.autoFillDomainId && domainIndex !== null) {
            defaultValue = String(domainIndex);
        }

        // Service check button for URL fields
        const serviceCheckButton = prop.checkService ? `
            <div class="flex items-center gap-2 mt-2" id="${fieldId}-service-container">
                <button type="button" 
                        onclick="checkService('${fieldId}')"
                        class="btn-secondary px-3 py-1 rounded text-xs font-medium flex items-center gap-2">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Verificar
                </button>
                <span id="${fieldId}-status" class="service-status hidden">
                    <span class="pulse-dot"></span>
                    <span class="status-text"></span>
                </span>
            </div>
        ` : '';

        // Determine if we need confirmation checkbox
        const needsConfirm = prop.needsConfirmation === true;
        const confirmOnZero = prop.confirmOnZero === true;
        const confirmDataAttr = needsConfirm ? 'data-needs-confirmation="true"' : '';
        const confirmOnZeroAttr = confirmOnZero ? 'data-confirm-on-zero="true"' : '';

        // Build confirmation checkbox HTML (will be shown/hidden dynamically for number fields)
        function buildConfirmCheckbox(showByDefault) {
            if (!needsConfirm) return '';
            const hiddenClass = (prop.type === 'number' && !showByDefault) ? 'hidden' : '';
            return '<div class="flex items-center gap-2 ml-3 confirm-container ' + hiddenClass + '" id="' + fieldId + '-confirm-container">' +
                '<input type="checkbox" ' +
                'id="' + fieldId + '-confirm" ' +
                'class="confirm-checkbox cursor-pointer" ' +
                'data-confirm-for="' + fieldId + '" ' +
                'title="Confirmar uso de este valor" ' +
                'onchange="handleConfirmChange(\'' + fieldId + '\', this.checked)">' +
                '<label for="' + fieldId + '-confirm" class="text-xs text-gray-400 cursor-pointer">Confirmar</label>' +
                '</div>';
        }

        switch (prop.type) {
        case 'boolean':
            const isChecked = prop.booleanType === 'string' 
                ? defaultValue === 'true'
                : defaultValue === '1';
            inputField = `
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" 
                           id="${fieldId}" 
                           class="sr-only peer toggle-checkbox" 
                           data-key="${prop.key}"
                           data-boolean-type="${prop.booleanType}"
                           ${isChecked ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-accent"></div>
                    <span class="ml-3 text-sm font-medium text-gray-300">${isChecked ? 'Habilitado' : 'Deshabilitado'}</span>
                </label>
            `;
            break;

        case 'select':
            const selectOptions = prop.options || [];
            inputField = `
                <div class="flex items-center">
                    <select id="${fieldId}" 
                            class="input-field w-full md:w-80 px-4 py-2.5 rounded-lg text-gray-100"
                            data-key="${prop.key}">
                        ${selectOptions.map(opt => 
                            `<option value="${escapeAttr(opt.value)}" ${opt.value === defaultValue ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
            break;

        case 'mexicoStates':
            inputField = `
                <div class="flex items-center">
                    <select id="${fieldId}" 
                            class="input-field w-full md:w-80 px-4 py-2.5 rounded-lg text-gray-100"
                            data-key="${prop.key}">
                        ${configData.mexicoStates.map(state => 
                            `<option value="${escapeAttr(state.value)}" ${state.value === defaultValue ? 'selected' : ''}>${escapeHtml(state.label)}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
            break;

        case 'paymentPeriods':
            inputField = `
                <div class="flex items-center">
                    <select id="${fieldId}" 
                            class="input-field w-full md:w-80 px-4 py-2.5 rounded-lg text-gray-100"
                            data-key="${prop.key}">
                        ${configData.paymentPeriods.map(period => 
                            `<option value="${escapeAttr(period.value)}" ${period.value === defaultValue ? 'selected' : ''} ${!period.enabled ? 'disabled' : ''}>${escapeHtml(period.label)}${!period.enabled ? ' (deshabilitado)' : ''}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
            break;

        case 'dynamicSelect':
            inputField = `
                <div class="flex items-center">
                    <select id="${fieldId}" 
                            class="input-field w-full md:w-48 px-4 py-2.5 rounded-lg text-gray-100 dynamic-row-select"
                            data-key="${prop.key}"
                            data-depends-on-row-list="${prop.dependsOnRowList}">
                    </select>
                </div>
            `;
            break;

        case 'password':
            inputField = `
                <div class="flex items-center">
                    <div class="relative w-full md:w-96">
                        <input type="password" 
                               id="${fieldId}" 
                               class="input-field w-full px-4 py-2.5 rounded-lg text-gray-100 pr-12"
                               data-key="${prop.key}"
                               value="${escapeAttr(defaultValue)}"
                               ${confirmDataAttr}
                               placeholder="Ingrese valor...">
                        <button type="button" 
                                onclick="togglePassword('${fieldId}')"
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                        </button>
                    </div>
                    ${buildConfirmCheckbox(true)}
                </div>
            `;
            break;

        case 'number':
            const minAttr = prop.min !== undefined ? `min="${prop.min}"` : '';
            const maxAttr = prop.max !== undefined ? `max="${prop.max}"` : '';
            const showConfirmForNumber = confirmOnZero && (defaultValue === '0' || defaultValue === '' || defaultValue === 0);
            inputField = `
                <div class="flex items-center">
                    <input type="number" 
                           id="${fieldId}" 
                           class="input-field w-full md:w-48 px-4 py-2.5 rounded-lg text-gray-100"
                           data-key="${prop.key}"
                           value="${escapeAttr(defaultValue)}"
                           ${minAttr} ${maxAttr}
                           ${confirmDataAttr}
                           ${confirmOnZeroAttr}
                           ${prop.isDynamicLanguageCount ? 'data-dynamic-language-count="true"' : ''}
                           placeholder="0"
                           onchange="handleNumberChange('${fieldId}', this.value)">
                    ${buildConfirmCheckbox(showConfirmForNumber)}
                </div>
            `;
            break;

        case 'url':
            inputField = `
                <div class="flex flex-col gap-2 w-full md:w-auto">
                    <div class="flex items-center">
                        <input type="text" 
                               id="${fieldId}" 
                               class="input-field w-full md:w-96 px-4 py-2.5 rounded-lg text-gray-100"
                               data-key="${prop.key}"
                               value="${escapeAttr(defaultValue)}"
                               ${confirmDataAttr}
                               placeholder="https://...">
                        ${buildConfirmCheckbox(true)}
                    </div>
                    ${serviceCheckButton}
                </div>
            `;
            break;

        case 'html':
            inputField = `
                <div class="flex flex-col gap-3 w-full">
                    <div class="flex items-start gap-3">
                        <textarea id="${fieldId}" 
                                  class="input-field w-full px-4 py-3 rounded-lg text-gray-100 font-mono text-sm html-textarea"
                                  data-key="${prop.key}"
                                  rows="6"
                                  ${confirmDataAttr}
                                  oninput="updateHtmlPreview('${fieldId}')"
                                  placeholder="Ingrese código HTML...">${escapeHtml(defaultValue)}</textarea>
                        ${buildConfirmCheckbox(true)}
                    </div>
                    <div class="html-preview-container">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">Vista Previa</span>
                            <button type="button" 
                                    onclick="toggleHtmlPreview('${fieldId}')"
                                    class="text-xs text-electric-light hover:text-electric-accent transition-colors flex items-center gap-1">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                                <span id="${fieldId}-preview-toggle-text">Ocultar</span>
                            </button>
                        </div>
                        <div id="${fieldId}-preview" class="html-preview p-4 rounded-lg bg-white text-gray-900 max-h-64 overflow-auto">
                            ${defaultValue || '<span class="text-gray-400 italic">Sin contenido</span>'}
                        </div>
                    </div>
                </div>
            `;
            break;

        default: // text
            inputField = `
                <div class="flex items-center">
                    <input type="text" 
                           id="${fieldId}" 
                           class="input-field w-full md:w-96 px-4 py-2.5 rounded-lg text-gray-100"
                           data-key="${prop.key}"
                           value="${escapeAttr(defaultValue)}"
                           ${confirmDataAttr}
                           ${prop.isDynamicRowList ? 'data-dynamic-row-list="true"' : ''}
                           placeholder="Ingrese valor...">
                    ${buildConfirmCheckbox(true)}
                </div>
            `;
        }

        return `
            <div class="property-row p-4 rounded-xl ${dependencyClass}" ${dependencyData} data-prop-key="${prop.key}">
                <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-1 flex-wrap">
                            <span class="font-mono text-sm text-electric-light break-all">${escapeHtml(prop.key.replace(/\{N\}/g, domainIndex || 'N'))}</span>
                            ${requiredBadge}
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-white font-medium">${escapeHtml(prop.label)}</span>
                            <div class="tooltip-trigger relative">
                                <svg class="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <div class="info-tooltip absolute bottom-full left-0 mb-2 w-64 glass-card rounded-lg text-sm z-10">
                                    ${escapeHtml(prop.description)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex-shrink-0">
                        ${inputField}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error rendering property:', prop.key, error);
        return `<div class="property-row p-4 rounded-xl bg-red-900/20 border border-red-500/30">
            <span class="text-red-400">Error rendering: ${prop.key}</span>
        </div>`;
    }
}

// Handle number input change to show/hide confirmation checkbox
function handleNumberChange(fieldId, value) {
    const confirmContainer = document.getElementById(`${fieldId}-confirm-container`);
    const input = document.getElementById(fieldId);
    
    if (!confirmContainer || !input) return;
    
    const confirmOnZero = input.dataset.confirmOnZero === 'true';
    const needsConfirmation = input.dataset.needsConfirmation === 'true';
    
    if (needsConfirmation && confirmOnZero) {
        if (value === '0' || value === '' || value === 0) {
            confirmContainer.classList.remove('hidden');
        } else {
            confirmContainer.classList.add('hidden');
            // Auto-confirm when value is not zero
            const checkbox = document.getElementById(`${fieldId}-confirm`);
            if (checkbox) {
                checkbox.checked = true;
                confirmedRequiredFields[fieldId] = true;
            }
        }
    }
}

// Update HTML preview in real-time
function updateHtmlPreview(fieldId) {
    const textarea = document.getElementById(fieldId);
    const preview = document.getElementById(`${fieldId}-preview`);
    
    if (!textarea || !preview) return;
    
    const htmlContent = textarea.value.trim();
    
    if (htmlContent) {
        // Sanitize and render HTML preview
        try {
            preview.innerHTML = htmlContent;
        } catch (error) {
            preview.innerHTML = '<span class="text-red-500 italic">Error al renderizar HTML</span>';
        }
    } else {
        preview.innerHTML = '<span class="text-gray-400 italic">Sin contenido</span>';
    }
}

// Toggle HTML preview visibility
function toggleHtmlPreview(fieldId) {
    const preview = document.getElementById(`${fieldId}-preview`);
    const toggleText = document.getElementById(`${fieldId}-preview-toggle-text`);
    
    if (!preview || !toggleText) return;
    
    if (preview.style.display === 'none') {
        preview.style.display = 'block';
        toggleText.textContent = 'Ocultar';
    } else {
        preview.style.display = 'none';
        toggleText.textContent = 'Mostrar';
    }
}

// Render dynamic languages field
function renderDynamicLanguagesField(prop) {
    return `
        <div class="property-row p-4 rounded-xl" id="dynamic-languages-container" data-prop-key="${prop.key}">
            <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3">
                    <span class="font-mono text-sm text-electric-light">portal.languages.language[N]</span>
                    <span class="required-badge text-xs px-2 py-0.5 rounded-full text-white">Requerido</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-white font-medium">${prop.label}</span>
                    <div class="tooltip-trigger relative">
                        <svg class="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <div class="info-tooltip absolute bottom-full left-0 mb-2 w-64 glass-card rounded-lg text-sm z-10">
                            ${prop.description}
                        </div>
                    </div>
                </div>
                <div id="languages-inputs-container" class="language-input-container">
                    <!-- Languages will be rendered here dynamically -->
                </div>
            </div>
        </div>
    `;
}

// Initialize languages
function initializeLanguages() {
    renderLanguageInputs();
}

// Render language inputs based on count
function renderLanguageInputs() {
    const container = document.getElementById('languages-inputs-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 1; i <= languageCount; i++) {
        const value = languageValues[i - 1] || '';
        container.innerHTML += `
            <div class="language-item">
                <label class="text-sm text-gray-400">Idioma ${i}:</label>
                <input type="text" 
                       id="global-portal.languages.language${i}"
                       class="input-field w-24 px-3 py-2 rounded-lg text-gray-100 language-input"
                       data-key="portal.languages.language${i}"
                       data-language-index="${i}"
                       data-needs-confirmation="true"
                       value="${value}"
                       placeholder="ej: es"
                       maxlength="5">
                <input type="checkbox" 
                       id="global-portal.languages.language${i}-confirm"
                       class="confirm-checkbox cursor-pointer"
                       data-confirm-for="global-portal.languages.language${i}"
                       title="Confirmar"
                       onchange="handleConfirmChange('global-portal.languages.language${i}', this.checked)">
            </div>
        `;
    }
}

// Handle language count change
function handleLanguageCountChange(newCount) {
    newCount = parseInt(newCount) || 1;
    if (newCount < 1) newCount = 1;
    if (newCount > 10) newCount = 10;
    
    // Save current values
    const inputs = document.querySelectorAll('.language-input');
    inputs.forEach((input, index) => {
        languageValues[index] = input.value;
    });
    
    languageCount = newCount;
    
    // Extend or trim the values array
    while (languageValues.length < newCount) {
        languageValues.push('');
    }
    
    renderLanguageInputs();
}

// Initialize dynamic row list
function initializeDynamicRowList() {
    updateDynamicRowSelect();
}

// Initialize generic repeatable fields and dynamic options
function initializeDynamicFields() {
    updateRepeatableFields();
    updateDynamicOptionsSelects();
    setupDynamicFieldListeners();
}

// Setup event listeners for dynamic fields
function setupDynamicFieldListeners() {
    // Listen for changes on fields that control repeatable fields
    document.querySelectorAll('[data-repeat-container]').forEach(container => {
        const basedOnKey = container.dataset.repeatBasedOn;
        const sourceInput = document.querySelector(`[data-key="${basedOnKey}"]`);
        
        if (sourceInput) {
            // Remove existing listener to prevent duplicates
            sourceInput.removeEventListener('input', handleRepeatableSourceChange);
            sourceInput.addEventListener('input', handleRepeatableSourceChange);
        }
    });
    
    // Listen for changes on fields that control dynamic options
    document.querySelectorAll('[data-dynamic-options-from]').forEach(select => {
        const sourceKey = select.dataset.dynamicOptionsFrom;
        const sourceInput = document.querySelector(`[data-key="${sourceKey}"]`);
        
        if (sourceInput) {
            sourceInput.removeEventListener('input', handleDynamicOptionsSourceChange);
            sourceInput.addEventListener('input', handleDynamicOptionsSourceChange);
        }
    });
}

// Handle changes in repeatable source field
function handleRepeatableSourceChange(event) {
    updateRepeatableFields();
}

// Handle changes in dynamic options source field
function handleDynamicOptionsSourceChange(event) {
    updateDynamicOptionsSelects();
}

// Update dynamic row select based on row list input
function updateDynamicRowSelect() {
    const rowListInput = document.querySelector('[data-dynamic-row-list="true"]');
    const dynamicSelects = document.querySelectorAll('.dynamic-row-select');
    
    if (!rowListInput) return;
    
    const values = rowListInput.value.split(',').map(v => v.trim()).filter(v => v);
    
    dynamicSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = values.map(val => 
            `<option value="${val}" ${val === currentValue ? 'selected' : ''}>${val}</option>`
        ).join('');
        
        // If current value is not in the list, select the first one
        if (!values.includes(currentValue) && values.length > 0) {
            select.value = values[0];
        }
    });
}

// Generic function to update all dynamic selects based on source field
function updateDynamicOptionsSelects() {
    document.querySelectorAll('[data-dynamic-options-from]').forEach(select => {
        const sourceKey = select.dataset.dynamicOptionsFrom;
        const separator = select.dataset.optionsSeparator || ',';
        const sourceInput = document.querySelector(`[data-key="${sourceKey}"]`);
        
        if (!sourceInput) return;
        
        const values = sourceInput.value.split(separator).map(v => v.trim()).filter(v => v);
        const currentValue = select.value;
        
        select.innerHTML = values.map(val => 
            `<option value="${val}" ${val === currentValue ? 'selected' : ''}>${val}</option>`
        ).join('');
        
        if (!values.includes(currentValue) && values.length > 0) {
            select.value = values[0];
        }
    });
}

// Generic function to handle repeatable fields based on count
function updateRepeatableFields() {
    document.querySelectorAll('[data-repeat-container]').forEach(container => {
        const basedOnKey = container.dataset.repeatBasedOn;
        const keyTemplate = container.dataset.repeatKeyTemplate;
        const labelTemplate = container.dataset.repeatLabelTemplate || 'Item';
        const placeholder = container.dataset.repeatPlaceholder || '[N]';
        const defaultValues = JSON.parse(container.dataset.repeatDefaults || '[]');
        const needsConfirmation = container.dataset.repeatNeedsConfirmation === 'true';
        
        const countInput = document.querySelector(`[data-key="${basedOnKey}"]`);
        if (!countInput) return;
        
        const count = parseInt(countInput.value) || 0;
        const maxCount = 20; // Limit to prevent too many fields
        const actualCount = Math.min(Math.max(count, 0), maxCount);
        
        // Save current values before re-rendering
        const savedValues = {};
        container.querySelectorAll('input[data-repeat-index]').forEach(input => {
            savedValues[input.dataset.repeatIndex] = input.value;
        });
        
        let html = '';
        for (let i = 1; i <= actualCount; i++) {
            const fieldKey = keyTemplate.replace(placeholder, i).replace('[N]', i).replace('{N}', i);
            const fieldId = `global-${fieldKey}`;
            const savedValue = savedValues[i] !== undefined ? savedValues[i] : (defaultValues[i - 1] || '');
            
            html += `
                <div class="flex items-center gap-3 mb-2">
                    <label class="text-sm text-gray-400 w-20">${labelTemplate} ${i}:</label>
                    <input type="text" 
                           id="${fieldId}"
                           class="input-field w-32 px-3 py-2 rounded-lg text-gray-100"
                           data-key="${fieldKey}"
                           data-repeat-index="${i}"
                           ${needsConfirmation ? 'data-needs-confirmation="true"' : ''}
                           value="${escapeAttr(savedValue)}"
                           placeholder="Valor ${i}">
                    ${needsConfirmation ? `
                        <input type="checkbox" 
                               id="${fieldId}-confirm"
                               class="confirm-checkbox cursor-pointer"
                               data-confirm-for="${fieldId}"
                               title="Confirmar"
                               onchange="handleConfirmChange('${fieldId}', this.checked)">
                    ` : ''}
                </div>
            `;
        }
        
        container.innerHTML = html || '<span class="text-gray-500 text-sm">Ingrese un valor mayor a 0</span>';
    });
}

// Render repeatable field (generic version)
function renderRepeatableField(prop, context, domainIndex = null) {
    const repeatConfig = prop.repeatBasedOn || {};
    const basedOnKey = repeatConfig.key || '';
    const placeholder = repeatConfig.placeholder || '[N]';
    const labelTemplate = repeatConfig.label || 'Item';
    const defaults = Array.isArray(prop.default) ? prop.default : [];
    
    const requiredBadge = prop.required 
        ? '<span class="required-badge text-xs px-2 py-0.5 rounded-full text-white">Requerido</span>'
        : '<span class="optional-badge text-xs px-2 py-0.5 rounded-full text-gray-400">Opcional</span>';
    
    // Handle dependsOn for repeatable fields
    let dependsOnAttrs = '';
    if (prop.dependsOn && prop.dependsOn.key) {
        dependsOnAttrs = `data-depends-on="${escapeAttr(prop.dependsOn.key)}" data-depends-value="${escapeAttr(prop.dependsOn.value)}"`;
    }
    
    return `
        <div class="property-row p-4 rounded-xl" data-prop-key="${prop.key}" ${dependsOnAttrs}>
            <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3 flex-wrap">
                    <span class="font-mono text-sm text-electric-light">${escapeHtml(prop.key)}${placeholder}</span>
                    ${requiredBadge}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Repetible</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-white font-medium">${escapeHtml(prop.label)}</span>
                    <div class="tooltip-trigger relative">
                        <svg class="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <div class="info-tooltip absolute bottom-full left-0 mb-2 w-64 glass-card rounded-lg text-sm z-10">
                            ${escapeHtml(prop.description || '')}
                            <br><br>
                            <strong>Se repite según:</strong> ${escapeHtml(basedOnKey)}
                        </div>
                    </div>
                </div>
                <div data-repeat-container
                     data-repeat-based-on="${escapeAttr(basedOnKey)}"
                     data-repeat-key-template="${escapeAttr(prop.key)}"
                     data-repeat-label-template="${escapeAttr(labelTemplate)}"
                     data-repeat-placeholder="${escapeAttr(placeholder)}"
                     data-repeat-defaults='${JSON.stringify(defaults)}'
                     data-repeat-needs-confirmation="${prop.needsConfirmation ? 'true' : 'false'}"
                     class="flex flex-wrap gap-4">
                    <!-- Fields will be rendered dynamically -->
                </div>
            </div>
        </div>
    `;
}

// Render dynamic options select (generic version)
function renderDynamicOptionsSelect(prop, context, domainIndex = null) {
    const fieldId = domainIndex !== null 
        ? `domain-${domainIndex}-${prop.key.replace(/\{N\}/g, domainIndex)}`
        : `global-${prop.key}`;
    
    const optionsConfig = prop.dynamicOptionsFrom || {};
    const sourceKey = optionsConfig.key || '';
    const separator = optionsConfig.separator || ',';
    
    const requiredBadge = prop.required 
        ? '<span class="required-badge text-xs px-2 py-0.5 rounded-full text-white">Requerido</span>'
        : '<span class="optional-badge text-xs px-2 py-0.5 rounded-full text-gray-400">Opcional</span>';
    
    // Handle dependsOn for dynamic options fields
    let dependsOnAttrs = '';
    if (prop.dependsOn && prop.dependsOn.key) {
        dependsOnAttrs = `data-depends-on="${escapeAttr(prop.dependsOn.key)}" data-depends-value="${escapeAttr(prop.dependsOn.value)}"`;
    }
    
    return `
        <div class="property-row p-4 rounded-xl" data-prop-key="${prop.key}" ${dependsOnAttrs}>
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-1 flex-wrap">
                        <span class="font-mono text-sm text-electric-light break-all">${escapeHtml(prop.key)}</span>
                        ${requiredBadge}
                        <span class="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Opciones Dinámicas</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-white font-medium">${escapeHtml(prop.label)}</span>
                        <div class="tooltip-trigger relative">
                            <svg class="w-4 h-4 text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <div class="info-tooltip absolute bottom-full left-0 mb-2 w-64 glass-card rounded-lg text-sm z-10">
                                ${escapeHtml(prop.description || '')}
                                <br><br>
                                <strong>Opciones de:</strong> ${escapeHtml(sourceKey)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex-shrink-0">
                    <select id="${fieldId}" 
                            class="input-field w-full md:w-48 px-4 py-2.5 rounded-lg text-gray-100"
                            data-key="${prop.key}"
                            data-dynamic-options-from="${escapeAttr(sourceKey)}"
                            data-options-separator="${escapeAttr(separator)}">
                        <!-- Options will be populated dynamically -->
                    </select>
                </div>
            </div>
        </div>
    `;
}

// Handle confirmation checkbox change
function handleConfirmChange(fieldId, isChecked) {
    confirmedRequiredFields[fieldId] = isChecked;
}

// Validate all confirmations before download
function validateConfirmations() {
    const unconfirmedFields = [];
    
    // Check global properties
    const allConfirmCheckboxes = document.querySelectorAll('.confirm-checkbox:not(.hidden)');
    
    allConfirmCheckboxes.forEach(checkbox => {
        const container = checkbox.closest('.confirm-container');
        if (container && !container.classList.contains('hidden')) {
            const fieldId = checkbox.dataset.confirmFor;
            
            // Check if the parent property row is visible (not hidden by dependency)
            const propertyRow = checkbox.closest('.property-row');
            if (propertyRow) {
                // Check if the property row has a dependency (data-depends-on is on the property-row itself)
                const dependsOn = propertyRow.dataset.dependsOn;
                if (dependsOn) {
                    // If the property row is hidden due to dependency, skip validation
                    if (propertyRow.style.display === 'none') {
                        return; // Skip this checkbox
                    }
                }
                
                // Also check if the property row itself is hidden via computed style
                const computedDisplay = getComputedStyle(propertyRow).display;
                if (computedDisplay === 'none') {
                    return; // Skip this checkbox
                }
            }
            
            if (!checkbox.checked) {
                unconfirmedFields.push({
                    fieldId: fieldId,
                    checkbox: checkbox
                });
            }
        }
    });
    
    // Also check for domain properties that need confirmation
    // We need to check all domains, not just the current one
    saveDomainValues();
    
    return unconfirmedFields;
}

// Check service availability
async function checkService(fieldId) {
    const input = document.getElementById(fieldId);
    const statusContainer = document.getElementById(`${fieldId}-status`);
    
    if (!input || !statusContainer) return;
    
    const url = input.value.trim();
    if (!url) {
        showToast('Ingrese una URL válida', 'error');
        return;
    }
    
    // Show checking status
    statusContainer.classList.remove('hidden', 'online', 'offline');
    statusContainer.classList.add('checking');
    statusContainer.innerHTML = `
        <span class="pulse-dot checking"></span>
        <span class="status-text">Verificando...</span>
    `;
    
    try {
        // Try to fetch the URL - note: this will likely fail due to CORS
        // but we can at least try
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // If we get here, the request completed (even with no-cors we can assume the server responded)
        statusContainer.classList.remove('checking');
        statusContainer.classList.add('online');
        statusContainer.innerHTML = `
            <span class="pulse-dot online"></span>
            <span class="status-text">Disponible</span>
        `;
    } catch (error) {
        statusContainer.classList.remove('checking');
        statusContainer.classList.add('offline');
        statusContainer.innerHTML = `
            <span class="pulse-dot offline"></span>
            <span class="status-text">No disponible</span>
        `;
    }
}

// Check all services
async function checkAllServices() {
    const serviceInputs = document.querySelectorAll('[data-key][id*="url"], [data-key][id*="Url"]');
    showToast('Verificando servicios...', 'info');
    
    for (const input of serviceInputs) {
        const fieldId = input.id;
        if (document.getElementById(`${fieldId}-status`)) {
            await checkService(fieldId);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between checks
        }
    }
    
    showToast('Verificación de servicios completada');
}

// Render domain tabs
function renderDomainTabs() {
    const container = document.getElementById('domainTabs');
    container.innerHTML = domains.map((domain, index) => `
        <button class="domain-tab px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${index === currentDomainIndex ? 'active text-white' : 'text-gray-400 bg-gray-800/50'}"
                onclick="switchDomain(${index})">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                Dominio ${domain.id}
            </div>
        </button>
    `).join('');
}

// Render domain properties
function renderDomainProperties() {
    const container = document.getElementById('domainPropertiesContainer');
    const domain = domains[currentDomainIndex];
    
    let html = '';
    configData.domainProperties.forEach((category, index) => {
        try {
            let propertiesHtml = '';
            category.properties.forEach(prop => {
                propertiesHtml += renderPropertyField(prop, 'domain', domain.id);
            });
            
            // Generate empty category message based on dependencies
            const emptyMessage = generateCategoryEmptyMessage(category.properties);
            
            const domainCategoryId = `domain-category-${index}`;
            html += `
                <div id="${domainCategoryId}" class="glass-card rounded-2xl overflow-hidden fade-in category-collapsible">
                    <div class="category-header px-6 py-4 cursor-pointer flex items-center justify-between" onclick="toggleCategory('${domainCategoryId}')">
                        <h3 class="text-lg font-semibold text-white">${category.category}</h3>
                        <button type="button" class="category-toggle-btn text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5 transform transition-transform duration-300 category-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                    </div>
                    <div class="category-content p-6 space-y-4">
                        ${propertiesHtml}
                        ${emptyMessage}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error rendering domain category:', category.category, error);
        }
    });
    
    container.innerHTML = html;
    
    // Set domain ID value
    const domainIdInput = document.getElementById(`domain-${domain.id}-hrvertical.portalfirma.domain${domain.id}.iddomain`);
    if (domainIdInput && (!domainIdInput.value || domainIdInput.value === '0' || domainIdInput.value === '')) {
        domainIdInput.value = domain.id;
    }
    
    // Restore saved values
    restoreDomainValues();
    
    // Initialize dependencies after rendering
    requestAnimationFrame(() => {
        initializeDependencies();
    });
}

// Switch between domains
function switchDomain(index) {
    // Save current domain values before switching
    saveDomainValues();
    
    currentDomainIndex = index;
    renderDomainTabs();
    renderDomainProperties();
}

// Save current domain values
function saveDomainValues() {
    const domain = domains[currentDomainIndex];
    const container = document.getElementById('domainPropertiesContainer');
    const inputs = container.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        const key = input.dataset.key;
        if (key) {
            if (input.type === 'checkbox' && input.classList.contains('toggle-checkbox')) {
                domain.properties[key] = input.checked;
            } else if (input.type !== 'checkbox') {
                domain.properties[key] = input.value;
            }
        }
    });
    
    // Save confirmed fields for domain
    const confirmCheckboxes = container.querySelectorAll('.confirm-checkbox');
    confirmCheckboxes.forEach(cb => {
        const confirmFor = cb.dataset.confirmFor;
        if (confirmFor) {
            confirmedRequiredFields[confirmFor] = cb.checked;
        }
    });
}

// Restore saved domain values
function restoreDomainValues() {
    const domain = domains[currentDomainIndex];
    const container = document.getElementById('domainPropertiesContainer');
    const inputs = container.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        const key = input.dataset.key;
        if (key && domain.properties.hasOwnProperty(key)) {
            if (input.type === 'checkbox' && input.classList.contains('toggle-checkbox')) {
                input.checked = domain.properties[key];
                updateToggleLabel(input);
            } else if (input.type !== 'checkbox') {
                input.value = domain.properties[key];
                // Update number confirmation visibility
                if (input.type === 'number') {
                    handleNumberChange(input.id, input.value);
                }
            }
        }
    });
    
    // Restore confirmed fields
    const confirmCheckboxes = container.querySelectorAll('.confirm-checkbox');
    confirmCheckboxes.forEach(cb => {
        const confirmFor = cb.dataset.confirmFor;
        if (confirmFor && confirmedRequiredFields.hasOwnProperty(confirmFor)) {
            cb.checked = confirmedRequiredFields[confirmFor];
        }
    });
}

// Add a new domain
function addDomain() {
    saveDomainValues();
    const newId = domains.length + 1;
    domains.push({
        id: newId,
        name: `Dominio ${newId}`,
        properties: {
            'hrvertical.portalfirma.domain{N}.iddomain': newId
        }
    });
    
    // Update total domains in global properties
    const totalInput = document.getElementById('global-hrvertical.portalfirma.dominios.totalconfigurados');
    if (totalInput) {
        totalInput.value = domains.length;
    }
    
    updateRemoveButtonVisibility();
    renderDomainTabs();
    switchDomain(domains.length - 1);
    showToast(`Dominio ${newId} agregado`);
}

// Remove the last domain
function removeDomain() {
    if (domains.length <= 1) {
        showToast('Debe existir al menos un dominio', 'error');
        return;
    }
    
    const removedId = domains[domains.length - 1].id;
    domains.pop();
    
    // Update total domains in global properties
    const totalInput = document.getElementById('global-hrvertical.portalfirma.dominios.totalconfigurados');
    if (totalInput) {
        totalInput.value = domains.length;
    }
    
    updateRemoveButtonVisibility();
    
    if (currentDomainIndex >= domains.length) {
        currentDomainIndex = domains.length - 1;
    }
    
    renderDomainTabs();
    renderDomainProperties();
    showToast(`Dominio ${removedId} eliminado`);
}

// Update remove button visibility
function updateRemoveButtonVisibility() {
    const btn = document.getElementById('btnRemoveDomain');
    if (btn) {
        btn.style.display = domains.length > 1 ? 'flex' : 'none';
    }
}

// Generate properties content
function generatePropertiesContent() {
    saveDomainValues();
    
    let content = '';
    const timestamp = new Date().toLocaleString('es-MX');
    
    // Header
    content += `# ============================================\n`;
    content += `# Archivo de Configuración SeguriSign\n`;
    content += `# Generado: ${timestamp}\n`;
    content += `# ============================================\n\n`;

    // Global Properties
    configData.globalProperties.forEach(category => {
        content += `# ${'-'.repeat(50)}\n`;
        content += `# ${category.category.toUpperCase()}\n`;
        content += `# ${'-'.repeat(50)}\n`;
        
        category.properties.forEach(prop => {
            // Handle repeatable fields (generic)
            if (prop.repeatBasedOn && prop.repeatBasedOn.key) {
                const basedOnKey = prop.repeatBasedOn.key;
                const placeholder = prop.repeatBasedOn.placeholder || '[N]';
                const countInput = document.querySelector(`[data-key="${basedOnKey}"]`);
                const count = countInput ? parseInt(countInput.value) || 0 : 0;
                
                for (let i = 1; i <= count; i++) {
                    const fieldKey = prop.key.replace(placeholder, i).replace('[N]', i).replace('{N}', i);
                    const fieldId = `global-${fieldKey}`;
                    const input = document.getElementById(fieldId);
                    const value = input ? input.value : '';
                    content += `# ${prop.label} ${i}\n`;
                    content += `${fieldKey}=${value}\n`;
                }
                return;
            }
            
            // Handle dynamic options fields
            if (prop.dynamicOptionsFrom && prop.dynamicOptionsFrom.key) {
                const inputId = `global-${prop.key}`;
                const input = document.getElementById(inputId);
                const value = input ? input.value : '';
                if (prop.description) {
                    content += `# ${prop.description}\n`;
                }
                content += `${prop.key}=${value}\n`;
                return;
            }
            
            // Handle dynamic languages specially (legacy support)
            if (prop.type === 'dynamicLanguages') {
                for (let i = 1; i <= languageCount; i++) {
                    const langInput = document.getElementById(`global-portal.languages.language${i}`);
                    const value = langInput ? langInput.value : '';
                    content += `# Código del idioma ${i}\n`;
                    content += `portal.languages.language${i}=${value}\n`;
                }
                return;
            }
            
            const inputId = `global-${prop.key}`;
            const input = document.getElementById(inputId);
            let value = '';
            
            if (input) {
                if (input.type === 'checkbox' && input.classList.contains('toggle-checkbox')) {
                    const booleanType = input.dataset.booleanType;
                    if (booleanType === 'string') {
                        value = input.checked ? 'true' : 'false';
                    } else {
                        value = input.checked ? '1' : '0';
                    }
                } else if (input.type !== 'checkbox') {
                    value = input.value;
                }
            } else {
                value = prop.default || '';
            }
            
            // Add comment with description
            if (prop.description) {
                content += `# ${prop.description}\n`;
            }
            content += `${prop.key}=${value}\n`;
        });
        content += '\n';
    });

    // Domain Properties
    domains.forEach((domain, domainIdx) => {
        content += `# ${'='.repeat(50)}\n`;
        content += `# DOMINIO ${domain.id}\n`;
        content += `# ${'='.repeat(50)}\n\n`;
        
        configData.domainProperties.forEach(category => {
            content += `# ${'-'.repeat(40)}\n`;
            content += `# ${category.category}\n`;
            content += `# ${'-'.repeat(40)}\n`;
            
            category.properties.forEach(prop => {
                const actualKey = prop.key.replace(/\{N\}/g, domain.id);
                let value = '';
                
                // Check if we have a saved value
                if (domain.properties.hasOwnProperty(prop.key)) {
                    const savedValue = domain.properties[prop.key];
                    if (prop.type === 'boolean') {
                        if (prop.booleanType === 'string') {
                            value = savedValue ? 'true' : 'false';
                        } else {
                            value = savedValue ? '1' : '0';
                        }
                    } else {
                        value = savedValue;
                    }
                } else {
                    // Use default value or domain ID for iddomain field
                    if (prop.autoFillDomainId) {
                        value = domain.id;
                    } else if (prop.type === 'boolean') {
                        value = prop.default || (prop.booleanType === 'string' ? 'false' : '0');
                    } else {
                        value = prop.default || '';
                    }
                }
                
                // Add comment with description
                if (prop.description) {
                    content += `# ${prop.description}\n`;
                }
                content += `${actualKey}=${value}\n`;
            });
            content += '\n';
        });
    });

    return content;
}

// Preview properties
function previewProperties() {
    const content = generatePropertiesContent();
    document.getElementById('previewContent').textContent = content;
    
    // Update preview title with the output file name
    const previewTitle = document.getElementById('previewTitle');
    if (previewTitle && configData) {
        previewTitle.textContent = `Vista Previa - ${configData.outputFileName || 'config.properties'}`;
    }
    
    document.getElementById('previewModal').classList.remove('hidden');
}

// Close preview
function closePreview() {
    document.getElementById('previewModal').classList.add('hidden');
}

// Download properties file
function downloadProperties() {
    // Validate confirmations first
    const unconfirmed = validateConfirmations();
    
    if (unconfirmed.length > 0) {
        // Find the first unconfirmed field and scroll to it
        const firstUnconfirmed = unconfirmed[0];
        const checkbox = firstUnconfirmed.checkbox;
        const row = checkbox.closest('.property-row');
        
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('ring-2', 'ring-coral', 'ring-opacity-50');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
                row.classList.remove('ring-2', 'ring-coral', 'ring-opacity-50');
            }, 3000);
        }
        
        showToast(`Hay ${unconfirmed.length} campo(s) sin confirmar. Por favor, confirme todos los valores antes de descargar.`, 'error');
        return;
    }
    
    const content = generatePropertiesContent();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Use the output file name from the configuration, or default to 'config.properties'
    const outputFileName = configData.outputFileName || 'config.properties';
    
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Archivo "${outputFileName}" descargado exitosamente`);
}

// Copy to clipboard
function copyToClipboard() {
    const content = document.getElementById('previewContent').textContent;
    navigator.clipboard.writeText(content).then(() => {
        showToast('Copiado al portapapeles');
    }).catch(() => {
        showToast('Error al copiar', 'error');
    });
}

// Toggle password visibility
function togglePassword(fieldId) {
    const input = document.getElementById(fieldId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

// Update toggle label
function updateToggleLabel(checkbox) {
    const label = checkbox.parentElement.querySelector('span:last-child');
    if (label) {
        label.textContent = checkbox.checked ? 'Habilitado' : 'Deshabilitado';
    }
}

// Scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Toggle individual category collapse/expand
function toggleCategory(categoryId) {
    const category = document.getElementById(categoryId);
    if (!category) return;
    
    const content = category.querySelector('.category-content');
    const chevron = category.querySelector('.category-chevron');
    
    if (!content) return;
    
    const isCollapsed = category.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Expand
        category.classList.remove('collapsed');
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.opacity = '1';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        
        // Remove max-height after animation
        setTimeout(() => {
            content.style.maxHeight = 'none';
        }, 300);
    } else {
        // Collapse
        content.style.maxHeight = content.scrollHeight + 'px';
        // Force reflow
        content.offsetHeight;
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        category.classList.add('collapsed');
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
    }
}

// Expand all categories
function expandAllCategories() {
    document.querySelectorAll('.category-collapsible.collapsed').forEach(category => {
        const content = category.querySelector('.category-content');
        const chevron = category.querySelector('.category-chevron');
        
        category.classList.remove('collapsed');
        if (content) {
            content.style.maxHeight = content.scrollHeight + 'px';
            content.style.opacity = '1';
            setTimeout(() => {
                content.style.maxHeight = 'none';
            }, 300);
        }
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    });
    showToast('Todas las categorías expandidas', 'info');
}

// Collapse all categories
function collapseAllCategories() {
    document.querySelectorAll('.category-collapsible:not(.collapsed)').forEach(category => {
        const content = category.querySelector('.category-content');
        const chevron = category.querySelector('.category-chevron');
        
        if (content) {
            content.style.maxHeight = content.scrollHeight + 'px';
            content.offsetHeight; // Force reflow
            content.style.maxHeight = '0';
            content.style.opacity = '0';
        }
        category.classList.add('collapsed');
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
    });
    showToast('Todas las categorías contraídas', 'info');
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    
    toastMessage.textContent = message;
    
    // Update icon based on type
    if (type === 'error') {
        toastIcon.classList.remove('text-emerald-accent');
        toastIcon.classList.add('text-coral');
        toastIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`;
    } else if (type === 'info') {
        toastIcon.classList.remove('text-emerald-accent', 'text-coral');
        toastIcon.classList.add('text-electric-light');
        toastIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`;
    } else {
        toastIcon.classList.remove('text-coral', 'text-electric-light');
        toastIcon.classList.add('text-emerald-accent');
        toastIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`;
    }
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Setup event listeners
function setupEventListeners() {
    // Listen for checkbox changes to update labels
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('toggle-checkbox')) {
            updateToggleLabel(e.target);
        }
        
        // Handle dependency fields
        if (e.target.dataset.key) {
            const fieldValue = e.target.type === 'checkbox' 
                ? String(e.target.checked) 
                : e.target.value;
            handleDependencies(e.target.dataset.key, fieldValue);
        }
        
        // Handle total domains change
        if (e.target.id === 'global-hrvertical.portalfirma.dominios.totalconfigurados') {
            handleDomainsCountChange(parseInt(e.target.value) || 1);
        }
        
        // Handle dynamic language count change
        if (e.target.dataset.dynamicLanguageCount === 'true') {
            handleLanguageCountChange(e.target.value);
        }
        
        // Handle dynamic row list change
        if (e.target.dataset.dynamicRowList === 'true') {
            updateDynamicRowSelect();
        }
    });
    
    // Listen for input changes on row list
    document.addEventListener('input', (e) => {
        if (e.target.dataset.dynamicRowList === 'true') {
            updateDynamicRowSelect();
        }
    });
    
    // Initial dependency check - use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
        setTimeout(() => {
            initializeDependencies();
        }, 50);
    });
}

// Initialize all dependencies - call this after any render
function initializeDependencies() {
    // First: trigger handleDependencies for all fields that have dependents
    const fieldsWithDependents = new Set();
    
    document.querySelectorAll('[data-depends-on]').forEach(field => {
        fieldsWithDependents.add(field.dataset.dependsOn);
    });
    
    // Trigger dependency check for each source field
    fieldsWithDependents.forEach(key => {
        const sourceField = document.querySelector(`[data-key="${key}"]`);
        if (sourceField) {
            const value = sourceField.type === 'checkbox' 
                ? String(sourceField.checked) 
                : sourceField.value;
            handleDependencies(key, value);
        }
    });
    
    // Second pass: cascade - ensure all nested dependencies are properly hidden
    let changed = true;
    let iterations = 0;
    const maxIterations = 10;
    
    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        document.querySelectorAll('[data-depends-on]').forEach(field => {
            // Skip already hidden fields
            if (field.style.display === 'none') return;
            
            const dependsOn = field.dataset.dependsOn;
            const dependsValue = field.dataset.dependsValue;
            const sourceField = document.querySelector(`[data-key="${dependsOn}"]`);
            
            // If source field doesn't exist, check if it might be hidden
            if (!sourceField) {
                field.style.display = 'none';
                changed = true;
                return;
            }
            
            // Check if parent row is visible
            const sourceRow = sourceField.closest('.property-row');
            if (sourceRow && sourceRow.style.display === 'none') {
                field.style.display = 'none';
                changed = true;
                return;
            }
            
            // Check value match
            const currentValue = sourceField.type === 'checkbox' 
                ? String(sourceField.checked)
                : sourceField.value;
            
            if (!valuesMatch(currentValue, dependsValue)) {
                field.style.display = 'none';
                changed = true;
            }
        });
    }
    
    // Update empty category messages
    updateCategoryEmptyMessages();
}

// Update visibility of empty category messages
function updateCategoryEmptyMessages() {
    document.querySelectorAll('.category-content').forEach(content => {
        const propertyRows = content.querySelectorAll('.property-row');
        const emptyMessage = content.querySelector('.category-empty-message');
        
        if (!emptyMessage) return;
        
        // Count visible property rows
        let visibleCount = 0;
        propertyRows.forEach(row => {
            if (row.style.display !== 'none') {
                visibleCount++;
            }
        });
        
        // Show/hide the empty message
        if (visibleCount === 0) {
            emptyMessage.classList.remove('hidden');
        } else {
            emptyMessage.classList.add('hidden');
        }
    });
}

// Normalize boolean values for comparison
function normalizeBooleanValue(value) {
    // Convert to string first
    const strValue = String(value).toLowerCase().trim();
    
    // Map various boolean representations
    if (strValue === 'true' || strValue === '1' || strValue === 'on' || strValue === 'yes') {
        return 'true';
    }
    if (strValue === 'false' || strValue === '0' || strValue === 'off' || strValue === 'no') {
        return 'false';
    }
    
    // Return original string for non-boolean values
    return strValue;
}

// Check if values match (handling boolean variations)
function valuesMatch(currentValue, expectedValue) {
    const normalizedCurrent = normalizeBooleanValue(currentValue);
    const normalizedExpected = normalizeBooleanValue(expectedValue);
    
    return normalizedCurrent === normalizedExpected;
}

// Handle dependencies with cascade support
function handleDependencies(key, value) {
    document.querySelectorAll(`[data-depends-on="${key}"]`).forEach(field => {
        const dependsValue = field.dataset.dependsValue;
        const shouldShow = valuesMatch(value, dependsValue);
        
        // Also check if any parent in the chain is hidden
        const isParentVisible = isFieldParentVisible(field);
        const finalShow = shouldShow && isParentVisible;
        
        field.style.display = finalShow ? 'block' : 'none';
        
        // Find input inside this field and cascade to its dependents
        const input = field.querySelector('[data-key]');
        if (input) {
            const childKey = input.dataset.key;
            const childValue = input.type === 'checkbox' 
                ? String(input.checked) 
                : input.value;
            
            // If this field is now hidden, cascade hide all its dependents
            // by passing a value that won't match (empty string)
            if (!finalShow) {
                handleDependencies(childKey, '__HIDDEN__');
            } else {
                // Re-evaluate dependents with current value
                handleDependencies(childKey, childValue);
            }
        }
    });
    
    // Update empty category messages after dependency changes
    updateCategoryEmptyMessages();
}

// Check if a field's parent dependency chain is all visible
function isFieldParentVisible(field) {
    const dependsOn = field.dataset.dependsOn;
    if (!dependsOn) return true;
    
    // Find the source field
    const sourceField = document.querySelector(`[data-key="${dependsOn}"]`);
    if (!sourceField) return true;
    
    // Find the property-row containing the source field
    const sourceRow = sourceField.closest('.property-row');
    if (!sourceRow) return true;
    
    // If source row is hidden, this field should also be hidden
    if (sourceRow.style.display === 'none') {
        return false;
    }
    
    // Recursively check if parent's parent is visible
    return isFieldParentVisible(sourceRow);
}

// Handle domains count change
function handleDomainsCountChange(newCount) {
    if (newCount < 1) newCount = 1;
    if (newCount > 10) newCount = 10; // Max 10 domains
    
    saveDomainValues();
    
    while (domains.length < newCount) {
        const newId = domains.length + 1;
        domains.push({
            id: newId,
            name: `Dominio ${newId}`,
            properties: {
                'hrvertical.portalfirma.domain{N}.iddomain': newId
            }
        });
    }
    
    while (domains.length > newCount) {
        domains.pop();
    }
    
    if (currentDomainIndex >= domains.length) {
        currentDomainIndex = domains.length - 1;
    }
    
    updateRemoveButtonVisibility();
    renderDomainTabs();
    renderDomainProperties();
}

// Export configuration as JSON
function exportConfigAsJSON() {
    saveDomainValues();
    
    const exportData = {
        global: {},
        domains: {},
        languages: languageValues.slice(0, languageCount)
    };
    
    // Collect global values
    configData.globalProperties.forEach(category => {
        category.properties.forEach(prop => {
            if (prop.type === 'dynamicLanguages') return;
            
            const input = document.getElementById(`global-${prop.key}`);
            if (input) {
                if (input.type === 'checkbox' && input.classList.contains('toggle-checkbox')) {
                    exportData.global[prop.key] = input.checked;
                } else if (input.type !== 'checkbox') {
                    exportData.global[prop.key] = input.value;
                }
            }
        });
    });
    
    // Collect domain values
    domains.forEach(domain => {
        exportData.domains[`domain${domain.id}`] = { ...domain.properties };
    });
    
    return exportData;
}

// Import configuration from JSON
function importConfigFromJSON(data) {
    // Set global values
    if (data.global) {
        Object.entries(data.global).forEach(([key, value]) => {
            const input = document.getElementById(`global-${key}`);
            if (input) {
                if (input.type === 'checkbox' && input.classList.contains('toggle-checkbox')) {
                    input.checked = value;
                    updateToggleLabel(input);
                } else if (input.type !== 'checkbox') {
                    input.value = value;
                }
            }
        });
    }
    
    // Set languages
    if (data.languages) {
        languageValues = data.languages;
        languageCount = data.languages.length;
        const langCountInput = document.getElementById('global-portal.languages.total');
        if (langCountInput) {
            langCountInput.value = languageCount;
        }
        renderLanguageInputs();
    }
    
    // Set domain values
    if (data.domains) {
        Object.entries(data.domains).forEach(([domainKey, props]) => {
            const domainNum = parseInt(domainKey.replace('domain', ''));
            const domainIndex = domains.findIndex(d => d.id === domainNum);
            if (domainIndex !== -1) {
                domains[domainIndex].properties = { ...props };
            }
        });
        
        // Restore current domain
        restoreDomainValues();
    }
    
    showToast('Configuración importada exitosamente');
}

// =====================================================
// JSON EDITOR FUNCTIONS
// =====================================================

let editorProperties = [];
let editorCategories = [];
let editorFileName = '';

// Parse .properties file for editor (returns raw properties)
function parsePropertiesFileForEditor(content, fileName) {
    const lines = content.split('\n');
    const properties = [];
    
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line || line.startsWith('#') || line.startsWith('!')) {
            return;
        }
        
        const separatorIndex = line.search(/[=:]/);
        if (separatorIndex === -1) return;
        
        const key = line.substring(0, separatorIndex).trim();
        let value = line.substring(separatorIndex + 1).trim();
        
        // Detect property type
        let type = 'text';
        let booleanType = null;
        
        if (value === 'true' || value === 'false') {
            type = 'boolean';
            booleanType = 'string';
        } else if (value === '1' || value === '0') {
            type = 'boolean';
            booleanType = 'number';
        } else if (/^\d+$/.test(value)) {
            type = 'number';
        } else if (value.startsWith('http://') || value.startsWith('https://')) {
            type = 'url';
        } else if (/<[a-z][\s\S]*>/i.test(value)) {
            // Detect HTML content
            type = 'html';
        }
        
        // Determine category from key
        const parts = key.split('.');
        let category = 'General';
        if (parts.length >= 2) {
            category = parts.slice(0, 2).join('.');
        }
        
        // Check if this is a domain property using configurable pattern
        const domainPattern = getDomainKeyPattern();
        const isDomainProp = checkIfDomainProperty(key, domainPattern);
        
        properties.push({
            id: `prop_${index}`,
            key: key,
            label: generateLabel(key),
            type: type,
            default: value,
            required: false,
            needsConfirmation: type === 'text' || type === 'url',
            description: `Propiedad: ${key}`,
            category: category,
            isDomain: isDomainProp,
            booleanType: booleanType,
            checkService: type === 'url',
            options: [],
            dependsOn: null
        });
    });
    
    return properties;
}

// Generate label from property key
function generateLabel(key) {
    const parts = key.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart
        .replace(/([A-Z])/g, ' $1')
        .replace(/[_-]/g, ' ')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Open JSON Editor with parsed properties
function openJsonEditor(properties, fileName) {
    editorProperties = properties;
    editorFileName = fileName;
    
    // Group properties by category
    editorCategories = [];
    const categoryMap = new Map();
    
    properties.forEach(prop => {
        if (!categoryMap.has(prop.category)) {
            categoryMap.set(prop.category, []);
        }
        categoryMap.get(prop.category).push(prop);
    });
    
    categoryMap.forEach((props, categoryName) => {
        editorCategories.push({
            id: `cat_${editorCategories.length}`,
            name: formatCategoryName(categoryName),
            originalName: categoryName,
            icon: 'settings',
            properties: props,
            isDomain: props.some(p => p.isDomain)
        });
    });
    
    // Set project info
    const projectName = fileName.replace('.properties', '').replace(/[-_]/g, ' ');
    document.getElementById('editorProjectName').value = projectName.charAt(0).toUpperCase() + projectName.slice(1);
    document.getElementById('editorProjectVersion').value = '1.0.0';
    document.getElementById('editorDomainKeyPattern').value = 'domain{N}';
    document.getElementById('jsonEditorSubtitle').textContent = `${properties.length} propiedades desde ${fileName}`;
    
    // Render editor
    renderJsonEditor();
    
    // Show modal
    document.getElementById('jsonEditorModal').classList.remove('hidden');
}

// Open editor empty for new configuration
function openJsonEditorEmpty() {
    editorCategories = [];
    editorProperties = [];
    editorFileName = 'nueva-config.json';
    
    // Clear project info
    document.getElementById('editorProjectName').value = '';
    document.getElementById('editorProjectVersion').value = '1.0.0';
    document.getElementById('editorDomainKeyPattern').value = 'domain{N}';
    document.getElementById('jsonEditorSubtitle').textContent = 'Nueva configuración';
    
    // Clear category select if exists
    const categorySelect = document.getElementById('editorCategorySelect');
    if (categorySelect) {
        categorySelect.value = '';
    }
    const newCategoryInput = document.getElementById('editorNewCategory');
    if (newCategoryInput) {
        newCategoryInput.classList.add('hidden');
        newCategoryInput.value = '';
    }
    const subcategoryInput = document.getElementById('editorSubcategory');
    if (subcategoryInput) {
        subcategoryInput.value = '';
    }
    
    // Render empty editor
    renderJsonEditor();
    
    // Show modal
    document.getElementById('jsonEditorModal').classList.remove('hidden');
}

// Edit current loaded configuration (from JSON)
function openJsonEditorWithCurrentConfig() {
    if (!configData) {
        openJsonEditorEmpty();
        return;
    }
    
    // Convert configData to editor format
    editorCategories = [];
    editorFileName = currentConfigFile;
    
    // Process global properties
    if (configData.globalProperties && configData.globalProperties.length > 0) {
        configData.globalProperties.forEach((category, index) => {
            const props = category.properties.map((prop, pIndex) => ({
                ...prop,
                id: prop.id || `global_${index}_${pIndex}`,
                category: category.category,
                isDomain: false
            }));
            
            editorCategories.push({
                id: `cat_global_${index}`,
                name: category.category,
                originalName: category.category,
                icon: 'settings',
                properties: props,
                isDomain: false
            });
        });
    }
    
    // Process domain properties
    if (configData.domainProperties && configData.domainProperties.length > 0) {
        configData.domainProperties.forEach((category, index) => {
            const props = category.properties.map((prop, pIndex) => ({
                ...prop,
                id: prop.id || `domain_${index}_${pIndex}`,
                category: category.category,
                isDomain: true
            }));
            
            editorCategories.push({
                id: `cat_domain_${index}`,
                name: category.category,
                originalName: category.category,
                icon: 'server',
                properties: props,
                isDomain: true
            });
        });
    }
    
    // Flatten properties for editorProperties
    editorProperties = [];
    editorCategories.forEach(cat => {
        editorProperties.push(...cat.properties);
    });
    
    // Set project info from configData
    document.getElementById('editorProjectName').value = configData.projectName || 'Sin nombre';
    document.getElementById('editorProjectVersion').value = configData.version || '1.0.0';
    document.getElementById('editorDomainKeyPattern').value = configData.domainKeyPattern || 'domain{N}';
    document.getElementById('jsonEditorSubtitle').textContent = `${editorProperties.length} propiedades - ${currentConfigFile}`;
    
    // Set subcategory if available
    const subcategoryInput = document.getElementById('editorSubcategory');
    if (subcategoryInput) {
        subcategoryInput.value = configData.subcategory || '';
    }
    
    // Render editor
    renderJsonEditor();
    
    // Show modal
    document.getElementById('jsonEditorModal').classList.remove('hidden');
    showToast('Editor de configuración abierto', 'info');
}

// Close JSON Editor
function closeJsonEditor() {
    document.getElementById('jsonEditorModal').classList.add('hidden');
}

// Render the JSON Editor content
function renderJsonEditor() {
    const container = document.getElementById('jsonEditorContent');
    
    // Save collapsed state before re-rendering
    const collapsedCategories = new Set();
    document.querySelectorAll('.editor-category-collapsible.editor-collapsed').forEach(el => {
        collapsedCategories.add(el.dataset.categoryId);
    });
    
    let html = '';
    
    editorCategories.forEach((category, catIndex) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const isDomainBadge = category.isDomain 
            ? '<span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 ml-2" title="Estas propiedades se repetirán por cada dominio">🔄 Por Dominio</span>' 
            : '<span class="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 ml-2" title="Propiedades globales de la aplicación">🌐 Global</span>';
        
        const collapsedClass = isCollapsed ? 'editor-collapsed' : '';
        const chevronStyle = isCollapsed ? 'transform: rotate(-90deg);' : '';
        const contentStyle = isCollapsed ? 'max-height: 0; opacity: 0; padding: 0 1rem;' : '';
        
        html += `
            <div class="editor-category-card mb-6 editor-category-collapsible ${collapsedClass}" data-category-id="${category.id}">
                <div class="editor-category-header px-5 py-3 rounded-t-xl flex items-center justify-between cursor-pointer" onclick="toggleEditorCategory('${category.id}')">
                    <div class="flex items-center">
                        <button type="button" class="mr-3 text-gray-400 hover:text-white transition-colors">
                            <svg class="w-5 h-5 transform transition-transform duration-300 editor-category-chevron" style="${chevronStyle}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                        <input type="text" 
                               class="bg-transparent border-none text-lg font-semibold text-white focus:outline-none"
                               value="${escapeAttr(category.name)}"
                               onclick="event.stopPropagation()"
                               onchange="updateCategoryName('${category.id}', this.value)">
                        ${isDomainBadge}
                        <span class="text-sm text-gray-400 ml-3">(${category.properties.length} propiedades)</span>
                    </div>
                    <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                        <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer" title="Si está marcado, estas propiedades se repetirán por cada dominio (domain1, domain2, etc.)">
                            <input type="checkbox" 
                                   class="form-checkbox rounded"
                                   ${category.isDomain ? 'checked' : ''}
                                   onchange="toggleCategoryDomain('${category.id}', this.checked)">
                            <span>Propiedades por Dominio</span>
                            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </label>
                        <button onclick="addPropertyToCategory('${category.id}')" class="btn-icon text-gray-400 hover:text-green-400" title="Agregar propiedad a esta categoría">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                        </button>
                        <button onclick="deleteCategory('${category.id}')" class="btn-icon danger text-gray-400 hover:text-red-400" title="Eliminar categoría">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="editor-category-content p-4 space-y-3" style="${contentStyle}">
                    ${category.properties.map((prop, propIndex) => renderEditorProperty(prop, category.id)).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html || '<p class="text-center text-gray-500 py-12">No hay propiedades. Carga un archivo .properties o agrega propiedades manualmente.</p>';
}

// Render a single property in the editor
function renderEditorProperty(prop, categoryId) {
    const typeOptions = [
        { value: 'text', label: 'Texto' },
        { value: 'number', label: 'Número' },
        { value: 'boolean', label: 'Booleano' },
        { value: 'url', label: 'URL' },
        { value: 'password', label: 'Contraseña' },
        { value: 'html', label: 'HTML (con vista previa)' },
        { value: 'select', label: 'Lista (Select)' },
        { value: 'mexicoStates', label: 'Estados de México' },
        { value: 'paymentPeriods', label: 'Periodos de Pago' }
    ];
    
    const booleanTypeOptions = [
        { value: '', label: 'N/A' },
        { value: 'string', label: 'String (true/false)' },
        { value: 'number', label: 'Número (1/0)' }
    ];
    
    // Get all keys for dependsOn dropdown
    const allKeys = editorProperties.map(p => p.key).filter(k => k !== prop.key);
    
    // Build category selector options
    const categoryOptions = editorCategories.map(cat => 
        `<option value="${cat.id}" ${cat.id === categoryId ? 'selected' : ''}>${escapeHtml(cat.name)} ${cat.isDomain ? '(Dominio)' : '(Global)'}</option>`
    ).join('');
    
    return `
        <div class="editor-property-card p-4" data-property-id="${prop.id}">
            <div class="flex items-start justify-between gap-4 mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        <span class="font-mono text-xs text-electric-light bg-electric/10 px-2 py-1 rounded">${escapeHtml(prop.key)}</span>
                        ${prop.isDomain ? '<span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Dominio</span>' : ''}
                        <select class="text-xs px-2 py-1 rounded bg-slate-700 border border-gray-600 text-gray-300 cursor-pointer ml-auto" 
                                onchange="movePropertyToCategory('${prop.id}', this.value)" 
                                title="Mover a otra categoría">
                            ${categoryOptions}
                        </select>
                    </div>
                </div>
                <button onclick="deleteProperty('${prop.id}', '${categoryId}')" class="btn-icon danger text-gray-400 hover:text-red-400" title="Eliminar propiedad">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <div class="editor-field-group mb-3">
                <div class="editor-field">
                    <label>Clave (Key)</label>
                    <input type="text" value="${escapeAttr(prop.key)}" onchange="updatePropertyField('${prop.id}', 'key', this.value)">
                </div>
                <div class="editor-field">
                    <label>Etiqueta (Label)</label>
                    <input type="text" value="${escapeAttr(prop.label)}" onchange="updatePropertyField('${prop.id}', 'label', this.value)">
                </div>
                <div class="editor-field">
                    <label>Tipo</label>
                    <select onchange="updatePropertyField('${prop.id}', 'type', this.value); renderJsonEditor();">
                        ${typeOptions.map(opt => `<option value="${opt.value}" ${prop.type === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
                <div class="editor-field">
                    <label>Valor por defecto</label>
                    <input type="text" value="${escapeAttr(prop.default)}" onchange="updatePropertyField('${prop.id}', 'default', this.value)">
                </div>
            </div>
            
            <!-- Descripción - Campo amplio -->
            <div class="mb-3">
                <div class="editor-field">
                    <label>Descripción (explica brevemente qué hace esta propiedad)</label>
                    <textarea rows="2" 
                              class="w-full resize-none"
                              placeholder="Describe para qué sirve esta propiedad..."
                              onchange="updatePropertyField('${prop.id}', 'description', this.value)">${escapeHtml(prop.description)}</textarea>
                </div>
            </div>
            
            ${prop.type === 'boolean' ? `
            <div class="editor-field-group mb-3">
                <div class="editor-field">
                    <label>Tipo de Booleano</label>
                    <select onchange="updatePropertyField('${prop.id}', 'booleanType', this.value)">
                        ${booleanTypeOptions.map(opt => `<option value="${opt.value}" ${prop.booleanType === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            ` : ''}
            
            <div class="flex flex-wrap gap-4 mb-3">
                <label class="editor-toggle flex items-center gap-2">
                    <input type="checkbox" ${prop.required ? 'checked' : ''} onchange="updatePropertyField('${prop.id}', 'required', this.checked)">
                    <span class="text-sm text-gray-300">Requerido</span>
                </label>
                <label class="editor-toggle flex items-center gap-2">
                    <input type="checkbox" ${prop.needsConfirmation ? 'checked' : ''} onchange="updatePropertyField('${prop.id}', 'needsConfirmation', this.checked)">
                    <span class="text-sm text-gray-300">Necesita Confirmación</span>
                </label>
                <label class="editor-toggle flex items-center gap-2">
                    <input type="checkbox" ${prop.checkService ? 'checked' : ''} onchange="updatePropertyField('${prop.id}', 'checkService', this.checked)">
                    <span class="text-sm text-gray-300">Verificar Servicio</span>
                </label>
                <label class="editor-toggle flex items-center gap-2" title="Si está marcado, esta propiedad se repetirá por cada dominio configurado">
                    <input type="checkbox" ${prop.isDomain ? 'checked' : ''} onchange="updatePropertyField('${prop.id}', 'isDomain', this.checked)">
                    <span class="text-sm text-gray-300">Repetir por Dominio</span>
                </label>
                <label class="editor-toggle flex items-center gap-2" title="Habilita configuración para repetir este campo N veces según el valor de otra propiedad numérica">
                    <input type="checkbox" ${prop.repeatBasedOn ? 'checked' : ''} onchange="toggleRepeatBasedOnEnabled('${prop.id}', this.checked)">
                    <span class="text-sm text-gray-300">Campo Repetible</span>
                </label>
                <label class="editor-toggle flex items-center gap-2" title="Habilita opciones dinámicas para selects (se cargan desde otra propiedad)" style="${prop.type !== 'select' && !prop.dynamicOptionsFrom ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                    <input type="checkbox" ${prop.dynamicOptionsFrom ? 'checked' : ''} onchange="toggleDynamicOptionsEnabled('${prop.id}', this.checked)" ${prop.type !== 'select' && !prop.dynamicOptionsFrom ? 'disabled' : ''}>
                    <span class="text-sm text-gray-300">Opciones Dinámicas</span>
                </label>
            </div>
            
            <!-- Depends On -->
            <div class="editor-field-group mb-3">
                <div class="editor-field">
                    <label>Depende de (Key)</label>
                    <select onchange="updateDependsOn('${prop.id}', 'key', this.value)">
                        <option value="">-- Ninguno --</option>
                        ${allKeys.map(k => `<option value="${escapeAttr(k)}" ${prop.dependsOn?.key === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
                    </select>
                </div>
                <div class="editor-field">
                    <label>Valor de dependencia</label>
                    <input type="text" value="${escapeAttr(prop.dependsOn?.value || '')}" onchange="updateDependsOn('${prop.id}', 'value', this.value)" ${!prop.dependsOn?.key ? 'disabled' : ''}>
                </div>
            </div>
            
            ${prop.repeatBasedOn ? `
            <!-- Repeat Based On - Para campos que se repiten N veces -->
            <div class="editor-field-group mb-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    <label class="text-xs text-purple-300 uppercase font-semibold">Campo Repetible (se repite N veces)</label>
                </div>
                <p class="text-xs text-gray-400 mb-2">Configura esta propiedad para que se repita según el valor de otra propiedad numérica.</p>
                <div class="editor-field">
                    <label>Se repite según el valor de (Key numérica)</label>
                    <select onchange="updateRepeatBasedOn('${prop.id}', 'key', this.value)">
                        <option value="">-- No repetible --</option>
                        ${allKeys.map(k => `<option value="${escapeAttr(k)}" ${prop.repeatBasedOn?.key === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
                    </select>
                </div>
                ${prop.repeatBasedOn?.key ? `
                <div class="editor-field-group mt-2">
                    <div class="editor-field">
                        <label>Placeholder en key (ej: [N], {N})</label>
                        <input type="text" value="${escapeAttr(prop.repeatBasedOn?.placeholder || '[N]')}" 
                               onchange="updateRepeatBasedOn('${prop.id}', 'placeholder', this.value)"
                               placeholder="[N]">
                    </div>
                    <div class="editor-field">
                        <label>Etiqueta del item (ej: Idioma)</label>
                        <input type="text" value="${escapeAttr(prop.repeatBasedOn?.label || 'Item')}" 
                               onchange="updateRepeatBasedOn('${prop.id}', 'label', this.value)"
                               placeholder="Item">
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            ${prop.dynamicOptionsFrom ? `
            <!-- Dynamic Options From - Para selects con opciones dinámicas -->
            <div class="editor-field-group mb-3 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    <label class="text-xs text-cyan-300 uppercase font-semibold">Opciones Dinámicas (lista desde otra propiedad)</label>
                </div>
                <p class="text-xs text-gray-400 mb-2">Las opciones de este select vendrán de los valores separados por comas de otra propiedad.</p>
                <div class="editor-field">
                    <label>Obtener opciones de (Key con valores separados por comas)</label>
                    <select onchange="updateDynamicOptionsFrom('${prop.id}', 'key', this.value)">
                        <option value="">-- Opciones fijas --</option>
                        ${allKeys.map(k => `<option value="${escapeAttr(k)}" ${prop.dynamicOptionsFrom?.key === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
                    </select>
                </div>
                ${prop.dynamicOptionsFrom?.key ? `
                <div class="editor-field mt-2">
                    <label>Separador (por defecto: coma)</label>
                    <input type="text" value="${escapeAttr(prop.dynamicOptionsFrom?.separator || ',')}" 
                           onchange="updateDynamicOptionsFrom('${prop.id}', 'separator', this.value)"
                           placeholder=","
                           class="w-20">
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            ${prop.type === 'select' && !prop.dynamicOptionsFrom ? renderOptionsEditor(prop) : ''}
        </div>
    `;
}

// Render options editor for select type
function renderOptionsEditor(prop) {
    const options = prop.options || [];
    
    return `
        <div class="options-container">
            <div class="flex items-center justify-between mb-2">
                <label class="text-xs text-gray-400 uppercase">Opciones del Select</label>
                <button onclick="addOptionToProperty('${prop.id}')" class="text-xs text-electric hover:text-electric-light flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Agregar Opción
                </button>
            </div>
            <div id="options-${prop.id}">
                ${options.map((opt, idx) => `
                    <div class="option-row">
                        <input type="text" class="flex-1" placeholder="Valor" value="${escapeAttr(opt.value)}" onchange="updateOption('${prop.id}', ${idx}, 'value', this.value)">
                        <input type="text" class="flex-1" placeholder="Etiqueta" value="${escapeAttr(opt.label)}" onchange="updateOption('${prop.id}', ${idx}, 'label', this.value)">
                        <button onclick="removeOption('${prop.id}', ${idx})" class="btn-icon danger text-gray-400 hover:text-red-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                `).join('')}
                ${options.length === 0 ? '<p class="text-xs text-gray-500 text-center py-2">No hay opciones. Agrega una.</p>' : ''}
            </div>
        </div>
    `;
}

// Update a property field
function updatePropertyField(propId, field, value) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop) {
        prop[field] = value;
    }
}

// Update repeatBasedOn field
function updateRepeatBasedOn(propId, field, value) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop) {
        if (!prop.repeatBasedOn) {
            prop.repeatBasedOn = { key: '', placeholder: '[N]', label: 'Item' };
        }
        prop.repeatBasedOn[field] = value;
        renderJsonEditor();
    }
}

// Update dynamicOptionsFrom field
function updateDynamicOptionsFrom(propId, field, value) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop) {
        if (!prop.dynamicOptionsFrom) {
            prop.dynamicOptionsFrom = { key: '', separator: ',' };
        }
        prop.dynamicOptionsFrom[field] = value;
        renderJsonEditor();
    }
}

function toggleRepeatBasedOnEnabled(propId, enabled) {
    const prop = editorProperties.find(p => p.id === propId);
    if (!prop) return;
    if (enabled) {
        if (!prop.repeatBasedOn) {
            prop.repeatBasedOn = { key: '', placeholder: '[N]', label: 'Item' };
        }
    } else {
        delete prop.repeatBasedOn;
    }
    renderJsonEditor();
}

function toggleDynamicOptionsEnabled(propId, enabled) {
    const prop = editorProperties.find(p => p.id === propId);
    if (!prop) return;
    if (enabled) {
        if (!prop.dynamicOptionsFrom) {
            prop.dynamicOptionsFrom = { key: '', separator: ',' };
        }
        // Dynamic options only make sense for selects; keep type consistent
        if (prop.type !== 'select') {
            prop.type = 'select';
        }
    } else {
        delete prop.dynamicOptionsFrom;
    }
    renderJsonEditor();
}

// Update dependsOn field
function updateDependsOn(propId, field, value) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop) {
        if (!prop.dependsOn) {
            prop.dependsOn = { key: '', value: '' };
        }
        prop.dependsOn[field] = value;
        
        // If key is empty, set dependsOn to null
        if (!prop.dependsOn.key) {
            prop.dependsOn = null;
        }
        
        renderJsonEditor();
    }
}

// Update category name
function updateCategoryName(catId, name) {
    const category = editorCategories.find(c => c.id === catId);
    if (category) {
        category.name = name;
    }
}

// Toggle category domain status
function toggleCategoryDomain(catId, isDomain) {
    const category = editorCategories.find(c => c.id === catId);
    if (category) {
        category.isDomain = isDomain;
        category.properties.forEach(p => p.isDomain = isDomain);
        renderJsonEditor();
    }
}

// Delete a category
function deleteCategory(catId) {
    if (confirm('¿Eliminar esta categoría y todas sus propiedades?')) {
        const catIndex = editorCategories.findIndex(c => c.id === catId);
        if (catIndex !== -1) {
            const category = editorCategories[catIndex];
            // Remove properties from editorProperties
            editorProperties = editorProperties.filter(p => !category.properties.includes(p));
            editorCategories.splice(catIndex, 1);
            renderJsonEditor();
        }
    }
}

// Delete a property
function deleteProperty(propId, catId) {
    const category = editorCategories.find(c => c.id === catId);
    if (category) {
        category.properties = category.properties.filter(p => p.id !== propId);
        editorProperties = editorProperties.filter(p => p.id !== propId);
        renderJsonEditor();
    }
}

// Add option to select property
function addOptionToProperty(propId) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop) {
        if (!prop.options) prop.options = [];
        prop.options.push({ value: '', label: '' });
        renderJsonEditor();
    }
}

// Update option
function updateOption(propId, optIndex, field, value) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop && prop.options && prop.options[optIndex]) {
        prop.options[optIndex][field] = value;
    }
}

// Remove option
function removeOption(propId, optIndex) {
    const prop = editorProperties.find(p => p.id === propId);
    if (prop && prop.options) {
        prop.options.splice(optIndex, 1);
        renderJsonEditor();
    }
}

// Add new property to editor - show category selector
function addNewPropertyToEditor() {
    if (editorCategories.length === 0) {
        showToast('Primero crea una categoría', 'error');
        return;
    }
    
    // Create modal for category selection
    const categoryOptions = editorCategories.map(cat => 
        `<option value="${cat.id}">${escapeHtml(cat.name)} ${cat.isDomain ? '(Dominio)' : '(Global)'}</option>`
    ).join('');
    
    const modalHtml = `
        <div id="selectCategoryModal" class="fixed inset-0 z-[60] flex items-center justify-center">
            <div class="absolute inset-0 bg-black/70" onclick="closeSelectCategoryModal()"></div>
            <div class="relative glass-card rounded-2xl p-6 w-full max-w-md">
                <h3 class="text-lg font-semibold text-white mb-4">Nueva Propiedad</h3>
                <p class="text-gray-400 text-sm mb-4">Selecciona la categoría donde se agregará la propiedad:</p>
                <select id="newPropCategorySelect" class="input-field w-full px-4 py-3 rounded-lg text-gray-100 mb-6">
                    ${categoryOptions}
                </select>
                <div class="flex justify-end gap-3">
                    <button onclick="closeSelectCategoryModal()" class="btn-secondary px-4 py-2 rounded-lg text-sm">Cancelar</button>
                    <button onclick="confirmAddProperty()" class="btn-primary px-4 py-2 rounded-lg text-sm">Agregar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Close category selection modal
function closeSelectCategoryModal() {
    const modal = document.getElementById('selectCategoryModal');
    if (modal) modal.remove();
}

// Confirm adding property to selected category
function confirmAddProperty() {
    const select = document.getElementById('newPropCategorySelect');
    const categoryId = select.value;
    
    closeSelectCategoryModal();
    addPropertyToCategory(categoryId);
}

// Add property directly to a specific category
function addPropertyToCategory(categoryId) {
    const category = editorCategories.find(c => c.id === categoryId);
    if (!category) {
        showToast('Categoría no encontrada', 'error');
        return;
    }
    
    const newId = `prop_${Date.now()}`;
    const newProp = {
        id: newId,
        key: 'nueva.propiedad',
        label: 'Nueva Propiedad',
        type: 'text',
        default: '',
        required: false,
        needsConfirmation: false,
        description: 'Descripción de la propiedad',
        category: category.originalName || category.name,
        isDomain: category.isDomain,
        booleanType: null,
        checkService: false,
        options: [],
        dependsOn: null
    };
    
    editorProperties.push(newProp);
    category.properties.push(newProp);
    
    renderJsonEditor();
    showToast(`Propiedad agregada a "${category.name}"`, 'success');
}

// Toggle editor category collapse
function toggleEditorCategory(categoryId) {
    const category = document.querySelector(`[data-category-id="${categoryId}"]`);
    if (!category) return;
    
    const content = category.querySelector('.editor-category-content');
    const chevron = category.querySelector('.editor-category-chevron');
    
    if (!content) return;
    
    const isCollapsed = category.classList.contains('editor-collapsed');
    
    if (isCollapsed) {
        category.classList.remove('editor-collapsed');
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.opacity = '1';
        content.style.padding = '1rem';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        setTimeout(() => { content.style.maxHeight = 'none'; }, 300);
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        content.offsetHeight;
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        content.style.padding = '0 1rem';
        category.classList.add('editor-collapsed');
        if (chevron) chevron.style.transform = 'rotate(-90deg)';
    }
}

// Expand all editor categories
function expandAllEditorCategories() {
    document.querySelectorAll('.editor-category-collapsible.editor-collapsed').forEach(category => {
        const categoryId = category.dataset.categoryId;
        toggleEditorCategory(categoryId);
    });
}

// Collapse all editor categories
function collapseAllEditorCategories() {
    document.querySelectorAll('.editor-category-collapsible:not(.editor-collapsed)').forEach(category => {
        const categoryId = category.dataset.categoryId;
        toggleEditorCategory(categoryId);
    });
}

// Move property to another category
function movePropertyToCategory(propId, newCategoryId) {
    // Find property and current category
    let prop = null;
    let oldCategory = null;
    
    for (const cat of editorCategories) {
        const propIndex = cat.properties.findIndex(p => p.id === propId);
        if (propIndex !== -1) {
            prop = cat.properties[propIndex];
            oldCategory = cat;
            cat.properties.splice(propIndex, 1);
            break;
        }
    }
    
    if (!prop) {
        showToast('Propiedad no encontrada', 'error');
        return;
    }
    
    // Find new category and add property
    const newCategory = editorCategories.find(c => c.id === newCategoryId);
    if (!newCategory) {
        showToast('Categoría destino no encontrada', 'error');
        // Put property back
        oldCategory.properties.push(prop);
        return;
    }
    
    // Update property
    prop.category = newCategory.originalName || newCategory.name;
    prop.isDomain = newCategory.isDomain;
    newCategory.properties.push(prop);
    
    renderJsonEditor();
    showToast(`Propiedad movida a "${newCategory.name}"`, 'success');
}

// Add new category to editor
function addNewCategoryToEditor() {
    const catId = `cat_${Date.now()}`;
    editorCategories.push({
        id: catId,
        name: 'Nueva Categoría',
        originalName: `nueva.categoria.${editorCategories.length}`,
        icon: 'settings',
        properties: [],
        isDomain: false
    });
    
    renderJsonEditor();
    showToast('Nueva categoría agregada', 'success');
}

// Build config JSON from editor data
function buildConfigJsonFromEditor() {
    const projectName = document.getElementById('editorProjectName').value || 'MiProyecto';
    const projectVersion = document.getElementById('editorProjectVersion').value || '1.0.0';
    const domainKeyPattern = document.getElementById('editorDomainKeyPattern').value || 'domain{N}';
    const subcategory = document.getElementById('editorSubcategory')?.value || '';
    
    // Separate global and domain properties
    const globalCategories = [];
    const domainCategories = [];
    
    editorCategories.forEach(category => {
        const categoryData = {
            category: category.name,
            icon: category.icon || 'settings',
            properties: category.properties.map(prop => {
                const propData = {
                    key: prop.isDomain ? prop.key.replace(/\d+/g, '{N}') : prop.key,
                    label: prop.label,
                    type: prop.type,
                    default: prop.default,
                    required: prop.required,
                    needsConfirmation: prop.needsConfirmation,
                    description: prop.description
                };
                
                if (prop.booleanType) propData.booleanType = prop.booleanType;
                if (prop.checkService) propData.checkService = prop.checkService;
                if (prop.dependsOn && prop.dependsOn.key) propData.dependsOn = prop.dependsOn;
                if (prop.options && prop.options.length > 0) propData.options = prop.options;
                if (prop.repeatBasedOn && prop.repeatBasedOn.key) propData.repeatBasedOn = prop.repeatBasedOn;
                if (prop.dynamicOptionsFrom && prop.dynamicOptionsFrom.key) propData.dynamicOptionsFrom = prop.dynamicOptionsFrom;
                
                return propData;
            })
        };
        
        if (category.isDomain) {
            delete categoryData.icon;
            domainCategories.push(categoryData);
        } else {
            globalCategories.push(categoryData);
        }
    });
    
    return {
        projectName: projectName,
        projectDescription: projectName,
        version: projectVersion,
        subcategory: subcategory,
        outputFileName: 'config.properties',
        domainKeyPattern: domainKeyPattern,
        mexicoStates: configData?.mexicoStates || [],
        paymentPeriods: configData?.paymentPeriods || [],
        globalProperties: globalCategories,
        domainProperties: domainCategories
    };
}

// Save configuration to database from editor
async function saveConfigFromEditor() {
    const categorySelect = document.getElementById('editorCategorySelect');
    const newCategoryInput = document.getElementById('editorNewCategory');
    const subcategoryInput = document.getElementById('editorSubcategory');
    const projectNameInput = document.getElementById('editorProjectName');
    
    if (!categorySelect || !categorySelect.value) {
        showToast('Selecciona una categoría', 'error');
        return;
    }
    
    let categoryId = null;
    let categoryName = null;
    
    if (categorySelect.value === '__new__') {
        categoryName = newCategoryInput?.value?.trim();
        if (!categoryName) {
            showToast('Ingresa un nombre para la categoría', 'error');
            return;
        }
    } else {
        categoryId = parseInt(categorySelect.value);
    }
    
    const subcategory = subcategoryInput?.value?.trim() || '';
    const configName = projectNameInput?.value?.trim();
    
    if (!configName) {
        showToast('Ingresa un nombre para la configuración', 'error');
        return;
    }
    
    const configJson = buildConfigJsonFromEditor();
    
    try {
        const accessToken = localStorage.getItem('accessToken');
        const response = await fetch('/api/configs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                name: configName,
                subcategory: subcategory,
                categoryId: categoryId,
                categoryName: categoryName,
                json: JSON.stringify(configJson)
            })
        });
        
        if (response.ok) {
            showToast('Configuración guardada exitosamente');
            closeJsonEditor();
            
            // Reload configurations if function exists
            if (typeof loadCategories === 'function') {
                await loadCategories();
            }
            if (typeof loadConfigurations === 'function') {
                await loadConfigurations();
            }
            
            // Load the newly saved config
            const data = await response.json();
            if (data.id && typeof loadConfigurationFromApi === 'function') {
                await loadConfigurationFromApi(data.id);
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            showToast(errorData.error || 'Error al guardar la configuración', 'error');
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        showToast('Error al guardar la configuración', 'error');
    }
}

// Export JSON from editor (download as file)
function exportJsonFromEditor() {
    const configJson = buildConfigJsonFromEditor();
    const projectName = configJson.projectName || 'MiProyecto';
    
    const jsonContent = JSON.stringify(configJson, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const jsonFileName = `${projectName.replace(/\s+/g, '-')}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = jsonFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Configuración exportada como "${jsonFileName}"`, 'success');
}

// Save and apply configuration from editor
async function saveAndApplyEditorConfig() {
    // Save to database
    await saveConfigFromEditor();
}

// Open editor with imported data
function openJsonEditorWithData(data, fileName) {
    // Convert data to editor format
    editorCategories = [];
    editorFileName = fileName;
    
    // Process global properties
    if (data.globalProperties && data.globalProperties.length > 0) {
        data.globalProperties.forEach((category, index) => {
            const props = category.properties.map((prop, pIndex) => ({
                ...prop,
                id: prop.id || `global_${index}_${pIndex}`,
                category: category.category,
                isDomain: false
            }));
            
            editorCategories.push({
                id: `cat_global_${index}`,
                name: category.category,
                originalName: category.category,
                icon: category.icon || 'settings',
                properties: props,
                isDomain: false
            });
        });
    }
    
    // Process domain properties
    if (data.domainProperties && data.domainProperties.length > 0) {
        data.domainProperties.forEach((category, index) => {
            const props = category.properties.map((prop, pIndex) => ({
                ...prop,
                id: prop.id || `domain_${index}_${pIndex}`,
                category: category.category,
                isDomain: true
            }));
            
            editorCategories.push({
                id: `cat_domain_${index}`,
                name: category.category,
                originalName: category.category,
                icon: 'server',
                properties: props,
                isDomain: true
            });
        });
    }
    
    // Flatten properties for editorProperties
    editorProperties = [];
    editorCategories.forEach(cat => {
        editorProperties.push(...cat.properties);
    });
    
    // Set project info from data
    document.getElementById('editorProjectName').value = data.projectName || 'Sin nombre';
    document.getElementById('editorProjectVersion').value = data.version || '1.0.0';
    document.getElementById('editorDomainKeyPattern').value = data.domainKeyPattern || 'domain{N}';
    document.getElementById('jsonEditorSubtitle').textContent = `${editorProperties.length} propiedades - ${fileName}`;
    
    // Clear category select
    const categorySelect = document.getElementById('editorCategorySelect');
    if (categorySelect) {
        categorySelect.value = '';
    }
    const newCategoryInput = document.getElementById('editorNewCategory');
    if (newCategoryInput) {
        newCategoryInput.classList.add('hidden');
        newCategoryInput.value = '';
    }
    const subcategoryInput = document.getElementById('editorSubcategory');
    if (subcategoryInput) {
        subcategoryInput.value = data.subcategory || '';
    }
    
    // Render editor
    renderJsonEditor();
    
    // Show modal
    document.getElementById('jsonEditorModal').classList.remove('hidden');
}
