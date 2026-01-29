# Page snapshot

```yaml
- generic [ref=e2]:
  - heading "Bellman-Ford Algorithm" [level=2] [ref=e3]
  - paragraph [ref=e4]: Bellman-Ford is a dynamic programming algorithm used to find the shortest paths from a source node to all other nodes in a weighted graph. It can handle negative weight edges and negative cycles.
  - paragraph [ref=e5]: The algorithm works by iteratively relaxing all edges in the graph, and then repeatedly applying the algorithm to the updated graph.
  - paragraph [ref=e6]: "Here is the step-by-step process:"
  - list [ref=e7]:
    - listitem [ref=e8]: Initialize the distance to the source node as 0, and all other nodes as infinity.
    - listitem [ref=e9]: Relax all edges in the graph. This involves updating the distance to each node based on the shortest path to its neighbors.
    - listitem [ref=e10]: Repeat step 2 until all nodes have been processed.
    - listitem [ref=e11]: Finally, the algorithm returns the shortest distances from the source node to all other nodes.
  - paragraph [ref=e12]: "Here is an example of a graph with a negative weight edge and a negative cycle:"
  - img "Graph with negative weight edge"
  - paragraph [ref=e13]: "And here is an example of a graph without a negative weight edge:"
  - img "Graph without negative weight edge"
  - button "Run the Bellman-Ford Algorithm" [ref=e14]
```