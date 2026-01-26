import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ebf54-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Virtual Memory Simulation app.
 * Encapsulates common interactions and observations for tests.
 */
class VirtualMemoryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages for assertions
    this.page.on('console', (msg) => {
      // Collect console messages (text)
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading console message fails for any reason, still capture the raw object
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });

    // Convenience locators
    this.loadButton = () => this.page.locator('button[onclick="loadProcess()"]');
    this.physicalSlots = () => this.page.locator('#memory .memory-slot');
    this.virtualSlots = () => this.page.locator('#virtualMemory .memory-slot');
    this.physicalDiv = () => this.page.locator('#memory');
    this.virtualDiv = () => this.page.locator('#virtualMemory');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Load Process" button once
  async clickLoad() {
    await this.loadButton().click();
  }

  // Click the "Load Process" button N times sequentially
  async clickLoadTimes(n) {
    for (let i = 0; i < n; i++) {
      // Each click triggers synchronous DOM updates; await for button to be enabled
      await this.loadButton().click();
    }
  }

  // Get texts of physical memory slots in DOM order
  async getPhysicalSlotTexts() {
    const count = await this.physicalSlots().count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.physicalSlots().nth(i).innerText()).trim());
    }
    return texts;
  }

  // Get texts of virtual memory slots in DOM order
  async getVirtualSlotTexts() {
    const count = await this.virtualSlots().count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.virtualSlots().nth(i).innerText()).trim());
    }
    return texts;
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages.map(m => m.text);
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Clear captured console and page errors (useful between phases)
  clearCaptured() {
    this.consoleMessages = [];
    this.pageErrors = [];
  }
}

test.describe('Virtual Memory Simulation - FSM behavior', () => {
  // Ensure a fresh page object per test
  test.beforeEach(async ({ page }) => {
    // Nothing here; each test constructs its own VirtualMemoryPage
  });

  // Test initial Idle state rendering and components
  test('Initial state (S0_Idle): page renders Load Process button and empty memory displays', async ({ page }) => {
    const vm = new VirtualMemoryPage(page);
    await vm.goto();

    // The Load Process button must be visible in Idle state (evidence in FSM)
    await expect(vm.loadButton()).toBeVisible();

    // Physical and virtual memory containers should be present
    await expect(vm.physicalDiv()).toBeVisible();
    await expect(vm.virtualDiv()).toBeVisible();

    // Initially no memory slots should be rendered
    await expect(vm.physicalSlots()).toHaveCount(0);
    await expect(vm.virtualSlots()).toHaveCount(0);

    // Assert there were no uncaught page errors on initial render
    expect(vm.getPageErrors().length).toBe(0);
  });

  test.describe('Loading processes and transitions', () => {
    test('Load one process: transitions to Process Loaded (S1_ProcessLoaded) and updates DOM', async ({ page }) => {
      // This test validates transition S0 -> S1 on first click
      const vm = new VirtualMemoryPage(page);
      await vm.goto();

      // Click Load Process once
      await vm.clickLoad();

      // Virtual memory should show "Process 1"
      await expect(vm.virtualSlots()).toHaveCount(1);
      const vTexts = await vm.getVirtualSlotTexts();
      expect(vTexts[0]).toBe('Process 1');

      // Physical memory should also show "Process 1" because physicalMemory has free slots
      await expect(vm.physicalSlots()).toHaveCount(1);
      const pTexts = await vm.getPhysicalSlotTexts();
      expect(pTexts[0]).toBe('Process 1');

      // Check console logs do not contain errors and no page errors occurred
      const consoles = vm.getConsoleMessages();
      // Should not have 'Physical Memory Full' or 'Virtual Memory Full' yet
      expect(consoles.some(c => c.includes('Physical Memory Full'))).toBe(false);
      expect(consoles.some(c => c.includes('Virtual Memory Full'))).toBe(false);
      expect(vm.getPageErrors().length).toBe(0);
    });

    test('Fill physical memory then trigger swapMemory (S2_PhysicalMemoryFull): verify swapping log and slot order', async ({ page }) => {
      // This test validates S1 -> S2 transition when physical memory is full
      const vm = new VirtualMemoryPage(page);
      await vm.goto();

      // physicalMemorySize is 4; load 5 processes to force swapping on the 5th load
      await vm.clickLoadTimes(5);

      // Virtual memory should have 5 processes (Process 1..5)
      await expect(vm.virtualSlots()).toHaveCount(5);
      const vTexts = await vm.getVirtualSlotTexts();
      expect(vTexts[0]).toBe('Process 1');
      expect(vTexts[4]).toBe('Process 5');

      // Physical memory should always display 4 slots (physicalMemorySize)
      await expect(vm.physicalSlots()).toHaveCount(4);

      // After swapping on the 5th load, the oldest (Process 1) was shifted then pushed
      // Resulting order in physical memory should be: Process 2, Process 3, Process 4, Process 1
      const pTexts = await vm.getPhysicalSlotTexts();
      expect(pTexts).toEqual(['Process 2', 'Process 3', 'Process 4', 'Process 1']);

      // Inspect console messages for the specific swapping-related logs
      const consoles = vm.getConsoleMessages();
      // Expect to see "Physical Memory Full! Swapping needed." when swapping occurred
      expect(consoles.some(c => c.includes('Physical Memory Full! Swapping needed.'))).toBe(true);

      // Also expect a swapped log containing "Process 1 swapped to virtual memory."
      expect(consoles.some(c => c.includes('Process 1 swapped to virtual memory.'))).toBe(true);

      // Ensure no runtime page errors were thrown
      expect(vm.getPageErrors().length).toBe(0);
    });

    test('Fill virtual memory and assert Virtual Memory Full behavior (S3_VirtualMemoryFull)', async ({ page }) => {
      // This test validates the S1 -> S3 scenario when virtual memory is full
      const vm = new VirtualMemoryPage(page);
      await vm.goto();

      // virtualMemorySize is 10; click 11 times. The 11th should trigger the virtual memory full log and not add a new process
      await vm.clickLoadTimes(11);

      // Virtual memory should have at most 10 entries (virtualMemorySize)
      await expect(vm.virtualSlots()).toHaveCount(10);
      const vTexts = await vm.getVirtualSlotTexts();
      expect(vTexts[0]).toBe('Process 1');
      expect(vTexts[9]).toBe('Process 10');

      // The console should contain 'Virtual Memory Full! Cannot load more processes.' from the 11th attempt
      const consoles = vm.getConsoleMessages();
      expect(consoles.some(c => c.includes('Virtual Memory Full! Cannot load more processes.'))).toBe(true);

      // Ensure no page errors occurred during this stress scenario
      expect(vm.getPageErrors().length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Repeated swapping maintains physical memory size and logs appropriately', async ({ page }) => {
      // Ensure repeated loads beyond physical memory repeatedly trigger swapping behavior
      const vm = new VirtualMemoryPage(page);
      await vm.goto();

      // Load 9 processes to perform multiple swaps (physicalMemorySize = 4)
      await vm.clickLoadTimes(9);

      // Virtual memory should have 9 processes
      await expect(vm.virtualSlots()).toHaveCount(9);

      // Physical memory should remain at 4 entries
      await expect(vm.physicalSlots()).toHaveCount(4);

      // Check that multiple 'Physical Memory Full' messages appeared in console (at least once)
      const consoles = vm.getConsoleMessages();
      const physicalFullCount = consoles.filter(c => c.includes('Physical Memory Full! Swapping needed.')).length;
      expect(physicalFullCount).toBeGreaterThanOrEqual(1);

      // Verify that swapped logs reference earlier processes (e.g., "Process 1 swapped ..." at least once)
      expect(consoles.some(c => /swapped to virtual memory\./.test(c))).toBe(true);

      // No uncaught page errors
      expect(vm.getPageErrors().length).toBe(0);
    });

    test('No unexpected runtime errors on load interactions (ReferenceError/TypeError/SyntaxError check)', async ({ page }) => {
      // This test explicitly checks for unexpected runtime errors while exercising the UI
      const vm = new VirtualMemoryPage(page);
      await vm.goto();

      // Perform various interactions
      await vm.clickLoadTimes(3); // normal loads
      await vm.clickLoadTimes(2); // further loads, maybe causing swap later

      // Collect page errors captured during interactions
      const errors = vm.getPageErrors();

      // We expect the provided implementation to run without uncaught exceptions.
      // If there were ReferenceError / TypeError / SyntaxError, they would be captured in pageErrors.
      // Assert there are no uncaught page errors.
      expect(errors.length).toBe(0);

      // As a secondary check, ensure console does not contain 'Uncaught' style error messages
      const consoles = vm.getConsoleMessages();
      expect(consoles.some(c => /Uncaught|Error|Exception/.test(c))).toBe(false);
    });
  });
});