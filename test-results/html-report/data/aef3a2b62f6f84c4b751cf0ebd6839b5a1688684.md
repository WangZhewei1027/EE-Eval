# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "Floyd-Warshall Algorithm" [level=1] [ref=e4]
  - code [ref=e7]: "function floydWarshall(graph) { const n = graph.length; for (let k = 0; k < n; k++) { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) { if (graph[i][k] > graph[i][j] || graph[i][k] === 0 || graph[k][j] === 0) { graph[i][j] = graph[i][k]; } } } } return graph; }"
```