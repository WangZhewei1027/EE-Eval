import { test, expect } from '@playwright/test';

// Test file for Application ID: 72acc470-fa78-11f0-812d-c9788050701f
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/72acc470-fa78-11f0-812d-c9788050701f.html
// This suite validates FSM states/transitions and observes console/page errors naturally (no patching).

// Page Object Model for the Version Control visualization page
class VersionControlPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72acc470-fa78-11f0-812d-c9788050701f.html';
  }

  async goto() {
    await this.page.goto(this.url);
    // Wait for the main container to ensure DOMContentLoaded handlers run
    await this.page.waitForSelector('.container', { timeout: 5000 });
  }

  async getHeaderText() {
    return this.page.textContent('header h1');
  }

  async getFooterText() {
    return this.page.textContent('footer');
  }

  async animateButton() {
    return this.page.locator('#animateBtn');
  }

  async clickAnimate() {
    await this.page.click('#animateBtn');
  }

  async getCommitCount() {
    return this.page.$$eval('.commit', els => els.length);
  }

  async getGitNodeCount() {
    return this.page.$$eval('.git-node', els => els.length);
  }

  async getGitConnectionCount() {
    return this.page.$$eval('.git-connection', els => els.length);
  }

  // Wait until at least one git-node has opacity '1' (visible), within timeout
  async waitForAnyNodeVisible(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.git-node'));
      return nodes.some(n => window.getComputedStyle(n).opacity === '1');
    }, null, { timeout });
  }

  // Wait until all git-nodes have opacity '1'
  async waitForAllNodesVisible(timeout = 8000) {
    await this.page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.git-node'));
      if (nodes.length === 0) return false;
      return nodes.every(n => window.getComputedStyle(n).opacity === '1');
    }, null, { timeout });
  }

  // Wait until at least one git-connection has opacity '1'
  async waitForAnyConnectionVisible(timeout = 6000) {
    await this.page.waitForFunction(() => {
      const conns = Array.from(document.querySelectorAll('.git-connection'));
      return conns.some(c => window.getComputedStyle(c).opacity === '1');
    }, null, { timeout });
  }

  async isAnimateButtonDisabled() {
    return this.page.$eval('#animateBtn', el => el.disabled);
  }

  async waitForAnimateButtonEnabled(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('animateBtn');
      return btn && btn.disabled === false;
    }, null, { timeout });
  }

  async waitForAnimateButtonDisabled(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('animateBtn');
      return btn && btn.disabled === true;
    }, null, { timeout });
  }
}

test.describe('Version Control | Visual Elegance - FSM and Interactive Tests', () => {
  // Arrays to capture console messages and page errors per test
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture console events including errors and logs
    page.on('console', msg => {
      const type = msg.type(); // 'log', 'error', etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright fixtures.
    // We keep this hook to demonstrate teardown place if needed.
  });

  test.describe('State S0_Idle (Initial)', () => {
    test('Initial Idle State renders page elements and commits (S0_Idle entry: renderPage())', async ({ page }) => {
      // Validate S0_Idle: the initial page is rendered with header/footer and commit DOM nodes.
      const vc = new VersionControlPage(page);
      await vc.goto();

      // Header and footer should be present - evidence for S0_Idle
      const headerText = await vc.getHeaderText();
      const footerText = await vc.getFooterText();
      expect(headerText).toBeTruthy();
      expect(headerText.toLowerCase()).toContain('version control');
      expect(footerText).toBeTruthy();
      expect(footerText.toLowerCase()).toContain('visualizing version control');

      // There should be commit elements present as per HTML evidence
      const commitCount = await vc.getCommitCount();
      expect(commitCount).toBeGreaterThanOrEqual(6); // HTML shows at least 6 commits

      // Git graph nodes should have been created by DOMContentLoaded script
      const nodeCount = await vc.getGitNodeCount();
      // Implementation creates 10 nodes; assert at least 10 exist
      expect(nodeCount).toBeGreaterThanOrEqual(10);

      // Connections should be created as per the JS connections array (9 expected)
      const connCount = await vc.getGitConnectionCount();
      expect(connCount).toBeGreaterThanOrEqual(8); // be tolerant but expect connections were created

      // Ensure there were no JS runtime errors emitted during initial render
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: AnimateGraphClick -> S1_Animating', () => {
    test('Clicking Animate Graph triggers animateGraph (S1_Animating entry: animateGraph()) and nodes/connections become visible', async ({ page }) => {
      // This test verifies the transition from Idle to Animating via button click
      const vc = new VersionControlPage(page);
      await vc.goto();

      // Ensure animate button exists and is enabled initially (unless auto animation has just run)
      const animateBtn = await vc.animateButton();
      await expect(animateBtn).toBeVisible();

      // Click the animate button and assert it becomes disabled immediately
      await vc.clickAnimate();
      await vc.waitForAnimateButtonDisabled(2000); // button should be disabled right after click
      let disabledState = await vc.isAnimateButtonDisabled();
      expect(disabledState).toBe(true);

      // After clicking, at least one node should become visible (opacity '1')
      await vc.waitForAnyNodeVisible(5000);
      // Also connections should start becoming visible
      await vc.waitForAnyConnectionVisible(5000);

      // Wait for button to re-enable after the 3s timeout defined in the script
      await vc.waitForAnimateButtonEnabled(5000);
      disabledState = await vc.isAnimateButtonDisabled();
      expect(disabledState).toBe(false);

      // By now, many nodes and connections should be visible. Assert that all nodes eventually become visible.
      await vc.waitForAllNodesVisible(8000);
      const allNodesVisible = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('.git-node'));
        return nodes.every(n => window.getComputedStyle(n).opacity === '1');
      });
      expect(allNodesVisible).toBe(true);

      // Ensure no uncaught exceptions were observed during the animation triggered by click
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid multiple clicks: button disables to prevent re-entrancy and no exceptions occur', async ({ page }) => {
      // Edge case: user rapidly clicks the animate button repeatedly
      const vc = new VersionControlPage(page);
      await vc.goto();

      // Rapidly click the button multiple times programmatically
      // Use page.evaluate to click synchronously multiple times to emulate fast user clicks
      await page.evaluate(() => {
        const btn = document.getElementById('animateBtn');
        if (!btn) return;
        // Rapidly invoke clicks
        for (let i = 0; i < 5; i++) {
          try {
            btn.click();
          } catch (e) {
            // let errors naturally surface; do not swallow them here
          }
        }
      });

      // The button should have been disabled after the first click
      await vc.waitForAnimateButtonDisabled(2000);
      let disabled = await vc.isAnimateButtonDisabled();
      expect(disabled).toBe(true);

      // Wait for the button to be enabled again (debounced / re-enabled after 3s)
      await vc.waitForAnimateButtonEnabled(6000);
      disabled = await vc.isAnimateButtonDisabled();
      expect(disabled).toBe(false);

      // Animation should have progressed: at least one node visible
      await vc.waitForAnyNodeVisible(5000);

      // No console errors or page errors should have been thrown due to rapid clicking
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Automated Behavior and Edge Cases', () => {
    test('Initial automatic animation occurs (setTimeout animateGraph on load) without clicking', async ({ page }) => {
      // The script triggers an initial animateGraph via setTimeout ~1500ms after load.
      // This test confirms nodes become visible automatically without user interaction.
      const vc = new VersionControlPage(page);
      await vc.goto();

      // Wait up to 4 seconds for the automatic animation to reveal nodes
      await vc.waitForAnyNodeVisible(4500);

      // At least one connection should appear after automatic animation as well
      await vc.waitForAnyConnectionVisible(4500);

      // No runtime errors should accompany the automatic animation
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Observes console and page errors over lifecycle - expects none (natural errors would be asserted if present)', async ({ page }) => {
      // This test loads the page and intentionally does not interact to observe any errors that naturally occur.
      const vc = new VersionControlPage(page);
      await vc.goto();

      // Allow some time for on-load timers and animations to run which might surface errors
      await page.waitForTimeout(2500);

      // Collect console error messages and page errors captured during the lifecycle
      // If any ReferenceError/SyntaxError/TypeError occurred naturally, they would appear in pageErrors or consoleErrors
      // We assert that there were no such errors for this implementation.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // For extra observability, assert that console messages were emitted (logs) but not error-type messages
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // there may or may not be logs
      const errorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorMessages.length).toBe(0);
    });
  });
});