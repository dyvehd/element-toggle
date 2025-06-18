class ElementTogglePopup {
  constructor() {
    this.pickerBtn = document.getElementById('pickerBtn');
    this.elementsList = document.getElementById('elementsList');
    this.emptyState = document.getElementById('emptyState');
    this.bulkActions = document.getElementById('bulkActions');
    this.showAllBtn = document.getElementById('showAllBtn');
    this.hideAllBtn = document.getElementById('hideAllBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.importInput = document.getElementById('importInput');
    this.autoRestoreToggle = document.getElementById('autoRestoreToggle');
    this.selectorMethodSelect = document.getElementById('selectorMethodSelect');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.backBtn = document.getElementById('backBtn');
    this.mainPage = document.getElementById('mainPage');
    this.settingsPage = document.getElementById('settingsPage');
    this.manualSelectorInput = document.getElementById('manualSelectorInput');
    this.addSelectorBtn = document.getElementById('addSelectorBtn');
    this.clearSelectorBtn = document.getElementById('clearSelectorBtn');
    this.openShortcutsBtn = document.getElementById('openShortcutsBtn');
    
    this.init();
  }
  
  async init() {
    await this.loadElements();
    this.setupEventListeners();
    await this.loadSettings();
    this.validateManualSelector();
  }
  
  setupEventListeners() {
    this.pickerBtn.addEventListener('click', () => {
      this.togglePicker();
    });
    
    this.showAllBtn.addEventListener('click', () => {
      this.toggleAllElements(true);
    });
    
    this.hideAllBtn.addEventListener('click', () => {
      this.toggleAllElements(false);
    });
    
    this.exportBtn.addEventListener('click', () => {
      this.exportSettings();
    });
    
    this.importInput.addEventListener('change', (e) => {
      this.importSettings(e);
    });
    
    this.autoRestoreToggle.addEventListener('change', () => {
      this.saveSettings();
    });
    
    this.selectorMethodSelect.addEventListener('change', () => {
      this.saveSettings();
    });
    
    this.settingsBtn.addEventListener('click', () => {
      this.showSettingsPage();
    });
    
    this.backBtn.addEventListener('click', () => {
      this.showMainPage();
    });
    
    // Manual selector functionality
    this.manualSelectorInput.addEventListener('input', () => {
      this.validateManualSelector();
    });
    
    this.manualSelectorInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.addSelectorBtn.disabled) {
        e.preventDefault();
        this.addManualSelector();
      }
    });
    
    this.addSelectorBtn.addEventListener('click', () => {
      this.addManualSelector();
    });
    
    this.clearSelectorBtn.addEventListener('click', () => {
      this.manualSelectorInput.value = '';
      this.validateManualSelector();
      this.manualSelectorInput.focus();
    });
    
    // Open shortcuts settings
    this.openShortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    // Add event listeners for hotkey buttons
    const hotkeyButtons = this.elementsList.querySelectorAll('.hotkey-btn');
    hotkeyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.recordHotkey(tabUrl, index, e.target);
      });
    });
  }
  
  showSettingsPage() {
    this.mainPage.classList.remove('active');
    this.settingsPage.classList.add('active');
  }
  
  showMainPage() {
    this.settingsPage.classList.remove('active');
    this.mainPage.classList.add('active');
  }
  
  // Smart selector generation
  generateSmartSelector(originalSelector) {
    // Patterns to clean for cross-environment compatibility
    const patterns = [
      // Angular dynamic component IDs
      {
        pattern: /ng-tns-c\d+-/g,
        replacement: 'ng-tns-c*-'
      },
      // React dynamic class hashes
      {
        pattern: /css-[a-zA-Z0-9]+-/g,
        replacement: 'css-*-'
      },
      // Vue scoped CSS
      {
        pattern: /data-v-[a-f0-9]{8}/g,
        replacement: 'data-v-*'
      },
      // Webpack/build hash suffixes
      {
        pattern: /_[a-zA-Z0-9]{5,}_/g,
        replacement: '_*_'
      },
      // Generic hash patterns in class names
      {
        pattern: /\.[a-zA-Z]+-[a-f0-9]{6,}/g,
        replacement: (match) => {
          const parts = match.split('-');
          return parts[0] + '-*';
        }
      }
    ];
    
    let smartSelector = originalSelector;
    
    // Apply pattern replacements
    patterns.forEach(({ pattern, replacement }) => {
      if (typeof replacement === 'function') {
        smartSelector = smartSelector.replace(pattern, replacement);
      } else {
        smartSelector = smartSelector.replace(pattern, replacement);
      }
    });
    
    // Convert to attribute selector format for wildcard matching
    smartSelector = this.convertToAttributeSelector(smartSelector);
    
    return smartSelector;
  }
  
  convertToAttributeSelector(selector) {
    // Convert wildcarded class selectors to attribute selectors
    // .ng-tns-c*-4 becomes [class*="ng-tns-c"][class*="-4"]
    
    return selector.replace(/\.([^.\s]+\*[^.\s]*)/g, (match, className) => {
      if (className.includes('*')) {
        const parts = className.split('*');
        let attrSelector = '';
        
        for (let i = 0; i < parts.length; i++) {
          if (parts[i]) {
            attrSelector += `[class*="${parts[i]}"]`;
          }
        }
        
        return attrSelector;
      }
      return match;
    });
  }
  
  // Enhanced element finding that tries multiple selector methods
  async findElementWithSelector(selector, method = 'exact') {
    try {
      if (method === 'exact') {
        return document.querySelector(selector);
      } else if (method === 'smart') {
        // First try exact match
        let element = document.querySelector(selector);
        if (element) return element;
        
        // Generate and try smart selector
        const smartSelector = this.generateSmartSelector(selector);
        if (smartSelector !== selector) {
          element = document.querySelector(smartSelector);
          if (element) return element;
        }
        
        // Try minimal selector (remove dynamic parts entirely)
        const minimalSelector = this.generateMinimalSelector(selector);
        if (minimalSelector !== selector && minimalSelector !== smartSelector) {
          element = document.querySelector(minimalSelector);
          if (element) return element;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding element with selector:', selector, error);
      return null;
    }
  }
  
  generateMinimalSelector(selector) {
    // Create a minimal selector by removing known dynamic patterns entirely
    return selector
      .replace(/\.ng-tns-c\d+-\d+/g, '') // Remove Angular component IDs
      .replace(/\.css-[a-zA-Z0-9]+-[a-zA-Z0-9]+/g, '') // Remove React CSS modules
      .replace(/\[data-v-[a-f0-9]{8}\]/g, '') // Remove Vue scoped attributes
      .replace(/\._[a-zA-Z0-9]{5,}_/g, '') // Remove webpack hashes
      .replace(/\.\w+-[a-f0-9]{6,}/g, '') // Remove generic hash classes
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .replace(/\s*>\s*/g, ' > ') // Clean up child selectors
      .trim();
  }
  
  async togglePicker() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (this.pickerBtn.classList.contains('active')) {
      // Stop picker
      this.pickerBtn.classList.remove('active');
      this.pickerBtn.textContent = 'Pick Element';
      
      chrome.tabs.sendMessage(tab.id, { action: 'stopPicker' });
    } else {
      // Start picker
      this.pickerBtn.classList.add('active');
      this.pickerBtn.textContent = 'Cancel';
      
      chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
      window.close(); // Close popup so user can pick element
    }
  }
  
  async loadElements() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url).hostname;
    
    const result = await chrome.storage.local.get([tabUrl]);
    const elements = result[tabUrl] || [];
    
    this.renderElements(elements, tabUrl);
  }
  
  renderElements(elements, tabUrl) {
    
    if (elements.length === 0) {
      this.emptyState.style.display = 'block';
      this.bulkActions.style.display = 'none';
      this.exportBtn.disabled = true;
      return;
    }
    
    this.emptyState.style.display = 'none';
    this.bulkActions.style.display = 'flex';
    this.exportBtn.disabled = false;
    
    const elementsHtml = elements.map((element, index) => {
      const action = element.action || 'toggle'; // Default to toggle for backward compatibility
      const hotkey = element.hotkey || 'Not Set';
      const smartSelector = this.generateSmartSelector(element.selector);
      const showSmartSelector = smartSelector !== element.selector;
      
      return `
        <div class="element-item" data-action="${action}">
          <div class="element-header">
            <div class="element-info">
              <div class="element-name" data-tab-url="${tabUrl}" data-index="${index}">${element.name || 'Unnamed Element'}</div>
              <div class="element-selector" title="Original Selector">${element.selector}</div>
              ${showSmartSelector ? `<div class="element-selector" style="color: #4285f4; font-style: italic;" title="Smart Selector">${smartSelector}</div>` : ''}
              <div class="element-text">${element.textContent}</div>
            </div>
            <div class="element-controls">
              ${action === 'toggle' ? `
                <label class="toggle-switch">
                  <input type="checkbox" ${element.visible ? 'checked' : ''} 
                         data-tab-url="${tabUrl}" data-index="${index}">
                  <span class="slider"></span>
                </label>
              ` : ''}
              <button class="action-btn edit-btn" data-tab-url="${tabUrl}" data-index="${index}" title="Edit Name">✏️</button>
              <button class="action-btn delete-btn" data-tab-url="${tabUrl}" data-index="${index}" title="Remove">×</button>
            </div>
          </div>
          <div class="element-footer">
            <div class="action-control">
              <label for="action-select-${index}">Action:</label>
              <select class="action-select" id="action-select-${index}" data-tab-url="${tabUrl}" data-index="${index}">
                <option value="toggle" ${action === 'toggle' ? 'selected' : ''}>Toggle Visibility</option>
                <option value="click" ${action === 'click' ? 'selected' : ''}>Simulate Click</option>
              </select>
            </div>
            ${action === 'click' ? `
              <div class="hotkey-control">
                <label>Hotkey:</label>
                <button class="hotkey-btn" data-tab-url="${tabUrl}" data-index="${index}">${hotkey}</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    this.elementsList.innerHTML = elementsHtml;
    
    // Add event listeners to the newly created elements
    this.addElementEventListeners();
    
    // Keep buttons always enabled when elements exist
    this.showAllBtn.disabled = false;
    this.hideAllBtn.disabled = false;
  }
  
  addElementEventListeners() {
    // Add event listeners for toggle switches
    const toggleInputs = this.elementsList.querySelectorAll('input[type="checkbox"]');
    toggleInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        const visible = e.target.checked;
        this.toggleElement(tabUrl, index, visible);
      });
    });
    
    // Add event listeners for edit buttons
    const editButtons = this.elementsList.querySelectorAll('.edit-btn');
    editButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.editElementName(tabUrl, index);
      });
    });
    
    // Add event listeners for delete buttons
    const deleteButtons = this.elementsList.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.deleteElement(tabUrl, index);
      });
    });

    // Add event listeners for action dropdowns
    const actionSelects = this.elementsList.querySelectorAll('.action-select');
    actionSelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        const newAction = e.target.value;
        this.updateElementAction(tabUrl, index, newAction);
      });
    });

    // Add event listeners for hotkey buttons
    const hotkeyButtons = this.elementsList.querySelectorAll('.hotkey-btn');
    hotkeyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.recordHotkey(tabUrl, index, e.target);
      });
    });
  }
  
  async editElementName(tabUrl, index) {
    const nameElement = this.elementsList.querySelector(`.element-name[data-tab-url="${tabUrl}"][data-index="${index}"]`);
    const currentName = nameElement.textContent;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName === 'Unnamed Element' ? '' : currentName;
    input.className = 'element-name editable';
    input.placeholder = 'Enter element name...';
    
    // Replace the name element with input
    nameElement.parentNode.replaceChild(input, nameElement);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
      const newName = input.value.trim() || 'Unnamed Element';
      
      // Update storage
      const result = await chrome.storage.local.get([tabUrl]);
      const elements = result[tabUrl] || [];
      
      if (elements[index]) {
        elements[index].name = newName;
        await chrome.storage.local.set({ [tabUrl]: elements });
        
        // Re-render elements to reflect changes
        this.renderElements(elements, tabUrl);
        this.showNotification('Element name updated!', 'success');
      }
    };
    
    const cancelEdit = () => {
      // Restore original name element
      const newNameElement = document.createElement('div');
      newNameElement.className = 'element-name';
      newNameElement.textContent = currentName;
      newNameElement.dataset.tabUrl = tabUrl;
      newNameElement.dataset.index = index;
      
      input.parentNode.replaceChild(newNameElement, input);
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
  }
  
  async exportSettings() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url).hostname;
    const fullUrl = tab.url;
    
    const result = await chrome.storage.local.get([tabUrl]);
    const elements = result[tabUrl] || [];
    
    if (elements.length === 0) {
      this.showNotification('No elements to export for this page.', 'error');
      return;
    }
    
    const exportData = {
      version: '1.1', // Updated version for smart selector support
      exportDate: new Date().toISOString(),
      hostname: tabUrl,
      fullUrl: fullUrl,
      pageTitle: tab.title,
      elements: elements.map(element => ({
        name: element.name || 'Unnamed Element',
        selector: element.selector,
        smartSelector: this.generateSmartSelector(element.selector),
        textContent: element.textContent,
        visible: element.visible,
        dateAdded: element.dateAdded || new Date().toISOString()
      }))
    };
    
    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `element-toggle-${tabUrl}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showNotification('Settings exported with smart selectors!', 'success');
  }
  
  async importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // Validate import data
      if (!importData.version || !importData.elements || !Array.isArray(importData.elements)) {
        throw new Error('Invalid file format');
      }
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentHostname = new URL(tab.url).hostname;
      
      // Ask user if they want to import to current page or original page
      const useCurrentPage = confirm(
        `Import settings to current page (${currentHostname}) or original page (${importData.hostname})?\n\n` +
        `Click OK for current page, Cancel for original page.`
      );
      
      const targetHostname = useCurrentPage ? currentHostname : importData.hostname;
      
      // Get existing elements for the target hostname
      const result = await chrome.storage.local.get([targetHostname]);
      let existingElements = result[targetHostname] || [];
      
      // Ask user about merge vs replace
      let finalElements = [];
      if (existingElements.length > 0) {
        const mergeWithExisting = confirm(
          `You have ${existingElements.length} existing element(s) for this page.\n\n` +
          `Click OK to MERGE with existing elements (keep both old and new)\n` +
          `Click Cancel to REPLACE existing elements (delete old, keep only new)`
        );
        
        if (mergeWithExisting) {
          // Merge: start with existing elements
          finalElements = [...existingElements];
        }
        // Replace: start with empty array (existing elements will be discarded)
      } else {
        // No existing elements, just use imported ones
        finalElements = [];
      }
      
      // Process imported elements
      const importedElements = importData.elements.map(element => ({
        name: element.name || 'Unnamed Element',
        selector: element.selector,
        smartSelector: element.smartSelector || this.generateSmartSelector(element.selector),
        textContent: element.textContent,
        visible: element.visible !== false, // Default to true
        dateAdded: element.dateAdded || new Date().toISOString(),
        action: element.action || 'toggle', // Support new property
        hotkey: element.hotkey || null      // Support new property
      }));
      
      // Add imported elements, avoiding duplicates based on selector
      let addedCount = 0;
      let updatedCount = 0;
      
      importedElements.forEach(importedElement => {
        const existingIndex = finalElements.findIndex(el => 
          el.selector === importedElement.selector || 
          el.smartSelector === importedElement.smartSelector
        );
        
        if (existingIndex === -1) {
          // New element
          finalElements.push(importedElement);
          addedCount++;
        } else {
          // Update existing element but keep current visibility state
          const currentVisible = finalElements[existingIndex].visible;
          finalElements[existingIndex] = {
            ...importedElement,
            visible: currentVisible
          };
          updatedCount++;
        }
      });
      
      // Save updated elements
      await chrome.storage.local.set({ [targetHostname]: finalElements });
      
      // If importing to current page, refresh the display and apply states
      if (useCurrentPage) {
        this.renderElements(finalElements, targetHostname);
        
        // Apply visibility states using current selector method
        const settings = await chrome.storage.local.get(['selectorMethod']);
        const method = settings.selectorMethod || 'smart';
        
        finalElements.forEach(element => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleElement',
            selector: element.selector,
            smartSelector: element.smartSelector,
            method: method,
            visible: element.visible
          });
        });
      }
      
      let message = '';
      if (addedCount > 0 && updatedCount > 0) {
        message = `Added ${addedCount} new elements, updated ${updatedCount} existing elements!`;
      } else if (addedCount > 0) {
        message = `Added ${addedCount} new elements!`;
      } else if (updatedCount > 0) {
        message = `Updated ${updatedCount} existing elements!`;
      } else {
        message = 'No new elements imported (all already exist).';
      }
      
      this.showNotification(message, 'success');
      
    } catch (error) {
      console.error('Import error:', error);
      this.showNotification('Failed to import settings. Please check the file format.', 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }
  
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  async toggleAllElements(visible) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = new URL(tab.url).hostname;
    
    // Get current elements and settings
    const result = await chrome.storage.local.get([tabUrl, 'selectorMethod']);
    const elements = result[tabUrl] || [];
    const method = result.selectorMethod || 'smart';
    
    // Update all elements visibility that are set to "toggle"
    elements.forEach(element => {
      if ((element.action || 'toggle') === 'toggle') {
        element.visible = visible;
      }
    });
    
    // Save to storage
    await chrome.storage.local.set({ [tabUrl]: elements });
    
    // Send messages to content script for each "toggle" element
    elements.forEach(element => {
      if ((element.action || 'toggle') === 'toggle') {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleElement',
          selector: element.selector,
          smartSelector: element.smartSelector || this.generateSmartSelector(element.selector),
          method: method,
          visible: visible
        });
      }
    });
    
    // Update UI
    this.renderElements(elements, tabUrl);
  }
  
  async toggleElement(tabUrl, index, visible) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update storage
    const result = await chrome.storage.local.get([tabUrl, 'selectorMethod']);
    const elements = result[tabUrl] || [];
    const method = result.selectorMethod || 'smart';
    
    if (elements[index]) {
      elements[index].visible = visible;
      await chrome.storage.local.set({ [tabUrl]: elements });
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleElement',
        selector: elements[index].selector,
        smartSelector: elements[index].smartSelector || this.generateSmartSelector(elements[index].selector),
        method: method,
        visible: visible
      });
    }
  }
  
  async deleteElement(tabUrl, index) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update storage
    const result = await chrome.storage.local.get([tabUrl, 'selectorMethod']);
    const elements = result[tabUrl] || [];
    const method = result.selectorMethod || 'smart';
    
    if (elements[index]) {
      // Show element before removing
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleElement',
        selector: elements[index].selector,
        smartSelector: elements[index].smartSelector || this.generateSmartSelector(elements[index].selector),
        method: method,
        visible: true
      });
      
      elements.splice(index, 1);
      await chrome.storage.local.set({ [tabUrl]: elements });
      
      // Reload popup to reflect changes
      location.reload();
    }
  }
  
  async loadSettings() {
    const result = await chrome.storage.local.get(['autoRestore', 'selectorMethod']);
    const autoRestore = result.autoRestore !== undefined ? result.autoRestore : false; // Default to false
    const selectorMethod = result.selectorMethod || 'smart'; // Default to smart
    
    this.autoRestoreToggle.checked = autoRestore;
    this.selectorMethodSelect.value = selectorMethod;
  }
  
  async saveSettings() {
    const autoRestore = this.autoRestoreToggle.checked;
    const selectorMethod = this.selectorMethodSelect.value;
    
    await chrome.storage.local.set({ 
      autoRestore: autoRestore,
      selectorMethod: selectorMethod
    });
    
    // If method changed, re-render to show updated selectors
    this.loadElements();
  }
  
  validateManualSelector() {
    const selector = this.manualSelectorInput.value.trim();
    this.addSelectorBtn.disabled = selector.length === 0;
  }
  
  isValidSelector(selector) {
    // This check is now primarily done in the content script (testSelector)
    // for better accuracy in the context of the page.
    // We only do a basic check here to enable the button.
    return selector.length > 0;
  }
  
  async addManualSelector() {
    const selector = this.manualSelectorInput.value.trim();
    if (!selector) {
      this.showNotification('Please enter a CSS selector', 'error');
      return;
    }
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Test if element exists on current page
      const elementInfo = await chrome.tabs.sendMessage(tab.id, {
        action: 'testSelector',
        selector: selector
      });
      
      if (!elementInfo || !elementInfo.found) {
        this.showNotification('Element not found on current page', 'error');
        return;
      }
      
      // Add the element
      const tabUrl = new URL(tab.url).hostname;
      const result = await chrome.storage.local.get([tabUrl]);
      const elements = result[tabUrl] || [];
      
      // Check if element already exists
      const existingIndex = elements.findIndex(el => el.selector === selector);
      if (existingIndex !== -1) {
        this.showNotification('Element with this selector already exists', 'error');
        return;
      }
      
      // Create new element entry
      const newElement = {
        name: elementInfo.suggestedName || 'Manual Element',
        selector: selector,
        smartSelector: this.generateSmartSelector(selector),
        textContent: elementInfo.textContent || '',
        visible: true,
        dateAdded: new Date().toISOString(),
        action: 'toggle',
        hotkey: null
      };
      
      elements.push(newElement);
      await chrome.storage.local.set({ [tabUrl]: elements });
      
      // Clear input and refresh display
      this.manualSelectorInput.value = '';
      this.validateManualSelector();
      this.renderElements(elements, tabUrl);
      
      this.showNotification('Element added successfully!', 'success');
      
    } catch (error) {
      console.error('Error adding manual selector:', error);
      this.showNotification('Failed to add element. Make sure you\'re on the correct page.', 'error');
    }
  }

  async updateElementAction(tabUrl, index, newAction) {
    const result = await chrome.storage.local.get([tabUrl]);
    const elements = result[tabUrl] || [];

    if (elements[index]) {
        elements[index].action = newAction;
        await chrome.storage.local.set({ [tabUrl]: elements });
        
        // Re-render to show/hide relevant controls
        this.renderElements(elements, tabUrl);
        // Notify content script of the change
        this.notifyContentScript();
    }
  }

  async recordHotkey(tabUrl, index, button) {
      // Disable other hotkey buttons to prevent multiple recordings
      this.elementsList.querySelectorAll('.hotkey-btn').forEach(btn => btn.disabled = true);
      
      button.textContent = 'Recording...';
      button.disabled = false; // Ensure the current button is enabled
      button.classList.add('recording');

      const keydownListener = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          document.removeEventListener('keydown', keydownListener, true);

          if (e.key === 'Escape') {
              this.loadElements(); // Re-render to restore button state
              return;
          }

          let hotkeyString = '';
          if (e.ctrlKey) hotkeyString += 'Ctrl+';
          if (e.altKey) hotkeyString += 'Alt+';
          if (e.shiftKey) hotkeyString += 'Shift+';

          // Avoid pure modifier keys
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
              hotkeyString += e.key.toUpperCase();
          } else {
              // If only a modifier was pressed, don't save
              this.loadElements();
              this.showNotification('Please use a combination with a non-modifier key.', 'warning');
              return;
          }

          // Save hotkey
          const result = await chrome.storage.local.get([tabUrl]);
          const elements = result[tabUrl] || [];
          if (elements[index]) {
              elements[index].hotkey = hotkeyString;
              await chrome.storage.local.set({ [tabUrl]: elements });
          }

          this.loadElements(); // Re-render to show new hotkey
          // Notify content script that hotkeys have been updated
          this.notifyContentScript();
      };

      document.addEventListener('keydown', keydownListener, true);
  }

  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'hotkeysUpdated' });
      }
    } catch (error) {
      console.error("Could not notify content script. Are you on a valid page?", error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ElementTogglePopup();
}); 