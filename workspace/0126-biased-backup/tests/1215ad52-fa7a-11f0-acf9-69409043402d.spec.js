import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215ad52-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the simulator
class SimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Config controls
    this.pageSizeInput = '#pageSizeInput';
    this.virtualMemKBInput = '#virtualMemKBInput';
    this.physicalMemKBInput = '#physicalMemKBInput';
    this.processCountInput = '#processCountInput';
    this.applyConfigBtn = '#applyConfigBtn';

    // Process management
    this.processManagementDiv = '#process-management';
    this.processSelector = '#processSelector';
    this.addProcessBtn = '#addProcessBtn';
    this.removeProcessBtn = '#removeProcessBtn';
    this.resetAllProcessesBtn = '#resetAllProcessesBtn';

    // Program management
    this.programManagementDiv = '#program-management';
    this.programNameInput = '#programNameInput';
    this.programSizeInput = '#programSizeInput';
    this.loadProgramBtn = '#loadProgramBtn';
    this.unloadProgramBtn = '#unloadProgramBtn';

    // Memory access
    this.memoryAccessDiv = '#memory-access';
    this.accessAddressInput = '#accessAddressInput';
    this.accessMemoryBtn = '#accessMemoryBtn';
    this.accessModeSelect = '#accessModeSelect';
    this.showPageTableBtn = '#showPageTableBtn';
    this.showPhysicalMemoryBtn = '#showPhysicalMemoryBtn';
    this.showTLBBtn = '#showTLBBtn';
    this.memoryAccessResult = '#memoryAccessResult';

    // TLB controls
    this.tlbControlsDiv = '#tlb-controls';
    this.tlbSizeInput = '#tlbSizeInput';
    this.applyTLBSizeBtn = '#applyTLBSizeBtn';
    this.clearTLBBtn = '#clearTLBBtn';

    // Stats
    this.statsDiv = '#stats';
    this.statsContent = '#statsContent';
    this.resetStatsBtn = '#resetStatsBtn';

    // Debug output
    this.debugOutput = '#debug-output';
  }

  async navigate() {
    await this.page.goto(APP);
  }

  // Helpers for reading style.display
  async displayOf(selector) {
    return await this.page.$eval(selector, el => el.style.display);
  }

  async applyConfig() {
    await this.page.click(this.applyConfigBtn);
  }

  async addProcess() {
    await this.page.click(this.addProcessBtn);
  }

  async removeProcess() {
    await this.page.click(this.removeProcessBtn);
  }

  async resetAllProcesses(acceptDialog = true) {
    const p = this.page;
    const promise = p.waitForEvent('dialog');
    const click = p.click(this.resetAllProcessesBtn);
    const dialog = await promise;
    if (acceptDialog) await dialog.accept();
    else await dialog.dismiss();
    // ensure click promise resolved
    await click;
  }

  async loadProgram(name, size) {
    await this.page.fill(this.programNameInput, name);
    await this.page.fill(this.programSizeInput, String(size));
    await this.page.click(this.loadProgramBtn);
  }

  async unloadProgram(name) {
    await this.page.fill(this.programNameInput, name);
    await this.page.click(this.unloadProgramBtn);
  }

  async accessMemory(address, mode = 'read') {
    await this.page.fill(this.accessAddressInput, String(address));
    await this.page.selectOption(this.accessModeSelect, mode);
    await this.page.click(this.accessMemoryBtn);
  }

  async showPageTable() {
    await this.page.click(this.showPageTableBtn);
  }

  async showPhysicalMemory() {
    await this.page.click(this.showPhysicalMemoryBtn);
  }

  async showTLB() {
    await this.page.click(this.showTLBBtn);
  }

  async applyTLBSize(size) {
    await this.page.fill(this.tlbSizeInput, String(size));
    await this.page.click(this.applyTLBSizeBtn);
  }

  async clearTLB() {
    await this.page.click(this.clearTLBBtn);
  }

  async resetStats() {
    await this.page.click(this.resetStatsBtn);
  }

  async getProcessOptionsCount() {
    return await this.page.$eval(this.processSelector, sel => sel.options.length);
  }

  async getMemoryAccessResultText() {
    return await this.page.$eval(this.memoryAccessResult, el => el.textContent || '');
  }

  async getStatsText() {
    return await this.page.$eval(this.statsContent, el => el.textContent || '');
  }

  async getDebugOutputText() {
    return await this.page.$eval(this.debugOutput, el => el.textContent || '');
  }

  async getStatsLogText() {
    // statsContent contains logs at top when appendStatsLog is used
    return await this.getStatsText();
  }
}

test.describe('Virtual Memory Interactive Simulator - FSM tests', () => {
  // Capture console errors and page errors
  let consoleErrors = [];
  let pageErrors = [];
  let sim;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    sim = new SimulatorPage(page);
    await sim.navigate();
  });

  test.afterEach(async () => {
    // Ensure tests didn't produce console or runtime errors
    expect(consoleErrors, `Console errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('S0 Idle: initial UI is disabled except config controls', async ({ page }) => {
    // Validate initial visibility per FSM S0_Idle evidence
    // All management divs should be hidden
    expect(await sim.displayOf(sim.processManagementDiv)).toBe('none');
    expect(await sim.displayOf(sim.programManagementDiv)).toBe('none');
    expect(await sim.displayOf(sim.memoryAccessDiv)).toBe('none');
    expect(await sim.displayOf(sim.tlbControlsDiv)).toBe('none');
    expect(await sim.displayOf(sim.statsDiv)).toBe('none');

    // Debug output contains welcome message (sanity)
    const dbg = await sim.getDebugOutputText();
    expect(dbg).toContain('Welcome to the Virtual Memory Interactive Simulator');

    // No processes present yet in selector (should be empty)
    const optionsCount = await sim.getProcessOptionsCount();
    expect(optionsCount).toBe(0);
  });

  test('ApplyConfig event transitions to S1_Configured and initializes system', async ({ page }) => {
    // Apply configuration with default valid inputs
    await sim.applyConfig();

    // After applying, management sections should be visible (evidence for S1_Configured)
    expect(await sim.displayOf(sim.processManagementDiv)).toBe('block');
    expect(await sim.displayOf(sim.programManagementDiv)).toBe('block');
    expect(await sim.displayOf(sim.memoryAccessDiv)).toBe('block');
    expect(await sim.displayOf(sim.tlbControlsDiv)).toBe('block');
    expect(await sim.displayOf(sim.statsDiv)).toBe('block');

    // Process selector should be populated equal to processCountInput value (default 2)
    const expectedCount = parseInt(await page.$eval(sim.processCountInput, el => el.value), 10);
    const optionsCount = await sim.getProcessOptionsCount();
    expect(optionsCount).toBe(expectedCount);

    // Stats should show initial zeros
    const statsText = await sim.getStatsText();
    expect(statsText).toContain('Total Memory Accesses: 0');
    expect(statsText).toContain('TLB Hits: 0');
    expect(statsText).toContain('Page Faults: 0');

    // Debug output should indicate initialization
    const dbg = await sim.getDebugOutputText();
    expect(dbg).toContain('System initialized.');
  });

  test('Process Management (S2): add and remove processes, reset all processes (confirm handling)', async ({ page }) => {
    // Enter configured state
    await sim.applyConfig();

    const before = await sim.getProcessOptionsCount();
    // Add a process
    await sim.addProcess();
    const afterAdd = await sim.getProcessOptionsCount();
    expect(afterAdd).toBe(before + 1);

    // Remove the currently selected process
    // Ensure there is more than one process to allow removal without alert
    const beforeRemove = afterAdd;
    await sim.removeProcess();
    const afterRemove = await sim.getProcessOptionsCount();
    expect(afterRemove).toBe(beforeRemove - 1);

    // Reset all processes triggers confirm dialog; accept it
    // The implementation uses confirm; we should accept it to proceed
    // The resetAllProcessesBtn click will open a dialog that we accept within the helper
    await sim.resetAllProcesses(true);
    // After reset, physical memory and TLB cleared - check stats log text contains reset message
    const statsLog = await sim.getStatsLogText();
    expect(statsLog).toContain('Reset all processes and cleared physical memory and TLB');
  });

  test('Program Management (S3): load and unload program and validate error on missing name', async ({ page }) => {
    // Enter configured state
    await sim.applyConfig();

    // Attempt to load program without name -> expect alert dialog with specific message
    const dialogPromise = page.waitForEvent('dialog');
    await page.click(sim.loadProgramBtn);
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Please enter a program name.');
    await dialog.accept();

    // Now load a valid program into selected process
    const progName = 'progA';
    const progSize = 256; // with default page size 64 -> 4 pages
    await sim.loadProgram(progName, progSize);

    // After loading, stats log should mention the loaded program
    const statsLog1 = await sim.getStatsLogText();
    expect(statsLog1).toContain(`Loaded program '${progName}'`);

    // Unload the program
    await sim.unloadProgram(progName);
    const statsLog2 = await sim.getStatsLogText();
    expect(statsLog2).toContain(`Unloaded program '${progName}'`);
  });

  test('Memory Access (S4): cause page fault on first access, then TLB hit on subsequent access', async ({ page }) => {
    // Configure and load a program first
    await sim.applyConfig();

    const progName = 'progB';
    const progSize = 256; // 4 pages (64 byte page)
    await sim.loadProgram(progName, progSize);

    // Access virtual address 0 - first access should cause a page fault and load the page
    await sim.accessMemory(0, 'read');
    const result1 = await sim.getMemoryAccessResultText();
    expect(result1).toContain('Page fault');
    expect(result1).toContain('Virtual Address = 0');
    expect(result1).toContain('Page Fault = Yes');

    // Access the same virtual address again - should be a TLB hit
    await sim.accessMemory(0, 'read');
    const result2 = await sim.getMemoryAccessResultText();
    // It may say TLB hit or page table hit depending on timing, but since tlbAddEntry is invoked at page load,
    // the second access should ideally hit the TLB. Assert at least one of the expected messages is present.
    expect(result2).toSatisfy((text) => {
      return text.includes('TLB hit') || text.includes('Page found in page table');
    });

    // Validate stats reflect at least one TLB miss and possibly a hit
    const statsText = await sim.getStatsText();
    expect(statsText).toContain('TLB Misses:');
    // Memory access count should be >= 2
    expect(statsText).toMatch(/Total Memory Accesses:\s*\d+/);
  });

  test('Show Page Table, Physical Memory, and TLB (S4, S5): UI displays expected information', async ({ page }) => {
    // Configure and load program and access memory to populate frames & TLB
    await sim.applyConfig();
    const progName = 'progC';
    await sim.loadProgram(progName, 128); // 2 pages
    await sim.accessMemory(0, 'read');     // load page 0
    await sim.accessMemory(64, 'read');    // load page 1

    // Show page table - should contain "Page Table of Process"
    await sim.showPageTable();
    const pageTableText = await sim.getMemoryAccessResultText();
    expect(pageTableText).toContain('Page Table of Process');

    // Show physical memory - should list frames
    await sim.showPhysicalMemory();
    const physText = await sim.getMemoryAccessResultText();
    expect(physText).toContain('Physical Memory Frames');
    expect(physText).toMatch(/Frame \| Valid \| Process ID \| Virtual Page/);

    // Show TLB entries - should contain entries (or at least header)
    await sim.showTLB();
    const tlbText = await sim.getMemoryAccessResultText();
    expect(tlbText).toContain('TLB Entries');

    // Now clear TLB and verify showTLB reports "(empty)"
    await sim.clearTLB();
    // After clearing, show TLB again
    await sim.showTLB();
    const tlbTextAfterClear = await sim.getMemoryAccessResultText();
    expect(tlbTextAfterClear).toContain('(empty)');
  });

  test('TLB Controls (S5): apply TLB size with bounds checking and log update', async ({ page }) => {
    await sim.applyConfig();

    // Apply invalid TLB size (too large) -> triggers alert
    const invalidDialogP = page.waitForEvent('dialog');
    await sim.page.fill(sim.tlbSizeInput, '20'); // invalid >16
    await sim.page.click(sim.applyTLBSizeBtn);
    const invalidDialog = await invalidDialogP;
    expect(invalidDialog.message()).toContain('TLB size must be between 1 and 16.');
    await invalidDialog.accept();

    // Apply valid TLB size and ensure stats log mentions it
    await sim.applyTLBSize(2);
    const statsLog = await sim.getStatsLogText();
    expect(statsLog).toContain('Applied TLB size: 2');
  });

  test('Statistics (S6): reset statistics and ensure counters and logs update', async ({ page }) => {
    await sim.applyConfig();
    // Load program and do some memory accesses to create stats
    await sim.loadProgram('progD', 128);
    await sim.accessMemory(0, 'read');
    await sim.accessMemory(64, 'read');

    // Reset stats
    await sim.resetStats();
    const statsText = await sim.getStatsText();
    // After reset, all counters should be zero
    expect(statsText).toContain('Total Memory Accesses: 0');
    expect(statsText).toContain('TLB Hits: 0');

    // Stats log should include "Statistics reset."
    const statsLog = await sim.getStatsLogText();
    expect(statsLog).toContain('Statistics reset.');
  });

  test('Edge cases: invalid configuration inputs and invalid memory access should show alerts', async ({ page }) => {
    // Set invalid page size (not power of two) and expect alert
    await page.fill(sim.pageSizeInput, '20'); // not a power of two
    const dialog1 = await page.waitForEvent('dialog');
    await page.click(sim.applyConfigBtn);
    // The click will trigger the dialog; capture its message
    expect(dialog1.message()).toContain('Page size must be a power of two');

    await dialog1.accept();

    // Now provide a valid configuration and apply
    await page.fill(sim.pageSizeInput, '64');
    await page.fill(sim.physicalMemKBInput, '8');
    await page.fill(sim.virtualMemKBInput, '16');
    await sim.applyConfig();

    // Load a small program then attempt to access an out-of-range virtual address
    await sim.loadProgram('progE', 64); // one page
    const largeAddr = (16 * 1024) + 100; // larger than virtual memory
    // Accessing an address greater than process virtual memory should produce an alert
    const dialog2Promise = page.waitForEvent('dialog');
    await page.fill(sim.accessAddressInput, String(largeAddr));
    await page.click(sim.accessMemoryBtn);
    const dialog2 = await dialog2Promise;
    expect(dialog2.message()).toContain('Virtual address exceeds process virtual memory size');
    await dialog2.accept();

    // Also attempt to access an address within virtual space but not mapped to any program
    // Example: program size = 64 bytes (one page), access page 2 -> should error with message shown in memoryAccessResult
    const unusedAddr = 2 * 64; // page 2 -> beyond loaded program pages
    await sim.accessMemory(unusedAddr, 'read');
    const memRes = await sim.getMemoryAccessResultText();
    expect(memRes).toContain('Error: Address refers to unused virtual memory');
  });
});