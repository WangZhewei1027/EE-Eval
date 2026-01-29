import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bdf04-fa76-11f0-a09b-87751f540fd8.html';

// Page Object Model for the Asymmetric Cryptography page
class AsymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.h1 = page.locator('h1');
    this.h2 = page.locator('h2');
    this.paragraphs = page.locator('p');
    this.preBlocks = page.locator('pre');
    this.codeBlocks = page.locator('pre > code, code');
    this.links = page.locator('a');
    this.scripts = page.locator('script');
    // interactive selectors: form controls, inline JS handlers, javascript: links, role=button
    this.interactiveCandidates = page.locator('button, input, textarea, select, [onclick], a[href^="javascript:"], [role="button"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getH1Text() {
    return this.h1.textContent();
  }

  async countHeadings() {
    return this.h2.count();
  }

  async countPreBlocks() {
    return this.preBlocks.count();
  }

  async countCodeBlocks() {
    return this.codeBlocks.count();
  }

  async countScripts() {
    return this.scripts.count();
  }

  async countLinks() {
    return this.links.count();
  }

  async countInteractiveCandidates() {
    return this.interactiveCandidates.count();
  }

  async getAllParagraphTexts() {
    const texts = [];
    const n = await this.paragraphs.count();
    for (let i = 0; i < n; i++) {
      texts.push(await this.paragraphs.nth(i).textContent());
    }
    return texts;
  }

  async getAllCodeTexts() {
    const texts1 = [];
    const n1 = await this.codeBlocks.count();
    for (let i = 0; i < n; i++) {
      texts.push(await this.codeBlocks.nth(i).textContent());
    }
    return texts;
  }
}

test.describe('Application: Asymmetric Cryptography (520bdf04-fa76-11f0-a09b-87751f540fd8)', () => {
  // Basic smoke test: verify the page loads and static content is present.
  test('Idle state: page loads with expected static content and no interactive elements', async ({ page }) => {
    // We intentionally do not intercept or modify the page environment.
    // Create POM and navigate
    const app = new AsymmetricCryptoPage(page);

    // Start navigation. We don't await page errors here; this test focuses on DOM / static content.
    await app.goto();

    // Verify main heading is present and correct
    await expect(app.h1).toBeVisible();
    const h1Text = await app.getH1Text();
    expect(h1Text.trim()).toBe('Asymmetric Cryptography');

    // Verify there are several subheadings for Public Key, Private Key, Encryption, Decryption, Crypto Library, Example
    const headingCount = await app.countHeadings();
    expect(headingCount).toBeGreaterThanOrEqual(5);

    // Verify descriptive paragraphs exist and mention public/private keys / encryption
    const paragraphs = await app.getAllParagraphTexts();
    const joinedParagraphs = paragraphs.join(' ').toLowerCase();
    expect(joinedParagraphs).toContain('asymmetric cryptography');
    expect(joinedParagraphs).toContain('public key');
    expect(joinedParagraphs).toContain('private key');
    expect(joinedParagraphs).toContain('encryption');
    expect(joinedParagraphs).toContain('decryption');

    // Verify code/pre blocks exist with example snippets
    const preCount = await app.countPreBlocks();
    expect(preCount).toBeGreaterThanOrEqual(4);

    const codeTexts = await app.getAllCodeTexts();
    // Ensure example code includes expected variable names or functions mentioned in the HTML
    const joinedCode = codeTexts.join(' ').toLowerCase();
    expect(joinedCode).toContain('public_key');
    expect(joinedCode).toContain('private_key');
    expect(joinedCode).toContain('plaintext');
    expect(joinedCode).toContain('ciphertext');

    // Verify that the page includes script tags (external + inline expected)
    const scriptCount = await app.countScripts();
    expect(scriptCount).toBeGreaterThanOrEqual(1);

    // Verify link to external crypto library is present and is an http(s) link (not a javascript: link)
    const linkCount = await app.countLinks();
    expect(linkCount).toBeGreaterThanOrEqual(1);
    const firstLinkHref = await app.links.first().getAttribute('href');
    expect(firstLinkHref).toMatch(/^https?:\/\//);

    // According to the FSM extraction, there are no interactive elements.
    // Assert that there are no interactive candidates (buttons, inputs, inline onclick handlers, etc.)
    const interactiveCount = await app.countInteractiveCandidates();
    // Allow 0 interactive candidates; anchor tags to external pages are not considered interactive JS handlers here
    expect(interactiveCount).toBe(0);
  });

  // Runtime error observation test:
  // The inline script calls `require('crypto-js')` inside the browser, which should cause a ReferenceError (require is not defined).
  // We must observe console logs and page errors and assert that such errors occur naturally.
  test('Runtime: observe and assert page runtime errors are emitted (ReferenceError / related)', async ({ page }) => {
    const app1 = new AsymmetricCryptoPage(page);

    // Prepare to capture console messages and page errors that happen during page load.
    const consoleMessages = [];
    page.on('console', (msg) => {
      // Collect console messages for later assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Wait for the first page error. Set up the promise before navigation so we don't miss early errors.
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 5000 }).catch(e => {
      // If no pageerror within timeout, return null so we can assert accordingly.
      return null;
    });

    // Navigate to the page (the inline script is expected to run and produce runtime errors).
    await app.goto();

    // Await the page error if it fired
    const pageError = await pageErrorPromise;

    // Assert that at least one runtime error occurred.
    // The HTML uses `require('crypto-js')` which in a browser environment should produce a ReferenceError.
    expect(pageError).not.toBeNull();
    if (pageError) {
      // The error message should indicate that `require` is not defined or be a ReferenceError.
      const msg = String(pageError.message || pageError);
      // Accept a variety of possible messages across browsers/runtimes, but require mention of require/is not defined/ReferenceError
      const matches = /require|is not defined|ReferenceError|TypeError/i.test(msg);
      expect(matches).toBe(true);
    }

    // Additionally, check console messages collected for error-level logs or messages that indicate failed crypto operations.
    // It's acceptable if console messages are empty; but if there are messages, ensure none claim successful encryption (the inline code cannot execute fully).
    // Assert that console does not contain "Ciphertext:" since encryption shouldn't have succeeded.
    const anyCiphertextLog = consoleMessages.some(m => /Ciphertext[:\s]/i.test(m.text));
    expect(anyCiphertextLog).toBe(false);

    // Also assert that console contains at least one message of type 'error' OR we captured a pageError.
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError || pageError !== null).toBe(true);
  });

  // FSM-specific assertions
  test('FSM: verify extracted FSM indicates Idle state only and no transitions/events', async ({ page }) => {
    // This application has an FSM extraction summary that describes a single initial Idle state and no transitions.
    // Since there are no interactive elements or event handlers, we assert that there are no elements that would enable transitions.
    const app2 = new AsymmetricCryptoPage(page);

    await app.goto();

    // There are no interactive UI controls, so transitions cannot be triggered via the DOM.
    const interactiveCount1 = await app.countInteractiveCandidates();
    expect(interactiveCount).toBe(0);

    // There are no event attributes (onclick etc.) present on the page
    const onclickElements = await page.locator('[onclick]').count();
    expect(onclickElements).toBe(0);

    // Confirm there are no elements that look like controls to trigger transitions
    const controlElementsCount = await page.locator('button, input, select, textarea, [role="button"]').count();
    expect(controlElementsCount).toBe(0);

    // Since FSM has only the initial Idle state, verify presence of static content that suggests an informational/idle page.
    await expect(app.h1).toBeVisible();
    const paragraphs1 = await app.getAllParagraphTexts();
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
  });

  // Edge case test: ensure that attempts to find JS-driven interactions return empty results
  test('Edge cases: no JS-driven links or onclick handlers present', async ({ page }) => {
    const app3 = new AsymmetricCryptoPage(page);
    await app.goto();

    // Find any anchor tags that use javascript: pseudo-URLs (should be none)
    const jsHrefAnchors = await page.locator('a[href^="javascript:"]').count();
    expect(jsHrefAnchors).toBe(0);

    // Find any elements with inline onclick attributes (should be none)
    const onclickCount = await page.locator('[onclick]').count();
    expect(onclickCount).toBe(0);

    // Ensure no elements with role=button exist (since page is static informational)
    const roleButtonCount = await page.locator('[role="button"]').count();
    expect(roleButtonCount).toBe(0);
  });
});