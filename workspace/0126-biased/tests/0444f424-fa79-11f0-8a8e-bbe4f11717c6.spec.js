import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444f424-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the K-Means demo page.
 * Encapsulates navigation, interactions and error/console capture.
 */
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleErrors = [];
    this._listenersAttached = false;
  }

  // Attach listeners to capture runtime errors and console.error messages.
  _attachListeners() {
    if (this._listenersAttached) return;
    this._listenersAttached = true;

    this.page.on('pageerror', (err) => {
      // pageerror gives Error objects for unhandled exceptions
      try {
        this.pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        this.pageErrors.push(String(err));
      }
    });

    this.page.on('console', (msg) => {
      // capture console errors (console.error)
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });
  }

  // Navigate to the page and allow scripts to run.
  async goto() {
    this._attachListeners();
    // Do a navigation and wait for load event. Scripts referenced in the HTML will run.
    const resp = await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow some time for any synchronous or asynchronous errors to surface.
    await this.page.waitForTimeout(250);
    return resp;
  }

  async clickCluster() {
    await this.page.click('#cluster-button');
    // let any event handlers run and any errors surface
    await this.page.waitForTimeout(200);
  }

  async clickVisualize() {
    await this.page.click('#visualize-button');
    await this.page.waitForTimeout(200);
  }

  // Utility accessors used in assertions
  clusterButton() {
    return this.page.locator('#cluster-button');
  }

  visualizeButton() {
    return this.page.locator('#visualize-button');
  }

  canvas() {
    return this.page.locator('#k-means-graph');
  }

  totalErrorsCount() {
    return this.pageErrors.length + this.consoleErrors.length;
  }

  anyErrorMessages() {
    return [...this.pageErrors, ...this.consoleErrors];
  }
}

// Grouping all FSM-related tests
test.describe('K-Means Clustering FSM - Interactive Application (0444f424-...-17c6)', () => {
  // Each test gets a fresh page so listeners and counts start cleanly.
  test('Idle state: page renders UI and entry action (renderPage) attempts run (errors observed)', async ({ page }) => {
    // This test validates:
    // - The Idle state renders required DOM elements (buttons + canvas)
    // - The entry action for Idle (renderPage()) may be invoked by the app; if the implementation is missing or broken,
    //   a runtime error should be observable. We capture and assert that at least one runtime/console error occurred.
    const app = new KMeansPage(page);
    await app.goto();

    // Verify UI elements exist and are visible
    await expect(app.clusterButton()).toBeVisible({ timeout: 2000 });
    await expect(app.visualizeButton()).toBeVisible({ timeout: 2000 });
    await expect(app.canvas()).toBeVisible({ timeout: 2000 });

    // We expect the application to have attempted its entry action which may produce runtime errors.
    // The test asserts that at least one error (pageerror or console.error) occurred during load.
    const totalErrors = app.totalErrorsCount();
    // Assert that some error happened (ReferenceError / TypeError / SyntaxError allowed by the test instructions).
    expect(totalErrors, `Expected at least one runtime or console error to have occurred during page load, but none were captured. Captured errors: ${JSON.stringify(app.anyErrorMessages())}`).toBeGreaterThan(0);

    // As additional evidence, include the captured messages in the assertion failure message above.
  });

  test('Transition: Idle -> Clustering via Cluster button (performClustering invoked / errors observed)', async ({ page }) => {
    // This test validates:
    // - Clicking the "Cluster" button triggers the clustering transition.
    // - If performClustering() is missing or fails, a runtime error should be observed.
    // - UI remains stable (buttons still present) after clicking, even if errors occur.
    const app = new KMeansPage(page);
    await app.goto();

    // Pre-click sanity checks
    await expect(app.clusterButton()).toBeVisible();
    await expect(app.visualizeButton()).toBeVisible();

    // Record error counts before the click so we can detect new errors caused by the transition.
    const beforeCount = app.totalErrorsCount();

    // Perform the transition event
    await app.clickCluster();

    // After clicking, ensure that UI elements remain accessible (the application should not have crashed the DOM).
    await expect(app.clusterButton()).toBeVisible();
    await expect(app.visualizeButton()).toBeVisible();

    // There should be at least one new error or previously observed error referencing clustering logic.
    const afterCount = app.totalErrorsCount();
    expect(afterCount, `Expected some runtime/console errors after clicking Cluster, but none were captured.`).toBeGreaterThan(0);

    // Preferably, the transition triggers an error mentioning "performClustering" if that function is missing.
    // Check captured messages for hints about performClustering (if available).
    const msgs = app.anyErrorMessages().join(' | ');
    // We do not fail if the specific substring is missing, because implementations may vary,
    // but we assert that errors exist (done above). For diagnostics, we include a soft expectation:
    if (!/performClustering/i.test(msgs)) {
      // Add an informational check: log detail via a normal assertion that does not fail the test.
      test.info().annotations.push({ type: 'info', description: 'No explicit performClustering mention in captured errors.' });
    }
  });

  test('Transition: Idle -> Visualizing via Visualize button (performVisualization invoked / errors observed)', async ({ page }) => {
    // This test validates:
    // - Clicking the "Visualize" button triggers the visualization transition.
    // - If performVisualization() is missing or fails, a runtime error should be observed.
    // - The canvas element exists and remains present after clicking.
    const app = new KMeansPage(page);
    await app.goto();

    // Ensure controls are available
    await expect(app.visualizeButton()).toBeVisible();
    await expect(app.clusterButton()).toBeVisible();

    const before = app.totalErrorsCount();

    // Trigger the Visualize event
    await app.clickVisualize();

    // Check canvas is present and still in DOM (app should not remove it unexpectedly).
    await expect(app.canvas()).toBeVisible();

    const after = app.totalErrorsCount();
    expect(after, `Expected runtime/console errors after clicking Visualize but none were captured.`).toBeGreaterThan(0);

    // Soft diagnostic: check whether performVisualization is mentioned in errors
    const msgs = app.anyErrorMessages().join(' | ');
    if (!/performVisualization/i.test(msgs)) {
      test.info().annotations.push({ type: 'info', description: 'No explicit performVisualization mention in captured errors.' });
    }
  });

  test('Edge cases: rapid repeated clicks and resilience (no fatal crashes, errors captured)', async ({ page }) => {
    // This test validates:
    // - Rapid user interactions (multiple cluster/visualize clicks) do not completely break the page.
    // - We capture any errors that happen as a result of rapid events.
    const app = new KMeansPage(page);
    await app.goto();

    // Rapidly click buttons in quick succession to simulate aggressive user behavior.
    // Use a small loop to click cluster then visualize several times.
    for (let i = 0; i < 3; i++) {
      await Promise.all([
        app.page.click('#cluster-button'),
        app.page.click('#visualize-button'),
      ]).catch(() => {
        // Individual clicks may throw if page is in a bad state; let errors be captured by listeners.
      });
      // allow some time for handlers to run and errors to surface
      await app.page.waitForTimeout(150);
    }

    // After rapid interactions, the UI should still contain the core elements.
    await expect(app.clusterButton()).toBeVisible();
    await expect(app.visualizeButton()).toBeVisible();
    await expect(app.canvas()).toBeVisible();

    // Ensure we captured some errors (as allowed by instructions); at minimum one error is expected during stress interactions.
    expect(app.totalErrorsCount(), `Expected at least one runtime/console error during rapid interactions. Captured: ${JSON.stringify(app.anyErrorMessages())}`).toBeGreaterThan(0);
  });

  test('Sanity check: Confirm existence of expected FSM components in DOM (buttons and visual canvas)', async ({ page }) => {
    // This simple test ensures the required components described in the FSM are present in the DOM.
    const app = new KMeansPage(page);
    await app.goto();

    await expect(app.clusterButton()).toHaveText('Cluster');
    await expect(app.visualizeButton()).toHaveText('Visualize');

    // The canvas exists; even if drawing did not happen, the element should be present.
    const canvas = app.canvas();
    await expect(canvas).toBeVisible();

    // Ensure at least the DOM components are available irrespective of runtime script errors.
    // We still expect the environment to produce some error(s) as per test rules.
    expect(app.totalErrorsCount(), 'Expected runtime or console errors to be captured during load or interaction.').toBeGreaterThan(0);
  });
});