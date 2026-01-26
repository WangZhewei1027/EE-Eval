import { test, expect } from '@playwright/test';

// Test file for Application ID: 04447ef1-fa79-11f0-8a8e-bbe4f11717c6
// Serves the HTML at:
// http://127.0.0.1:5500/workspace/0126-biased/html/04447ef1-fa79-11f0-8a8e-bbe4f11717c6.html
//
// These tests validate the FSM described in the prompt:
// - State S0_Idle (entry actions createObject() and createClass())
// - Event LearnMoreClick (click on .button)
// The tests also assert console output, visual feedback, DOM presence, and that no unexpected page errors occur.

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/04447ef1-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object model for the Design Patterns page
class DesignPatternsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.containerSelector = '.container';
    this.headerSelector = '.header h1';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickLearnMore() {
    await this.page.click(this.buttonSelector);
  }

  async hoverLearnMore() {
    await this.page.hover(this.buttonSelector);
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async buttonComputedBackground() {
    return this.page.$eval(this.buttonSelector, (el) =>
      getComputedStyle(el).backgroundColor
    );
  }

  async title() {
    return this.page.title();
  }

  async isButtonVisible() {
    const el = await this.page.$(this.buttonSelector);
    return !!el && (await el.isVisible());
  }

  async getHref() {
    return this.page.$eval(this.buttonSelector, (el) => el.getAttribute('href'));
  }

  async url() {
    return this.page.url();
  }
}

test.describe('Design Patterns App - FSM: S0_Idle and LearnMoreClick', () => {
  // We'll collect console messages and page errors for assertions.
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate before each test to ensure a clean state.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (e.g., "Creating object...", "Creating class...")
    page.on('console', (msg) => {
      try {
        // push the text representation for easier asserts
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test
    const dp = new DesignPatternsPage(page);
    await dp.goto();
  });

  // Basic smoke tests for initial state and DOM
  test('Initial load should render the page and run entry actions (createObject & createClass)', async ({
    page,
  }) => {
    // Validate page object and helpers
    const dp = new DesignPatternsPage(page);

    // Assert page title is correct
    await expect(dp.title()).resolves.toBe('Design Patterns');

    // Assert container and button are visible
    await expect(dp.isButtonVisible()).resolves.toBeTruthy();

    // The button text should be "Learn More"
    await expect(dp.getButtonText()).resolves.toContain('Learn More');

    // The anchor href should be '#'
    await expect(dp.getHref()).resolves.toBe('#');

    // The entry actions createObject() and createClass() are called on load and write to console.
    // We expect to see both messages in the console captured during load.
    // They are called synchronously in the inline script on the page, so they should already be present.
    expect(
      consoleMessages.filter((m) => m.includes('Creating object...')).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      consoleMessages.filter((m) => m.includes('Creating class...')).length
    ).toBeGreaterThanOrEqual(1);

    // There should be no unexpected page errors on initial load.
    expect(pageErrors.length).toBe(0);
  });

  test('Button visual feedback: background color changes on hover', async ({ page }) => {
    const dp = new DesignPatternsPage(page);

    // Compute background color before hover
    const bgBefore = await dp.buttonComputedBackground();
    // Expected #4CAF50 -> rgb(76, 175, 80)
    expect(bgBefore.replace(/\s+/g, '')).toBe('rgb(76,175,80)');

    // Hover the button to trigger :hover styles
    await dp.hoverLearnMore();

    // Allow style change to apply
    const bgAfter = await dp.buttonComputedBackground();
    // Expected #3e8e41 -> rgb(62, 142, 65)
    expect(bgAfter.replace(/\s+/g, '')).toBe('rgb(62,142,65)');

    // No console errors produced by hover action
    expect(pageErrors.length).toBe(0);
  });

  test('LearnMoreClick event: clicking the Learn More link should not produce errors and should not re-run entry actions', async ({
    page,
  }) => {
    const dp = new DesignPatternsPage(page);

    // Snapshot the counts of the entry action logs captured on initial load
    const initialCreateObjectCount = consoleMessages.filter((m) =>
      m.includes('Creating object...')
    ).length;
    const initialCreateClassCount = consoleMessages.filter((m) =>
      m.includes('Creating class...')
    ).length;

    // Click the Learn More link once
    await dp.clickLearnMore();

    // Clicking the anchor with href="#" typically updates the URL hash to '#'
    const currentUrl = await dp.url();
    expect(currentUrl.endsWith('#')).toBeTruthy();

    // After click, ensure no page errors were produced
    expect(pageErrors.length).toBe(0);

    // Ensure that the entry action logs were NOT emitted again by the click handler
    // The page's script does not re-run createObject/createClass on click, so counts should remain unchanged.
    const afterClickCreateObjectCount = consoleMessages.filter((m) =>
      m.includes('Creating object...')
    ).length;
    const afterClickCreateClassCount = consoleMessages.filter((m) =>
      m.includes('Creating class...')
    ).length;

    expect(afterClickCreateObjectCount).toBe(initialCreateObjectCount);
    expect(afterClickCreateClassCount).toBe(initialCreateClassCount);
  });

  test('Event robustness: multiple rapid Learn More clicks produce no additional entry logs and no page errors', async ({
    page,
  }) => {
    const dp = new DesignPatternsPage(page);

    // Count initial occurrences of the entry logs
    const initialCreateObjectCount = consoleMessages.filter((m) =>
      m.includes('Creating object...')
    ).length;
    const initialCreateClassCount = consoleMessages.filter((m) =>
      m.includes('Creating class...')
    ).length;

    // Perform a rapid sequence of clicks (simulate aggressive user interaction)
    for (let i = 0; i < 5; i++) {
      await dp.clickLearnMore();
    }

    // After rapid clicks, ensure the URL hash is still present (clicks navigate to '#')
    const currentUrl = await dp.url();
    expect(currentUrl.includes('#')).toBeTruthy();

    // Confirm no new entry action logs were produced by clicking repeatedly
    const finalCreateObjectCount = consoleMessages.filter((m) =>
      m.includes('Creating object...')
    ).length;
    const finalCreateClassCount = consoleMessages.filter((m) =>
      m.includes('Creating class...')
    ).length;

    expect(finalCreateObjectCount).toBe(initialCreateObjectCount);
    expect(finalCreateClassCount).toBe(initialCreateClassCount);

    // Confirm no page errors occurred during aggressive clicking
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: confirm DOM stability and accessible content after interactions', async ({
    page,
  }) => {
    const dp = new DesignPatternsPage(page);

    // Ensure main heading is present and unchanged
    const headerText = await page.textContent(dp.headerSelector);
    expect(headerText).toBe('Design Patterns');

    // Ensure the content paragraph about Creational Patterns exists and contains expected word
    const contentHasCreatational = await page.$eval('body', (body) =>
      body.innerText.includes('Creatational patterns')
    );
    expect(contentHasCreatational).toBeTruthy();

    // Click the button and ensure the footer still exists and displays year
    await dp.clickLearnMore();
    const footerText = await page.textContent('.footer p');
    expect(footerText).toContain('2023');

    // No page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  // This test explicitly watches that console messages contain the expected sequence.
  test('Console output ordering: createObject then createClass appear on initial load', async ({ page }) => {
    // We expect "Creating object..." to appear before "Creating class..." because of script order.
    const objIndex = consoleMessages.findIndex((m) => m.includes('Creating object...'));
    const classIndex = consoleMessages.findIndex((m) => m.includes('Creating class...'));

    // Both should be present
    expect(objIndex).toBeGreaterThanOrEqual(0);
    expect(classIndex).toBeGreaterThanOrEqual(0);

    // And createObject should be logged before createClass
    expect(objIndex).toBeLessThan(classIndex);

    // No page errors observed
    expect(pageErrors.length).toBe(0);
  });
});