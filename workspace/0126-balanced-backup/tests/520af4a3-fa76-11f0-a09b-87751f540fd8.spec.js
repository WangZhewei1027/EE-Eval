import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520af4a3-fa76-11f0-a09b-87751f540fd8.html';

// Page object for the Git Demo page
class GitDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      clone: '#git-clone-button',
      push: '#git-push-button',
      branch: '#git-branch-button',
      commit: '#git-commit-button',
      status: '#git-status-button'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickClone() {
    await this.page.click(this.selectors.clone);
  }
  async clickPush() {
    await this.page.click(this.selectors.push);
  }
  async clickBranch() {
    await this.page.click(this.selectors.branch);
  }
  async clickCommit() {
    await this.page.click(this.selectors.commit);
  }
  async clickStatus() {
    await this.page.click(this.selectors.status);
  }

  async getButtonText(selector) {
    return this.page.locator(selector).textContent();
  }

  // Reads the href property (not the attribute) from the element
  async getButtonHrefProperty(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      // Return the property value if present, otherwise null
      return el ? (el.href !== undefined ? el.href : null) : null;
    }, selector);
  }

  // Reads the href attribute (if any) from the element
  async getButtonHrefAttribute(selector) {
    return this.page.getAttribute(selector, 'href');
  }
}

test.describe('Git Demo (FSM) - 520af4a3-fa76-11f0-a09b-87751f540fd8', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // Clear listeners implicitly by test fixture tear down; arrays remain for assertions inside each test
  });

  test.describe('Idle state and initial render', () => {
    test('Initial render should show all Git buttons and not define renderPage', async ({ page }) => {
      // Arrange
      const git = new GitDemoPage(page);

      // Act
      await git.goto();

      // Assert - all buttons present with expected labels (FSM S0_Idle evidence)
      await expect(page.locator('#git-clone-button')).toBeVisible();
      await expect(page.locator('#git-push-button')).toBeVisible();
      await expect(page.locator('#git-branch-button')).toBeVisible();
      await expect(page.locator('#git-commit-button')).toBeVisible();
      await expect(page.locator('#git-status-button')).toBeVisible();

      // Verify text content matches FSM initial evidence
      expect(await git.getButtonText('#git-clone-button')).toBe('Clone Repository');
      expect(await git.getButtonText('#git-push-button')).toBe('Push to GitHub');
      expect(await git.getButtonText('#git-branch-button')).toBe('Create New Branch');
      expect(await git.getButtonText('#git-commit-button')).toBe('Commit Changes');
      expect(await git.getButtonText('#git-status-button')).toBe('Get Git Status');

      // Verify that a FSM-mentioned entry action function "renderPage" is NOT present on window.
      // FSM listed renderPage() in S0_Idle entry_actions, but implementation doesn't define it.
      const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      expect(renderPageExists).toBe(false);

      // Verify no console errors or uncaught page errors occurred during load
      expect(consoleErrors.length, `Console errors: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${pageErrors.join('\n')}`).toBe(0);
    });
  });

  test.describe('Event handlers and transitions', () => {
    test('CloneRepository click sets href property and preserves text (transition observable)', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      // Click the Clone button
      await git.clickClone();

      // The app's handler sets a cloneUrl on the element property .href and sets textContent.
      const hrefProp = await git.getButtonHrefProperty('#git-clone-button');
      const hrefAttr = await git.getButtonHrefAttribute('#git-clone-button');
      const text = await git.getButtonText('#git-clone-button');

      // Expected URL from FSM implementation
      const expectedUrl = 'https://github.com/your-username/your-repo-name.git';

      // Assert the property was set on the element (implementation sets element.href)
      expect(hrefProp).toBe(expectedUrl);

      // Because the implementation assigns the href property on a <button>, the attribute may not exist.
      // This verifies the nuance between property vs attribute assignment.
      expect(hrefAttr).toBeNull();

      // Assert textContent matches FSM expected text (text is same as original)
      expect(text).toBe('Clone Repository');

      // No console or page errors
      expect(consoleErrors.length, `Console errors after clone click: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after clone click: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('PushToGitHub click sets href property and preserves text', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      await git.clickPush();

      const hrefProp = await git.getButtonHrefProperty('#git-push-button');
      const hrefAttr = await git.getButtonHrefAttribute('#git-push-button');
      const text = await git.getButtonText('#git-push-button');

      const expectedUrl = 'https://github.com/your-username/your-repo-name.git';
      expect(hrefProp).toBe(expectedUrl);
      expect(hrefAttr).toBeNull();
      expect(text).toBe('Push to GitHub');

      expect(consoleErrors.length, `Console errors after push click: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after push click: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('CreateNewBranch click sets href property and preserves text', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      await git.clickBranch();

      const hrefProp = await git.getButtonHrefProperty('#git-branch-button');
      const hrefAttr = await git.getButtonHrefAttribute('#git-branch-button');
      const text = await git.getButtonText('#git-branch-button');

      const expectedUrl = 'https://github.com/your-username/your-repo-name.git';
      expect(hrefProp).toBe(expectedUrl);
      expect(hrefAttr).toBeNull();
      expect(text).toBe('Create New Branch');

      expect(consoleErrors.length, `Console errors after branch click: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after branch click: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('CommitChanges click sets href property and preserves text', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      await git.clickCommit();

      const hrefProp = await git.getButtonHrefProperty('#git-commit-button');
      const hrefAttr = await git.getButtonHrefAttribute('#git-commit-button');
      const text = await git.getButtonText('#git-commit-button');

      const expectedUrl = 'https://github.com/your-username/your-repo-name.git';
      expect(hrefProp).toBe(expectedUrl);
      expect(hrefAttr).toBeNull();
      expect(text).toBe('Commit Changes');

      expect(consoleErrors.length, `Console errors after commit click: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after commit click: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('GetGitStatus click sets href property and preserves text', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      await git.clickStatus();

      const hrefProp = await git.getButtonHrefProperty('#git-status-button');
      const hrefAttr = await git.getButtonHrefAttribute('#git-status-button');
      const text = await git.getButtonText('#git-status-button');

      const expectedUrl = 'https://github.com/your-username/your-repo-name.git';
      expect(hrefProp).toBe(expectedUrl);
      expect(hrefAttr).toBeNull();
      expect(text).toBe('Get Git Status');

      expect(consoleErrors.length, `Console errors after status click: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after status click: ${pageErrors.join('\n')}`).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Clicking a button repeatedly is idempotent and does not raise errors', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      // Click Clone three times
      await git.clickClone();
      await git.clickClone();
      await git.clickClone();

      const hrefProp = await git.getButtonHrefProperty('#git-clone-button');
      const text = await git.getButtonText('#git-clone-button');
      const expectedUrl = 'https://github.com/your-username/your-repo-name.git';

      // Expect property persists and text unchanged
      expect(hrefProp).toBe(expectedUrl);
      expect(text).toBe('Clone Repository');

      // Ensure no console or page errors after repeated clicks
      expect(consoleErrors.length, `Console errors after repeated clone clicks: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after repeated clone clicks: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('Attempting to call missing renderPage should not exist (verifies onEnter not invoked)', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      // Attempt to call renderPage only to verify it is not present; do not execute if undefined.
      const renderPageType = await page.evaluate(() => {
        return typeof window.renderPage;
      });

      // If renderPage was meant to be an entry action it would be 'function', but implementation does not define it.
      expect(renderPageType).toBe('undefined');

      // Confirm no console/page errors were produced by our check
      expect(consoleErrors.length, `Console errors after checking renderPage: ${consoleErrors.join('\n')}`).toBe(0);
      expect(pageErrors.length, `Page errors after checking renderPage: ${pageErrors.join('\n')}`).toBe(0);
    });

    test('Clicking a non-existent element selector should surface a Playwright error (edge-case testing)', async ({ page }) => {
      const git = new GitDemoPage(page);
      await git.goto();

      // This verifies that attempting to interact with an element that isn't present will throw from Playwright.
      // We assert that the thrown error is indeed produced by Playwright's API and not swallowed by the page.
      let threw = false;
      try {
        await page.click('#non-existent-button', { timeout: 500 });
      } catch (err) {
        threw = true;
        // Ensure the error message indicates that the element wasn't found / clickable
        expect(String(err.message)).toContain('waiting for selector');
      }

      expect(threw).toBe(true);
      // Ensure no page runtime errors were produced as a side-effect of our failed click
      expect(pageErrors.length, `Page errors after non-existent click attempt: ${pageErrors.join('\n')}`).toBe(0);
      // Playwright may log to console as part of the exception flow; we do not expect runtime console.error from the page itself
      expect(consoleErrors.length, `Console errors after non-existent click attempt: ${consoleErrors.join('\n')}`).toBe(0);
    });
  });
});