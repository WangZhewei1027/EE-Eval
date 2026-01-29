import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d94521-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the Paging Demo
class PagingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.numPages = page.locator('#numPages');
    this.pageSize = page.locator('#pageSize');
    this.numFrames = page.locator('#numFrames');
    this.policy = page.locator('#policy');
    this.tlbEnable = page.locator('#tlbEnable');
    this.tlbEntries = page.locator('#tlbEntries');

    this.buildBtn = page.locator('#buildBtn');
    this.resetBtn = page.locator('#resetBtn');

    this.accessAddr = page.locator('#accessAddr');
    this.accessBtn = page.locator('#accessBtn');
    this.randBtn = page.locator('#randBtn');
    this.seqBtn = page.locator('#seqBtn');

    this.breakdown = page.locator('#breakdown');
    this.ptableWrap = page.locator('#ptableWrap');
    this.framesWrap = page.locator('#framesWrap');

    this.cntAccess = page.locator('#cntAccess');
    this.cntHit = page.locator('#cntHit');
    this.cntPF = page.locator('#cntPF');

    this.tlbWrap = page.locator('#tlbWrap');
    this.log = page.locator('#log');

    this.runSeqBtn = page.locator('#runSeq');
    this.stepSeqBtn = page.locator('#stepSeq');
    this.clearLogBtn = page.locator('#clearLog');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait until the page has run the initial build() call and exposed state
    await this.page.waitForFunction(() => window.pagingState && typeof window.pagingState === 'function' && window.pagingState() !== null);
  }

  async build() {
    await this.buildBtn.click();
    // wait for a log entry indicating build (the app logs "Built: ...")
    await expect(this.log).toContainText('Built:', { timeout: 2000 });
  }

  async reset() {
    await this.resetBtn.click();
    // After reset the counters should reset to 0 and ptableWrap should be empty
    await expect(this.cntAccess).toHaveText('0');
    await expect(this.cntHit).toHaveText('0');
    await expect(this.cntPF).toHaveText('0');
  }

  async setNumFrames(n) {
    await this.numFrames.fill(String(n));
  }

  async setNumPages(n) {
    await this.numPages.fill(String(n));
  }

  async setPageSize(n) {
    await this.pageSize.fill(String(n));
  }

  async accessAddress(addr) {
    await this.accessAddr.fill(String(addr));
    await this.accessBtn.click();
  }

  async clickRandom() {
    await this.randBtn.click();
  }

  async generateSequence() {
    await this.seqBtn.click();
    await expect(this.log).toContainText('Generated sequence', { timeout: 2000 });
  }

  async stepSequence() {
    await this.stepSeqBtn.click();
  }

  async runSequenceToggle() {
    await this.runSeqBtn.click();
  }

  async clearLog() {
    await this.clearLogBtn.click();
  }

  async getLogText() {
    return this.log.innerText();
  }

  async getPTableRowCount() {
    // Count <tr> in table body
    const rows = await this.ptableWrap.locator('tbody tr').count();
    return rows;
  }

  async getFramesCount() {
    return await this.framesWrap.locator('.frame').count();
  }

  async getFramesText() {
    const count = await this.getFramesCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.framesWrap.locator('.frame').nth(i).innerText());
    }
    return texts;
  }

  async getTLBText() {
    return this.tlbWrap.innerText();
  }

  async getCounters() {
    return {
      access: Number((await this.cntAccess.innerText()) || '0'),
      hit: Number((await this.cntHit.innerText()) || '0'),
      pf: Number((await this.cntPF.innerText()) || '0'),
    };
  }

  async getRunButtonText() {
    return this.runSeqBtn.innerText();
  }

  // Access the internal JS state exposed by page
  async evaluateState() {
    return this.page.evaluate(() => {
      try {
        return window.pagingState() || null;
      } catch (e) {
        return null;
      }
    });
  }

  async getSeqAndIndex() {
    return this.page.evaluate(() => {
      return { seq: window.seq ? window.seq.slice(0) : [], seqIndex: typeof seqIndex !== 'undefined' ? seqIndex : null };
    });
  }
}

// Collect console errors and page errors for each test and assert there are none
test.describe('Paging Demo — Virtual Memory (d3d94521...)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async () => {
    // Nothing here; each test will assert console/page errors itself.
  });

  test.describe('Setup and Build', () => {
    test('initial load triggers build() and initializes configuration (S0_Idle -> S1_Configured)', async ({ page }) => {
      // This test validates initial entry action (build) on load and that the app is configured.
      const app = new PagingPage(page);
      await app.goto();

      // The initial build logs a "Built:" message and creates state
      const logText = await app.getLogText();
      expect(logText).toContain('Built:');

      // state should be non-null and have default properties
      const state = await app.evaluateState();
      expect(state).toBeTruthy();
      expect(state.numPages).toBeGreaterThanOrEqual(2);
      expect(state.numFrames).toBeGreaterThanOrEqual(1);

      // ptable should render rows equal to numPages
      const rows = await app.getPTableRowCount();
      expect(rows).toBe(state.numPages);

      // frames rendered count should equal configured frames
      const framesCount = await app.getFramesCount();
      expect(framesCount).toBe(state.numFrames);

      // No console or page errors during load/build
      expect(consoleErrors.length, 'No console.error on load').toBe(0);
      expect(pageErrors.length, 'No page error on load').toBe(0);
    });

    test('clicking Build with modified inputs updates configuration', async ({ page }) => {
      // Validate Build button transition S0 -> S1 and re-rendering
      const app = new PagingPage(page);
      await app.goto();

      // Modify configuration
      await app.setNumPages(8);
      await app.setPageSize(32);
      await app.setNumFrames(2);

      // Click build
      await app.build();

      // Check state updated
      const state = await app.evaluateState();
      expect(state.numPages).toBe(8);
      expect(state.pageSize).toBe(32);
      expect(state.numFrames).toBe(2);

      // Check UI reflect changes
      expect(await app.getPTableRowCount()).toBe(8);
      expect(await app.getFramesCount()).toBe(2);
      expect(await app.getLogText()).toContain('Built: 8 virtual pages');

      expect(consoleErrors.length, 'No console.error after Build').toBe(0);
      expect(pageErrors.length, 'No page error after Build').toBe(0);
    });
  });

  test.describe('Accessing Addresses (S2_Accessing)', () => {
    test('accessing a valid address causes page fault then load, counters update and TLB/ptable reflect mapping', async ({ page }) => {
      // This test validates Access transition and its effects on page table, frames and counters.
      const app = new PagingPage(page);
      await app.goto();

      // Ensure a known small configuration for deterministic checks
      await app.setNumPages(16);
      await app.setPageSize(64);
      await app.setNumFrames(4);
      await app.build();

      // Access address 0 should map to VPN 0 and cause a page fault (initially)
      await app.accessAddress(0);

      // Check that page fault counter incremented
      const counters = await app.getCounters();
      expect(counters.access).toBeGreaterThanOrEqual(1);
      expect(counters.pf).toBeGreaterThanOrEqual(1);

      // Check frames contain at least one loaded page and ptable has valid entry
      const framesText = await app.getFramesText();
      const anyLoaded = framesText.some(t => /Page \d+/.test(t));
      expect(anyLoaded).toBeTruthy();

      // TLB should include the loaded mapping (TLB enabled by default)
      const tlbText = await app.getTLBText();
      expect(tlbText.length).toBeGreaterThan(0);

      // Access same page again to test hits (TLB or ptable hit)
      const beforeHits = (await app.getCounters()).hit;
      await app.accessAddress(0);
      const afterHits = (await app.getCounters()).hit;
      expect(afterHits).toBeGreaterThanOrEqual(beforeHits + 1);

      expect(consoleErrors.length, 'No console.error during Access flows').toBe(0);
      expect(pageErrors.length, 'No page error during Access flows').toBe(0);
    });

    test('clicking Access with empty input triggers alert dialog (edge-case)', async ({ page }) => {
      // This test ensures the Access button shows an alert when input is empty
      const app = new PagingPage(page);
      await app.goto();

      // Ensure input empty
      await app.accessAddr.fill('');

      // Listen for dialogs
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        await dialog.accept();
      });

      // Click access
      await app.accessBtn.click();

      // A dialog should have appeared with a helpful message
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[0].message.toLowerCase()).toContain('enter an address');

      expect(consoleErrors.length, 'No console.error during empty-access alert').toBe(0);
      expect(pageErrors.length, 'No page error during empty-access alert').toBe(0);
    });

    test('accessing out-of-range address logs an out-of-range message', async ({ page }) => {
      // This test validates edge-case where address is beyond virtual space
      const app = new PagingPage(page);
      await app.goto();

      // Ensure known config
      await app.setNumPages(4);
      await app.setPageSize(16);
      await app.setNumFrames(2);
      await app.build();

      // compute out of range
      const state = await app.evaluateState();
      expect(state).toBeTruthy();
      const maxAddr = state.numPages * state.pageSize - 1;
      const out = maxAddr + 5;

      await app.accessAddress(out);

      const logText = await app.getLogText();
      expect(logText).toContain(`Address ${out} out of range`);

      expect(consoleErrors.length, 'No console.error during out-of-range access').toBe(0);
      expect(pageErrors.length, 'No page error during out-of-range access').toBe(0);
    });

    test('pressing Enter in access input triggers Access (EnterAccess event)', async ({ page }) => {
      // This test validates Enter key triggers the access button behavior
      const app = new PagingPage(page);
      await app.goto();

      await app.setNumPages(8);
      await app.setPageSize(32);
      await app.setNumFrames(2);
      await app.build();

      // Type an address and press Enter
      await app.accessAddr.fill('0');
      await app.accessAddr.press('Enter');

      // Expect the access to have been processed (access counter incremented)
      const counters = await app.getCounters();
      expect(counters.access).toBeGreaterThanOrEqual(1);

      expect(consoleErrors.length, 'No console.error on Enter access').toBe(0);
      expect(pageErrors.length, 'No page error on Enter access').toBe(0);
    });
  });

  test.describe('Sequence Generation and Running (S3_SequenceGenerated -> S4_SequenceRunning)', () => {
    test('generating a sequence populates seq and logs event (S3_SequenceGenerated)', async ({ page }) => {
      // Validate Seq (20) button behavior and that sequence is stored/visible in log
      const app = new PagingPage(page);
      await app.goto();

      await app.setNumPages(16);
      await app.setPageSize(64);
      await app.setNumFrames(4);
      await app.build();

      // Generate sequence
      await app.generateSequence();

      // seq should be set on the page (length 20)
      const seqInfo = await app.getSeqAndIndex();
      expect(Array.isArray(seqInfo.seq)).toBe(true);
      expect(seqInfo.seq.length).toBe(20);

      // Log contains sequence message
      const logText = await app.getLogText();
      expect(logText).toContain('Generated sequence (20)');

      expect(consoleErrors.length, 'No console.error during sequence generation').toBe(0);
      expect(pageErrors.length, 'No page error during sequence generation').toBe(0);
    });

    test('stepping through sequence processes one address and increments seqIndex (StepSequence)', async ({ page }) => {
      // Validate Step button consumes one sequence item and triggers access
      const app = new PagingPage(page);
      await app.goto();

      await app.setNumPages(16);
      await app.setPageSize(64);
      await app.setNumFrames(4);
      await app.build();

      await app.generateSequence();

      // capture seq info before
      const before = await app.getSeqAndIndex();
      expect(before.seq.length).toBe(20);

      await app.stepSequence();

      // small wait to allow processing/render
      await page.waitForTimeout(200);

      // seqIndex should have advanced by 1
      const after = await app.getSeqAndIndex();
      expect(after.seqIndex).toBeGreaterThanOrEqual((before.seqIndex || 0) + 1);

      expect(consoleErrors.length, 'No console.error during step sequence').toBe(0);
      expect(pageErrors.length, 'No page error during step sequence').toBe(0);
    });

    test('running sequence toggles auto-run (RunSequence) and can be stopped', async ({ page }) => {
      // Validate Run toggles to "Stop" and starts advancing seqIndex; then toggling stops it.
      const app = new PagingPage(page);
      await app.goto();

      await app.setNumPages(16);
      await app.setPageSize(64);
      await app.setNumFrames(4);
      await app.build();

      await app.generateSequence();

      const before = await app.getSeqAndIndex();

      // Start auto-run
      await app.runSequenceToggle();
      // Button text should change to Stop
      await expect(app.runSeqBtn).toHaveText('Stop', { timeout: 1000 });

      // wait a short while to let a couple of iterations run
      await page.waitForTimeout(1000);

      // Stop auto-run
      await app.runSequenceToggle();
      // Button text returns to original
      await expect(app.runSeqBtn).toHaveText('Run sequence (auto)', { timeout: 1000 });

      const after = await app.getSeqAndIndex();
      // seqIndex should have advanced (at least 1)
      expect(after.seqIndex).toBeGreaterThanOrEqual((before.seqIndex || 0) + 1);

      expect(consoleErrors.length, 'No console.error during run sequence toggle').toBe(0);
      expect(pageErrors.length, 'No page error during run sequence toggle').toBe(0);
    });

    test('clear log while running clears the UI log but does not crash (ClearLog during S4)', async ({ page }) => {
      // Validate Clear Log works while sequence running
      const app = new PagingPage(page);
      await app.goto();

      await app.setNumPages(16);
      await app.setPageSize(64);
      await app.setNumFrames(4);
      await app.build();

      await app.generateSequence();

      // Start auto-run
      await app.runSequenceToggle();
      await expect(app.runSeqBtn).toHaveText('Stop', { timeout: 1000 });

      // Wait a bit, then clear log while running
      await page.waitForTimeout(500);
      await app.clearLog();

      // The log should be empty (no content)
      const logText = await app.getLogText();
      // innerText may be empty string; ensure it's empty or only whitespace
      expect(logText.trim().length).toBeLessThanOrEqual(0);

      // Stop the run to clean up
      await app.runSequenceToggle();
      await expect(app.runSeqBtn).toHaveText('Run sequence (auto)', { timeout: 1000 });

      expect(consoleErrors.length, 'No console.error during clear log while running').toBe(0);
      expect(pageErrors.length, 'No page error during clear log while running').toBe(0);
    });
  });

  test.describe('Reset and UI cleanup', () => {
    test('Reset button clears state, UI and logs (Reset transition)', async ({ page }) => {
      // Validate Reset behavior and S1->S1 Reset transition
      const app = new PagingPage(page);
      await app.goto();

      // Make some accesses to create non-empty state and logs
      await app.accessAddress(0);
      await app.accessAddress(64);

      // Reset
      await app.reset();

      // After reset, internal state should be null (window.pagingState returns null)
      const state = await app.evaluateState();
      expect(state).toBeNull();

      // UI elements should be cleared
      const ptableHtml = await app.ptableWrap.innerHTML();
      expect(ptableHtml.trim()).toBe('');

      // Log should be empty
      const logText = await app.getLogText();
      expect(logText.trim()).toBe('');

      expect(consoleErrors.length, 'No console.error after Reset').toBe(0);
      expect(pageErrors.length, 'No page error after Reset').toBe(0);
    });
  });

  test.describe('Additional edge cases and invariants', () => {
    test('Random address button generates and accesses an address (Random event)', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      await app.setNumPages(8);
      await app.setPageSize(32);
      await app.setNumFrames(2);
      await app.build();

      const before = await app.getCounters();
      await app.clickRandom();

      // small wait for processing
      await page.waitForTimeout(200);

      const after = await app.getCounters();
      // accessCounter should have increased
      expect(after.access).toBeGreaterThanOrEqual(before.access + 1);

      expect(consoleErrors.length, 'No console.error during Random').toBe(0);
      expect(pageErrors.length, 'No page error during Random').toBe(0);
    });

    test('TLB enabled/disabled toggles display and behavior does not crash', async ({ page }) => {
      const app = new PagingPage(page);
      await app.goto();

      // Ensure TLB enabled (default)
      const stateBefore = await app.evaluateState();
      if (stateBefore) {
        expect(stateBefore.tlbEnabled).toBeTruthy();
      }

      // Access to populate TLB
      await app.accessAddress(0);

      const tlbTextBefore = await app.getTLBText();
      expect(tlbTextBefore.length).toBeGreaterThan(0);

      // Now disable TLB via select and rebuild
      await app.tlbEnable.selectOption('false');
      await app.build();

      const stateAfter = await app.evaluateState();
      expect(stateAfter.tlbEnabled).toBe(false);

      // TLB UI should show disabled message
      const tlbTextAfter = await app.getTLBText();
      expect(tlbTextAfter.toLowerCase()).toContain('tlb disabled');

      expect(consoleErrors.length, 'No console.error toggling TLB').toBe(0);
      expect(pageErrors.length, 'No page error toggling TLB').toBe(0);
    });
  });
});