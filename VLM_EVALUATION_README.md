# 🎨 VLM Evaluation Tool

Evaluates interactive learning materials using **vision-only** analysis through OpenAI Vision API. This tool is designed to demonstrate the limitations of pure visual assessment without interaction testing.

## 🎯 Research Purpose

This tool supports research comparing:

- **Visual-only evaluation** (VLM using screenshots)
- **Interactive evaluation** (Playwright testing with FSM)

**Hypothesis**: Visual analysis alone cannot fully capture the educational quality of interactive learning materials.

## 🚀 Quick Start

### Basic Usage

```bash
node vlm-evaluation.mjs -c 100 --vlm-model "gpt-4o-mini" -w "0126-balanced"
```

### Command Line Arguments

| Argument              | Description       | Default       | Example                |
| --------------------- | ----------------- | ------------- | ---------------------- |
| `-c <number>`         | Concurrency limit | 10            | `-c 100`               |
| `--vlm-model <model>` | VLM model name    | gpt-4o-mini   | `--vlm-model "gpt-4o"` |
| `-w <workspace>`      | Workspace name    | 0126-balanced | `-w "my-workspace"`    |

## 📁 Directory Structure

```
workspace/
  └── 0126-balanced/
      ├── visuals/                    # Input: Screenshots (PNG files)
      │   ├── 63afa090-xxx.png
      │   ├── 324c0030-xxx.png
      │   └── ...
      └── visual-results/             # Output: Evaluation results
          ├── 63afa090-xxx.json       # Individual evaluation
          ├── 324c0030-xxx.json
          ├── ...
          └── _summary.json           # Overall summary
```

## 📊 Evaluation Criteria

### Visual Quality (0-5)

Evaluated based on **appearance only**:

- ✅ Layout and organization
- ✅ Visual appeal and design
- ✅ Use of color and typography
- ✅ Information density and clarity
- ✅ Overall visual polish

### Educational Quality (0-5)

Evaluated based on **visible educational content**:

- ✅ Clarity of educational concept
- ✅ Appropriateness of visual representation
- ✅ Presence of instructional elements (labels, legends)
- ✅ Apparent learning objectives
- ✅ Pedagogical effectiveness of visual design

**Important**: These scores are **independent**. A visually appealing page may have low educational value, and vice versa.

## 📝 Output Format

### Individual Evaluation File

Each screenshot generates a JSON file named after the HTML file:

```json
{
  "visual_quality": 4.5,
  "educational_quality": 3.0,
  "visual_analysis": "The layout is clean and well-organized with good use of whitespace. Color scheme is pleasant and typography is clear. The visual elements are properly aligned.",
  "educational_analysis": "The visualization shows a data structure but lacks clear labels or instructions. Educational purpose is somewhat unclear from the static image alone.",
  "metadata": {
    "html_filename": "63afa090-fa74-11f0-bb9a-db7e6ecdeeaa.html",
    "screenshot_filename": "63afa090-fa74-11f0-bb9a-db7e6ecdeeaa.png",
    "workspace": "0126-balanced",
    "vlm_model": "gpt-4o-mini",
    "evaluated_at": "2026-01-29T12:34:56.789Z"
  }
}
```

### Summary File (\_summary.json)

```json
{
  "total": 450,
  "succeeded": 448,
  "failed": 2,
  "average_visual_quality": 3.82,
  "average_educational_quality": 2.95,
  "visual_quality_distribution": {
    "0": 2,
    "1": 15,
    "2": 48,
    "3": 125,
    "4": 198,
    "5": 60
  },
  "educational_quality_distribution": {
    "0": 8,
    "1": 32,
    "2": 105,
    "3": 180,
    "4": 98,
    "5": 25
  },
  "workspace": "0126-balanced",
  "vlm_model": "gpt-4o-mini",
  "evaluated_at": "2026-01-29T12:34:56.789Z",
  "duration_seconds": 1250
}
```

## 🎯 Example Output

```
╔════════════════════════════════════════════════════════════════╗
║              🎨 VLM Evaluation Tool                            ║
╠════════════════════════════════════════════════════════════════╣
║  Workspace:    0126-balanced                                   ║
║  VLM Model:    gpt-4o-mini                                     ║
║  Concurrency:  100                                             ║
╚════════════════════════════════════════════════════════════════╝

📁 Reading screenshots from: workspace/0126-balanced/visuals
✅ Found 450 screenshots

📊 Processing 450 screenshots with concurrency limit 100

✅ [1/450] 324c0030-fa73-11f0-a9d0-d7a1991987c6.png - Visual: 4.5/5, Educational: 3.0/5
✅ [2/450] 324c4e50-fa73-11f0-a9d0-d7a1991987c6.png - Visual: 3.0/5, Educational: 2.5/5
...

======================================================================

📊 VLM Evaluation Complete

Total screenshots:           450
✅ Successfully evaluated:   448
❌ Failed:                   2

📈 Average Scores:
   Visual Quality:           3.82/5
   Educational Quality:      2.95/5

📁 Results saved to: workspace/0126-balanced/visual-results
⏱️  Duration: 1250s

======================================================================

Visual Quality Distribution:
  0/5:  (2)
  1/5: ███████████████ (15)
  2/5: ████████████████████████████████████████████████ (48)
  3/5: █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████ (125)
  4/5: ████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████ (198)
  5/5: ████████████████████████████████████████████████████████████ (60)

Educational Quality Distribution:
  0/5: ████████ (8)
  1/5: ████████████████████████████████ (32)
  2/5: █████████████████████████████████████████████████████████████████████████████████████████████████████ (105)
  3/5: ████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████ (180)
  4/5: ██████████████████████████████████████████████████████████████████████████████████████████████ (98)
  5/5: █████████████████████████████ (25)
```

## ⚙️ Performance

- **Speed**: ~2-3 seconds per screenshot (with gpt-4o-mini)
- **Concurrency**: Recommended 50-100 for large batches
- **Cost**: ~$0.001-0.002 per image (gpt-4o-mini pricing)

### Performance Tips

1. **Concurrency tuning**:
   - Small batches (<50): `-c 10`
   - Medium batches (50-200): `-c 50`
   - Large batches (>200): `-c 100`

2. **Model selection**:
   - `gpt-4o-mini`: Fast and cost-effective (recommended)
   - `gpt-4o`: More accurate but slower and more expensive

3. **Error handling**: The script continues processing even if individual evaluations fail

## 🔍 Research Insights

### Expected Findings

Based on the research hypothesis, we expect:

1. **Visual Quality**: Generally higher scores
   - Static screenshots can show good design
   - Layout and aesthetics are visible

2. **Educational Quality**: More variable scores
   - Hard to assess interactivity from a static image
   - Cannot evaluate user guidance or feedback
   - Missing dynamic behavior and state transitions

3. **Limitation Demonstration**:
   - VLM cannot assess:
     - ❌ Interactive feedback quality
     - ❌ Error handling
     - ❌ Step-by-step guidance
     - ❌ State machine correctness
     - ❌ User interaction flow

## 📦 Dependencies

- Node.js (v16+)
- OpenAI SDK
- Environment variables:
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL` (optional)

## 🛠️ Troubleshooting

### Issue: No screenshots found

**Solution**: Run the screenshot capture tool first:

```bash
node capture-screenshots.mjs workspace/0126-balanced
```

### Issue: API rate limit errors

**Solution**: Reduce concurrency:

```bash
node vlm-evaluation.mjs -c 10 --vlm-model "gpt-4o-mini" -w "0126-balanced"
```

### Issue: JSON parsing errors

**Problem**: VLM sometimes returns malformed JSON

**Solution**: The script automatically retries with error handling. Check the summary for failed evaluations.

## 📊 Comparing with Interactive Testing

After running VLM evaluation, compare with Playwright test results:

```bash
# 1. Run VLM evaluation (visual only)
node vlm-evaluation.mjs -c 100 --vlm-model "gpt-4o-mini" -w "0126-balanced"

# 2. Run Playwright tests (interactive)
npx playwright test workspace/0126-balanced/tests/ --workers=100

# 3. Analyze test results
node analyze-pass-rate.mjs workspace/0126-balanced

# 4. Compare findings:
#    - VLM scores are in: workspace/0126-balanced/visual-results/_summary.json
#    - Test scores are in: workspace/0126-balanced/data/*.json (testStats field)
```

## 💡 Key Takeaway

This tool demonstrates that **vision alone is insufficient** for evaluating interactive learning materials. While VLM can assess visual design, it cannot:

- Verify interactive functionality
- Test user guidance and feedback
- Validate state machine correctness
- Assess learning progression

**Conclusion**: A comprehensive evaluation requires both visual analysis AND interactive testing.
