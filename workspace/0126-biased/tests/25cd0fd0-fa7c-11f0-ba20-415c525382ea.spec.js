import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd0fd0-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the Git demo page
class GitDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showHistoryBtn = page.locator('#showHistoryBtn');
    this.historyOutput = page.locator('#historyOutput');
  }

  async clickShowHistory() {
    await this.showHistoryBtn.click();
  }

  async isHistoryVisible() {
    // Use computed style to determine display state
    return await this.page.$eval('#historyOutput', (el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getHistoryText() {
    return this.historyOutput.textContent();
  }

  async getHistoryDisplayStyle() {
    return this.page.$eval('#historyOutput', (el) => window.getComputedStyle(el).display);
  }

  async getAriaLive() {
    return this.historyOutput.getAttribute('aria-live');
  }

  async isShowHistoryButtonVisible() {
    return this.showHistoryBtn.isVisible();
  }
}

test.describe('Comprehensive Guide to Git - Commit History Demo (FSM tests)', () => {
  // Arrays to collect console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  // Reusable page object
  let gitPage;

  // Attach listeners BEFORE navigation so we capture errors on load
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Initialize page object
    gitPage = new GitDemoPage(page);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging: if errors happened, include them in the test output via expectation messages
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Print them to the test trace for diagnostics
      // Note: We do not modify the runtime; simply report
      console.log('Captured console errors:', consoleErrors);
      console.log('Captured page errors:', pageErrors);
    }
    // close page after each test to isolate tests (Playwright manages pages, but explicit close is fine)
    await page.close();
  });

  test('Initial state (S0_Idle): button is present and history output is hidden and empty', async () => {
    // Validate the show history button exists and is visible
    expect(await gitPage.isShowHistoryButtonVisible()).toBe(true);

    // Confirm the history output is present in DOM
    const historyHandle = await gitPage.page.$('#historyOutput');
    expect(historyHandle).not.toBeNull();

    // Confirm initial display style is 'none' (hidden)
    const displayStyle = await gitPage.getHistoryDisplayStyle();
    expect(displayStyle).toBe('none');

    // Confirm initial text content is empty string
    const text = await gitPage.getHistoryText();
    // The element may contain whitespace, ensure trimmed emptiness
    expect(text ? text.trim() : '').toBe('');

    // Confirm aria-live attribute is set to 'polite' per implementation
    const ariaLive = await gitPage.getAriaLive();
    expect(ariaLive).toBe('polite');

    // Assert no runtime errors were thrown during page load (edge-case check)
    // If errors exist, the afterEach will log them; here we assert there were none
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_HistoryVisible on clicking #showHistoryBtn: history becomes visible and text is rendered', async () => {
    // Click to show the history (trigger ShowHistory)
    await gitPage.clickShowHistory();

    // Wait until the output's computed display is 'block' (visible)
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display !== 'none';
    });

    // Validate display style is 'block' (or not 'none')
    const displayAfter = await gitPage.getHistoryDisplayStyle();
    expect(displayAfter === 'block' || displayAfter === 'inline' || displayAfter === 'inline-block').toBeTruthy();

    // Validate that textContent has the demo history contents (check for known substrings)
    const content = (await gitPage.getHistoryText()) || '';
    expect(content).toContain('Merge commit c6');
    expect(content).toContain('Commit c1 (root)');
    expect(content.trim().length).toBeGreaterThan(0);

    // Validate that the entry actions effectively set content and made the output visible
    // (This corresponds to "output.textContent = demoHistory" and "output.style.display = 'block'")
    // We already checked content and display; also ensure the aria-live attribute remains 'polite'
    expect(await gitPage.getAriaLive()).toBe('polite');

    // Confirm no console/page errors occurred during the interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_HistoryVisible -> S0_Idle on clicking #showHistoryBtn again: history hides and text is cleared', async () => {
    // Show the history first
    await gitPage.clickShowHistory();

    // Ensure visible
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display !== 'none';
    });

    // Now click again to hide (toggle behavior)
    await gitPage.clickShowHistory();

    // Wait until hidden
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display === 'none';
    });

    // Validate display style returns to 'none'
    const displayAfterHide = await gitPage.getHistoryDisplayStyle();
    expect(displayAfterHide).toBe('none');

    // Validate text content is cleared (empty or whitespace-only)
    const contentAfterHide = (await gitPage.getHistoryText()) || '';
    expect(contentAfterHide.trim()).toBe('');

    // Confirm no console/page errors occurred during the toggle
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid toggling (edge case): double click quickly should toggle twice and leave the output hidden and empty', async () => {
    // Simulate rapid clicks: two sequential clicks with minimal delay
    await gitPage.showHistoryBtn.click();
    await gitPage.showHistoryBtn.click();

    // The logic toggles on each click; after two clicks we expect it to be back to hidden
    // Allow a small time for DOM updates
    await gitPage.page.waitForTimeout(50);

    const displayStyle = await gitPage.getHistoryDisplayStyle();
    expect(displayStyle).toBe('none');

    const content = (await gitPage.getHistoryText()) || '';
    expect(content.trim()).toBe('');

    // Also validate that clicking twice did not cause exceptions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Accessibility & DOM checks: button is focusable and clicking via keyboard activates the demo', async () => {
    // Focus the button and press Enter to activate
    await gitPage.showHistoryBtn.focus();
    await gitPage.page.keyboard.press('Enter');

    // Wait for the content to show
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display !== 'none';
    });

    // Confirm content present
    const content = (await gitPage.getHistoryText()) || '';
    expect(content.trim().length).toBeGreaterThan(0);
    expect(content).toContain('Commit c1 (root)');

    // Now press Space to toggle hide (spacebar should activate the button as well)
    await gitPage.showHistoryBtn.focus();
    await gitPage.page.keyboard.press('Space');

    // Wait for hide
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display === 'none';
    });

    // Final assertions
    const finalDisplay = await gitPage.getHistoryDisplayStyle();
    expect(finalDisplay).toBe('none');

    const finalContent = (await gitPage.getHistoryText()) || '';
    expect(finalContent.trim()).toBe('');

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Event handler existence & behavior: clicking the button triggers the documented listener (evidence smoke)', async () => {
    // We cannot introspect attached listeners directly without modifying the page,
    // but the observable behavior is that clicking toggles the #historyOutput content/display.
    // This test validates that the documented event handler behavior is present.

    // Ensure initial hidden
    expect(await gitPage.getHistoryDisplayStyle()).toBe('none');

    // Click to show
    await gitPage.clickShowHistory();
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display !== 'none';
    });

    // Check for a key line from the demo history
    expect((await gitPage.getHistoryText()) || '').toContain('Merge commit c6');

    // Click to hide
    await gitPage.clickShowHistory();
    await gitPage.page.waitForFunction(() => {
      const el = document.getElementById('historyOutput');
      return el && window.getComputedStyle(el).display === 'none';
    });

    // Ensure cleared
    expect(((await gitPage.getHistoryText()) || '').trim()).toBe('');

    // Confirm no errors emitted while exercising the event handler
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation test: if any console or page errors occur, they must be of expected JS error types or reported explicitly', async () => {
    // This test's purpose is to assert that either no errors occurred or, if they did,
    // they are standard JS runtime error types. We do not modify the page or inject code.
    // Collect any captured errors from the beforeEach listeners.

    if (pageErrors.length === 0 && consoleErrors.length === 0) {
      // No runtime errors observed - this is acceptable
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    } else {
      // If there are page errors, assert they are JS runtime error types
      for (const e of pageErrors) {
        expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error']).toContain(e.name);
        expect(typeof e.message).toBe('string');
      }

      // If there are console errors, ensure we at least have text messages (don't assume structure)
      for (const ce of consoleErrors) {
        expect(typeof ce.text).toBe('string');
        expect(ce.text.length).toBeGreaterThan(0);
      }
    }
  });
});