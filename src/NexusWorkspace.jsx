import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import NexusFocusView from './NexusFocusView';
import './NexusWorkspace.css';

const GlobalRelationsNexus = lazy(() => import('./GlobalRelationsNexus'));

export default function NexusWorkspace({ forecasts, selectedTheory, theories, onTheorySelect, initialNodeId, onActorChange, onOpenBriefing }) {
    const [presentation, setPresentation] = useState('focus');
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
        <section className="nexus-workspace" aria-label="Relations Nexus workspace">
            <div className="nexus-presentation-switch" role="group" aria-label="Nexus presentation">
                <div>
                    <span>RELATIONS NEXUS</span>
                    <small>{presentation === 'focus' ? 'Focused 2D exploration' : 'Full spatial exploration'}</small>
                </div>
                <button type="button" aria-pressed={presentation === 'focus'} onClick={() => setPresentation('focus')}>Focus view</button>
                <button type="button" aria-pressed={presentation === 'spatial'} onClick={() => setPresentation('spatial')}>3D spatial</button>
            </div>

            <div className="nexus-presentation-content">
                {presentation === 'focus' ? (
                    <NexusFocusView
                        forecasts={forecasts}
                        initialNodeId={selectedNodeId}
                        onSelectActor={selectActor}
                        onOpenSpatial={() => setPresentation('spatial')}
                        onOpenBriefing={onOpenBriefing}
                    />
                ) : (
                    <Suspense fallback={<div className="nexus-spatial-loading" role="status">LOADING 3D SPATIAL VIEW…</div>}>
                        <GlobalRelationsNexus
                            forecasts={forecasts}
                            selectedTheory={selectedTheory}
                            theories={theories}
                            onTheorySelect={onTheorySelect}
                            initialNodeId={selectedNodeId}
                            onActorSelect={selectActor}
                        />
                    </Suspense>
                )}
            </div>
        </section>
    );
}
