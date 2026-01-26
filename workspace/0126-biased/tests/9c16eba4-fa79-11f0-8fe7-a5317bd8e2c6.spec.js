import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c16eba4-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object helpers
class BackpropLabPage {
  constructor(page) {
    this.page = page;
  }
  async click(selector) {
    await this.page.click(selector);
  }
  async setValue(selector, value) {
    await this.page.fill(selector, String(value));
  }
  async getText(selector) {
    return (await this.page.locator(selector).textContent()) ?? '';
  }
  async getInputValue(selector) {
    return await this.page.$eval(selector, el => (el.value === undefined ? '' : el.value));
  }
  async waitForLogContains(text, timeout = 2000) {
    await this.page.waitForFunction(
      (t) => {
        const pre = document.getElementById('logPre');
        return pre && pre.textContent.includes(t);
      },
      text,
      { timeout }
    );
  }
  async waitForTraceContains(text, timeout = 2000) {
    await this.page.waitForFunction(
      (t) => {
        const pre = document.getElementById('tracePre');
        return pre && pre.textContent.includes(t);
      },
      text,
      { timeout }
    );
  }
  async waitForLossHistoryNonEmpty(timeout = 2000) {
    await this.page.waitForFunction(
      () => {
        const pre = document.getElementById('lossHistoryPre');
        try {
          const txt = pre.textContent || '';
          const arr = JSON.parse(txt);
          return Array.isArray(arr) && arr.length > 0;
        } catch (e) { return false; }
      },
      null,
      { timeout }
    );
  }
}

test.describe('Backpropagation Interactive Lab - FSM & UI tests', () => {
  let page;
  let lab;
  let consoleMessages = [];
  let pageErrors = [];
  let dialogMessages = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    page.on('console', msg => {
      consoleMessages.push({type: msg.type(), text: msg.text()});
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    page.on('dialog', async (dialog) => {
      // record and accept by default in tests unless we need to assert message
      dialogMessages.push(dialog.message());
      try { await dialog.accept(); } catch (e) { /* ignore */ }
    });

    await page.goto(APP_URL);
    lab = new BackpropLabPage(page);
    // Wait for initial rendering and ready log text to appear in logPre
    await page.waitForFunction(() => {
      const pre = document.getElementById('logPre');
      return pre && pre.textContent.includes('Ready.');
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state S0_Idle: UI has ready log and initial network rendered', async () => {
    // Verify initial log contains the expected startup message (entry evidence)
    const logText = await lab.getText('#logPre');
    expect(logText).toContain('Ready. Use controls to build network, load data, and run backpropagation experiments.');
    // Network viewer should reflect default topology 2,2,1
    const networkViewText = await lab.getText('#networkView');
    expect(networkViewText).toContain('Topology: 2, 2, 1');
    expect(networkViewText).toContain('Layer 1');
    // ensure no runtime page errors occurred during load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Network Configuration events (S1_NetworkConfigured)', () => {
    test('ApplyTopology: valid topology applied and logged', async () => {
      // Change to 3,4,1 with activations
      await lab.setValue('#layersInput', '3,4,1');
      await lab.setValue('#activationsInput', 'linear,sigmoid,linear');
      await lab.click('#applyLayersBtn');
      // Check network view updated
      const nv = await lab.getText('#networkView');
      expect(nv).toContain('Topology: 3, 4, 1');
      // Check log mentions applied topology
      await lab.waitForLogContains('Applied topology: 3, 4, 1');
    });

    test('AddLayer and RemoveLayer: add and remove hidden layer updates UI and log', async () => {
      // Ensure known starting topology
      await lab.setValue('#layersInput', '2,2,1');
      await lab.setValue('#activationsInput', 'linear,sigmoid,linear');
      await lab.click('#applyLayersBtn');
      // Add a hidden layer
      await lab.click('#addLayerBtn');
      const layersAfterAdd = await lab.getInputValue('#layersInput');
      expect(layersAfterAdd.split(',').length).toBeGreaterThan(3); // now has added layer
      await lab.waitForLogContains('Added hidden layer');
      // Remove the last hidden layer
      await lab.click('#removeLayerBtn');
      const layersAfterRemove = await lab.getInputValue('#layersInput');
      expect(layersAfterRemove.split(',').length).toBe(3); // back to input, hidden, output
      await lab.waitForLogContains('Removed last hidden layer');
    });

    test('InitializeWeights: clicking initializes and updates view & log', async () => {
      // Choose Xavier init and initialize weights
      await lab.setValue('#initSelect', 'xavier');
      await lab.click('#initWeightsBtn');
      const nettext = await lab.getText('#networkView');
      expect(nettext).toContain('Layer 1'); // network still shows layers
      await lab.waitForLogContains('Initialized weights: xavier');
    });

    test('ToggleFreezeLayer and ZeroLayerWeights: freeze toggles and zero sets weights', async () => {
      // Ensure topology with layer 1 present
      await lab.setValue('#layersInput', '2,2,1');
      await lab.setValue('#activationsInput', 'linear,sigmoid,linear');
      await lab.click('#applyLayersBtn');
      // Select layer 1
      await lab.setValue('#selectedLayerIndex', '1');
      await lab.click('#toggleFreezeBtn');
      await lab.waitForLogContains('Toggled freeze for layer 1');
      const nv = await lab.getText('#networkView');
      expect(nv).toContain('[FROZEN]');
      // Zero weights
      await lab.click('#zeroWeightsBtn');
      await lab.waitForLogContains('Zeroed weights for layer 1');
      const nvAfterZero = await lab.getText('#networkView');
      // biases should show 0.0000 after zeroing
      expect(nvAfterZero).toContain('0.0000');
    });

    test('SaveNetworkJson triggers a download', async () => {
      // Wait for download event when clicking save
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        lab.click('#saveJsonBtn')
      ]);
      const suggested = download.suggestedFilename();
      expect(suggested).toBe('network.json');
    });

    test('Load JSON: upload valid JSON updates network', async () => {
      // Prepare a custom network JSON to upload
      const networkObj = {
        layerSizes: [2, 3, 1],
        activations: ['linear', 'sigmoid', 'linear'],
        weights: [null, [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]], [[0.1, 0.2, 0.3]]],
        biases: [null, [0.1, 0.2, 0.3], [0.0]],
        frozen: [false, false, false]
      };
      const filePayload = {
        name: 'networkUpload.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(networkObj), 'utf8')
      };
      // Trigger load.json UI
      const [fileChooserPromise] = [];
      // Click loadJsonBtn to open file input
      await lab.click('#loadJsonBtn');
      // Set file on input element directly
      const input = await page.$('#jsonFileInput');
      await input.setInputFiles(filePayload);
      // wait for 'Loaded network JSON' log entry
      await lab.waitForLogContains('Loaded network JSON');
      // check layersInput updated
      const layersVal = await lab.getInputValue('#layersInput');
      expect(layersVal).toContain('2,3,1');
      const activationsVal = await lab.getInputValue('#activationsInput');
      expect(activationsVal).toContain('sigmoid');
    });
  });

  test.describe('Dataset events (S2_DataLoaded)', () => {
    test('LoadPreset, ClearData, AddSample, ApplyData update samples view and logs', async () => {
      // Load XOR preset
      await lab.setValue('#datasetPreset', 'xor');
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset: xor');
      const samplesText = await lab.getText('#samplesPre');
      expect(samplesText).toContain('"x"');
      // Clear data
      await lab.click('#clearDataBtn');
      await lab.waitForLogContains('Cleared samples');
      const samplesAfterClear = await lab.getText('#samplesPre');
      expect(samplesAfterClear.trim()).toBe('[]');
      // Add a sample using input
      await lab.setValue('#addSampleInput', '0,1 -> 1');
      await lab.click('#addSampleBtn');
      await lab.waitForLogContains('Added sample');
      const samplesAfterAdd = await lab.getText('#samplesPre');
      expect(samplesAfterAdd).toContain('[0,1]');
      // Bulk apply data
      await lab.setValue('#dataArea', '0,0,0\n1,1,1');
      await lab.click('#applyDataBtn');
      await lab.waitForLogContains('Applied dataset, samples: 2');
      const samplesAfterApply = await lab.getText('#samplesPre');
      expect(samplesAfterApply).toContain('[0,0]');
      // Ensure the App.samples rendered corresponds to two samples
      const parsed = JSON.parse(samplesAfterApply);
      expect(parsed.length).toBe(2);
    });

    test('Edge-case: applyData with bad input triggers alert and recorded dialog', async () => {
      // Put a bad line in dataArea that contains non-numeric value
      await lab.setValue('#dataArea', 'bad,line');
      // Clear previous dialog messages
      dialogMessages = [];
      await lab.click('#applyDataBtn');
      // dialog should have been triggered for bad number alert; message recorded
      expect(dialogMessages.length).toBeGreaterThan(0);
      const found = dialogMessages.some(m => m.includes('Bad number') || m.includes('Bad number in line'));
      expect(found).toBeTruthy();
    });
  });

  test.describe('Training flows (S3_Training, S4_TrainingStep)', () => {
    test('TrainStep on empty data shows alert', async () => {
      // Ensure samples cleared
      await lab.click('#clearDataBtn');
      dialogMessages = [];
      await lab.click('#trainStepBtn');
      // Expect dialog indicating no samples
      const noSamples = dialogMessages.some(m => m.includes('No samples'));
      expect(noSamples).toBeTruthy();
    });

    test('Train on empty dataset shows alert', async () => {
      dialogMessages = [];
      await lab.click('#trainBtn');
      const noSamples = dialogMessages.some(m => m.includes('No samples'));
      expect(noSamples).toBeTruthy();
    });

    test('TrainStep performs a single step and logs loss', async () => {
      // Load a preset so there are samples
      await lab.setValue('#datasetPreset', 'xor');
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset: xor');
      // ensure batch size =1 and lr small
      await lab.setValue('#batchSizeInput', '1');
      await lab.setValue('#lrInput', '0.1');
      dialogMessages = [];
      await lab.click('#trainStepBtn');
      // Wait for log message about training step
      await lab.waitForLogContains('Performed one training step, loss:');
      const logText = await lab.getText('#logPre');
      expect(logText).toContain('Performed one training step, loss:');
      // Loss history should have an entry
      const lossHistory = await lab.getText('#lossHistoryPre');
      expect(lossHistory).toContain('['); // JSON array present
    });

    test('Train (run) for a couple epochs finishes and updates epoch/labels', async () => {
      // Load small data
      await lab.click('#clearDataBtn');
      await lab.setValue('#dataArea', '0,0,0\n0,1,1');
      await lab.click('#applyDataBtn');
      await lab.waitForLogContains('Applied dataset, samples: 2');
      // Set epochs to 2 to keep it short
      await lab.setValue('#epochsInput', '2');
      await lab.setValue('#batchSizeInput', '1');
      await lab.setValue('#shuffleCheckbox', ''); // no effect via fill; ensure deterministic default
      // Click train and wait for "Training finished" log entry
      await lab.click('#trainBtn');
      await lab.waitForFunction(() => {
        const pre = document.getElementById('logPre');
        return pre && pre.textContent.includes('Training finished at epoch');
      }, null, { timeout: 5000 });
      const epochLabel = await lab.getText('#epochLabel');
      expect(Number(epochLabel)).toBeGreaterThanOrEqual(1);
    });

    test('Stop training: clicking stop requests stop and logs message', async () => {
      // Start a longer training but stop immediately
      await lab.setValue('#epochsInput', '1000');
      // Ensure dataset present; if not, load preset
      await lab.setValue('#datasetPreset', 'xor');
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset: xor');
      // Start training
      dialogMessages = [];
      const trainPromise = lab.click('#trainBtn');
      // Click stop right after
      await lab.click('#stopBtn');
      // Wait for log to include either 'Stop requested' or 'Training finished'
      await page.waitForFunction(() => {
        const pre = document.getElementById('logPre');
        if (!pre) return false;
        const t = pre.textContent;
        return t.includes('Stop requested') || t.includes('Training finished at epoch');
      }, null, { timeout: 3000 });
      const logText = await lab.getText('#logPre');
      expect(logText.includes('Stop requested') || logText.includes('Training finished at epoch')).toBeTruthy();
    });
  });

  test.describe('Trace and Backprop views (S5_TraceForward, S6_TraceBackward, ShowForward/Backward)', () => {
    test('StepForward and StepBackward show traces and update tracePre and logs', async () => {
      // Ensure we have samples to trace
      await lab.setValue('#datasetPreset', 'xor');
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset: xor');
      // Set trace sample index to 0 and trigger forward
      await lab.setValue('#traceSampleIndex', '0');
      await lab.click('#stepForwardBtn');
      await lab.waitForTraceContains('Forward for sample 0');
      // Trigger backward
      await lab.click('#stepBackwardBtn');
      await lab.waitForTraceContains('Backward for sample 0');
      const traceText = await lab.getText('#tracePre');
      expect(traceText).toContain('Backward for sample 0');
    });

    test('ShowForward and ShowBackward present formatted traces', async () => {
      await lab.setValue('#traceSampleIndex', '1');
      await lab.click('#showForwardBtn');
      await lab.waitForTraceContains('Layer 1 pre-activations');
      const forwardTrace = await lab.getText('#tracePre');
      expect(forwardTrace).toContain('Output:');
      // Show backward
      await lab.click('#showBackwardBtn');
      await lab.waitForTraceContains('Backprop for sample');
      const backTrace = await lab.getText('#tracePre');
      expect(backTrace).toContain('grad biases');
    });

    test('ResetState resets internal state and logs action', async () => {
      await lab.click('#resetStateBtn');
      await lab.waitForLogContains('Reset network state');
      const log = await lab.getText('#logPre');
      expect(log).toContain('Reset network state');
    });
  });

  test.describe('Log & History (S7_LogCleared and ShowLossHistory)', () => {
    test('ClearLog empties the logPre', async () => {
      // Ensure there is some log content
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset');
      await lab.click('#clearLogBtn');
      // logPre should be empty string
      const val = await lab.getText('#logPre');
      expect(val.trim()).toBe('');
    });

    test('ShowLossHistory displays last N entries', async () => {
      // Produce a couple of loss entries using trainStep
      await lab.setValue('#datasetPreset', 'xor');
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset: xor');
      await lab.click('#trainStepBtn');
      await lab.waitForLogContains('Performed one training step, loss:');
      await lab.click('#showHistoryBtn');
      // lossHistoryPre should be JSON array
      const historyText = await lab.getText('#lossHistoryPre');
      const arr = JSON.parse(historyText);
      expect(Array.isArray(arr)).toBeTruthy();
    });
  });

  test.describe('Gradient Check (GradientCheck event)', () => {
    test('GradientCheck executes and produces an alert and log entry', async () => {
      // Ensure samples exist
      await lab.setValue('#datasetPreset', 'xor');
      await lab.click('#loadPresetBtn');
      await lab.waitForLogContains('Loaded preset: xor');
      dialogMessages = [];
      await lab.click('#gradCheckBtn');
      // gradCheck triggers an alert with result; ensure dialog captured
      expect(dialogMessages.length).toBeGreaterThan(0);
      const foundMsg = dialogMessages.some(m => m.includes('GradCheck result') || m.includes('GradCheck'));
      expect(foundMsg).toBeTruthy();
      // Also inspect log entry for GradCheck
      await lab.waitForLogContains('GradCheck weight');
      const log = await lab.getText('#logPre');
      expect(log).toContain('GradCheck weight');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('ApplyTopology with invalid layers triggers alert', async () => {
      dialogMessages = [];
      await lab.setValue('#layersInput', 'a,b,c');
      await lab.click('#applyLayersBtn');
      // Expect an alert dialog about invalid layers input
      const found = dialogMessages.some(m => m.includes('Invalid layers input') || m.includes('Error:'));
      expect(found).toBeTruthy();
      // Restore valid layers
      await lab.setValue('#layersInput', '2,2,1');
      await lab.setValue('#activationsInput', 'linear,sigmoid,linear');
      await lab.click('#applyLayersBtn');
    });

    test('RemoveLayer with no hidden layers shows alert', async () => {
      // Set topology with only input and output
      await lab.setValue('#layersInput', '2,1');
      await lab.setValue('#activationsInput', 'linear,linear');
      await lab.click('#applyLayersBtn');
      dialogMessages = [];
      await lab.click('#removeLayerBtn');
      const found = dialogMessages.some(m => m.includes('No hidden layers to remove'));
      expect(found).toBeTruthy();
    });

    test('AddSample with malformed input triggers alert', async () => {
      dialogMessages = [];
      await lab.setValue('#addSampleInput', 'not,a,number');
      await lab.click('#addSampleBtn');
      const found = dialogMessages.some(m => m.includes('Error parsing sample'));
      expect(found).toBeTruthy();
    });

    test('StepForward/Backward when sample missing triggers alert', async () => {
      // clear samples and try stepping
      await lab.click('#clearDataBtn');
      dialogMessages = [];
      await lab.setValue('#traceSampleIndex', '0');
      await lab.click('#stepForwardBtn');
      const forwardAlert = dialogMessages.some(m => m.includes('No such sample'));
      expect(forwardAlert).toBeTruthy();
      dialogMessages = [];
      await lab.click('#stepBackwardBtn');
      const backAlert = dialogMessages.some(m => m.includes('No such sample'));
      expect(backAlert).toBeTruthy();
    });
  });

  test('No unexpected runtime errors logged to pageerror during test run', async () => {
    // Verify the page didn't throw unhandled exceptions during our interactions
    expect(pageErrors.length).toBe(0);
  });
});