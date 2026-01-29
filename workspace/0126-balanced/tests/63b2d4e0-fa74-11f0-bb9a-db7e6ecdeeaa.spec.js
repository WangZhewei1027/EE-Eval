import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2d4e0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Increase default timeout because some interactions intentionally wait (swap animation delays)
test.setTimeout(120000);

class VirtualMemoryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageInput = '#page-input';
    this.accessBtn = '#access-btn';
    this.message = '#message';
    this.physicalGrid = '#physical-memory';
    this.virtualGrid = '#virtual-memory';
    this.swapGrid = '#swap-space';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for basic elements to be present
    await Promise.all([
      this.page.waitForSelector(this.pageInput),
      this.page.waitForSelector(this.accessBtn),
      this.page.waitForSelector(this.message)
    ]);
  }

  async setPageNumber(n) {
    await this.page.fill(this.pageInput, String(n));
  }

  async clickAccess() {
    await this.page.click(this.accessBtn);
  }

  async accessPage(n) {
    await this.setPageNumber(n);
    await this.clickAccess();
  }

  async pressEnterInInput(n) {
    await this.setPageNumber(n);
    await this.page.press(this.pageInput, 'Enter');
  }

  async getMessageText() {
    return this.page.locator(this.message).innerText();
  }

  async getMessageClass() {
    return this.page.locator(this.message).getAttribute('class');
  }

  async physicalCellCount() {
    return this.page.locator(`${this.physicalGrid} .memory-cell`).count();
  }

  async virtualCellCount() {
    return this.page.locator(`${this.virtualGrid} .memory-cell`).count();
  }

  async swapCellCount() {
    return this.page.locator(`${this.swapGrid} .memory-cell`).count();
  }

  async getPhysicalCellText(index) {
    const cell = this.page.locator(`${this.physicalGrid} .memory-cell`).nth(index);
    return cell.innerText();
  }

  async getSwapCellText(index) {
    const cell1 = this.page.locator(`${this.swapGrid} .memory-cell1`).nth(index);
    return cell.innerText();
  }

  async isPhysicalCellUsed(index) {
    const cell2 = this.page.locator(`${this.physicalGrid} .memory-cell2`).nth(index);
    return cell.getAttribute('class').then(c => c.includes('used'));
  }

  async isVirtualCellHighlighted(index) {
    const cell3 = this.page.locator(`${this.virtualGrid} .memory-cell3`).nth(index);
    return cell.getAttribute('class').then(c => c.includes('highlighted'));
  }

  async isPhysicalCellHighlighted(index) {
    const cell4 = this.page.locator(`${this.physicalGrid} .memory-cell4`).nth(index);
    return cell.getAttribute('class').then(c => c.includes('highlighted'));
  }

  async waitForMessageContains(substr, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel).textContent.includes(s),
      this.message,
      substr,
      { timeout }
    );
  }

  // Wait small delay to let DOM updates happen (used when messages update synchronously)
  async shortWait() {
    await this.page.waitForTimeout(50);
  }
}

test.describe('Virtual Memory Demonstration - FSM and UI tests', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors occurred during test runs
    expect(pageErrors.length).toBe(0);
    // Also assert there were no console error messages (developer errors)
    expect(consoleErrors.length).toBe(0);
  });

  test('Idle state: initial render and message (S0_Idle)', async ({ page }) => {
    // This test validates the Idle state: initial DOM renders and entry message
    const vm = new VirtualMemoryPage(page);
    await vm.goto();

    // Verify message instructing user is shown
    const msgText = await vm.getMessageText();
    expect(msgText).toContain('Access virtual page 0 using the input above.');

    // Verify grids have expected number of cells (physical: 8, virtual: 16, swap: 16)
    expect(await vm.physicalCellCount()).toBe(8);
    expect(await vm.virtualCellCount()).toBe(16);
    expect(await vm.swapCellCount()).toBe(16);

    // Verify that no frames are used initially (physical cells have empty text)
    for (let i = 0; i < 8; i++) {
      const txt = await vm.getPhysicalCellText(i);
      expect(txt.trim()).toBe('');
      const isUsed = await vm.isPhysicalCellUsed(i);
      expect(isUsed).toBe(false);
    }
  });

  test('Access a page loads it into physical memory (S0 -> S2) and highlights (Load Page)', async ({ page }) => {
    // Validate that accessing a virtual page loads it into a free physical frame
    const vm1 = new VirtualMemoryPage(page);
    await vm.goto();

    // Access virtual page 3
    await vm.accessPage(3);

    // After action, the app should show a "Loaded virtual page 3 into physical frame X." message
    await vm.waitForMessageContains('Loaded virtual page 3 into physical frame', 3000);
    const msg = await vm.getMessageText();
    expect(msg).toMatch(/Loaded virtual page 3 into physical frame \d+\./);

    // Verify that some physical frame contains '3' and that it is marked used/highlighted
    let found = false;
    for (let i = 0; i < 8; i++) {
      const txt1 = (await vm.getPhysicalCellText(i)).trim();
      if (txt === '3') {
        found = true;
        const isUsed1 = await vm.isPhysicalCellUsed(i);
        expect(isUsed).toBe(true);
        const highlighted = await vm.isPhysicalCellHighlighted(i);
        expect(highlighted).toBe(true);
      }
    }
    expect(found).toBe(true);

    // Accessing the same page again should produce an informative message "already in physical memory"
    await vm.accessPage(3);
    await vm.waitForMessageContains('already in physical memory', 2000);
    const repeatMsg = await vm.getMessageText();
    expect(repeatMsg).toContain('already in physical memory');
  });

  test('Page fault + swap scenario when no free frames (S0 -> S1 -> S2 with swap delay)', async ({ page }) => {
    // This test triggers a page fault which requires a swap out because physical memory is full:
    // 1) Fill physical memory (pages 0..7)
    // 2) Access page 8 - causes swap out of FIFO victim and schedules load after timeout
    // We assert that the page fault message is displayed immediately and the loaded message appears after timeout.
    const vm2 = new VirtualMemoryPage(page);
    await vm.goto();

    // Fill physical memory with pages 0..7
    for (let p = 0; p <= 7; p++) {
      await vm.accessPage(p);
      // Each load is synchronous; small wait to stabilize DOM
      await vm.shortWait();
      await vm.waitForMessageContains(`Loaded virtual page ${p} into physical frame`, 1000);
    }

    // Now physical memory is full. Access page 8 - should cause a page fault and initiate swap out.
    await vm.setPageNumber(8);
    // Click access
    await vm.clickAccess();

    // Immediately after click, because freeFrame === -1, accessVirtualPage sets "Page fault!" message
    // The subsequent swap/loaded messages are scheduled with a timeout.
    await vm.waitForMessageContains('Page fault! Virtual page 8 is not in physical memory.', 1000);
    const immediateMsg = await vm.getMessageText();
    expect(immediateMsg).toContain('Page fault! Virtual page 8 is not in physical memory.');

    // Wait for the scheduled swap+load to complete (~1300ms in app). Give some buffer.
    await page.waitForTimeout(1500);

    // Now the loaded message should be present
    await vm.waitForMessageContains('Loaded virtual page 8 into physical frame', 2000);
    const finalMsg = await vm.getMessageText();
    expect(finalMsg).toMatch(/Loaded virtual page 8 into physical frame \d+\./);

    // Verify that virtual page 8 is highlighted in virtual and its corresponding physical frame is highlighted
    // Find the physical frame that contains '8'
    let physIndex = -1;
    for (let i = 0; i < 8; i++) {
      const txt2 = (await vm.getPhysicalCellText(i)).trim();
      if (txt === '8') {
        physIndex = i;
        break;
      }
    }
    expect(physIndex).toBeGreaterThanOrEqual(0);
    const physHighlighted = await vm.isPhysicalCellHighlighted(physIndex);
    expect(physHighlighted).toBe(true);
  });

  test('Swap space becomes full and simulation halts with appropriate error (S3_SwapOut)', async ({ page }) => {
    // This test intentionally drives the simulation until swap space is full, then triggers the SwapOut error state:
    // Steps:
    // 1) Load pages 0..7 into physical memory (fills RAM)
    // 2) Access pages 8..15 sequentially => this will perform 8 swaps (each schedules a timeout)
    // 3) Access pages 0..7 sequentially => this will perform 8 more swaps, after which swapSpace will be full
    // 4) Attempt to access ANY page not in physical memory (e.g., pick a page currently in swap) -> swapOutPage will fail and message should indicate swap space is full.
    //
    // Note: Because each swap that moves a victim to swap schedules a 1300ms timeout before final load,
    // we wait after each access to let the system stabilize. This ensures we don't create race conditions.

    const vm3 = new VirtualMemoryPage(page);
    await vm.goto();

    // Step 1: load pages 0..7
    for (let p = 0; p <= 7; p++) {
      await vm.accessPage(p);
      await vm.waitForMessageContains(`Loaded virtual page ${p} into physical frame`, 1000);
      // small delay to be safe
      await page.waitForTimeout(50);
    }

    // Step 2: access pages 8..15 (8 accesses), each will cause a swap and delayed load
    for (let p = 8; p <= 15; p++) {
      await vm.accessPage(p);
      // Immediately should show "Page fault!"
      await vm.waitForMessageContains(`Page fault! Virtual page ${p} is not in physical memory.`, 1000);
      // Wait for scheduled swap+load to finish (~1300ms)
      await page.waitForTimeout(1500);
      await vm.waitForMessageContains(`Loaded virtual page ${p} into physical frame`, 2000);
      // short stabilization
      await page.waitForTimeout(50);
    }

    // At this point swapSpace should have 8 entries used (the swapped out pages 0..7); physical memory contains 8..15
    // Step 3: access pages 0..7 again, which are in swap; each access will cause another swap and delayed load, consuming remaining swap frames
    for (let p = 0; p <= 7; p++) {
      await vm.accessPage(p);
      // Immediate page fault
      await vm.waitForMessageContains(`Page fault! Virtual page ${p} is not in physical memory.`, 1000);
      // Wait for scheduled load to complete and occupy swap frames
      await page.waitForTimeout(1500);
      await vm.waitForMessageContains(`Loaded virtual page ${p} into physical frame`, 2000);
      // short stabilization
      await page.waitForTimeout(50);
    }

    // After the above, swapSpace should now be full (16 entries used) because we've performed 16 swaps total.
    // Step 4: Attempt to access a page not currently in physical memory to force swapOutPage() to return -1.
    // Find a page that is currently NOT in physical memory. We'll inspect physical cells to collect loaded pages.
    const physLoaded = [];
    for (let i = 0; i < 8; i++) {
      const txt3 = (await vm.getPhysicalCellText(i)).trim();
      if (txt !== '') physLoaded.push(Number(txt));
    }

    // Choose a page that is NOT in physical memory; since swap is full, many pages are in swap. Find such a page from 0..15
    let pageNotInPhys = -1;
    for (let p = 0; p < 16; p++) {
      if (!physLoaded.includes(p)) {
        pageNotInPhys = p;
        break;
      }
    }
    expect(pageNotInPhys).toBeGreaterThanOrEqual(0);

    // Trigger access which should now fail because swap space is full and no page can be swapped out.
    await vm.accessPage(pageNotInPhys);

    // The application sets the error message synchronously when swapOutPage returns -1.
    await vm.waitForMessageContains('Swap space is full! Cannot swap out any page. Simulation halted.', 2000);
    const errMsg = await vm.getMessageText();
    expect(errMsg).toContain('Swap space is full! Cannot swap out any page. Simulation halted.');

    // Message element should have error class for styling
    const cls = await vm.getMessageClass();
    expect(cls).toContain('error');
  });

  test('Edge cases: out-of-bounds page number and Enter-key event (Enter triggers AccessPage)', async ({ page }) => {
    // Validate error behavior when entering invalid page numbers and that Enter key triggers the access event.
    const vm4 = new VirtualMemoryPage(page);
    await vm.goto();

    // Enter an out-of-bounds page number (e.g., 99)
    await vm.accessPage(99);
    await vm.waitForMessageContains('Error: Page number 99 is out of bounds.', 2000);
    let errMsg1 = await vm.getMessageText();
    expect(errMsg).toContain('Error: Page number 99 is out of bounds.');
    // Should be styled as error
    let cls1 = await vm.getMessageClass();
    expect(cls).toContain('error');

    // Now test pressing Enter in the input triggers the same AccessPage behavior.
    // Use a valid page number 5
    await vm.pressEnterInInput(5);
    // Should result in loaded message
    await vm.waitForMessageContains('Loaded virtual page 5 into physical frame', 3000);
    const loadedMsg = await vm.getMessageText();
    expect(loadedMsg).toMatch(/Loaded virtual page 5 into physical frame \d+\./);
  });
});