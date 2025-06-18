class ElementPicker {
  constructor() {
    this.isActive = false;
    this.hoveredElement = null;
    this.overlay = null;
    this.clickHotkeys = []; // Store hotkeys for this page
    this.unfocusHotkey = null; // Global unfocus hotkey
    this.siteUnfocusHotkeys = {}; // Site-specific unfocus hotkeys
    
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleGlobalHotkey = this.handleGlobalHotkey.bind(this);
    
    this.setupMessageListener();
    this.loadHotkeysAndRestoreState();
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'startPicker') {
        this.startPicker();
        sendResponse({ success: true });
      } else if (request.action === 'stopPicker') {
        this.stopPicker();
        sendResponse({ success: true });
      } else if (request.action === 'toggleElement') {
        this.toggleElementVisibility(
          request.selector, 
          request.smartSelector, 
          request.method || 'smart',
          request.visible,
          request.patternSelector
        );
        sendResponse({ success: true });
      } else if (request.action === 'testSelector') {
        const result = this.testSelector(request.selector);
        sendResponse(result);
      } else if (request.action === 'showNotification') {
        this.showHotkeyNotification(request.message, request.type || 'info');
        sendResponse({ success: true });
      } else if (request.action === 'hotkeysUpdated') {
        // Reload hotkeys and state from storage
        this.loadHotkeysAndRestoreState();
        sendResponse({ success: true });
      } else if (request.action === 'testPatternSelector') {
        // Test a pattern selector
        const result = this.testPatternSelector(request.pattern, request.enhanced);
        sendResponse(result);
      }
    });
  }
  
  async loadHotkeysAndRestoreState() {
    await this.restoreElementStates(); // Restore visibility first
    
    // Load click hotkeys
    const result = await chrome.storage.local.get([window.location.hostname]);
    const elements = result[window.location.hostname] || [];
    
    this.clickHotkeys = elements
      .filter(el => el.action === 'click' && el.hotkey)
      .map(el => ({
        hotkey: el.hotkey,
        selector: el.selector,
        smartSelector: el.smartSelector,
        patternSelector: el.patternSelector, // Include pattern selector
        name: el.name // Add name for debugging
      }));

    // Load unfocus settings
    const settings = await chrome.storage.local.get([
      'enableUnfocusHotkey',
      'globalUnfocusHotkey',
      'enableSiteSpecificUnfocus',
      'siteUnfocusHotkeys'
    ]);
    
    this.unfocusEnabled = settings.enableUnfocusHotkey || false;
    this.globalUnfocusHotkey = settings.globalUnfocusHotkey || 'Alt+Shift+U';
    this.siteSpecificEnabled = settings.enableSiteSpecificUnfocus || false;
    this.siteUnfocusHotkeys = settings.siteUnfocusHotkeys || {};
    
    // Get current domain for site-specific hotkey
    this.currentDomain = window.location.hostname;

    console.log('Loaded hotkeys for', window.location.hostname, ':', this.clickHotkeys);
    console.log('Unfocus settings:', { 
      enabled: this.unfocusEnabled, 
      global: this.globalUnfocusHotkey,
      siteSpecific: this.siteSpecificEnabled,
      siteDomains: Object.keys(this.siteUnfocusHotkeys),
      currentSite: this.siteUnfocusHotkeys[this.currentDomain]
    });

    // Remove any existing listener before adding a new one
    document.removeEventListener('keydown', this.handleGlobalHotkey, true);
    
    // Add listener if we have hotkeys or unfocus is enabled
    if (this.clickHotkeys.length > 0 || this.unfocusEnabled) {
      document.addEventListener('keydown', this.handleGlobalHotkey, true);
      console.log('Global hotkey listener attached');
    } else {
      console.log('No hotkeys or unfocus disabled - no listener attached');
    }
  }

  handleGlobalHotkey(e) {
    console.log('Key pressed:', e.key, 'Modifiers:', { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey });
    
    // Build hotkey string
    let hotkeyString = '';
    if (e.ctrlKey) hotkeyString += 'Ctrl+';
    if (e.altKey) hotkeyString += 'Alt+';
    if (e.shiftKey) hotkeyString += 'Shift+';
    if (e.metaKey) hotkeyString += 'Meta+';

    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      let keyName = e.key;
      if (keyName === ' ') keyName = 'Space';
      else if (keyName.length === 1) keyName = keyName.toUpperCase();
      hotkeyString += keyName;
    } else {
      return; // Only modifier was pressed
    }

    console.log('Hotkey string formed:', hotkeyString);

    // Check for unfocus hotkey first (works even in input fields)
    if (this.unfocusEnabled && this.checkUnfocusHotkey(hotkeyString)) {
      console.log('Unfocus hotkey matched!');
      e.preventDefault();
      e.stopPropagation();
      
      const activeElement = document.activeElement;
      if (activeElement && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || 
        activeElement.isContentEditable
      )) {
        activeElement.blur();
        this.showHotkeyNotification('Input unfocused - hotkeys ready', 'success');
      } else {
        this.showHotkeyNotification('No input to unfocus', 'info');
      }
      return;
    }
    
    // Don't trigger click hotkeys if user is typing in an input field
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
      console.log('Ignoring click hotkey - user is typing in an input field');
      return;
    }

    // Check for click hotkeys
    const matchedHotkey = this.clickHotkeys.find(h => h.hotkey === hotkeyString);

    if (matchedHotkey) {
      console.log('Click hotkey matched!', matchedHotkey);
      e.preventDefault();
      e.stopPropagation();
      
      const element = this.findElementWithFallback(
        matchedHotkey.selector,
        matchedHotkey.smartSelector,
        'smart', // Always use smart find for hotkeys
        matchedHotkey.patternSelector // Pass pattern selector
      );

      if (element) {
        console.log('Element found, processing click:', element);
        this.performElementAction(element);
        this.showClickFeedback(element);
        this.showHotkeyNotification(`Activated: ${matchedHotkey.name}`, 'success');
      } else {
        console.warn(`Hotkey triggered, but element not found for selector: ${matchedHotkey.selector}`);
        this.showHotkeyNotification(`Element for hotkey "${hotkeyString}" not found.`, 'error');
      }
    } else {
      console.log('No hotkey match found for:', hotkeyString);
    }
  }

  checkUnfocusHotkey(hotkeyString) {
    // Check site-specific hotkey first (if enabled)
    if (this.siteSpecificEnabled && this.siteUnfocusHotkeys[this.currentDomain]) {
      const siteHotkey = this.siteUnfocusHotkeys[this.currentDomain];
      if (hotkeyString === siteHotkey) {
        console.log('Site-specific unfocus hotkey matched:', siteHotkey);
        return true;
      }
    }
    
    // Fall back to global hotkey
    if (hotkeyString === this.globalUnfocusHotkey) {
      console.log('Global unfocus hotkey matched:', this.globalUnfocusHotkey);
      return true;
    }
    
    return false;
  }

  performElementAction(element) {
    const tagName = element.tagName.toLowerCase();
    const elementType = element.type ? element.type.toLowerCase() : '';
    
    console.log('Performing action on element:', tagName, 'type:', elementType);

    // Handle different types of elements appropriately
    if (tagName === 'input') {
      // Handle different input types
      if (['text', 'email', 'password', 'search', 'url', 'tel', 'number'].includes(elementType)) {
        // Text input fields
        element.click();
        element.focus();
        // Move cursor to end of existing text
        if (element.value) {
          element.setSelectionRange(element.value.length, element.value.length);
        }
        console.log('Focused text input and set cursor position');
      } else if (['checkbox', 'radio'].includes(elementType)) {
        // Checkbox and radio buttons
        element.click();
        console.log('Clicked checkbox/radio input');
      } else if (elementType === 'submit' || elementType === 'button') {
        // Submit and button inputs
        element.click();
        console.log('Clicked submit/button input');
      } else {
        // Other input types
        element.click();
        element.focus();
        console.log('Clicked and focused other input type');
      }
    } else if (tagName === 'textarea') {
      // Text areas
      element.click();
      element.focus();
      // Move cursor to end of existing text
      if (element.value) {
        element.setSelectionRange(element.value.length, element.value.length);
      }
      console.log('Focused textarea and set cursor position');
    } else if (tagName === 'select') {
      // Select dropdowns
      element.click();
      element.focus();
      console.log('Focused select dropdown');
    } else if (element.isContentEditable || element.contentEditable === 'true') {
      // Content editable elements (like rich text editors)
      element.click();
      element.focus();
      // Move cursor to end of content
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false); // Collapse to end
      selection.removeAllRanges();
      selection.addRange(range);
      console.log('Focused content editable element and set cursor to end');
    } else {
      // Regular clickable elements (buttons, links, etc.)
      element.click();
      console.log('Clicked regular element');
    }
  }

  showClickFeedback(element) {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'element-click-ripple';
    ripple.style.cssText = `
      position: absolute;
      left: ${rect.left + window.scrollX + rect.width / 2}px;
      top: ${rect.top + window.scrollY + rect.height / 2}px;
      width: ${Math.max(rect.width, rect.height) * 2}px;
      height: ${Math.max(rect.width, rect.height) * 2}px;
      background: rgba(66, 133, 244, 0.4);
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(0);
      animation: ripple-effect 0.6s ease-out;
      z-index: 9999999;
      pointer-events: none;
    `;

    document.body.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  }
  
  // Smart selector generation (same as popup.js)
  generateSmartSelector(originalSelector) {
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
  
  // Enhanced element finding that tries multiple methods
  findElementWithFallback(selector, smartSelector, method = 'smart', patternSelector = null) {
    const trySelector = (sel) => {
      if (!sel) return null;
      try {
        return document.querySelector(sel);
      } catch (e) {
        // console.warn(`Invalid selector: ${sel}`, e);
        return null;
      }
    };
    
    if (method === 'exact') {
      return trySelector(selector);
    } 
    
    // Smart method - now prioritizes pattern selectors with enhanced matching
    
    // 1. Try enhanced pattern selector first (if available)
    if (patternSelector) {
      if (patternSelector.includes('[text=') || patternSelector.includes('[icon=')) {
        const element = this.findElementWithPattern(patternSelector);
        if (element) {
          console.log('Found element with enhanced pattern selector:', patternSelector);
          return element;
        }
      } else {
        // Use basic pattern conversion for simple patterns
        const cssPatternSelector = this.convertPatternToCSS(patternSelector);
        const element = trySelector(cssPatternSelector);
        if (element) {
          console.log('Found element with pattern selector:', patternSelector, '→', cssPatternSelector);
          return element;
        }
      }
    }
    
    // 2. Try exact selector
    let element = trySelector(selector);
    if (element) return element;
    
    // 3. Try provided smart selector
    if (smartSelector && smartSelector !== selector) {
      element = trySelector(smartSelector);
      if (element) return element;
    }
    
    // 4. Generate and try a new smart selector
    const generatedSmartSelector = this.generateSmartSelector(selector);
    if (generatedSmartSelector !== selector) {
      element = trySelector(generatedSmartSelector);
      if (element) return element;
    }
    
    // 5. Try minimal selector as last resort
    const minimalSelector = this.generateMinimalSelector(selector);
    if (minimalSelector && minimalSelector !== selector) {
      element = trySelector(minimalSelector);
      if (element) return element;
    }

    // 6. If it's a complex selector, try finding by a more stable parent
    if (selector.includes('>')) {
      const parts = selector.split('>');
      if (parts.length > 1) {
        const parentSelector = parts.slice(0, -1).join('>').trim();
        try {
          const parent = document.querySelector(parentSelector);
          if (parent) {
             // If parent is found, try finding the child within it
             const childSelector = parts[parts.length - 1].trim();
             return parent.querySelector(childSelector);
          }
        } catch (e) {
            // silent fail
        }
      }
    }
    
    return null;
  }
  
  startPicker() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.createOverlay();
    
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    
    // Add visual indicators
    document.body.style.cursor = 'crosshair';
    document.body.classList.add('element-picker-active');
    
    // Show helpful notification
    this.showPickerNotification('Click on any element to select it, or press ESC to cancel', 'info');
  }
  
  stopPicker() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.removeOverlay();
    this.clearHighlight();
    
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    
    // Clean up visual indicators
    document.body.style.cursor = '';
    document.body.classList.remove('element-picker-active');
    
    // Remove any picker-related notifications
    const pickerNotifications = document.querySelectorAll('.element-picker-notification:not(.success):not(.error)');
    pickerNotifications.forEach(notification => {
      notification.classList.add('slide-out');
      setTimeout(() => notification.remove(), 300);
    });
  }
  
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'element-picker-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(66, 133, 244, 0.1);
      z-index: 999999;
      pointer-events: none;
      border: 2px solid #4285f4;
      box-sizing: border-box;
    `;
    document.body.appendChild(this.overlay);
  }
  
  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
  
  handleMouseMove(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const element = document.elementFromPoint(event.clientX, event.clientY);
    
    // Skip if no element found or if it's the same element or if it's the overlay
    if (!element || element === this.hoveredElement || element === this.overlay) {
      return;
    }
    
    // Skip if the element is part of our extension's UI
    if (element.id === 'element-picker-overlay' || 
        element.classList.contains('element-picker-highlight') ||
        element.classList.contains('element-picker-notification')) {
      return;
    }
    
    // Highlight the new element
    this.highlightElement(element);
  }
  
  handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Additional prevention for input elements to avoid immediate focusing
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) {
      event.target.blur(); // Ensure the element doesn't get focused during picking
    }

    if (this.hoveredElement) {
      this.selectElement(this.hoveredElement);
    }

    this.stopPicker();
  }
  
  handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.stopPicker();
    }
  }
  
  highlightElement(element) {
    // Clear any existing highlight first
    this.clearHighlight();
    
    // Add the CSS class for enhanced highlighting
    element.classList.add('element-picker-highlight');
    
    // Store the element for cleanup
    this.hoveredElement = element;
  }
  
  clearHighlight() {
    if (this.hoveredElement) {
      // Remove the highlight class
      this.hoveredElement.classList.remove('element-picker-highlight');
      this.hoveredElement = null;
    }
  }
  
  async selectElement(element) {
    // Clear highlighting before generating selector to avoid including picker classes
    this.clearHighlight();
    
    const selector = this.generateSelector(element);
    const smartSelector = this.generateSmartSelector(selector);
    const textContent = element.textContent.trim().substring(0, 100);
    
    const tabUrl = window.location.hostname;
    
    // Get existing elements
    const result = await chrome.storage.local.get([tabUrl]);
    const elements = result[tabUrl] || [];
    
    // Check if element already exists (check both selectors)
    const existingIndex = elements.findIndex(el => 
      el.selector === selector || 
      el.smartSelector === smartSelector
    );
    
    if (existingIndex !== -1) {
      alert('This element is already being tracked!');
      return;
    }
    
    // Generate a smart default name based on element content and type
    const defaultName = this.generateDefaultName(element);
    
    // Add new element with enhanced metadata
    const newElement = {
      name: defaultName,
      selector: selector,
      smartSelector: smartSelector,
      textContent: textContent,
      visible: true,
      dateAdded: new Date().toISOString(),
      elementType: element.tagName.toLowerCase(),
      hasId: !!element.id,
      hasClasses: !!element.className,
      action: 'toggle',
      hotkey: null
    };
    
    elements.push(newElement);
    await chrome.storage.local.set({ [tabUrl]: elements });
    
    // Visual feedback
    this.showSelectionFeedback(element, defaultName);
  }
  
  generateDefaultName(element) {
    // Try to generate a meaningful name based on element content and attributes
    
    // Check for aria-label or title attributes
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label').substring(0, 30);
    }
    
    if (element.title) {
      return element.title.substring(0, 30);
    }
    
    // Check for alt text on images
    if (element.tagName === 'IMG' && element.alt) {
      return `Image: ${element.alt.substring(0, 25)}`;
    }
    
    // Check for button or link text
    if (['BUTTON', 'A'].includes(element.tagName)) {
      const text = element.textContent.trim();
      if (text) {
        return text.substring(0, 30);
      }
    }
    
    // Check for form elements
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)) {
      const placeholder = element.placeholder;
      const label = document.querySelector(`label[for="${element.id}"]`);
      
      if (label && label.textContent.trim()) {
        return label.textContent.trim().substring(0, 30);
      }
      
      if (placeholder) {
        return `Input: ${placeholder.substring(0, 25)}`;
      }
      
      return `${element.tagName.toLowerCase()} field`;
    }
    
    // Check for headings
    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
      const text = element.textContent.trim();
      if (text) {
        return `${element.tagName}: ${text.substring(0, 25)}`;
      }
    }
    
    // Check for navigation or menu items
    if (element.closest('nav, menu') || element.className.includes('nav') || element.className.includes('menu')) {
      const text = element.textContent.trim();
      if (text) {
        return `Nav: ${text.substring(0, 25)}`;
      }
    }
    
    // Check for specific classes that might indicate purpose
    const classPatterns = [
      { pattern: /sidebar|aside/, prefix: 'Sidebar' },
      { pattern: /header|top/, prefix: 'Header' },
      { pattern: /footer|bottom/, prefix: 'Footer' },
      { pattern: /banner|hero/, prefix: 'Banner' },
      { pattern: /ad|advertisement/, prefix: 'Ad' },
      { pattern: /modal|popup/, prefix: 'Modal' },
      { pattern: /tooltip|tip/, prefix: 'Tooltip' },
      { pattern: /notification|alert/, prefix: 'Alert' }
    ];
    
    const className = element.className.toLowerCase();
    for (const { pattern, prefix } of classPatterns) {
      if (pattern.test(className)) {
        const text = element.textContent.trim();
        const preview = text ? `: ${text.substring(0, 20)}` : '';
        return `${prefix}${preview}`;
      }
    }
    
    // Fall back to element type and brief content
    const text = element.textContent.trim();
    const tagName = element.tagName.toLowerCase();
    
    if (text && text.length > 0) {
      return `${tagName}: ${text.substring(0, 25)}`;
    }
    
    // Final fallback - just the tag name
    return `${tagName} element`;
  }
  
  generateSelector(element) {
    const path = [];
    let current = element;
    
    // Traverse up from the element to the body
    while (current && current.parentNode && current !== document.body) {
      let segment = current.tagName.toLowerCase();
      
      // If the current element has an ID, we've found our anchor.
      // Prepend it to the path and break the loop.
      if (current.id) {
        segment = `#${CSS.escape(current.id)}`;
        path.unshift(segment);
        break;
      }
      
      const parent = current.parentNode;
      
      // Check if the tag name alone is unique among its siblings
      const sameTagSiblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      
      // If the tag isn't unique, or if we need more specificity, add nth-child
      if (sameTagSiblings.length > 1) {
        const index = Array.from(parent.children).indexOf(current) + 1;
        segment += `:nth-child(${index})`;
      }
      
      path.unshift(segment);
      current = parent;
    }
    
    // If the loop finished without finding an ID, the path is relative to the body
    return path.join(' > ');
  }
  
  showSelectionFeedback(element, elementName) {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.element-picker-notification');
    existingNotifications.forEach(notification => {
      notification.classList.add('slide-out');
      setTimeout(() => notification.remove(), 300);
    });
    
    const feedback = document.createElement('div');
    feedback.className = 'element-picker-notification success';
    feedback.innerHTML = `
      <div style="font-weight: 500;">✓ Element selected!</div>
      <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">${elementName}</div>
    `;
    
    document.body.appendChild(feedback);
    
    // Auto-remove after 1 seconds with slide-out animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.classList.add('slide-out');
        setTimeout(() => feedback.remove(), 300);
      }
    }, 1000);
  }
  
  toggleElementVisibility(selector, smartSelector, method, visible, patternSelector = null) {
    const element = this.findElementWithFallback(selector, smartSelector, method, patternSelector);
    
    if (element) {
      if (visible) {
        element.style.display = '';
        element.style.visibility = '';
        element.style.opacity = '';
      } else {
        element.style.display = 'none';
      }
    } else {
      console.warn('Could not find element to toggle:', { selector, smartSelector, patternSelector, method });
    }
  }
  
  async restoreElementStates() {
    try {
      // Check if auto-restore is enabled
      const settingsResult = await chrome.storage.local.get(['autoRestore', 'selectorMethod']);
      const autoRestore = settingsResult.autoRestore !== undefined ? settingsResult.autoRestore : false;
      const method = settingsResult.selectorMethod || 'smart';
      
      if (!autoRestore) {
        console.log('Auto-restore is disabled, skipping element state restoration');
        return;
      }
      
      const result = await chrome.storage.local.get([window.location.hostname]);
      const elements = result[window.location.hostname] || [];
      
      console.log(`Restoring ${elements.length} elements using ${method} method`);
      
      for (const elementData of elements) {
        const element = this.findElementWithFallback(
          elementData.selector, 
          elementData.smartSelector, 
          method,
          elementData.patternSelector // Pass pattern selector
        );
        
        if (element) {
          if (elementData.visible) {
            element.style.display = '';
            element.style.visibility = '';
            element.style.opacity = '';
          } else {
            element.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error restoring element states:', error);
    }
  }
  
  testSelector(selector) {
    try {
      const element = this.findElementWithFallback(selector);
      if (element) {
        const suggestedName = this.generateDefaultName(element);
        const textContent = element.textContent?.trim().substring(0, 50) || '';
        
        return {
          found: true,
          suggestedName: suggestedName,
          textContent: textContent,
          elementType: element.tagName.toLowerCase(),
          hasId: !!element.id,
          hasClasses: !!element.className,
          computedSelector: this.generateSelector(element),
          smartSelector: this.generateSmartSelector(selector)
        };
      } else {
        return {
          found: false,
          message: 'Element not found with the provided selector'
        };
      }
    } catch (error) {
      return {
        found: false,
        message: `Invalid selector: ${error.message}`
      };
    }
  }
  
  showPickerNotification(message, type = 'info') {
    // Remove any existing picker notifications
    const existingNotifications = document.querySelectorAll('.element-picker-notification');
    existingNotifications.forEach(notification => {
      if (!notification.classList.contains('success') && !notification.classList.contains('error')) {
        notification.classList.add('slide-out');
        setTimeout(() => notification.remove(), 300);
      }
    });
    
    const notification = document.createElement('div');
    notification.className = `element-picker-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 1 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('slide-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 1000);
  }

  showHotkeyNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.element-toggle-hotkey-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = 'element-toggle-hotkey-notification';
    notification.textContent = message;
    
    const bgColor = type === 'success' ? '#34a853' : type === 'error' ? '#ea4335' : '#4285f4';
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideInFromRight 0.3s ease-out;
    `;
    
    // Add animation keyframes if not already added
    if (!document.querySelector('#element-toggle-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'element-toggle-notification-styles';
      styles.textContent = `
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 1 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 1000);
  }

  testPatternSelector(pattern, enhanced = false) {
    try {
      if (enhanced) {
        // Use enhanced pattern matching
        const element = this.findElementWithPattern(pattern);
        const cssSelector = this.convertPatternToCSS(pattern);
        const allMatches = document.querySelectorAll(cssSelector);
        
        return {
          found: !!element,
          count: allMatches.length,
          specificMatches: element ? 1 : 0,
          enhanced: true,
          cssSelector: cssSelector
        };
      } else {
        // Use basic pattern matching
        const cssSelector = this.convertPatternToCSS(pattern);
        const elements = document.querySelectorAll(cssSelector);
        
        return {
          found: elements.length > 0,
          count: elements.length,
          cssSelector: cssSelector
        };
      }
    } catch (error) {
      console.error('Error testing pattern selector:', error);
      return {
        found: false,
        count: 0,
        error: error.message
      };
    }
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

  convertPatternToCSS(pattern) {
    // Convert wildcard patterns to CSS attribute selectors with enhanced matching
    let cssSelector = pattern;
    
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
    
    // Handle nth-child patterns: :nth-child(*) becomes :nth-child(n)
    cssSelector = cssSelector.replace(/:nth-child\(\*\)/g, ':nth-child(n)');
    cssSelector = cssSelector.replace(/:nth-of-type\(\*\)/g, ':nth-of-type(n)');
    
    return cssSelector;
  }
}

// Initialize the element picker
new ElementPicker();

// Add keyframes for click feedback
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
  @keyframes ripple-effect {
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleSheet); 