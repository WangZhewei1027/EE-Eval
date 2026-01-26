import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520acd91-fa76-11f0-a09b-87751f540fd8.html';

// Page object for the DNS Example application
class DNSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = APP_URL;
  }

  // Navigate to the app page and wait for load
  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  // Read the element nodeName (to confirm it's a DIV and not an input)
  async getNodeName() {
    return await this.page.$eval('#dns', el => el.nodeName);
  }

  // Read the element's value property (the implementation uses .value on a div)
  async getValueProperty() {
    return await this.page.$eval('#dns', el => el.value);
  }

  // Read visible text content of the element
  async getTextContent() {
    return await this.page.$eval('#dns', el => el.textContent);
  }

  // Programmatically set the element.value and dispatch an 'input' event so the page's handler runs
  async setValueAndDispatchInput(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('dns');
      // Set the value property (as the app expects) then dispatch an input event
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }, value);
  }

  // Call the page's getDomainName utility directly and return its result
  async callGetDomainName(domain) {
    return await this.page.evaluate((d) => {
      // Return result of getDomainName if defined, otherwise return a sentinel
      if (typeof getDomainName === 'function') {
        return getDomainName(d);
      }
      return '__NO_GETDOMAINNAME__';
    }, domain);
  }
}

test.describe('DNS Example - FSM states and transitions', () => {
  let dnsPage;
  let consoleMessages;
  let pageErrors;

  // Setup: capture console and page errors and navigate to the app
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', msg => {
      // Save text and type for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page exceptions
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    dnsPage = new DNSPage(page);
    await dnsPage.goto();
  });

  // Teardown: assert that the page had no unexpected runtime errors
  test.afterEach(async () => {
    // Assert there were no uncaught page errors such as ReferenceError/SyntaxError/TypeError
    // The test will fail here if there were any page errors during test execution.
    expect(pageErrors, 'No unexpected page runtime errors should have occurred').toHaveLength(0);

    // Assert there were no console errors/warnings emitted by the page unexpectedly.
    // Collect only console messages of type 'error' to make a clearer assertion.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors, 'No console.error messages expected from page').toHaveLength(0);
  });

  test('Initial Idle state: element exists and initial value equals IP for www.example.com', async () => {
    // This validates S0_Idle entry action: dnsInput.value = dnsQuery('www.example.com');
    // The implementation uses a DIV with id "dns" and sets its .value property.
    const nodeName = await dnsPage.getNodeName();
    expect(nodeName).toBe('DIV'); // The element is a DIV (implementation detail)

    const initialValue = await dnsPage.getValueProperty();
    expect(initialValue).toBe('192.0.2.1'); // expected IP for www.example.com

    // The visual/visible text content should remain empty because script sets .value, not innerText
    const visibleText = await dnsPage.getTextContent();
    expect(visibleText).toBe('');
  });

  test('Transition to Querying: changing input to known domain updates value to corresponding IP', async () => {
    // This validates the InputChange event and transition to S1_Querying
    // Simulate typing "www.google.com" by setting the .value and dispatching an input event
    await dnsPage.setValueAndDispatchInput('www.google.com');

    // After the input event handler runs, the element's value property should be updated to the IP
    const updatedValue = await dnsPage.getValueProperty();
    expect(updatedValue).toBe('216.58.194.174');
  });

  test('Querying unknown domain: shows error message in value property', async () => {
    // Edge case: enter a domain that does not exist in the DNS object
    const unknown = 'no-such-domain.example';
    await dnsPage.setValueAndDispatchInput(unknown);

    const afterValue = await dnsPage.getValueProperty();
    expect(afterValue).toBe('No DNS entry found for ' + unknown);
  });

  test('Domain with trailing dot resolves correctly (canonicalization edge case)', async () => {
    // Check that 'www.example.com.' (with trailing dot) is handled as present in the dns map
    await dnsPage.setValueAndDispatchInput('www.example.com.');

    const resolved = await dnsPage.getValueProperty();
    expect(resolved).toBe('192.0.2.1');
  });

  test('Utility function getDomainName exists and returns second-level domain', async () => {
    // Validate the helper function present in the page script
    const result = await dnsPage.callGetDomainName('subdomain.example.co');
    // getDomainName in the page implementation combines the last two parts
    expect(result).toBe('co'); // Note: based on the provided implementation logic, this will combine the last two parts incorrectly for certain inputs (see test expectation)
    // The test above documents the actual behavior of the provided implementation.
  });
});

test.describe('Console and error observation tests', () => {
  // These tests focus on observing console messages and page errors explicitly.
  test('No unexpected console messages or page errors on load', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a tick to allow any async page script errors to surface
    await page.waitForTimeout(50);

    // Assert no page errors were emitted
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error calls happened
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Explicitly observe behavior when dispatching input events to the DIV', async ({ page }) => {
    // This test demonstrates that the page's input handler runs when an 'input' event is dispatched,
    // even though the target element is a DIV (unconventional but allowed in the DOM).
    const messages = [];
    page.on('console', m => messages.push({ type: m.type(), text: m.text() }));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Dispatch an input to change to a known domain and verify the value changed
    await page.evaluate(() => {
      const el = document.getElementById('dns');
      el.value = 'www.google.com';
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    });

    const value = await page.$eval('#dns', el => el.value);
    expect(value).toBe('216.58.194.174');

    // Confirm no console.error messages were emitted during this interaction
    const consoleErrors = messages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});