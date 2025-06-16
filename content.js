class ElementPicker {
  constructor() {
    this.isActive = false;
    this.hoveredElement = null;
    this.originalOutline = null;
    this.overlay = null;
    
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this.setupMessageListener();
    this.restoreElementStates();
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
          request.visible
        );
        sendResponse({ success: true });
      } else if (request.action === 'testSelector') {
        const result = this.testSelector(request.selector);
        sendResponse(result);
      } else if (request.action === 'showNotification') {
        this.showHotkeyNotification(request.message, request.type || 'info');
        sendResponse({ success: true });
      }
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
  findElementWithFallback(selector, smartSelector, method = 'smart') {
    try {
      if (method === 'exact') {
        // Only try exact selector
        return document.querySelector(selector);
      } else if (method === 'smart') {
        // Try multiple approaches in order
        
        // 1. Try exact selector first
        let element = document.querySelector(selector);
        if (element) {
          console.log('Found element with exact selector:', selector);
          return element;
        }
        
        // 2. Try provided smart selector
        if (smartSelector && smartSelector !== selector) {
          element = document.querySelector(smartSelector);
          if (element) {
            console.log('Found element with provided smart selector:', smartSelector);
            return element;
          }
        }
        
        // 3. Generate and try smart selector if not provided
        if (!smartSelector) {
          const generatedSmartSelector = this.generateSmartSelector(selector);
          if (generatedSmartSelector !== selector) {
            element = document.querySelector(generatedSmartSelector);
            if (element) {
              console.log('Found element with generated smart selector:', generatedSmartSelector);
              return element;
            }
          }
        }
        
        // 4. Try minimal selector as last resort
        const minimalSelector = this.generateMinimalSelector(selector);
        if (minimalSelector && minimalSelector !== selector) {
          element = document.querySelector(minimalSelector);
          if (element) {
            console.log('Found element with minimal selector:', minimalSelector);
            return element;
          }
        }
        
        console.warn('Could not find element with any selector method for:', selector);
        return null;
      }
    } catch (error) {
      console.error('Error finding element:', error);
      return null;
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
    
    document.body.style.cursor = 'crosshair';
  }
  
  stopPicker() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.removeOverlay();
    this.clearHighlight();
    
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    
    document.body.style.cursor = '';
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
    if (element && element !== this.hoveredElement) {
      this.clearHighlight();
      this.highlightElement(element);
      this.hoveredElement = element;
    }
  }
  
  handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
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
    this.originalOutline = element.style.outline;
    element.style.outline = '2px solid #4285f4';
    element.style.outlineOffset = '1px';
  }
  
  clearHighlight() {
    if (this.hoveredElement && this.originalOutline !== null) {
      this.hoveredElement.style.outline = this.originalOutline;
      this.hoveredElement = null;
      this.originalOutline = null;
    }
  }
  
  async selectElement(element) {
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
      hasClasses: !!element.className
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
    // Try to generate a unique selector
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Try class-based selector
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        const classSelector = `.${classes.join('.')}`;
        if (document.querySelectorAll(classSelector).length === 1) {
          return classSelector;
        }
      }
    }
    
    // Generate path-based selector
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }
      
      if (current.className) {
        const classes = current.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          selector += `.${classes.slice(0, 2).join('.')}`;
        }
      }
      
      // Add nth-child if needed for uniqueness
      const siblings = Array.from(current.parentNode?.children || [])
        .filter(el => el.tagName === current.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentNode;
    }
    
    return path.join(' > ');
  }
  
  showSelectionFeedback(element, elementName) {
    const feedback = document.createElement('div');
    feedback.innerHTML = `
      <div style="font-weight: 500;">✓ Element selected!</div>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">${elementName}</div>
    `;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4285f4;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: sans-serif;
      font-size: 14px;
      z-index: 1000000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 250px;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.remove();
    }, 3000);
  }
  
  toggleElementVisibility(selector, smartSelector, method, visible) {
    const element = this.findElementWithFallback(selector, smartSelector, method);
    
    if (element) {
      if (visible) {
        element.style.display = '';
        element.style.visibility = '';
        element.style.opacity = '';
      } else {
        element.style.display = 'none';
      }
    } else {
      console.warn('Could not find element to toggle:', { selector, smartSelector, method });
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
          method
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
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }
}

// Initialize the element picker
new ElementPicker(); 