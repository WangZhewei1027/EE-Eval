import { test, expect } from '@playwright/test';

// Test file: 3c99d761-fa78-11f0-857d-d58e82d5de73.spec.js
// URL under test:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c99d761-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating common interactions and queries for the OSI page
class OSIPage {
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#highlightBtn';
    this.layerSelector = '.osi-layer';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getButton() {
    return await this.page.locator(this.buttonSelector);
  }

  async getButtonText() {
    const btn = await this.getButton();
    return await btn.textContent();
  }

  async getButtonAriaPressed() {
    const btn = await this.getButton();
    return await btn.getAttribute('aria-pressed');
  }

  async clickHighlight() {
    const btn = await this.getButton();
    await btn.click();
  }

  async getLayers() {
    return this.page.locator(this.layerSelector);
  }

  // Returns number of layers that currently have the 'glow' class
  async countGlowingLayers() {
    const layers = await this.getLayers();
    const count = await layers.evaluateAll((els) =>
      els.reduce((acc, el) => acc + (el.classList.contains('glow') ? 1 : 0), 0)
    );
    return count;
  }

  // Returns an array of booleans for each layer indicating presence of 'glow'
  async layersGlowStates() {
    const layers = await this.getLayers();
    const states = await layers.evaluateAll((els) => els.map(el => el.classList.contains('glow')));
    return states;
  }

  // Wait until all layers have the glow class (with a reasonable timeout)
  async waitForAllLayersGlowing(timeout = 5000) {
    const layerCount = await this.getLayers().count();
    await this.page.waitForFunction(
      (sel, expected) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length !== expected) return false;
        return els.every(e => e.classList.contains('glow'));
      },
      this.layerSelector,
      layerCount,
      { timeout }
    );
  }

  // Wait until NO layer has the glow class
  async waitForNoLayersGlowing(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.every(e => !e.classList.contains('glow'));
      },
      this.layerSelector,
      { timeout }
    );
  }
}

// Collector for console messages and page errors for each test
function setupDiagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    // collect console messages with their types and text
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    // collect unhandled exceptions from the page
    pageErrors.push(err);
  });

  return { consoleMessages, pageErrors };
}

test.describe('FSM - OSI Model: Highlight Toggle (3c99d761-fa78-11f0-857d-d58e82d5de73)', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Initial Idle state (S0_Idle) renders correctly and matches FSM evidence', async ({ page }) => {
    // Setup diagnostics to capture any console errors / page errors
    const diagnostics = setupDiagnostics(page);
    const osi = new OSIPage(page);

    // Navigate to the application (entry action: renderPage() is represented by loading the page)
    await osi.goto();

    // Verify main components exist: button and layers
    const button = await osi.getButton();
    await expect(button).toBeVisible({ timeout: 2000 });

    // FSM evidence: button initial markup & attributes
    await expect(button).toHaveAttribute('id', 'highlightBtn');
    await expect(button).toHaveAttribute('class', /toggleBtn/);
    await expect(button).toHaveAttribute('aria-label', 'Toggle layer highlight animation');

    // Initial text
    const initialText = await osi.getButtonText();
    expect(initialText && initialText.trim()).toBe('Highlight Layers');

    // aria-pressed should be "false" on idle
    const ariaPressed = await osi.getButtonAriaPressed();
    expect(ariaPressed).toBe('false');

    // There should be 7 layers rendered (one per OSI layer)
    const layers = await osi.getLayers();
    const layerCount = await layers.count();
    expect(layerCount).toBe(7);

    // None of the layers are glowing initially
    const glowingCount = await osi.countGlowingLayers();
    expect(glowingCount).toBe(0);

    // Assert no runtime page errors and no console.error calls occurred during initial render
    // We do this at the end so any late errors are collected
    expect(diagnostics.pageErrors.length).toBe(0);
    const consoleErrors = diagnostics.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Highlighted: click toggles highlight on and updates UI', async ({ page }) => {
    // This test validates the "HighlightToggle" event and the transition to the Highlighted state
    const diagnostics = setupDiagnostics(page);
    const osi = new OSIPage(page);

    await osi.goto();

    // Click the highlight button to turn on highlight (this should flip highlightOn and add glow classes sequentially)
    await osi.clickHighlight();

    // After clicking: aria-pressed should be "true"
    const ariaPressedAfter = await osi.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('true');

    // Button text should change to "Remove Highlight" per FSM evidence
    // Wait for the text content to be updated by the page script
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.textContent?.trim() === 'Remove Highlight',
      osi.buttonSelector
    );
    const newText = await osi.getButtonText();
    expect(newText && newText.trim()).toBe('Remove Highlight');

    // Layers are added the 'glow' class in sequence via setTimeout with 220ms increments.
    // Wait for all layers to receive the class. Use a timeout that comfortably covers delayed additions.
    await osi.waitForAllLayersGlowing(5000);

    // Once all are glowing, assert that every layer has the 'glow' class
    const glowStates = await osi.layersGlowStates();
    expect(glowStates.every(Boolean)).toBe(true);

    // Ensure no page errors or console.error messages occurred during this transition
    expect(diagnostics.pageErrors.length).toBe(0);
    const consoleErrors = diagnostics.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_Highlighted -> S0_Idle: clicking again removes glow and resets UI', async ({ page }) => {
    // This test validates toggling back to Idle state removes glow classes and resets button text
    const diagnostics = setupDiagnostics(page);
    const osi = new OSIPage(page);

    await osi.goto();

    // Turn highlight on first
    await osi.clickHighlight();
    await osi.waitForAllLayersGlowing(5000);

    // Now click again to remove highlight
    await osi.clickHighlight();

    // aria-pressed should now be "false"
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.getAttribute('aria-pressed') === 'false',
      osi.buttonSelector
    );
    const ariaPressedAfter = await osi.getButtonAriaPressed();
    expect(ariaPressedAfter).toBe('false');

    // Button text should revert to "Highlight Layers"
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.textContent?.trim() === 'Highlight Layers',
      osi.buttonSelector
    );
    const textAfter = await osi.getButtonText();
    expect(textAfter && textAfter.trim()).toBe('Highlight Layers');

    // All glow classes should be removed from layers
    await osi.waitForNoLayersGlowing(3000);
    const glowingCountAfter = await osi.countGlowingLayers();
    expect(glowingCountAfter).toBe(0);

    // No runtime errors
    expect(diagnostics.pageErrors.length).toBe(0);
    const consoleErrors = diagnostics.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid toggling does not leave layers in inconsistent state', async ({ page }) => {
    // Simulate user clicking rapidly multiple times to toggle the highlight and ensure final state is consistent
    const diagnostics = setupDiagnostics(page);
    const osi = new OSIPage(page);

    await osi.goto();

    // Rapidly click the toggle button multiple times with small delays shorter than the layer timeouts
    const clicks = 6;
    for (let i = 0; i < clicks; i++) {
      await osi.clickHighlight();
      // small pause to simulate rapid user toggling
      await page.waitForTimeout(100);
    }

    // After rapid toggling, ensure the button's aria-pressed and text align (deterministic outcome depends on odd/even clicks)
    const expectedOn = (clicks % 2) === 1; // odd -> highlighted
    const ariaPressed = await osi.getButtonAriaPressed();
    expect(ariaPressed).toBe(expectedOn ? 'true' : 'false');

    const expectedText = expectedOn ? 'Remove Highlight' : 'Highlight Layers';
    // Wait for the text to stabilize
    await page.waitForFunction(
      (selector, expected) => document.querySelector(selector)?.textContent?.trim() === expected,
      osi.buttonSelector,
      expectedText
    );
    const btnText = (await osi.getButtonText())?.trim();
    expect(btnText).toBe(expectedText);

    if (expectedOn) {
      // If highlight expected ON, wait for layers to eventually receive the glow class (they may have been added/removed)
      await osi.waitForAllLayersGlowing(5000);
      const glowCount = await osi.countGlowingLayers();
      expect(glowCount).toBe(7);
    } else {
      // If expected OFF, ensure no layer has glow
      await osi.waitForNoLayersGlowing(3000);
      const glowCount = await osi.countGlowingLayers();
      expect(glowCount).toBe(0);
    }

    // Confirm no uncaught page errors during rapid interaction
    expect(diagnostics.pageErrors.length).toBe(0);
    const consoleErrors = diagnostics.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Diagnostics: capture console and page errors during load and interactions', async ({ page }) => {
    // This test explicitly captures and asserts on console messages and page errors.
    // Per test instructions we observe console logs and page errors and record them.
    const diagnostics = setupDiagnostics(page);
    const osi = new OSIPage(page);

    // Instrument: navigate and perform a simple toggle
    await osi.goto();

    // Click to generate the highlight toggling behavior
    await osi.clickHighlight();

    // Allow some time for any potential runtime errors to surface
    await page.waitForTimeout(1500);

    // Collect diagnostics snapshot
    const consoleMessagesSnapshot = diagnostics.consoleMessages.slice();
    const pageErrorsSnapshot = diagnostics.pageErrors.slice();

    // Validate that the page did not produce unexpected runtime exceptions
    // If any page errors are present, fail the test with their messages for visibility
    if (pageErrorsSnapshot.length > 0) {
      // Provide detailed error messages to aid debugging
      const messages = pageErrorsSnapshot.map(e => e.message).join(' | ');
      throw new Error('Page emitted uncaught errors: ' + messages);
    }

    // Validate no console.error messages were emitted
    const consoleErrs = consoleMessagesSnapshot.filter(m => m.type === 'error');
    if (consoleErrs.length > 0) {
      const msgs = consoleErrs.map(m => m.text).join(' | ');
      throw new Error('Console error messages detected: ' + msgs);
    }

    // For transparency, assert that there was at least some console activity (info/debug) - optional expectation
    // It's acceptable if there are zero console logs; we only assert absence of errors above.
    expect(Array.isArray(consoleMessagesSnapshot)).toBe(true);
  });

  // Teardown is implicitly handled by Playwright fixtures; each test creates a fresh context/page.
});