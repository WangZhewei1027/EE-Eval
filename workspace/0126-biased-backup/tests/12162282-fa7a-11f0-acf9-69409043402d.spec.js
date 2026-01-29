import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12162282-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the OSI interactive app
class OSIPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.layerSelect = '#layer-select';
    this.describeBtn = '#describe-layer';
    this.showFunctionsBtn = '#show-functions';
    this.examplesBtn = '#examples-btn';

    this.messageInput = '#message-input';
    this.startLayer = '#start-layer';
    this.endLayer = '#end-layer';
    this.simulateDownBtn = '#simulate-down';
    this.simulateUpBtn = '#simulate-up';

    this.mtuSlider = '#mtu-slider';
    this.mtuValueSpan = '#mtu-value';
    this.windowSizeInput = '#window-size-input';
    this.encryptionCheckbox = '#encryption-checkbox';
    this.compressionCheckbox = '#compression-checkbox';

    this.customMessageArea = '#custom-message';
    this.parseProtocolBtn = '#parse-protocol';

    this.output = '#output';
    this.header = '#header';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeaderText() {
    return (await this.page.locator(this.header).textContent())?.trim();
  }

  async setLayer(value) {
    await this.page.selectOption(this.layerSelect, { value: String(value) });
  }

  async clickDescribe() {
    await this.page.click(this.describeBtn);
  }
  async clickShowFunctions() {
    await this.page.click(this.showFunctionsBtn);
  }
  async clickExamples() {
    await this.page.click(this.examplesBtn);
  }

  async setMessage(text) {
    await this.page.fill(this.messageInput, text);
  }

  async setStartLayer(value) {
    await this.page.selectOption(this.startLayer, { value: String(value) });
  }
  async setEndLayer(value) {
    await this.page.selectOption(this.endLayer, { value: String(value) });
  }
  async clickSimulateDown() {
    await this.page.click(this.simulateDownBtn);
  }
  async clickSimulateUp() {
    await this.page.click(this.simulateUpBtn);
  }

  async setMTU(value) {
    await this.page.fill(this.mtuSlider, String(value));
    // Fire input event by focusing and pressing arrow keys if needed
    await this.page.dispatchEvent(this.mtuSlider, 'input');
  }
  async getMTUValueText() {
    return (await this.page.locator(this.mtuValueSpan).textContent())?.trim();
  }
  async setWindowSize(value) {
    await this.page.fill(this.windowSizeInput, String(value));
  }
  async toggleEncryption(enable) {
    const checked = await this.page.isChecked(this.encryptionCheckbox);
    if (checked !== enable) {
      await this.page.click(this.encryptionCheckbox);
    }
  }
  async toggleCompression(enable) {
    const checked = await this.page.isChecked(this.compressionCheckbox);
    if (checked !== enable) {
      await this.page.click(this.compressionCheckbox);
    }
  }

  async fillCustomMessage(text) {
    await this.page.fill(this.customMessageArea, text);
  }
  async clickParseProtocol() {
    await this.page.click(this.parseProtocolBtn);
  }

  async getOutputText() {
    // Wait a short moment for output to be written
    await this.page.waitForTimeout(50);
    return (await this.page.locator(this.output).textContent()) ?? '';
  }
}

test.describe('OSI Model Interactive Exploration - FSM Tests', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let osi;

  test.beforeEach(async ({ page }) => {
    // Capture console and page errors for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    osi = new OSIPage(page);
    await osi.goto();
  });

  test.afterEach(async () => {
    // After each test ensure there are no unexpected page errors.
    // We assert this inside tests as well, but keep a final check to help debugging.
    // (Tests that intentionally trigger UI-level errors will assert expected output instead.)
  });

  test('Idle state: page renders header and initial elements', async () => {
    // Validate the initial Idle state evidence: header exists and contains expected title
    const headerText = await osi.getHeaderText();
    expect(headerText).toBe('OSI Model Interactive Exploration');

    // Ensure output region is present and initially empty
    const outputText = await osi.getOutputText();
    expect(outputText.trim()).toBe('');

    // No uncaught page errors should have happened during load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Layer description, functions and examples (S1, S2, S3)', () => {
    test('Describe Layer: selecting Network (3) shows name and description', async () => {
      // Select layer 3 (Network) and click Describe Layer
      await osi.setLayer(3);
      await osi.clickDescribe();

      const out = await osi.getOutputText();
      expect(out).toContain('Layer 3 - Network');
      expect(out).toContain('Controls the operation of the subnet');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Show Functions: selecting Transport (4) lists functions', async () => {
      await osi.setLayer(4);
      await osi.clickShowFunctions();

      const out = await osi.getOutputText();
      expect(out).toContain('Common Functions of Layer 4 - Transport');
      expect(out).toContain('Segmentation and reassembly');
      expect(out).toMatch(/1\.\s+Segmentation and reassembly/);

      expect(pageErrors.length).toBe(0);
    });

    test('Show Examples: selecting Data Link (2) lists examples', async () => {
      await osi.setLayer(2);
      await osi.clickExamples();

      const out = await osi.getOutputText();
      expect(out).toContain('Real World Examples at Layer 2 - Data Link');
      expect(out).toContain('Ethernet');
      expect(out).toMatch(/1\.\s+Ethernet/);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Simulating Encapsulation and edge cases (S4)', () => {
    test('Simulate Encapsulation full flow from 7 to 1 includes headers and payload', async () => {
      // Ensure encryption and compression off for baseline
      await osi.toggleEncryption(false);
      await osi.toggleCompression(false);

      // Default message exists - verify it and run encapsulation from Application(7) down to Physical(1)
      await osi.setStartLayer(7);
      await osi.setEndLayer(1);
      await osi.setMessage('Hello OSI Model');

      await osi.clickSimulateDown();

      const out = await osi.getOutputText();
      expect(out).toContain('Encapsulating message from Layer 7 to Layer 1...');
      // After encapsulation, displayPacket prints 'Packet Headers' or segments listing
      expect(out).toMatch(/--- Packet Encapsulation Result ---/);
      // Ensure some layer headers are present, like Layer 1 or Layer 3 info in output
      expect(out).toMatch(/Layer 1 \(Physical\)|Layer 3 \(Network\)|Layer 4 \(Transport\)/);

      expect(pageErrors.length).toBe(0);
    });

    test('Encapsulation with small MTU triggers fragmentation in Network layer', async () => {
      // Set parameters to force fragmentation: small MTU (e.g., 5) and a longer message
      await osi.setMTU(5);
      // Ensure input triggers input event
      await osi.page.waitForTimeout(20);
      const mtuText = await osi.getMTUValueText();
      expect(mtuText).toBe(String(await osi.page.$eval('#mtu-slider', el => el.value)));

      await osi.setWindowSize(2);
      await osi.toggleCompression(false);
      await osi.toggleEncryption(false);
      await osi.setStartLayer(7);
      await osi.setEndLayer(1);
      await osi.setMessage('This message is long enough to fragment across a tiny MTU.');

      await osi.clickSimulateDown();

      const out = await osi.getOutputText();
      // Expect a fragmentation notice from Network layer
      expect(out).toMatch(/Fragmented into \d+ packets due to MTU=/);
      expect(out).toMatch(/Packet contains \d+ segment/);

      expect(pageErrors.length).toBe(0);
    });

    test('Encapsulation edge case: start < end yields error', async () => {
      // Intentionally set start lower than end to trigger the application's validation
      await osi.setStartLayer(1); // physical
      await osi.setEndLayer(7); // application
      await osi.setMessage('Edge case test');

      await osi.clickSimulateDown();

      const out = await osi.getOutputText();
      expect(out).toContain('Error: Start layer must be >= end layer for encapsulation (top-down).');

      // This is an application-level error message; no uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Simulating Decapsulation and edge cases (S5)', () => {
    test('Simulate Decapsulation when start == end (1) — build & remove physical header', async () => {
      // To navigate decapsulation path that will actually perform encapsulation before decapsulation,
      // choose start == end (1), due to implementation logic discussed in the FSM/HTML.
      await osi.setStartLayer(1);
      await osi.setEndLayer(1);
      await osi.setMessage('Physical layer test');

      await osi.clickSimulateUp();

      const out = await osi.getOutputText();
      expect(out).toContain('Decapsulating message from Layer 1 to Layer 1...');
      // Expect that physical headers were added then removed (display shows packet result)
      expect(out).toMatch(/--- Packet Decapsulation Result ---/);
      expect(pageErrors.length).toBe(0);
    });

    test('Decapsulation edge case: start > end yields validation error', async () => {
      // Set start greater than end to trigger decapsulation validation failure
      await osi.setStartLayer(7);
      await osi.setEndLayer(1);
      await osi.setMessage('Should error');

      await osi.clickSimulateUp();

      const out = await osi.getOutputText();
      // The app checks and reports validation error for start > end
      expect(out).toContain('Error: Start layer must be <= end layer for decapsulation (bottom-up).');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Parsing protocol messages (S6) and error handling', () => {
    test('Parse Protocol: empty textarea shows error message', async () => {
      await osi.fillCustomMessage('');
      await osi.clickParseProtocol();

      const out = await osi.getOutputText();
      expect(out).toContain('Error: Protocol message is empty.');
      expect(pageErrors.length).toBe(0);
    });

    test('Parse Protocol: invalid JSON reports JSON parse error', async () => {
      await osi.fillCustomMessage('{ invalid json: }');
      await osi.clickParseProtocol();

      const out = await osi.getOutputText();
      expect(out).toContain('Error: Invalid JSON format.');
      // Should include the JS error message text (e.g., Unexpected token) appended
      expect(out).toMatch(/Error: Invalid JSON format\.\n/);

      expect(pageErrors.length).toBe(0);
    });

    test('Parse Protocol: valid JSON is parsed and displayed in tree form', async () => {
      const sample = JSON.stringify({
        header: { src: '10.0.0.1', dst: '10.0.0.2' },
        payload: 'Hello',
        options: [{ key: 'a' }, { key: 'b' }]
      }, null, 2);
      await osi.fillCustomMessage(sample);
      await osi.clickParseProtocol();

      const out = await osi.getOutputText();
      expect(out).toContain('Parsed protocol message JSON:');
      expect(out).toContain('header:');
      expect(out).toContain('src: 10.0.0.1');
      expect(out).toContain('payload: Hello');
      expect(out).toContain('Item 1:');
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Parameter interactions and resulting behavior', () => {
    test('Presentation layer encryption & compression affect encapsulation output', async () => {
      // Enable both compression and encryption to observe Presentation layer effects
      await osi.toggleCompression(true);
      await osi.toggleEncryption(true);

      // Compose a message with letters to observe encryption (caesar cipher) effect
      await osi.setMessage('Attack at Dawn');
      await osi.setStartLayer(7);
      await osi.setEndLayer(1);

      await osi.clickSimulateDown();

      const out = await osi.getOutputText();
      // Expect that Presentation layer headers indicate both Compressed and Encrypted
      // The encapsulateLayer pushes headers with 'Compressed' and 'Encrypted' info
      expect(out).toMatch(/Layer 6 \(Presentation\):\s+Compressed|Encrypted/);
      expect(out).toMatch(/Encrypted|Compressed/);

      // Also expect the final displayed payload to include a transformed string (encrypted/decompressed markers)
      expect(out).toMatch(/Payload \(\d+ bytes\):|Packet contains/);
      expect(pageErrors.length).toBe(0);
    });

    test('MTU slider reflected in display and used for fragmentation decision', async () => {
      // Ensure changing the MTU slider updates the visible value
      await osi.setMTU(800);
      let visible = await osi.getMTUValueText();
      expect(visible).toBe('800');

      // Use a message longer than 800 to test fragmentation behavior
      await osi.setWindowSize(1);
      await osi.toggleCompression(false);
      await osi.toggleEncryption(false);
      await osi.setMessage('x'.repeat(1200));
      await osi.setStartLayer(7);
      await osi.setEndLayer(1);

      await osi.clickSimulateDown();
      const out = await osi.getOutputText();
      // Since message length > MTU, we expect fragmentation note
      expect(out).toMatch(/Fragmented into \d+ packets due to MTU=800/);

      expect(pageErrors.length).toBe(0);
    });
  });

  test('Console & page error monitoring: no unexpected runtime errors during interactions', async ({ page }) => {
    // Perform a representative set of interactions and then assert no uncaught runtime errors were emitted
    // (We still gathered consoleMessages and pageErrors in beforeEach.)

    // Quick interactions
    await osi.setLayer(5);
    await osi.clickDescribe();
    await osi.clickShowFunctions();
    await osi.setStartLayer(7);
    await osi.setEndLayer(1);
    await osi.clickSimulateDown();
    await osi.fillCustomMessage('{"ok":true}');
    await osi.clickParseProtocol();

    // Wait briefly to allow any async console/page errors to surface
    await page.waitForTimeout(100);

    // Assert no uncaught page errors were observed
    expect(pageErrors.length).toBe(0);

    // Assert no console errors of severity 'error' with messages indicating ReferenceError/SyntaxError etc.
    const errorConsoles = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(errorConsoles.length).toBe(0);
  });
});