import { useCallback, useEffect, useState } from 'react';
import NexusFocusView from './NexusFocusView';
import './NexusWorkspace.css';

export default function NexusWorkspace({ forecasts, initialNodeId, onActorChange, onOpenBriefing }) {
    const [selectedNodeId, setSelectedNodeId] = useState(initialNodeId || 'USA');

    useEffect(() => {
        setSelectedNodeId(initialNodeId || 'USA');
    }, [initialNodeId]);

    const selectActor = useCallback(nodeId => {
        setSelectedNodeId(nodeId);
        onActorChange?.(nodeId);
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'nexus');
        url.searchParams.set('actor', nodeId);
        url.searchParams.delete('tour');
        url.searchParams.delete('step');
        window.history.replaceState({ view: 'nexus', actor: nodeId }, '', url);
    }, [onActorChange]);

    return (
        <section className="nexus-workspace" aria-label="Nexus workspace">
            <NexusFocusView
                forecasts={forecasts}
                initialNodeId={selectedNodeId}
                onSelectActor={selectActor}
                onOpenBriefing={onOpenBriefing}
            />
        </section>
    );
}
