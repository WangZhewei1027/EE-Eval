import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d16873-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the demo
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      inputText: page.locator('#inputText'),
      hashFunction: page.locator('#hashFunction'),
      customSalt: page.locator('#customSalt'),
      computeHash: page.locator('#computeHash'),
      hashOutput: page.locator('#hashOutput'),
      hashLength: page.locator('#hashLength'),
      explorationDiv: page.locator('body >> div').filter({ hasText: '' }) // fallback not used directly
    };
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Ensure the main elements are present
    await Promise.all([
      this.locators.inputText.waitFor({ state: 'visible' }),
      this.locators.hashFunction.waitFor({ state: 'visible' }),
      this.locators.customSalt.waitFor({ state: 'visible' }),
      this.locators.computeHash.waitFor({ state: 'visible' }),
    ]);
  }

  async getInputValue() {
    return this.locators.inputText.inputValue();
  }

  async setInputValue(value) {
    await this.locators.inputText.fill('');
    await this.locators.inputText.type(value);
  }

  async setHashFunction(value) {
    await this.locators.hashFunction.selectOption(value);
  }

  async setCustomSalt(value) {
    await this.locators.customSalt.fill('');
    if (value) await this.locators.customSalt.type(value);
  }

  async clickCompute() {
    await this.locators.computeHash.click();
  }

  async getHashOutputText() {
    return (await this.locators.hashOutput.textContent()) || '';
  }

  async getHashLengthText() {
    return (await this.locators.hashLength.textContent()) || '';
  }

  // Return the dynamic wrapper locators created by the script
  getDynamicWrappers() {
    // explorationDiv appended near end of body. It contains direct child wrappers (div).
    return this.page.locator('body > div').filter({
      has: this.page.locator('button', { hasText: 'Compute with this Input' })
    });
  }

  async computeDynamicAt(index, inputValue) {
    const wrappers = this.getDynamicWrappers();
    const count = await wrappers.count();
    if (index >= count) throw new Error(`Requested dynamic wrapper index ${index} but only ${count} exist`);
    const wrapper = wrappers.nth(index);
    const input = wrapper.locator('input');
    const button = wrapper.locator('button', { hasText: 'Compute with this Input' });

    await input.fill('');
    if (inputValue) await input.type(inputValue);
    await button.click();
    // The script appends output div inside wrapper; wait for it.
    const output = wrapper.locator('div').filter({ hasText: 'Hash of' }).last();
    await expect(output).toBeVisible();
    return output;
  }
}

test.describe('Hash Functions Interactive Demo - FSM tests', () => {
  // Collect console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test the Idle state: ensure main controls are rendered as expected
  test('Idle state renders controls and default values', async ({ page }) => {
    const hp = new HashPage(page);
    await hp.navigate();

    // Validate presence and default values for FSM S0_Idle evidence
    await expect(page.locator('h1')).toHaveText(/Hash Functions Interactive Demo/);
    await expect(hp.locators.inputText).toHaveValue('Hello World');
    await expect(hp.locators.hashFunction).toBeVisible();
    await expect(hp.locators.customSalt).toHaveAttribute('placeholder', 'Optional Salt');
    await expect(hp.locators.computeHash).toHaveText('Compute Hash');

    // Outputs initially empty
    expect(await hp.getHashOutputText()).toBe('');
    expect(await hp.getHashLengthText()).toBe('');

    // No page errors should have occurred on initial render
    expect(pageErrors.length).toBe(0);
  });

  // Test the ComputeHashClick transition without providing custom salt
  test('ComputeHashClick (no salt) computes MD5 and updates output and length', async ({ page }) => {
    const hp = new HashPage(page);
    await hp.navigate();

    // Ensure clean state: no custom salt
    await hp.setCustomSalt('');
    // Use MD5
    await hp.setHashFunction('md5');
    // Use default input ("Hello World") or set explicitly for clarity
    await hp.setInputValue('Hello World');

    // Click compute and observe results
    await hp.clickCompute();

    // Wait briefly for DOM updates
    await page.waitForTimeout(100);

    const hashText = (await hp.getHashOutputText()).trim();
    const lengthText = (await hp.getHashLengthText()).trim();

    // MD5 hex should be 32 chars (hex). Assert length label and hash shape.
    expect(lengthText).toContain('Length: 32');
    expect(hashText).toMatch(/^[a-f0-9]{32}$/i);

    // No page errors for this path (no customSalt branch executed)
    expect(pageErrors.length).toBe(0);

    // Console should not have emitted errors for this action
    const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  // Test the ComputeHashClick transition when customSalt is provided.
  // The implementation contains a bug: inputText is a const and the code attempts to reassign it,
  // which should throw a TypeError ("Assignment to constant variable").
  test('ComputeHashClick with customSalt triggers a TypeError due to reassignment of const', async ({ page }) => {
    const hp = new HashPage(page);
    await hp.navigate();

    // Set a custom salt to cause the faulty branch to execute
    await hp.setCustomSalt('SALT123');
    await hp.setHashFunction('md5');
    await hp.setInputValue('Hello World');

    // We expect a pageerror to be raised when clicking the compute button.
    // Wait for the pageerror event produced by the click.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      hp.clickCompute()
    ]);

    // The pageerror should be a TypeError about assignment to a constant.
    expect(err).toBeTruthy();
    expect(err.name).toBeDefined();
    // Depending on environment, message may vary. Check for keywords.
    expect(
      err.message.toLowerCase().includes('assignment to constant') ||
      err.message.toLowerCase().includes('assignment to const') ||
      err.name.toLowerCase() === 'typeerror'
    ).toBeTruthy();

    // Also verify that the global collector saw an error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const messages = pageErrors.map(e => e.message.toLowerCase()).join(' ');
    expect(
      messages.includes('assignment to constant') ||
      messages.includes('assignment to const') ||
      messages.includes('typeerror')
    ).toBeTruthy();

    // The UI may not have updated hash outputs due to the thrown error; verify that's possible.
    // Either it remains empty or equals previous value. We assert that it did not produce a valid hex hash of expected length.
    const out = (await hp.getHashOutputText()).trim();
    const lenText = (await hp.getHashLengthText()).trim();
    const validHex32 = /^[a-f0-9]{32}$/i.test(out);
    if (validHex32) {
      // If by some chance hash was computed before the error, length label would reflect 32
      expect(lenText).toContain('Length: 32');
    } else {
      // More likely: no update
      expect(out.length === 0 || !/^[a-f0-9]+$/i.test(out)).toBeTruthy();
    }
  });

  // Test transitions for other hash functions to ensure correct lengths are displayed
  test('ComputeHashClick computes SHA-256 and SHA-512 with expected lengths', async ({ page }) => {
    const hp = new HashPage(page);
    await hp.navigate();

    await hp.setCustomSalt(''); // ensure no-salt path
    await hp.setInputValue('abc');

    // SHA-256
    await hp.setHashFunction('sha256');
    await hp.clickCompute();
    await page.waitForTimeout(100);
    const hash256 = (await hp.getHashOutputText()).trim();
    const length256 = (await hp.getHashLengthText()).trim();
    expect(length256).toContain('Length: 64');
    expect(hash256).toMatch(/^[a-f0-9]{64}$/i);

    // SHA-512
    await hp.setHashFunction('sha512');
    await hp.clickCompute();
    await page.waitForTimeout(100);
    const hash512 = (await hp.getHashOutputText()).trim();
    const length512 = (await hp.getHashLengthText()).trim();
    expect(length512).toContain('Length: 128');
    expect(hash512).toMatch(/^[a-f0-9]{128}$/i);

    // Confirm no page errors for these executions
    expect(pageErrors.length).toBe(0);
  });

  // Validate the dynamic input buttons created by the script (DynamicInputComputeClick transition)
  test('DynamicInputComputeClick creates outputs inside dynamic wrappers and computes hash', async ({ page }) => {
    const hp = new HashPage(page);
    await hp.navigate();

    // There should be three dynamic input wrappers created by the script
    const wrappers = hp.getDynamicWrappers();
    const count = await wrappers.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Use the first dynamic wrapper to compute a SHA-256 hash
    await hp.setHashFunction('sha256');
    const outputLocator = await hp.computeDynamicAt(0, 'dynamic');

    // Validate content of the appended output
    const text = (await outputLocator.textContent()) || '';
    // Format: Hash of "dynamic": <hex> (Length: <n>)
    const match = text.match(/Hash of "([^"]+)":\s*([a-f0-9]+)\s*\(Length:\s*(\d+)\)/i);
    expect(match).not.toBeNull();
    const [, inputCaptured, hex, lenStr] = match;
    expect(inputCaptured).toBe('dynamic');
    expect(parseInt(lenStr, 10)).toBe(hex.length);
    // SHA-256 hex length is 64
    expect(parseInt(lenStr, 10)).toBe(64);
    expect(hex).toMatch(/^[a-f0-9]{64}$/i);

    // Ensure no page errors occurred for dynamic computation
    expect(pageErrors.length).toBe(0);
  });

  // Validate multiple dynamic buttons behave independently and append outputs per-wrapper
  test('Multiple dynamic buttons produce independent outputs', async ({ page }) => {
    const hp = new HashPage(page);
    await hp.navigate();

    const wrappers = hp.getDynamicWrappers();
    const total = await wrappers.count();
    expect(total).toBeGreaterThanOrEqual(3);

    // Use index 1 and 2 with different inputs and hash functions
    await hp.setHashFunction('md5');
    const out1 = await hp.computeDynamicAt(1, 'one');
    await hp.setHashFunction('sha512');
    const out2 = await hp.computeDynamicAt(2, 'two');

    const text1 = (await out1.textContent()) || '';
    const text2 = (await out2.textContent()) || '';

    // Verify outputs reference correct inputs and have expected hex lengths
    const m1 = text1.match(/Hash of "([^"]+)":\s*([a-f0-9]+)\s*\(Length:\s*(\d+)\)/i);
    const m2 = text2.match(/Hash of "([^"]+)":\s*([a-f0-9]+)\s*\(Length:\s*(\d+)\)/i);
    expect(m1).not.toBeNull();
    expect(m2).not.toBeNull();

    // MD5 => 32, SHA-512 => 128
    expect(parseInt(m1[3], 10)).toBe(32);
    expect(m1[2]).toMatch(/^[a-f0-9]{32}$/i);

    expect(parseInt(m2[3], 10)).toBe(128);
    expect(m2[2]).toMatch(/^[a-f0-9]{128}$/i);

    // No page errors expected here
    expect(pageErrors.length).toBe(0);
  });
});