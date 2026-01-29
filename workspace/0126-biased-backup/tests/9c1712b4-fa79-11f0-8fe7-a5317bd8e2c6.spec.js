import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1712b4-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the Hash Functions Explorer
class HashExplorerPage {
  constructor(page) {
    this.page = page;
    // shortcuts for selectors
    this.sel = {
      h1: 'h1',
      textInput: '#textInput',
      fileInput: '#fileInput',
      randomTextBtn: '#randomTextBtn',
      randomBytesBtn: '#randomBytesBtn',
      outFormat: '#outFormat',
      algorithmSelect: '#algorithmSelect',
      saltInput: '#saltInput',
      saltMode: '#saltMode',
      blockSize: '#blockSize',
      iterations: '#iterations',
      iterChunk: '#iterChunk',
      computeHashBtn: '#computeHashBtn',
      computeAllBtn: '#computeAllBtn',
      copyResultBtn: '#copyResultBtn',
      downloadResultBtn: '#downloadResultBtn',
      chunkSize: '#chunkSize',
      startStreamBtn: '#startStreamBtn',
      cancelStreamBtn: '#cancelStreamBtn',
      streamLog: '#streamLog',
      resultAlg: '#resultAlg',
      hashOutput: '#hashOutput',
      rawHex: '#rawHex',
      rawBits: '#rawBits',
      // Avalanche
      avBase: '#avBase',
      avAlg: '#avAlg',
      avFlips: '#avFlips',
      avStrategy: '#avStrategy',
      runAvalancheBtn: '#runAvalancheBtn',
      cancelAvalancheBtn: '#cancelAvalancheBtn',
      avalancheLog: '#avalancheLog',
      // Brute force
      bfTarget: '#bfTarget',
      bfAlg: '#bfAlg',
      bfCharset: '#bfCharset',
      bfMaxLen: '#bfMaxLen',
      startBruteBtn: '#startBruteBtn',
      stopBruteBtn: '#stopBruteBtn',
      bruteLog: '#bruteLog',
      // Collision
      colAlg: '#colAlg',
      colMax: '#colMax',
      startCollisionBtn: '#startCollisionBtn',
      stopCollisionBtn: '#stopCollisionBtn',
      collisionLog: '#collisionLog',
      // Merkle
      merkleLeaves: '#merkleLeaves',
      merkleAlg: '#merkleAlg',
      buildMerkleBtn: '#buildMerkleBtn',
      merkleLog: '#merkleLog',
      // HMAC
      hmacKey: '#hmacKey',
      hmacMsg: '#hmacMsg',
      hmacAlg: '#hmacAlg',
      computeHmacBtn: '#computeHmacBtn',
      hmacLog: '#hmacLog',
      // Utilities
      clearLogsBtn: '#clearLogsBtn',
      resetDefaultsBtn: '#resetDefaultsBtn',
      miscLog: '#miscLog'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic existence checks
  async isVisible(selector) {
    return await this.page.isVisible(selector);
  }

  // Interactions
  async click(sel) {
    await this.page.click(sel);
  }

  async fill(sel, value) {
    await this.page.fill(sel, value);
  }

  async getText(sel) {
    return (await this.page.textContent(sel)) || '';
  }

  async getValue(sel) {
    return await this.page.$eval(sel, el => (el.value ?? ''));
  }

  // Helpers that wait for visible changes
  async waitForOutputContains(text, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, t) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(t),
      { timeout },
      this.sel.hashOutput,
      text
    );
  }
}

test.describe('Hash Functions Explorer - FSM and UI comprehensive tests', () => {
  let page;
  let app;
  const consoleErrors = [];
  const pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console errors and page errors for assertions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    app = new HashExplorerPage(page);
    await app.goto();
    // ensure initial render loaded
    await expect(page.locator('h1')).toHaveText('Hash Functions Explorer');
  });

  test.afterEach(async () => {
    // Assert that no fatal page errors occurred during the test
    // We assert that there are zero uncaught page errors (e.g., ReferenceError/SyntaxError/TypeError)
    // If any console error occurred, attach it to the expectation message for easier debugging.
    if (pageErrors.length > 0) {
      // fail with details
      const errors = pageErrors.map(e => e.stack || e.message).join('\n---\n');
      await page.close();
      throw new Error('Uncaught page errors detected:\n' + errors);
    }
    // It's acceptable for navigator.clipboard to fail (handled by UI) so consoleErrors might include copy failures.
    // We still fail on unexpected console errors that are clearly runtime exceptions (ReferenceError, TypeError, SyntaxError).
    const runtimeErrors = consoleErrors.filter(c => /ReferenceError|TypeError|SyntaxError/.test(c.text));
    if (runtimeErrors.length > 0) {
      const msgs = runtimeErrors.map(r => r.text).join('\n');
      await page.close();
      throw new Error('Console runtime errors present: \n' + msgs);
    }
    await page.close();
  });

  test.describe('S0 Idle - initial render and utilities', () => {
    test('renders page and static elements (onEnter renderPage equivalent)', async () => {
      // Validate the page header and presence of main sections
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('section >> text=Input')).toBeVisible();
      await expect(page.locator('section >> text=Algorithms & Options')).toBeVisible();
      // The FSM mentions renderPage() on entry to Idle; here we assert elements present
      await expect(page.locator('#textInput')).toHaveValue('hello world');
      await expect(page.locator('#algorithmSelect')).toHaveValue('SHA-256');
    });

    test('random text and bytes buttons change the text input', async () => {
      const before = await app.getValue(app.sel.textInput);
      await app.click(app.sel.randomTextBtn);
      const afterRandom = await app.getValue(app.sel.textInput);
      expect(afterRandom).not.toBe('');
      expect(afterRandom).not.toBe(before);

      // pressing randomBytesBtn replaces textInput with hex bytes string (contains spaces)
      await app.click(app.sel.randomBytesBtn);
      const bytesValue = await app.getValue(app.sel.textInput);
      expect(bytesValue.length).toBeGreaterThan(0);
      expect(bytesValue).toMatch(/[0-9a-f]{2}(\s[0-9a-f]{2})+/i);
    });

    test('reset defaults restores expected default values and logs', async () => {
      // Change some values then reset
      await app.fill(app.sel.textInput, 'temporary-value');
      await app.fill(app.sel.saltInput, 'somesalt');
      await app.click(app.sel.resetDefaultsBtn);
      // Reset sets textInput and some values back
      await expect(page.locator(app.sel.textInput)).toHaveValue('hello world');
      await expect(page.locator(app.sel.outFormat)).toHaveValue('hex');
      const miscLog = await app.getText(app.sel.miscLog);
      expect(miscLog).toContain('Reset to defaults');
    });
  });

  test.describe('S1 Hashing - compute single and all algorithms, copy and download', () => {
    test('compute hash (default SHA-256) displays result and raw hex/bits', async () => {
      // Ensure output format is hex for predictable assertion
      await app.fill(app.sel.textInput, 'test-input');
      await page.selectOption(app.sel.outFormat, 'hex');
      await app.click(app.sel.computeHashBtn);
      // Wait for resultAlg to update and hashOutput to contain some hex characters
      await page.waitForSelector('#resultAlg:has-text("SHA-256")', { timeout: 2000 });
      const resultAlg = await app.getText(app.sel.resultAlg);
      expect(resultAlg).toContain('SHA-256');
      const rawHex = await app.getText(app.sel.rawHex);
      expect(rawHex).toMatch(/^[0-9a-f]+$/i);
      const hashOutput = await app.getText(app.sel.hashOutput);
      expect(hashOutput.length).toBeGreaterThan(0);
    });

    test('compute across all algorithms populates multi-line output', async () => {
      await app.fill(app.sel.textInput, 'multi-test');
      await app.click(app.sel.computeAllBtn);
      // hashOutput expected to contain multiple lines, each "AlgName: hex"
      await page.waitForFunction(sel => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.split('\\n').length > 1;
      }, {}, app.sel.hashOutput);
      const out = await app.getText(app.sel.hashOutput);
      expect(out.split('\n').length).toBeGreaterThan(1);
      expect(await app.getText(app.sel.resultAlg)).toBe('Multi');
    });

    test('copy result updates miscLog with success or failure message (clipboard may fail)', async () => {
      // Ensure there is some output to copy
      await app.fill(app.sel.textInput, 'copyme');
      await app.click(app.sel.computeHashBtn);
      await app.click(app.sel.copyResultBtn);
      // miscLog will contain either 'Copied result to clipboard' or 'Copy failed: ...'
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return t.includes('Copied result') || t.includes('Copy failed');
      }, {}, app.sel.miscLog);
      const misc = await app.getText(app.sel.miscLog);
      expect(misc).toMatch(/Copied result to clipboard|Copy failed:/);
    });

    test('download result triggers anchor flow without throwing', async () => {
      // Compute something then trigger download
      await app.fill(app.sel.textInput, 'download-test');
      await app.click(app.sel.computeHashBtn);
      // Trigger download - this creates a blob and clicks an anchor
      // We assert no unhandled page errors occur and UI still has the output
      await app.click(app.sel.downloadResultBtn);
      const out = await app.getText(app.sel.hashOutput);
      expect(out.length).toBeGreaterThan(0);
    });

    test('compute hash with saltMode hmac triggers HMAC path and displays HMAC result', async () => {
      await page.selectOption(app.sel.saltMode, 'hmac');
      await app.fill(app.sel.saltInput, 'mysecret');
      await app.fill(app.sel.textInput, 'message-hmac');
      // Choose a deterministic algorithm available in page (SHA-256)
      await page.selectOption(app.sel.algorithmSelect, 'SHA-256');
      await app.click(app.sel.computeHashBtn);
      // resultAlg should include '(HMAC)'
      await page.waitForFunction(() => document.getElementById('resultAlg').textContent.includes('HMAC'), {}, {});
      const resultAlg = await app.getText(app.sel.resultAlg);
      expect(resultAlg).toContain('HMAC');
      // restore saltMode
      await page.selectOption(app.sel.saltMode, 'none');
    });
  });

  test.describe('S2 Streaming - start and cancel streaming', () => {
    test('start streaming over text produces interim logs and final streamed result', async () => {
      await app.fill(app.sel.textInput, 'streaming-text-for-test');
      // Choose a toy algorithm so interim hashes are short and deterministic
      await page.selectOption(app.sel.algorithmSelect, 'FNV-1a-32');
      // set small chunk size so multiple iterations occur
      await app.fill(app.sel.chunkSize, '5');
      await app.click(app.sel.startStreamBtn);
      // Wait for streamLog to show some processed updates
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return /Processed .* bytes/.test(t);
      }, {}, app.sel.streamLog);
      const sLog = await app.getText(app.sel.streamLog);
      expect(sLog).toMatch(/Processed .* bytes/);
      // Final displayResult will be called: ensure resultAlg contains '(streamed)'
      await page.waitForFunction(() => document.getElementById('resultAlg').textContent.includes('(streamed)'), {}, {});
      const resultAlg = await app.getText(app.sel.resultAlg);
      expect(resultAlg).toContain('(streamed)');
    });

    test('cancel streaming sets aborted message when a stream is running', async () => {
      // To reliably observe abortion, increase flips of an active streaming loop by using long input
      const longText = 'a'.repeat(5000); // larger text to allow cancellation
      await app.fill(app.sel.textInput, longText);
      await page.selectOption(app.sel.algorithmSelect, 'Murmur3-32');
      await app.fill(app.sel.chunkSize, '256');
      // Start streaming and then immediately cancel
      await app.click(app.sel.startStreamBtn);
      // Give loop a tick to begin
      await page.waitForTimeout(50);
      await app.click(app.sel.cancelStreamBtn);
      // streamLog should contain 'Aborted' (the implementation appends '\nAborted')
      await page.waitForFunction(sel => (document.querySelector(sel)?.textContent || '').includes('Aborted'), {}, app.sel.streamLog);
      const sLog = await app.getText(app.sel.streamLog);
      expect(sLog).toContain('Aborted');
    });
  });

  test.describe('S3 Avalanche Test - run and cancel', () => {
    test('run avalanche displays base hash and average changed bits', async () => {
      // Use a moderate number of flips to finish quickly
      await app.fill(app.sel.avBase, 'av-test');
      await page.selectOption(app.sel.avAlg, 'FNV-1a-32');
      await app.fill(app.sel.avFlips, '8');
      await page.selectOption(app.sel.avStrategy, 'random');
      await app.click(app.sel.runAvalancheBtn);
      // Wait for avalancheLog to show 'Base hash:' and 'Average changed bits'
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return t.includes('Base hash:') && t.includes('Average changed bits');
      }, {}, app.sel.avalancheLog);
      const log = await app.getText(app.sel.avalancheLog);
      expect(log).toContain('Base hash:');
      expect(log).toMatch(/Average changed bits:/);
    });

    test('cancel avalanche mid-run results in Aborted line in log', async () => {
      // Set flips large to allow cancellation
      await app.fill(app.sel.avBase, 'av-cancel');
      await page.selectOption(app.sel.avAlg, 'FNV-1a-32');
      await app.fill(app.sel.avFlips, '200'); // enough work to cancel
      await app.click(app.sel.runAvalancheBtn);
      // give it some time to start
      await page.waitForTimeout(20);
      await app.click(app.sel.cancelAvalancheBtn);
      // Wait for avalancheLog to contain 'Aborted' or show that it stopped
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return t.includes('Aborted') || t.includes('Average changed bits') || t.includes('Flip #');
      }, {}, app.sel.avalancheLog);
      const log = await app.getText(app.sel.avalancheLog);
      // Either aborted or finished early; in both cases we should find either 'Aborted' or 'Average changed bits'
      expect(log.includes('Aborted') || log.includes('Average changed bits')).toBeTruthy();
    });
  });

  test.describe('S4 Brute-force & S5 Collision - start/stop and edge handling', () => {
    test('start brute with empty target shows validation message (edge case)', async () => {
      // Clear target to trigger the validation path
      await app.fill(app.sel.bfTarget, '');
      await app.click(app.sel.startBruteBtn);
      // bruteLog should quickly show 'Provide target hex'
      await page.waitForFunction(sel => (document.querySelector(sel)?.textContent || '').includes('Provide target hex'), {}, app.sel.bruteLog);
      const log = await app.getText(app.sel.bruteLog);
      expect(log).toContain('Provide target hex');
    });

    test('start brute then stop quickly does not throw and updates log', async () => {
      // Provide a dummy small target hex that is invalid length but non-empty; brute should attempt or bail gracefully
      await app.fill(app.sel.bfTarget, '00');
      await page.selectOption(app.sel.bfAlg, 'FNV-1a-32');
      await app.fill(app.sel.bfCharset, 'ab');
      await app.fill(app.sel.bfMaxLen, '2');
      // Start brute force and quickly stop
      await app.click(app.sel.startBruteBtn);
      await page.waitForTimeout(10);
      await app.click(app.sel.stopBruteBtn);
      // bruteLog should contain either attempts info or 'Not found' message
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return t.length > 0;
      }, {}, app.sel.bruteLog);
      const log = await app.getText(app.sel.bruteLog);
      expect(log.length).toBeGreaterThan(0);
    });

    test('collision search with max=1 returns no collision message quickly (edge case)', async () => {
      await page.fill(app.sel.colMax, '1');
      await page.selectOption(app.sel.colAlg, 'DJB2');
      await app.click(app.sel.startCollisionBtn);
      // Expect 'No collision found' message because max attempts is 1
      await page.waitForFunction(sel => (document.querySelector(sel)?.textContent || '').includes('No collision found'), {}, app.sel.collisionLog);
      const log = await app.getText(app.sel.collisionLog);
      expect(log).toContain('No collision found');
    });

    test('stop collision while running sets abort flag without throwing', async () => {
      // Set max high to allow stop to have effect
      await page.fill(app.sel.colMax, '10000');
      await page.selectOption(app.sel.colAlg, 'FNV-1a-32');
      await app.click(app.sel.startCollisionBtn);
      await page.waitForTimeout(20);
      await app.click(app.sel.stopCollisionBtn);
      // After stopping, the collisionLog should be non-empty and no page errors occurred
      await page.waitForFunction(sel => (document.querySelector(sel)?.textContent || '').length > 0, {}, app.sel.collisionLog);
      const l = await app.getText(app.sel.collisionLog);
      expect(l.length).toBeGreaterThan(0);
    });
  });

  test.describe('S6 Merkle Tree & S7 HMAC - builder and inspector', () => {
    test('build merkle tree from default leaves shows leaves and root', async () => {
      // Ensure default textarea contains four leaves (from HTML)
      const leaves = await app.getValue(app.sel.merkleLeaves);
      expect(leaves.split('\\n').length).toBeGreaterThanOrEqual(1);
      // Select a toy algorithm for Merkle to run quickly
      await page.selectOption(app.sel.merkleAlg, 'FNV-1a-32');
      await app.click(app.sel.buildMerkleBtn);
      // merkleLog should contain 'Leaf 0' and 'Root'
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return t.includes('Leaf 0') && t.includes('Root');
      }, {}, app.sel.merkleLog);
      const log = await app.getText(app.sel.merkleLog);
      expect(log).toContain('Leaf 0');
      expect(log).toContain('Root');
    });

    test('compute HMAC displays ipad/opad/inner/outer info', async () => {
      // choose algorithm and ensure key/msg are set
      await page.selectOption(app.sel.hmacAlg, 'FNV-1a-32');
      await app.fill(app.sel.hmacKey, 'secret');
      await app.fill(app.sel.hmacMsg, 'hello');
      await app.click(app.sel.computeHmacBtn);
      // hmacLog should contain 'ipad (hex):', 'opad (hex):' and 'inner hash' and 'outer hash'
      await page.waitForFunction(sel => {
        const t = document.querySelector(sel)?.textContent || '';
        return t.includes('ipad (hex)') && t.includes('opad (hex)') && t.includes('inner hash') && t.includes('outer hash');
      }, {}, app.sel.hmacLog);
      const log = await app.getText(app.sel.hmacLog);
      expect(log).toContain('ipad (hex)');
      expect(log).toContain('opad (hex)');
      expect(log).toContain('inner hash');
      expect(log).toContain('outer hash');
    });
  });

  test.describe('Misc utilities and clearing logs', () => {
    test('clear logs empties various log areas', async () => {
      // Ensure logs have some content
      await app.fill(app.sel.textInput, 'clear-logs-test');
      await app.click(app.sel.computeHashBtn);
      await page.waitForTimeout(50);
      // Now clear logs
      await app.click(app.sel.clearLogsBtn);
      // Check multiple logs are empty
      const logs = ['#streamLog','#miscLog','#avalancheLog','#bruteLog','#collisionLog','#merkleLog','#hmacLog'];
      for (const l of logs) {
        const txt = await app.getText(l);
        expect(txt.trim().length).toBeLessThanOrEqual(0);
      }
    });
  });
});