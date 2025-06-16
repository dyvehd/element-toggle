// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    const tabUrl = new URL(tab.url).hostname;
    
    // Get stored elements and settings for this hostname
    const result = await chrome.storage.local.get([tabUrl, 'selectorMethod']);
    const elements = result[tabUrl] || [];
    const method = result.selectorMethod || 'smart';
    
    if (elements.length === 0) {
      // No elements to toggle
      return;
    }
    
    let visible = false;
    if (command === 'show-all') {
      visible = true;
    } else if (command === 'hide-all') {
      visible = false;
    } else {
      return; // Unknown command
    }
    
    // Update all elements visibility in storage
    const updatedElements = elements.map(element => ({
      ...element,
      visible: visible
    }));
    
    await chrome.storage.local.set({ [tabUrl]: updatedElements });
    
    // Send messages to content script to toggle each element
    for (const element of updatedElements) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleElement',
          selector: element.selector,
          smartSelector: element.smartSelector || generateSmartSelector(element.selector),
          method: method,
          visible: visible
        });
      } catch (error) {
        console.warn('Failed to toggle element:', element.selector, error);
      }
    }
    
    // Show notification feedback
    const action = visible ? 'shown' : 'hidden';
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: `${elements.length} elements ${action}`,
        type: 'success'
      });
    } catch (error) {
      // Notification failed, but that's okay
      console.log('Notification failed:', error);
    }
    
  } catch (error) {
    console.error('Error handling command:', command, error);
  }
});

// Smart selector generation (simplified version for background script)
function generateSmartSelector(originalSelector) {
  const patterns = [
    { pattern: /ng-tns-c\d+-/g, replacement: 'ng-tns-c*-' },
    { pattern: /css-[a-zA-Z0-9]+-/g, replacement: 'css-*-' },
    { pattern: /data-v-[a-f0-9]{8}/g, replacement: 'data-v-*' },
    { pattern: /_[a-zA-Z0-9]{5,}_/g, replacement: '_*_' },
    {
      pattern: /\.[a-zA-Z]+-[a-f0-9]{6,}/g,
      replacement: (match) => {
        const parts = match.split('-');
        return parts[0] + '-*';
      }
    }
  ];
  
  let smartSelector = originalSelector;
  
  patterns.forEach(({ pattern, replacement }) => {
    if (typeof replacement === 'function') {
      smartSelector = smartSelector.replace(pattern, replacement);
    } else {
      smartSelector = smartSelector.replace(pattern, replacement);
    }
  });
  
  return convertToAttributeSelector(smartSelector);
}

function convertToAttributeSelector(selector) {
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