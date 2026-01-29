import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b69d3-fa76-11f0-a09b-87751f540fd8.html';

class LinearRegressionPage {
  /**
   * Simple Page Object for the Linear Regression demo
   * Provides selectors and common interactions used across tests.
   */
  constructor(page) {
    this.page = page;
    this.loadBtn = '#load-data-btn';
    this.plotBtn = '#plot-btn';
    this.graph = '#graph';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickLoad() {
    await this.page.click(this.loadBtn);
  }

  async clickPlot() {
    await this.page.click(this.plotBtn);
  }

  async graphInnerHTML() {
    return await this.page.$eval(this.graph, (el) => el.innerHTML);
  }

  async hasRectElements() {
    // Count any child elements named "rect" (the app creates <rect> elements)
    return await this.page.evaluate(() => {
      const graph = document.getElementById('graph');
      if (!graph) return 0;
      return Array.from(graph.children).filter((c) => c.tagName.toLowerCase() === 'rect').length;
    });
  }

  async evalGlobal(name) {
    return await this.page.evaluate((n) => {
      // Return typeof and value snapshot for simple inspection
      try {
        const val = window[n];
        return { type: typeof val, value: val };
      } catch (e) {
        return { type: 'error', value: String(e) };
      }
    }, name);
  }
}

test.describe('Linear Regression FSM - Application Integration Tests', () => {
  // Ensure fresh page for each test and capture console/page errors when needed in test bodies.
  test.describe('Idle State (S0_Idle) - initial page load validations', () => {
    test('Initial DOM layout and global variables are present', async ({ page }) => {
      // Validate initial idle state: buttons and graph exist, global arrays exist but empty, loadData function exists
      const app = new LinearRegressionPage(page);
      await app.goto();

      // Basic DOM checks
      await expect(page.locator(app.loadBtn)).toBeVisible();
      await expect(page.locator(app.loadBtn)).toHaveText('Load Data');
      await expect(page.locator(app.plotBtn)).toBeVisible();
      await expect(page.locator(app.plotBtn)).toHaveText('Plot Regression Line');
      await expect(page.locator(app.graph)).toBeVisible();

      // Check global variables declared by the script: xData, yData, data
      const xDataInfo = await app.evalGlobal('xData');
      const yDataInfo = await app.evalGlobal('yData');
      const dataInfo = await app.evalGlobal('data');
      const loadDataInfo = await app.evalGlobal('loadData');

      // xData and yData should be arrays initially (declared as empty arrays in the HTML)
      expect(xDataInfo.type).toBe('object');
      expect(Array.isArray(xDataInfo.value)).toBe(true);
      expect(yDataInfo.type).toBe('object');
      expect(Array.isArray(yDataInfo.value)).toBe(true);

      // data should be present and contain the sample points
      expect(dataInfo.type).toBe('object');
      expect(Array.isArray(dataInfo.value)).toBe(true);
      expect(dataInfo.value.length).toBeGreaterThanOrEqual(1);

      // loadData should be defined as a function (the script calls it on load)
      expect(loadDataInfo.type).toBe('function');

      // FSM entry action 'renderPage()' was listed in the FSM but the page does not define it.
      // Verify that renderPage is not defined to assert we cannot rely on that FSM action here.
      const renderPageInfo = await app.evalGlobal('renderPage');
      expect(renderPageInfo.type).toBe('undefined');

      // Graph should be empty initially
      const initialGraphHTML = await app.graphInnerHTML();
      expect(initialGraphHTML).toBe('');
      const initialRectCount = await app.hasRectElements();
      expect(initialRectCount).toBe(0);
    });
  });

  test.describe('LoadData Event and S1_DataLoaded state behaviors', () => {
    test('Clicking "Load Data" triggers the page script and results in a runtime TypeError (as implemented)', async ({ page }) => {
      // This test validates the LoadData transition and observes the runtime error produced by the implementation.
      const app1 = new LinearRegressionPage(page);
      await app.goto();

      // Listen for pageerror (uncaught exceptions) emitted by the page.
      // The implementation contains a bug: it attempts to call .reduce on a number inside a map,
      // which should cause a TypeError. We assert that such an error occurs naturally.
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click(app.loadBtn), // trigger LoadData click handler added by loadData()
      ]);

      // Ensure an error object was received and it is a TypeError (expected from calling .reduce on a number)
      expect(pageError).toBeTruthy();
      // pageError.name is likely 'TypeError'; be explicit about that to validate the expected error category.
      expect(pageError.name).toBe('TypeError');

      // After the error, verify that xData and yData remain unchanged (empty arrays) because handler aborted early.
      const xDataInfo1 = await app.evalGlobal('xData');
      const yDataInfo1 = await app.evalGlobal('yData');
      expect(Array.isArray(xDataInfo.value)).toBe(true);
      expect(xDataInfo.value.length).toBe(0);
      expect(Array.isArray(yDataInfo.value)).toBe(true);
      expect(yDataInfo.value.length).toBe(0);

      // The graph should remain empty because the handler failed before it could clear/append elements.
      const graphHTML = await app.graphInnerHTML();
      expect(graphHTML).toBe('');
      const rectCount = await app.hasRectElements();
      expect(rectCount).toBe(0);
    });

    test('Clicking "Load Data" multiple times generates multiple runtime errors (edge-case of repeated listener firing)', async ({ page }) => {
      // This test validates an edge case: repeated user clicks will retrigger the faulty listener
      const app2 = new LinearRegressionPage(page);
      await app.goto();

      // First click -> expect an error
      const firstErrorPromise = page.waitForEvent('pageerror');
      await page.click(app.loadBtn);
      const firstErr = await firstErrorPromise;
      expect(firstErr).toBeTruthy();
      expect(firstErr.name).toBe('TypeError');

      // Second click -> expect another error (listener still present; same handler executed again)
      const secondErrorPromise = page.waitForEvent('pageerror');
      await page.click(app.loadBtn);
      const secondErr = await secondErrorPromise;
      expect(secondErr).toBeTruthy();
      expect(secondErr.name).toBe('TypeError');

      // Confirm still no rects appended to the graph due to handler failing each time
      const rectCount1 = await app.hasRectElements();
      expect(rectCount).toBe(0);
    });
  });

  test.describe('PlotRegressionLine Event and S2_RegressionPlotted state behaviors', () => {
    test('Clicking "Plot Regression Line" does not plot when LoadData failed; graph remains empty and no new errors expected from plot click alone', async ({ page }) => {
      // Validate the plot transition. The implementation does not attach a click handler to plotBtn,
      // so clicking it should not produce errors nor modify the graph in this implementation.
      const app3 = new LinearRegressionPage(page);
      await app.goto();

      // Ensure graph is empty to start
      expect(await app.graphInnerHTML()).toBe('');
      expect(await app.hasRectElements()).toBe(0);

      // Click the plot button. There is no explicit event handler for this in the provided code.
      // We watch for pageerror during the click, but we do not expect an error as a result of clicking plot.
      // Use a short timeout waitForEvent to ensure no unexpected exception occurs.
      let pageError = null;
      const errorPromise = page.waitForEvent('pageerror', { timeout: 500 }).then(e => e).catch(() => null);

      await app.clickPlot();
      pageError = await errorPromise;

      // Since plot button has no handler in the provided JS, there should be no pageerror
      expect(pageError).toBeNull();

      // Graph should remain unchanged (still empty) because LoadData failed earlier and plot doesn't run logic.
      expect(await app.graphInnerHTML()).toBe('');
      expect(await app.hasRectElements()).toBe(0);
    });

    test('Plot button still does not produce regression visualization even after attempted load (integration check)', async ({ page }) => {
      // Click load (which is faulty) and then click plot to assert the graph remains empty and FSM cannot reach final plotted state.
      const app4 = new LinearRegressionPage(page);
      await app.goto();

      // Trigger the faulty load; expect a TypeError
      await Promise.all([page.waitForEvent('pageerror'), app.clickLoad()]);

      // Now click plot; we do not expect the plot to create rect elements or otherwise change innerHTML.
      await app.clickPlot();

      // Confirm graph remains empty and no rect elements exist.
      expect(await app.graphInnerHTML()).toBe('');
      expect(await app.hasRectElements()).toBe(0);

      // Also confirm xData and yData still not populated due to earlier failure
      const xDataInfo2 = await app.evalGlobal('xData');
      const yDataInfo2 = await app.evalGlobal('yData');
      expect(Array.isArray(xDataInfo.value)).toBe(true);
      expect(xDataInfo.value.length).toBe(0);
      expect(Array.isArray(yDataInfo.value)).toBe(true);
      expect(yDataInfo.value.length).toBe(0);
    });
  });

  test.describe('FSM action verifications and negative checks', () => {
    test('Verify loadData() exists and was invoked on page load (onEnter action verification for S0 exit->S1 transition)', async ({ page }) => {
      // The HTML script calls loadData() on load; we ensure the function exists in global scope.
      // We don't re-invoke or modify it; just confirm presence and that it registered the click listener.
      const app5 = new LinearRegressionPage(page);
      await app.goto();

      const loadDataInfo1 = await app.evalGlobal('loadData');
      expect(loadDataInfo.type).toBe('function');

      // We can inspect if the load button has any click listeners indirectly by performing a click
      // and observing whether any error results (the click will trigger the attached handler).
      const [err] = await Promise.all([page.waitForEvent('pageerror'), app.clickLoad()]);
      expect(err).toBeTruthy();
      expect(err.name).toBe('TypeError');
    });

    test('Confirm FSM-declared renderPage() is not present - onEnter action missing (expected negative case)', async ({ page }) => {
      const app6 = new LinearRegressionPage(page);
      await app.goto();

      const renderPageInfo1 = await app.evalGlobal('renderPage');
      // FSM mentions renderPage in entry actions for S0, but implementation does not provide it.
      // Validate that it is indeed undefined.
      expect(renderPageInfo.type).toBe('undefined');
    });
  });
});