export function reheatGraphWhenReady(readyRef, graphRefOrInstance) {
    const graph = graphRefOrInstance?.current || graphRefOrInstance;
    if (!readyRef?.current || typeof graph?.d3ReheatSimulation !== 'function') {
        return false;
    }

    graph.d3ReheatSimulation();
    return true;
}
