import { test, expect } from '@playwright/test';

// Test suite for OSI Model Interactive Explorer (Application ID: 99d05701-fa79-11f0-8075-e54a10595dde)
// The HTML is served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/99d05701-fa79-11f0-8075-e54a10595dde.html

// Expected layer details (copied from the application HTML for assertions)
const EXPECTED_LAYER_DETAILS = {
  1: "Physical Layer: Transmits raw bits over a physical medium.",
  2: "Data Link Layer: Provides node-to-node data transfer and error detection.",
  3: "Network Layer: Handles the routing of data between devices.",
  4: "Transport Layer: Ensures complete data transfer with flow control.",
  5: "Session Layer: Manages sessions and controls the dialogues.",
  6: "Presentation Layer: Translates data formats for the application layer.",
  7: "Application Layer: Provides network services to the end user."
};

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d05701-fa79-11f0-8075-e54a10595dde.html';

// Helper to compute expected transmitted lines for a given input
function computeExpectedTransmissionLines(input) {
  const result = [];
  let processingData = input;
  for (let i = 1; i <= 7; i++) {
    processingData = `Layer ${i}: ${processingData}`;
    result.push(processingData);
  }
  return result;
}

test.describe('OSI Model Interactive Explorer - FSM validation', () => {
  // Arrays to collect runtime errors and console.error messages for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // swallow any unexpected handler errors
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(BASE_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small safeguard: ensure no unexpected dialogs remain
    // (should have been handled by tests that expect dialogs)
    // This will not modify the page or global functions.
    // If a dialog is present it would have been awaited in the test.
    // No explicit teardown required beyond Playwright fixtures.
  });

  test('Initial Idle State renders correctly (S0_Idle) and no runtime errors on load', async ({ page }) => {
    // What this test validates:
    // - The page loads and renders the top-level elements (title, buttons, info paragraphs)
    // - The initial texts are correct as per the Idle state evidence
    // - There are no console.error messages or page exceptions during load
    const title = await page.textContent('h1');
    expect(title?.trim()).toBe('OSI Model Interactive Explorer');

    // Verify layer buttons (Physical through Application) are present
    for (let i = 1; i <= 7; i++) {
      const selector = `button[onclick="selectLayer(${i})"]`;
      const btn = page.locator(selector);
      await expect(btn).toBeVisible();
    }

    // Verify Transmit button is present
    await expect(page.locator('button[onclick="transmitData()"]')).toBeVisible();

    // Verify initial layerInfo content matches Idle state's expectation
    const layerInfo = await page.textContent('#layerInfo');
    expect(layerInfo?.trim()).toBe('Select a layer to see details.');

    // Verify initial layerData content
    const layerData = await page.textContent('#layerData');
    expect(layerData?.trim()).toBe('Data will appear here as it passes through layers.');

    // Verify that the expected onEnter action name "renderPage" is NOT defined on the page
    // (FSM mentions renderPage() as an entry action for S0_Idle, but the implementation doesn't define it)
    // We assert its absence (so no ReferenceError will occur unless code tried to call it)
    const hasRenderPage = await page.evaluate(() => {
      // Do not call renderPage(); only check for existence
      try {
        return typeof window.renderPage !== 'undefined';
      } catch (e) {
        return false;
      }
    });
    expect(hasRenderPage).toBe(false);

    // Assert there were no console errors or page errors during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Selecting each OSI layer updates layerInfo (S0_Idle -> S1_LayerSelected)', async ({ page }) => {
    // What this test validates:
    // - Clicking each layer button updates #layerInfo to the correct layer description
    // - No runtime errors occur during these interactions
    for (let i = 1; i <= 7; i++) {
      const selector = `button[onclick="selectLayer(${i})"]`;
      await page.click(selector);
      // Allow the DOM to update
      const infoText = (await page.textContent('#layerInfo'))?.trim();
      expect(infoText).toBe(EXPECTED_LAYER_DETAILS[i]);
      // Ensure no console or page errors accumulated during these interactions
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Transmitting without data triggers an alert and does not change layerData (edge case)', async ({ page }) => {
    // What this test validates:
    // - Clicking Transmit with an empty input triggers an alert with the expected message
    // - layerData remains unchanged after the alert
    // - No console/page errors are produced by this flow
    // Ensure input is empty
    await page.fill('#dataInput', '');
    // Set up dialog handling before the click
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('button[onclick="transmitData()"]')
    ]);
    // Assert alert message
    expect(dialog.message()).toBe('Please enter some data to transmit.');
    // Dismiss the alert
    await dialog.accept();

    // Verify layerData remains the initial placeholder text
    const layerData = (await page.textContent('#layerData'))?.trim();
    expect(layerData).toBe('Data will appear here as it passes through layers.');

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transmitting with data populates layerData with seven layers (S0_Idle -> S2_DataTransmitted)', async ({ page }) => {
    // What this test validates:
    // - Providing an input and clicking Transmit updates #layerData with seven lines,
    //   each reflecting the progressive encapsulation per layer (Layer 1..7)
    // - No console or page errors occur
    const input = 'Hello';
    await page.fill('#dataInput', input);

    await page.click('button[onclick="transmitData()"]');

    // Read the layerData text and split into lines
    const layerDataText = (await page.textContent('#layerData')) ?? '';
    const actualLines = layerDataText.split('\n').map(l => l.trim()).filter(Boolean);

    // Compute expected lines programmatically
    const expectedLines = computeExpectedTransmissionLines(input);
    expect(actualLines.length).toBe(expectedLines.length);
    for (let i = 0; i < expectedLines.length; i++) {
      expect(actualLines[i]).toBe(expectedLines[i]);
    }

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Selecting a layer then transmitting preserves layerInfo while populating layerData (combined transition)', async ({ page }) => {
    // What this test validates:
    // - A selection transition followed by a transmit transition works together:
    //   layerInfo remains as selected, and layerData is updated by transmit
    const layerToSelect = 4;
    // Select layer
    await page.click(`button[onclick="selectLayer(${layerToSelect})"]`);
    const infoAfterSelect = (await page.textContent('#layerInfo'))?.trim();
    expect(infoAfterSelect).toBe(EXPECTED_LAYER_DETAILS[layerToSelect]);

    // Provide data and transmit
    const payload = 'Packet123';
    await page.fill('#dataInput', payload);
    await page.click('button[onclick="transmitData()"]');

    // Confirm layerInfo still reflects the selected layer
    const infoAfterTransmit = (await page.textContent('#layerInfo'))?.trim();
    expect(infoAfterTransmit).toBe(EXPECTED_LAYER_DETAILS[layerToSelect]);

    // Confirm layerData updated correctly
    const expectedLines = computeExpectedTransmissionLines(payload);
    const actualLines = (await page.textContent('#layerData')).split('\n').map(l => l.trim()).filter(Boolean);
    expect(actualLines.length).toBe(expectedLines.length);
    expect(actualLines[actualLines.length - 1]).toBe(expectedLines[expectedLines.length - 1]);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: very long input and special characters are preserved through layers', async ({ page }) => {
    // What this test validates:
    // - The transmit function can handle long inputs and special unicode characters
    const longInput = 'A'.repeat(2000) + '✨🚀' + 'Z'.repeat(500);
    await page.fill('#dataInput', longInput);
    await page.click('button[onclick="transmitData()"]');

    const actualText = (await page.textContent('#layerData')) ?? '';
    const actualLines = actualText.split('\n').map(l => l.trim()).filter(Boolean);
    const expectedLines = computeExpectedTransmissionLines(longInput);

    expect(actualLines.length).toBe(7);
    // Verify last (most encapsulated) line contains the original long input
    expect(actualLines[actualLines.length - 1]).toContain(longInput);
    // spot-check first line
    expect(actualLines[0]).toBe(expectedLines[0]);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid sequential transmissions produce consistent results (stability test)', async ({ page }) => {
    // What this test validates:
    // - Multiple quick transmissions reflect the most recent input each time
    const inputs = ['one', 'two', 'three'];
    for (const value of inputs) {
      await page.fill('#dataInput', value);
      await page.click('button[onclick="transmitData()"]');
      const lines = (await page.textContent('#layerData')).split('\n').map(l => l.trim()).filter(Boolean);
      const expectedLines = computeExpectedTransmissionLines(value);
      expect(lines[0]).toBe(expectedLines[0]);
      expect(lines[lines.length - 1]).toBe(expectedLines[expectedLines.length - 1]);
    }
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('DOM structure evidence checks (buttons and input exist as FSM components)', async ({ page }) => {
    // What this test validates:
    // - The DOM contains the components enumerated in the FSM extraction summary
    for (let i = 1; i <= 7; i++) {
      await expect(page.locator(`button[onclick="selectLayer(${i})"]`)).toBeVisible();
    }
    await expect(page.locator('button[onclick="transmitData()"]')).toBeVisible();
    await expect(page.locator('#dataInput')).toBeVisible();

    // Confirm the text content of the Physical Layer button specifically
    const physicalText = await page.textContent('button[onclick="selectLayer(1)"]');
    expect(physicalText?.trim()).toBe('Physical Layer');

    // No runtime errors from DOM queries
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('No unexpected global function calls were made (observe for runtime Reference/Type/Syntax errors)', async ({ page }) => {
    // What this test validates:
    // - Observes the global runtime for any unhandled exceptions or console errors
    // - If the implementation attempted to call an undefined function (e.g., renderPage),
    //   it would have produced a ReferenceError captured in pageErrors; here we assert none occurred.
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Unexpected console.error logs: ${consoleErrors.map(e => e.text).join('; ')}`);
  });
});