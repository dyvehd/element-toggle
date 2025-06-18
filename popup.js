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
    this.settingsBtn = document.getElementById('settingsBtn');
    this.backBtn = document.getElementById('backBtn');
    this.mainPage = document.getElementById('mainPage');
    this.settingsPage = document.getElementById('settingsPage');
    this.manualSelectorInput = document.getElementById('manualSelectorInput');
    this.addSelectorBtn = document.getElementById('addSelectorBtn');
    this.clearSelectorBtn = document.getElementById('clearSelectorBtn'); // might be null if button removed
    this.openShortcutsBtn = document.getElementById('openShortcutsBtn');
    
    // Settings elements
    this.autoRestore = document.getElementById('autoRestore');
    this.selectorMethodSelect = document.getElementById('selectorMethodSelect');
    
    // Unfocus hotkey settings
    this.enableUnfocusHotkey = document.getElementById('enableUnfocusHotkey');
    this.globalUnfocusHotkey = document.getElementById('globalUnfocusHotkey');
    this.recordGlobalUnfocusHotkey = document.getElementById('recordGlobalUnfocusHotkey');
    this.enableSiteSpecificUnfocus = document.getElementById('enableSiteSpecificUnfocus');
    this.siteUnfocusHotkeyList = document.getElementById('siteUnfocusHotkeyList');
    this.addSiteUnfocusHotkey = document.getElementById('addSiteUnfocusHotkey');
    this.unfocusHotkeySettings = document.getElementById('unfocusHotkeySettings');
    this.siteSpecificUnfocusSettings = document.getElementById('siteSpecificUnfocusSettings');
    
    // Selector editor modal elements
    this.selectorEditorModal = document.getElementById('selectorEditorModal');
    this.closeSelectorEditor = document.getElementById('closeSelectorEditor');
    this.cancelSelectorEdit = document.getElementById('cancelSelectorEdit');
    this.testSelector = document.getElementById('testSelector');
    this.saveSelectorEdit = document.getElementById('saveSelectorEdit');
    this.originalSelector = document.getElementById('originalSelector');
    this.patternSelector = document.getElementById('patternSelector');
    this.selectorHint = document.getElementById('selectorHint');
    
    // Current editing context
    this.currentEditingTabUrl = null;
    this.currentEditingIndex = null;
    
    // Hotkey recording state
    this.isRecordingHotkey = false;
    this.currentRecordingInput = null;
    this.currentElementContext = null;
    
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
    
    this.exportBtn.addEventListener('change', () => {
      this.exportSettings();
    });
    
    this.importInput.addEventListener('change', (e) => {
      this.importSettings(e);
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
    
    if (this.clearSelectorBtn) {
      this.clearSelectorBtn.addEventListener('click', () => {
        this.manualSelectorInput.value = '';
        this.validateManualSelector();
        this.manualSelectorInput.focus();
      });
    }
    
    // Open shortcuts settings
    this.openShortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });

    // Selector editor modal events
    this.closeSelectorEditor.addEventListener('click', () => {
      this.closeSelectorEditorModal();
    });

    this.cancelSelectorEdit.addEventListener('click', () => {
      this.closeSelectorEditorModal();
    });

    this.testSelector.addEventListener('click', () => {
      this.testSelectorPattern();
    });

    this.saveSelectorEdit.addEventListener('click', () => {
      this.saveSelectorPattern();
    });

    // Close modal when clicking outside
    this.selectorEditorModal.addEventListener('click', (e) => {
      if (e.target === this.selectorEditorModal) {
        this.closeSelectorEditorModal();
      }
    });

    // Real-time validation of pattern selector
    this.patternSelector.addEventListener('input', () => {
      this.validateSelectorPattern();
    });

    // Unfocus hotkey settings
    this.enableUnfocusHotkey.addEventListener('change', () => {
      this.toggleUnfocusHotkeySettings();
      this.saveSettings();
    });

    this.enableSiteSpecificUnfocus.addEventListener('change', () => {
      this.toggleSiteSpecificUnfocusSettings();
      this.saveSettings();
    });

    this.recordGlobalUnfocusHotkey.addEventListener('click', () => {
      this.startRecordingHotkey(this.globalUnfocusHotkey, this.recordGlobalUnfocusHotkey);
    });

    this.addSiteUnfocusHotkey.addEventListener('click', () => {
      this.addSiteSpecificUnfocusHotkey();
    });

    // Settings
    this.autoRestore.addEventListener('change', () => {
      this.saveSettings();
    });

    this.selectorMethodSelect.addEventListener('change', () => {
      this.saveSettings();
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

    // Add event listeners for delete buttons
    const deleteButtons = this.elementsList.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.deleteElement(tabUrl, index);
      });
    });

    // Add event listeners for edit selector buttons
    const editSelectorButtons = this.elementsList.querySelectorAll('.edit-selector-btn');
    editSelectorButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.openSelectorEditor(tabUrl, index);
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
      
      // Decide which selector to show as primary (pattern > selector)
      const primarySelector = element.patternSelector || element.selector;
      const secondarySelector = element.patternSelector ? element.selector : null;
      
      // Generate smart selector based on primarySelector (only if it's not already a pattern)
      const smartSelector = this.generateSmartSelector(primarySelector);
      const showSmartSelector = smartSelector !== primarySelector && !primarySelector.includes('*');
      
      return `
        <div class="element-item" data-action="${action}">
          <div class="element-header">
            <div class="element-info">
              <div class="element-name" data-tab-url="${tabUrl}" data-index="${index}">${element.name || 'Unnamed Element'}</div>
              <div class="element-selector" title="${element.patternSelector ? 'Pattern Selector' : 'Original Selector'}">${primarySelector}</div>
              ${secondarySelector ? `<div class="element-selector" style="color:#9aa0a6;font-style:italic;" title="Original Selector (read-only)">${secondarySelector}</div>` : ''}
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
              <button class="action-btn edit-selector-btn" data-tab-url="${tabUrl}" data-index="${index}" title="Edit Selector">🎯</button>
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

    // Add event listeners for edit selector buttons
    const editSelectorButtons = this.elementsList.querySelectorAll('.edit-selector-btn');
    editSelectorButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tabUrl = e.target.dataset.tabUrl;
        const index = parseInt(e.target.dataset.index);
        this.openSelectorEditor(tabUrl, index);
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
    }, 1000);
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
    const result = await chrome.storage.local.get([
      'autoRestore', 
      'selectorMethod',
      'enableUnfocusHotkey',
      'globalUnfocusHotkey',
      'enableSiteSpecificUnfocus',
      'siteUnfocusHotkeys'
    ]);
    
    // Load basic settings
    this.autoRestore.checked = result.autoRestore !== undefined ? result.autoRestore : false;
    this.selectorMethodSelect.value = result.selectorMethod || 'smart';
    
    // Load unfocus settings (all off by default)
    this.enableUnfocusHotkey.checked = result.enableUnfocusHotkey || false;
    this.globalUnfocusHotkey.value = result.globalUnfocusHotkey || 'Alt+Shift+U';
    this.enableSiteSpecificUnfocus.checked = result.enableSiteSpecificUnfocus || false;
    
    // Toggle visibility based on settings
    this.toggleUnfocusHotkeySettings();
    this.toggleSiteSpecificUnfocusSettings();
    
    // Load site-specific hotkeys
    const siteHotkeys = result.siteUnfocusHotkeys || {};
    this.renderSiteSpecificUnfocusHotkeys(siteHotkeys);
  }
  
  async saveSettings() {
    const settings = {
      autoRestore: this.autoRestore.checked,
      selectorMethod: this.selectorMethodSelect.value,
      enableUnfocusHotkey: this.enableUnfocusHotkey.checked,
      globalUnfocusHotkey: this.globalUnfocusHotkey.value || 'Alt+Shift+U',
      enableSiteSpecificUnfocus: this.enableSiteSpecificUnfocus.checked
    };
    
    await chrome.storage.local.set(settings);
    console.log('Settings saved:', settings);
    
    // Notify content script of settings changes
    this.notifyContentScript();
  }
  
  validateManualSelector() {
    const selector = this.manualSelectorInput.value.trim();

    // If empty, reset button state
    if (!selector) {
      this.addSelectorBtn.disabled = true;
      this.addSelectorBtn.textContent = 'Add Selector';
      this.addSelectorBtn.style.background = '#ccc';
      return;
    }

    const isValid = this.isValidSelector(selector);

    // Check if it's a pattern selector
    const isPattern = selector.includes('*') ||
                     selector.includes('[text=') ||
                     selector.includes('[icon=');

    if (isPattern) {
      // For pattern selectors, validate the converted CSS
      try {
        const cssSelector = this.convertPatternToCSS(selector);
        const patternValid = this.isValidSelector(cssSelector);

        this.addSelectorBtn.disabled = !patternValid;
        this.addSelectorBtn.textContent = patternValid ? 'Add Pattern' : 'Invalid Pattern';

        if (patternValid) {
          this.addSelectorBtn.style.background = '#34a853'; // Green for patterns
        } else {
          this.addSelectorBtn.style.background = '#ea4335'; // Red for invalid
        }
      } catch (error) {
        this.addSelectorBtn.disabled = true;
        this.addSelectorBtn.textContent = 'Invalid Pattern';
        this.addSelectorBtn.style.background = '#ea4335';
      }
    } else {
      // Regular selector validation
      this.addSelectorBtn.disabled = !isValid;
      this.addSelectorBtn.textContent = isValid ? 'Add Selector' : 'Invalid Selector';
      this.addSelectorBtn.style.background = isValid ? '#4285f4' : '#ea4335';
    }
  }
  
  isValidSelector(selector) {
    if (!selector) return false;
    
    try {
      document.querySelector(selector);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  async addManualSelector() {
    const selector = this.manualSelectorInput.value.trim();
    if (!selector) return;
    
    const isPattern = selector.includes('*') || 
                     selector.includes('[text=') || 
                     selector.includes('[icon=');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabUrl = new URL(tab.url).hostname;
      
      // Get existing elements
      const result = await chrome.storage.local.get([tabUrl]);
      const elements = result[tabUrl] || [];
      
      // Check if element already exists
      const existingIndex = elements.findIndex(el => 
        el.selector === selector || 
        el.patternSelector === selector
      );
      
      if (existingIndex !== -1) {
        this.showNotification('This selector/pattern is already being tracked!', 'warning');
        return;
      }
      
      let elementData;
      
      if (isPattern) {
        // Handle pattern selector
        elementData = {
          name: `Pattern: ${selector.substring(0, 30)}${selector.length > 30 ? '...' : ''}`,
          selector: selector, // Store original pattern as selector
          patternSelector: selector, // Also store as pattern
          smartSelector: selector,
          textContent: 'Pattern-based element',
          visible: true,
          dateAdded: new Date().toISOString(),
          elementType: 'pattern',
          hasId: false,
          hasClasses: false,
          action: 'toggle',
          hotkey: null,
          isPattern: true
        };
        
        this.showNotification('Pattern selector added successfully!', 'success');
      } else {
        // Handle regular selector - test it first
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'testSelector',
          selector: selector
        });
        
        if (response && response.found) {
          elementData = {
            name: response.suggestedName || `Manual: ${selector.substring(0, 20)}${selector.length > 20 ? '...' : ''}`,
            selector: selector,
            smartSelector: response.smartSelector || selector,
            textContent: response.textContent || '',
            visible: true,
            dateAdded: new Date().toISOString(),
            elementType: response.elementType || 'unknown',
            hasId: response.hasId || false,
            hasClasses: response.hasClasses || false,
            action: 'toggle',
            hotkey: null
          };
          
          this.showNotification('Selector added successfully!', 'success');
        } else {
          this.showNotification('Element not found on current page. Added as pattern.', 'warning');
          
          // Add as pattern even if not found on current page
          elementData = {
            name: `Manual: ${selector.substring(0, 30)}${selector.length > 30 ? '...' : ''}`,
            selector: selector,
            smartSelector: selector,
            textContent: 'Manual selector',
            visible: true,
            dateAdded: new Date().toISOString(),
            elementType: 'manual',
            hasId: false,
            hasClasses: false,
            action: 'toggle',
            hotkey: null
          };
        }
      }
      
      // Add the element
      elements.push(elementData);
      await chrome.storage.local.set({ [tabUrl]: elements });
      
      // Clear input and re-render
      this.manualSelectorInput.value = '';
      this.validateManualSelector();
      this.renderElements(elements, tabUrl);
      
      // Notify content script
      this.notifyContentScript();
      
    } catch (error) {
      console.error('Error adding manual selector:', error);
      this.showNotification('Failed to add selector', 'error');
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
    // Use the new enhanced hotkey recording system
    this.currentElementContext = { tabUrl, index, button };
    this.startRecordingHotkey(button, button, true);
  }

  handleHotkeyRecording(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Skip modifier-only keys
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }
    
    // Build hotkey string with enhanced modifier support
    let hotkeyString = '';
    if (e.ctrlKey) hotkeyString += 'Ctrl+';
    if (e.altKey) hotkeyString += 'Alt+';
    if (e.shiftKey) hotkeyString += 'Shift+';
    if (e.metaKey) hotkeyString += 'Meta+';
    
    // Add the key
    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();
    
    hotkeyString += keyName;
    
    // Set the value and stop recording
    if (this.currentRecordingInput) {
      this.currentRecordingInput.value = hotkeyString;
      this.currentRecordingInput.textContent = hotkeyString;
      
      // Save if it's a settings hotkey
      if (this.currentRecordingInput === this.globalUnfocusHotkey) {
        this.saveSettings();
      }
      
      // Save if it's an element hotkey
      if (this.currentElementContext) {
        const { tabUrl, index } = this.currentElementContext;
        this.updateElementHotkey(tabUrl, index, hotkeyString);
        this.currentElementContext = null;
      }
    }
    
    this.stopRecordingHotkey();
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

  async openSelectorEditor(tabUrl, index) {
    const result = await chrome.storage.local.get([tabUrl]);
    const elements = result[tabUrl] || [];
    const element = elements[index];
    
    if (!element) return;
    
    // Store current editing context
    this.currentEditingTabUrl = tabUrl;
    this.currentEditingIndex = index;
    
    // Populate modal fields
    this.originalSelector.value = element.selector;
    this.patternSelector.value = element.patternSelector || element.selector;
    
    // Show modal
    this.selectorEditorModal.classList.add('active');
    this.patternSelector.focus();
    
    // Initial validation
    this.validateSelectorPattern();
  }

  closeSelectorEditorModal() {
    this.selectorEditorModal.classList.remove('active');
    this.currentEditingTabUrl = null;
    this.currentEditingIndex = null;
  }

  validateSelectorPattern() {
    const pattern = this.patternSelector.value.trim();
    
    if (!pattern) {
      this.updateSelectorHint('Please enter a selector pattern', 'error');
      this.saveSelectorEdit.disabled = true;
      return false;
    }
    
    // Convert pattern to CSS selector for validation
    const cssSelector = this.convertPatternToCSS(pattern);
    
    try {
      // Test if it's a valid CSS selector
      document.querySelector(cssSelector);
      this.updateSelectorHint('Pattern looks valid ✓', 'success');
      this.saveSelectorEdit.disabled = false;
      return true;
    } catch (e) {
      this.updateSelectorHint('Invalid CSS selector syntax', 'error');
      this.saveSelectorEdit.disabled = true;
      return false;
    }
  }

  updateSelectorHint(message, type = '') {
    this.selectorHint.textContent = message;
    this.selectorHint.className = `selector-editor-hint ${type}`;
  }

  convertPatternToCSS(pattern) {
    // Convert wildcard patterns to CSS attribute selectors with enhanced matching
    let cssSelector = pattern;
    
    // Handle special pattern attributes first
    // Text content matching: [text="YouTube"] becomes a data attribute we'll handle in JS
    if (cssSelector.includes('[text=')) {
      // We'll handle text matching in the custom findElementWithPattern method
      // For now, just remove it from CSS validation
      cssSelector = cssSelector.replace(/\[text="[^"]*"\]/g, '');
    }
    
    // Icon matching: [icon="video_youtube"] becomes mat-icon[data-mat-icon-type="font"]:contains(video_youtube)
    if (cssSelector.includes('[icon=')) {
      cssSelector = cssSelector.replace(/\[icon="([^"]*)"\]/g, '');
    }
    
    // Enhanced ID patterns handling
    // Handle complex patterns like #_r_*_ or #prefix-*-suffix
    cssSelector = cssSelector.replace(/#([^#\s\[\]]*)\*([^#\s\[\]]*)/g, (match, prefix, suffix) => {
      if (prefix && suffix) {
        // Pattern like #_r_*_ becomes [id^="_r_"][id$="_"]
        return `[id^="${prefix}"][id$="${suffix}"]`;
      } else if (prefix) {
        // Pattern like #prefix-* becomes [id^="prefix-"]
        return `[id^="${prefix}"]`;
      } else if (suffix) {
        // Pattern like #*-suffix becomes [id$="-suffix"]
        return `[id$="${suffix}"]`;
      }
      return match;
    });
    
    // Handle remaining simple ID patterns: #prefix* becomes [id^="prefix"]
    cssSelector = cssSelector.replace(/#([^#\s\[\]]+)\*/g, '[id^="$1"]');
    cssSelector = cssSelector.replace(/#\*([^#\s\[\]]+)/g, '[id$="$1"]');
    
    // Enhanced class patterns handling
    // Handle complex patterns like .class-*-end
    cssSelector = cssSelector.replace(/\.([^.\s\[\]]*)\*([^.\s\[\]]*)/g, (match, prefix, suffix) => {
      if (prefix && suffix) {
        // Pattern like .btn-*-large becomes [class*="btn-"][class*="-large"]
        return `[class*="${prefix}"][class*="${suffix}"]`;
      } else if (prefix) {
        // Pattern like .btn-* becomes [class*="btn-"]
        return `[class*="${prefix}"]`;
      } else if (suffix) {
        // Pattern like .*-large becomes [class*="-large"]
        return `[class*="${suffix}"]`;
      }
      return match;
    });
    
    // Handle remaining simple class patterns
    cssSelector = cssSelector.replace(/\.([^.\s\[\]]+)\*/g, '[class*="$1"]');
    cssSelector = cssSelector.replace(/\.\*([^.\s\[\]]+)/g, '[class*="$1"]');
    
    // Enhanced attribute patterns: [attr="prefix-*-suffix"] becomes [attr*="prefix-"][attr*="-suffix"]
    cssSelector = cssSelector.replace(/\[([^=]+)="([^"]*)\*([^"]*)"\]/g, (match, attr, prefix, suffix) => {
      if (prefix && suffix) {
        return `[${attr}*="${prefix}"][${attr}*="${suffix}"]`;
      } else if (prefix) {
        return `[${attr}^="${prefix}"]`;
      } else if (suffix) {
        return `[${attr}$="${suffix}"]`;
      }
      return match;
    });
    
    // Handle contains attribute patterns: [attr*="value"] (already valid CSS)
    // These don't need conversion
    
    // Handle nth-child patterns: :nth-child(*) becomes :nth-child(n)
    cssSelector = cssSelector.replace(/:nth-child\(\*\)/g, ':nth-child(n)');
    cssSelector = cssSelector.replace(/:nth-of-type\(\*\)/g, ':nth-of-type(n)');
    
    return cssSelector.trim();
  }

  findElementWithPattern(pattern) {
    // Enhanced pattern matching that handles text content and icon matching
    try {
      // Parse special pattern attributes
      const textMatch = pattern.match(/\[text="([^"]*)"\]/);
      const iconMatch = pattern.match(/\[icon="([^"]*)"\]/);
      
      // Get the base CSS selector (without special attributes)
      let baseSelector = pattern
        .replace(/\[text="[^"]*"\]/g, '')
        .replace(/\[icon="[^"]*"\]/g, '')
        .trim();
      
      // Convert base pattern to CSS
      const cssSelector = this.convertPatternToCSS(baseSelector);
      
      // Find all elements matching the base pattern
      const candidates = document.querySelectorAll(cssSelector);
      
      // Filter by additional criteria
      for (const element of candidates) {
        let matches = true;
        
        // Check text content
        if (textMatch) {
          const targetText = textMatch[1].toLowerCase();
          const elementText = element.textContent.trim().toLowerCase();
          if (!elementText.includes(targetText)) {
            matches = false;
          }
        }
        
        // Check icon content
        if (iconMatch) {
          const targetIcon = iconMatch[1];
          const iconElement = element.querySelector('mat-icon');
          if (!iconElement || iconElement.textContent.trim() !== targetIcon) {
            matches = false;
          }
        }
        
        if (matches) {
          return element;
        }
      }
      
      // If no enhanced match found, fall back to basic CSS selector
      return document.querySelector(cssSelector);
      
    } catch (error) {
      console.error('Error in findElementWithPattern:', error);
      return null;
    }
  }

  async testSelectorPattern() {
    if (!this.validateSelectorPattern()) {
      return;
    }
    
    const pattern = this.patternSelector.value.trim();
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send test message to content script with enhanced pattern
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'testPatternSelector',
        pattern: pattern,
        enhanced: true
      });
      
      if (response && response.found) {
        if (response.enhanced && response.specificMatches > 0) {
          this.updateSelectorHint(`✓ Found ${response.specificMatches} specific match(es) (${response.count} total matches)`, 'success');
        } else {
          this.updateSelectorHint(`✓ Found ${response.count} matching element(s) on page`, 'success');
        }
      } else {
        this.updateSelectorHint('⚠ No matching elements found on current page', 'error');
      }
    } catch (error) {
      console.error('Error testing selector:', error);
      this.updateSelectorHint('Failed to test selector on page', 'error');
    }
  }

  async saveSelectorPattern() {
    if (!this.validateSelectorPattern()) {
      return;
    }
    
    const pattern = this.patternSelector.value.trim();
    const tabUrl = this.currentEditingTabUrl;
    const index = this.currentEditingIndex;
    
    if (!tabUrl || index === null) return;
    
    try {
      const result = await chrome.storage.local.get([tabUrl]);
      const elements = result[tabUrl] || [];
      
      if (elements[index]) {
        elements[index].patternSelector = pattern;
        await chrome.storage.local.set({ [tabUrl]: elements });
        
        this.showNotification('Selector pattern saved successfully!', 'success');
        this.closeSelectorEditorModal();
        
        // Refresh the elements list
        this.renderElements(elements, tabUrl);
        
        // Notify content script of changes
        this.notifyContentScript();
      }
    } catch (error) {
      console.error('Error saving selector pattern:', error);
      this.showNotification('Failed to save selector pattern', 'error');
    }
  }

  toggleUnfocusHotkeySettings() {
    const enabled = this.enableUnfocusHotkey.checked;
    this.unfocusHotkeySettings.style.display = enabled ? 'block' : 'none';
    this.enableSiteSpecificUnfocus.disabled = !enabled;
    
    if (!enabled) {
      this.enableSiteSpecificUnfocus.checked = false;
      this.toggleSiteSpecificUnfocusSettings();
    }
  }

  toggleSiteSpecificUnfocusSettings() {
    const enabled = this.enableSiteSpecificUnfocus.checked && this.enableUnfocusHotkey.checked;
    this.siteSpecificUnfocusSettings.style.display = enabled ? 'block' : 'none';
  }

  startRecordingHotkey(inputElement, buttonElement, isElementHotkey = false) {
    if (this.isRecordingHotkey) {
      this.stopRecordingHotkey();
      return;
    }

    this.isRecordingHotkey = true;
    this.currentRecordingInput = inputElement;
    
    // Update UI based on whether it's an element hotkey or settings hotkey
    if (isElementHotkey) {
      // Element hotkey button
      inputElement.classList.add('recording');
      inputElement.textContent = 'Recording...';
      inputElement.disabled = false;
      
      // Disable other hotkey buttons to prevent conflicts
      this.elementsList.querySelectorAll('.hotkey-btn').forEach(btn => {
        if (btn !== inputElement) {
          btn.disabled = true;
        }
      });
    } else {
      // Settings hotkey input
      inputElement.classList.add('recording');
      inputElement.value = 'Press any key combination...';
      buttonElement.classList.add('recording');
      buttonElement.textContent = 'Recording...';
    }
    
    // Cache bound handler so we can remove it later
    if (!this.boundHotkeyHandler) {
      this.boundHotkeyHandler = this.handleHotkeyRecording.bind(this);
    }
    document.addEventListener('keydown', this.boundHotkeyHandler, true);
  }

  stopRecordingHotkey() {
    if (!this.isRecordingHotkey) return;
    
    this.isRecordingHotkey = false;
    if (this.boundHotkeyHandler) {
      document.removeEventListener('keydown', this.boundHotkeyHandler, true);
    }
    
    // Reset UI
    if (this.currentRecordingInput) {
      this.currentRecordingInput.classList.remove('recording');
    }
    
    // Reset all record buttons (settings)
    document.querySelectorAll('.hotkey-record-btn.recording').forEach(btn => {
      btn.classList.remove('recording');
      btn.textContent = 'Record';
    });
    
    // Re-enable all hotkey buttons (elements)
    this.elementsList.querySelectorAll('.hotkey-btn').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('recording');
    });
    
    this.currentRecordingInput = null;
  }

  async addSiteSpecificUnfocusHotkey() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const domain = new URL(tab.url).hostname;
      
      // Create a new site hotkey item
      const item = document.createElement('div');
      item.className = 'site-hotkey-item';
      
      item.innerHTML = `
        <div class="site-hotkey-domain">${domain}</div>
        <input type="text" class="site-hotkey-value" placeholder="Click to record..." readonly>
        <button class="site-hotkey-remove" title="Remove">×</button>
      `;
      
      // Add event listeners
      const hotkeyInput = item.querySelector('.site-hotkey-value');
      const removeBtn = item.querySelector('.site-hotkey-remove');
      
      hotkeyInput.addEventListener('click', () => {
        this.startRecordingSiteHotkey(hotkeyInput, domain);
      });
      
      removeBtn.addEventListener('click', () => {
        item.remove();
        this.saveSiteSpecificUnfocusHotkeys();
      });
      
      this.siteUnfocusHotkeyList.appendChild(item);
      
      // Start recording immediately
      this.startRecordingSiteHotkey(hotkeyInput, domain);
      
    } catch (error) {
      console.error('Error adding site-specific hotkey:', error);
    }
  }

  startRecordingSiteHotkey(inputElement, domain) {
    if (this.isRecordingHotkey) {
      this.stopRecordingHotkey();
      return;
    }
    
    this.isRecordingHotkey = true;
    this.currentRecordingInput = inputElement;
    
    inputElement.classList.add('recording');
    inputElement.value = 'Press any key combination...';
    
    // Store domain for saving
    this.currentRecordingDomain = domain;
    
    if (!this.boundSiteHotkeyHandler) {
      this.boundSiteHotkeyHandler = this.handleSiteHotkeyRecording.bind(this);
    }
    document.addEventListener('keydown', this.boundSiteHotkeyHandler, true);
  }

  handleSiteHotkeyRecording(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }
    
    let hotkeyString = '';
    if (e.ctrlKey) hotkeyString += 'Ctrl+';
    if (e.altKey) hotkeyString += 'Alt+';
    if (e.shiftKey) hotkeyString += 'Shift+';
    if (e.metaKey) hotkeyString += 'Meta+';
    
    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();
    
    hotkeyString += keyName;
    
    if (this.currentRecordingInput) {
      this.currentRecordingInput.value = hotkeyString;
      this.currentRecordingInput.classList.remove('recording');
    }
    
    this.isRecordingHotkey = false;
    this.currentRecordingInput = null;
    if (this.boundSiteHotkeyHandler) {
      document.removeEventListener('keydown', this.boundSiteHotkeyHandler, true);
    }
    
    // Save the site-specific hotkeys
    this.saveSiteSpecificUnfocusHotkeys();
  }

  async updateElementHotkey(tabUrl, index, hotkey) {
    const result = await chrome.storage.local.get([tabUrl]);
    const elements = result[tabUrl] || [];
    
    if (elements[index]) {
      elements[index].hotkey = hotkey;
      await chrome.storage.local.set({ [tabUrl]: elements });
      
      // Re-render elements to show the new hotkey
      this.renderElements(elements, tabUrl);
      
      // Notify content script that hotkeys have changed
      this.notifyContentScript();
    }
  }

  async saveSiteSpecificUnfocusHotkeys() {
    const siteHotkeys = {};
    const items = this.siteUnfocusHotkeyList.querySelectorAll('.site-hotkey-item');
    
    items.forEach(item => {
      const domain = item.querySelector('.site-hotkey-domain').textContent;
      const hotkey = item.querySelector('.site-hotkey-value').value;
      
      if (domain && hotkey && !hotkey.includes('Press any key') && !hotkey.includes('Click to record')) {
        siteHotkeys[domain] = hotkey;
      }
    });
    
    await chrome.storage.local.set({ siteUnfocusHotkeys: siteHotkeys });
    console.log('Site-specific unfocus hotkeys saved:', siteHotkeys);
    
    // Notify content script
    this.notifyContentScript();
  }

  renderSiteSpecificUnfocusHotkeys(siteHotkeys) {
    this.siteUnfocusHotkeyList.innerHTML = '';
    
    Object.entries(siteHotkeys).forEach(([domain, hotkey]) => {
      const item = document.createElement('div');
      item.className = 'site-hotkey-item';
      
      item.innerHTML = `
        <div class="site-hotkey-domain">${domain}</div>
        <input type="text" class="site-hotkey-value" value="${hotkey}" readonly>
        <button class="site-hotkey-remove" title="Remove">×</button>
      `;
      
      // Add event listeners
      const hotkeyInput = item.querySelector('.site-hotkey-value');
      const removeBtn = item.querySelector('.site-hotkey-remove');
      
      hotkeyInput.addEventListener('click', () => {
        this.startRecordingSiteHotkey(hotkeyInput, domain);
      });
      
      removeBtn.addEventListener('click', () => {
        item.remove();
        this.saveSiteSpecificUnfocusHotkeys();
      });
      
      this.siteUnfocusHotkeyList.appendChild(item);
    });
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ElementTogglePopup();
}); 