import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cb841-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Hash Table Visualization page
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main elements are present
    await this.page.waitForSelector('#populateButton');
    await this.page.waitForSelector('#hashTable');
  }

  async clickPopulate() {
    await this.page.click('#populateButton');
  }

  async countBuckets() {
    return await this.page.$$eval('#hashTable .bucket', els => els.length);
  }

  async getBucketTexts() {
    return await this.page.$$eval('#hashTable .bucket .bucket-content', els => els.map(e => e.textContent.trim()));
  }

  async getHashTableInnerHTML() {
    return await this.page.$eval('#hashTable', el => el.innerHTML);
  }

  async isPopulateButtonVisible() {
    return await this.page.isVisible('#populateButton');
  }
}

test.describe('Hash Table Visualization - FSM states and transitions', () => {
  // Containers for console and page errors captured per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught exceptions thrown in the page
    page.on('pageerror', error => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });
  });

  // Test initial state S0_Idle
  test('S0_Idle: Initial render shows Populate button and empty hash table (entry action renderPage())', async ({ page }) => {
    // This test validates the initial idle state described in the FSM.
    // It checks that the UI renders with the populate button present and the hash table empty.
    const hp = new HashTablePage(page);

    // Navigate to the page and attach listeners were already set in beforeEach
    await hp.goto();

    // Assert populate button is visible
    expect(await hp.isPopulateButtonVisible()).toBe(true);

    // Assert the hash table element exists and is empty initially
    const initialInnerHTML = await hp.getHashTableInnerHTML();
    expect(initialInnerHTML).toBe('', 'Expected hash table innerHTML to be empty in Idle state');

    // Ensure no page errors occurred during initial render
    expect(pageErrors).toEqual([], `Expected no page errors during initial render, found: ${JSON.stringify(pageErrors)}`);

    // Ensure there are no console error-level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([], `Expected no console.errors on initial render, found: ${JSON.stringify(consoleErrors)}`);
  });

  // Test the transition PopulateHashTable: clicking the button populates the table
  test('PopulateHashTable event transitions S0_Idle -> S1_HashTablePopulated and creates 8 buckets', async ({ page }) => {
    // This test validates the transition triggered by clicking the Populate button.
    // It verifies that the hash table is populated with 8 buckets each containing "Key X: Value Y".
    const hp = new HashTablePage(page);
    await hp.goto();

    // Precondition: ensure empty
    expect(await hp.countBuckets()).toBe(0);

    // Click populate and wait for expected DOM changes
    await Promise.all([
      page.waitForSelector('#hashTable .bucket'), // wait for at least one bucket
      hp.clickPopulate()
    ]);

    // Assert exactly 8 buckets were created
    const bucketCount = await hp.countBuckets();
    expect(bucketCount).toBe(8, 'Expected 8 buckets after populating the hash table');

    // Assert text contents format for each bucket
    const texts = await hp.getBucketTexts();
    expect(texts.length).toBe(8);
    for (let i = 0; i < texts.length; i++) {
      const txt = texts[i];
      // Should include "Key" and "Value"
      expect(txt).toMatch(/Key\s+\d+:\s+Value\s+\d+/, `Bucket ${i} content didn't match expected pattern: ${txt}`);
    }

    // Verify that innerHTML was cleared before population by performing another populate and ensuring new content replaced old
    const innerHTMLAfterFirstPopulate = await hp.getHashTableInnerHTML();
    await hp.clickPopulate();
    const innerHTMLAfterSecondPopulate = await hp.getHashTableInnerHTML();
    expect(innerHTMLAfterSecondPopulate).not.toBe('', 'Expected innerHTML not to be empty after second populate');
    expect(innerHTMLAfterSecondPopulate).not.toBe(innerHTMLAfterFirstPopulate, 'Expected new populate to clear previous contents and replace with new data');

    // Ensure no runtime errors were thrown during populating
    expect(pageErrors).toEqual([], `Expected no page errors while populating, found: ${JSON.stringify(pageErrors)}`);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs).toEqual([], `Expected no console.error while populating, found: ${JSON.stringify(consoleErrs)}`);
  });

  // Edge case: rapid multiple clicks
  test('Edge case: Rapid multiple clicks still result in a clean population and no errors', async ({ page }) => {
    // This test attempts multiple rapid clicks to ensure the app remains stable:
    // - Old content should be cleared and replaced
    // - Final result should still contain 8 buckets
    // - No JS errors should be emitted
    const hp = new HashTablePage(page);
    await hp.goto();

    // Rapidly click populate several times without awaiting population fully
    await Promise.all([
      page.waitForSelector('#hashTable .bucket'),
      // Trigger multiple clicks in quick succession
      (async () => {
        await hp.clickPopulate();
        await hp.clickPopulate();
        await hp.clickPopulate();
      })()
    ]);

    // After repeated clicks, ensure exactly 8 buckets are present (each populate should clear then add 8)
    const bucketCount = await hp.countBuckets();
    expect(bucketCount).toBe(8, 'Expected 8 buckets after rapid repeated populates');

    // Validate content format remains correct
    const texts = await hp.getBucketTexts();
    for (const t of texts) {
      expect(t).toMatch(/Key\s+\d+:\s+Value\s+\d+/, `Unexpected bucket content: ${t}`);
    }

    // Verify that no console errors or page errors were recorded during rapid interactions
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs).toEqual([], `Expected no console.error during rapid clicks, got: ${JSON.stringify(consoleErrs)}`);
    expect(pageErrors).toEqual([], `Expected no page errors during rapid clicks, got: ${JSON.stringify(pageErrors)}`);
  });

  // Test for unexpected JS errors (ReferenceError, SyntaxError, TypeError) - assert none occurred
  test('Monitor for runtime errors: page should not throw ReferenceError, SyntaxError, or TypeError during normal use', async ({ page }) => {
    // This test explicitly looks for common JS error types in pageErrors captured during navigation and interactions.
    const hp = new HashTablePage(page);

    // Navigate and do a normal populate to exercise code paths
    await hp.goto();
    await hp.clickPopulate();

    // Check captured page errors for specific error types
    const errorNames = pageErrors.map(e => e.name);
    // Assert none of the common fatal error types occurred
    const fatalErrors = errorNames.filter(name => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(name));
    expect(fatalErrors).toEqual([], `Expected no ReferenceError/SyntaxError/TypeError, found: ${JSON.stringify(fatalErrors)}`);

    // Also inspect console messages for those keywords as an extra precaution
    const consoleErrorsWithNames = consoleMessages
      .filter(m => m.type === 'error')
      .map(m => m.text)
      .filter(txt => /ReferenceError|SyntaxError|TypeError/.test(txt));
    expect(consoleErrorsWithNames).toEqual([], `Expected no console messages indicating ReferenceError/SyntaxError/TypeError, found: ${JSON.stringify(consoleErrorsWithNames)}`);
  });

  // Validate evidence of event handler wiring: clicking triggers populateHashTable (as observed by DOM change)
  test('Event wiring: populateButton click is wired and triggers populateHashTable (evidence by DOM mutation)', async ({ page }) => {
    // This test ensures the event described in FSM is actually wired up:
    // document.getElementById("populateButton").addEventListener("click", populateHashTable);
    const hp = new HashTablePage(page);
    await hp.goto();

    // Before clicking, snapshot the hash table innerHTML
    const before = await hp.getHashTableInnerHTML();
    expect(before).toBe('', 'Expected empty hash table before clicking populate button');

    // Click and wait for buckets to appear
    await Promise.all([
      page.waitForSelector('#hashTable .bucket'),
      hp.clickPopulate()
    ]);

    const after = await hp.getHashTableInnerHTML();
    expect(after).not.toBe('', 'Expected hash table innerHTML to change after the click event');

    // Confirm bucket elements exist as evidence that populateHashTable executed
    const bucketCount = await hp.countBuckets();
    expect(bucketCount).toBe(8, 'Expected populateHashTable to add 8 buckets as evidence of execution');

    // Ensure no errors were logged as a side-effect of event handling
    expect(pageErrors).toEqual([], 'No page errors should have been recorded during event handling');
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs).toEqual([], 'No console error messages should have been logged during event handling');
  });
});