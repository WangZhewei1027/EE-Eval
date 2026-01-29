import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b6473-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Suffix Tree Visualization (de3b6473-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset logs before each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages (info/debug/warn/error)
    page.on('console', (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text()
      };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The page triggers a build on DOMContentLoaded (buildButton.click()).
    // Wait for the visualization info to appear to ensure initial build completed.
    await page.waitForSelector('#buildButton');
    // Wait for info container to be populated by the initial build (if it occurs)
    await page.waitForSelector('#infoContainer', { timeout: 5000 });
  });

  test.afterEach(async ({}) => {
    // Intentionally left blank: Playwright closes pages automatically in its fixtures.
    // This placeholder is here to emphasize teardown is considered.
  });

  test.describe('State S0_Idle (Initial render) and components presence', () => {
    test('renders input, build button and SVG container (Idle state evidence)', async ({ page }) => {
      // Validate presence of the input field with default value
      const inputValue = await page.$eval('#inputText', (el) => el.value);
      expect(inputValue).toBe('banana'); // evidence from FSM: input default value is "banana"

      // Validate presence and label of the build button
      const buildText = await page.$eval('#buildButton', (el) => el.textContent.trim());
      expect(buildText).toBe('Build Suffix Tree');

      // Validate presence of the svg placeholder and its configured dimensions
      const svgAttrs = await page.$eval('#treeSvg', (el) => ({
        width: el.getAttribute('width'),
        height: el.getAttribute('height')
      }));
      expect(svgAttrs.width).toBe('800');
      expect(svgAttrs.height).toBe('400');
    });

    test('initial page load triggers an initial build resulting in Tree Built state evidence', async ({ page }) => {
      // The script invokes buildButton.click() in DOMContentLoaded; check for resulting info
      // Wait for the generated heading inside infoContainer to assert the tree was built
      const headingHandle = await page.waitForSelector('#infoContainer h3', { timeout: 5000 });
      const headingText = await headingHandle.textContent();
      expect(headingText).toContain('Suffix Tree Information');

      // Ensure the infoContainer mentions the input text (evidence that onEnter of TreeBuilt executed)
      const infoText = await page.$eval('#infoContainer', (el) => el.innerText);
      expect(infoText).toContain('Text: banana');

      // Check that SVG contains nodes/links created by the visualization (basic DOM evidence)
      // There should be at least one node drawn (groups with class 'node' are created)
      const nodeCount = await page.$$eval('#treeSvg .node', (els) => els.length);
      expect(nodeCount).toBeGreaterThan(0);

      // Edge labels are rendered as text elements with class 'edgelabel'
      const edgeLabelCount = await page.$$eval('#treeSvg .edgelabel', (els) => els.length);
      expect(edgeLabelCount).toBeGreaterThan(0);
    });
  });

  test.describe('Event BuildTreeClick and transition S0_Idle -> S1_TreeBuilt', () => {
    test('clicking Build Suffix Tree with a new input updates visualization and info', async ({ page }) => {
      // Change input and click the build button to trigger the transition actions
      await page.fill('#inputText', 'abc');
      await page.click('#buildButton');

      // Wait for the info container to reflect the new text
      await page.waitForFunction(() => {
        const info = document.getElementById('infoContainer');
        return info && info.textContent.includes('Text: abc');
      }, null, { timeout: 3000 });

      // Assert the info contains expected text and suffixes list
      const infoText1 = await page.$eval('#infoContainer', (el) => el.innerText);
      expect(infoText).toContain('Text: abc (termination character'); // partial match to be resilient
      expect(infoText).toContain('Number of nodes:');

      // Ensure the visualization re-rendered: there are node groups and edge labels
      const nodes = await page.$$eval('#treeSvg g.node', (els) => els.length);
      expect(nodes).toBeGreaterThan(0);

      const edgelabels = await page.$$eval('#treeSvg .edgelabel', (els) => els.length);
      expect(edgelabels).toBeGreaterThan(0);

      // Check that tooltips (title elements) exist for nodes and include "Node"
      const titles = await page.$$eval('#treeSvg g.node title', (els) =>
        els.map(t => t.textContent.trim())
      );
      expect(titles.length).toBeGreaterThan(0);
      expect(titles[0]).toMatch(/Node \d+/);
    });

    test('submitting empty input triggers alert and does not transition to Tree Built', async ({ page }) => {
      // Listen for the dialog (alert) and capture its message
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        (async () => {
          // Clear the input and click build to trigger the alert
          await page.fill('#inputText', '');
          await page.click('#buildButton');
        })()
      ]);

      // Validate the alert message matches the expected validation
      expect(dialog.message()).toBe('Please enter some text');
      await dialog.dismiss();

      // Confirm that infoContainer did not update to reflect an empty build (still contains previous data)
      const infoText2 = await page.$eval('#infoContainer', (el) => el.innerText);
      // The info should still contain some previously built information; at a minimum check it contains 'Suffix Tree Information' or not empty
      expect(infoText.length).toBeGreaterThan(0);
    });

    test('building with a single-character input produces a minimal visualization', async ({ page }) => {
      // Build with single character 'a' to test edge-case behavior
      await page.fill('#inputText', 'a');
      await page.click('#buildButton');

      // Wait for info to reflect 'a'
      await page.waitForFunction(() => {
        const info1 = document.getElementById('infoContainer');
        return info && info.textContent.includes('Text: a');
      }, null, { timeout: 3000 });

      const infoText3 = await page.$eval('#infoContainer', (el) => el.innerText);
      expect(infoText).toContain('Text: a');

      // The suffixes list should contain at least one list item
      const liCount = await page.$$eval('#infoContainer ul li', (els) => els.length);
      expect(liCount).toBeGreaterThanOrEqual(1);

      // Verify that svg still has nodes drawn
      const nodes1 = await page.$$eval('#treeSvg g.node', (els) => els.length);
      expect(nodes).toBeGreaterThan(0);
    });
  });

  test.describe('Observability: console and runtime errors', () => {
    test('no unexpected console error messages or uncaught page errors occurred during tests', async () => {
      // This assertion ensures the page executed without uncaught runtime errors.
      // If the application had ReferenceError, TypeError, SyntaxError, those would appear in pageErrors or consoleErrors.
      // We assert that none were observed during navigation and interaction above.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);

      // Optionally assert that we observed other console messages (info/debug) - not required but informative
      // At minimum, ensure we captured some console activity (could be zero in some environments)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.describe('Miscellaneous visual and DOM validations', () => {
    test('SVG path elements for links and suffix-links exist and have expected classes', async ({ page }) => {
      // Wait for at least one '.link' path to be present (the tree layout should create links)
      const linkExists = await page.waitForSelector('#treeSvg path.link', { timeout: 3000 }).then(() => true).catch(() => false);
      expect(linkExists).toBeTruthy();

      // Suffix links may or may not exist depending on the structure; check that selection is valid (no crash)
      // We don't enforce a minimum number for suffix-link, but ensure querying does not throw and returns an array.
      const suffixLinkCount = await page.$$eval('#treeSvg path.suffix-link', (els) => els.length);
      expect(typeof suffixLinkCount).toBe('number');
    });
  });
});