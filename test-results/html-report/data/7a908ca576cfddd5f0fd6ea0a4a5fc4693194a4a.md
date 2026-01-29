# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "Insertion Sort" [level=1] [ref=e4]
    - paragraph [ref=e5]: A visual demonstration of the elegant sorting algorithm
    - generic [ref=e6]:
      - generic [ref=e9]: Unsorted
      - generic [ref=e12]: Active
      - generic [ref=e15]: Sorted
    - generic [ref=e17]:
      - button "Start Sorting" [ref=e18] [cursor=pointer]
      - button "Reset" [ref=e19] [cursor=pointer]
    - generic [ref=e20]:
      - heading "About Insertion Sort" [level=3] [ref=e21]
      - paragraph [ref=e22]: Insertion sort is a simple sorting algorithm that builds the final sorted array one item at a time. It works by repeatedly taking the next element and inserting it into its correct position within the already sorted portion. Though not the most efficient for large datasets, its simplicity and elegance make it beautiful to visualize and efficient for small or nearly sorted data.
  - text: "`; document.getElementById('particles-js').innerHTML = particlesJS; // Sorting visualization const visualization = document.getElementById('visualization'); const startBtn = document.getElementById('startBtn'); const resetBtn = document.getElementById('resetBtn'); let bars = []; let values = []; let sorting = false; function generateRandomArray() { values = []; for (let i = 0; i < 15; i++) { values.push(Math.floor(Math.random() * 90) + 10); } renderBars(); } function renderBars() { visualization.innerHTML = ''; bars = []; const maxHeight = Math.max(...values); values.forEach((value, index) => { const bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = `${(value / maxHeight) * 100}%`; bar.setAttribute('data-value', value); visualization.appendChild(bar); bars.push(bar); }); } async function insertionSort() { sorting = true; startBtn.disabled = true; for (let i = 1; i < values.length; i++) { let j = i; bars[i].classList.add('active'); await sleep(300); while (j > 0 && values[j] < values[j - 1]) { // Highlight the current element being compared bars[j].classList.add('active'); bars[j - 1].classList.add('active'); await sleep(300); // Swap values [values[j], values[j - 1]] = [values[j - 1], values[j]]; // Update heights bars[j].style.height = `${(values[j] / 100) * 100}%`; bars[j].setAttribute('data-value', values[j]); bars[j - 1].style.height = `${(values[j - 1] / 100) * 100}%`; bars[j - 1].setAttribute('data-value', values[j - 1]); // Remove active class from previous position bars[j].classList.remove('active'); bars[j - 1].classList.remove('active'); // Mark as sorted bars[j - 1].classList.add('sorted'); j--; await sleep(500); } bars[i].classList.remove('active'); bars[j].classList.add('sorted'); } // Mark all as sorted when done bars.forEach(bar => bar.classList.add('sorted')); sorting = false; startBtn.disabled = false; } function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); } function reset() { if (sorting) return; generateRandomArray(); } startBtn.addEventListener('click', insertionSort); resetBtn.addEventListener('click', reset); // Initialize generateRandomArray(); });"
```