import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { theories } from '../theories';
import { readStoredJson, writeStoredJson } from '../localState.mjs';

export function useSupabasePreferences({
    user,
    values,
    setters,
}) {
    const [preferencesHydratedFor, setPreferencesHydratedFor] = useState(null);
    const settersRef = useRef(setters);
    settersRef.current = setters;

    const {
        selectedTheory,
        selectedCategory,
        timelineYear,
        stressLevel,
        sidebarCollapsed,
        showEditorialCases,
        largeText,
        reducedEffects,
        metricsCollapsed,
    } = values;

    useEffect(() => {
        let cancelled = false;
        const preferenceOwner = user?.id || 'anonymous';
        setPreferencesHydratedFor(null);

        const applyPreferences = prefs => {
            if (!prefs || typeof prefs !== 'object') return;
            const s = settersRef.current;
            if (prefs.selectedTheory && theories[prefs.selectedTheory]) s.setSelectedTheory(prefs.selectedTheory);
            if (prefs.selectedCategory) s.setSelectedCategory(prefs.selectedCategory);
            if (prefs.timelineYear) s.setTimelineYear(prefs.timelineYear);
            if (typeof prefs.stressLevel === 'number') s.setStressLevel(prefs.stressLevel);
            if (typeof prefs.sidebarCollapsed === 'boolean') s.setSidebarCollapsed(prefs.sidebarCollapsed);
            if (typeof prefs.showEditorialCases === 'boolean') s.setShowEditorialCases(prefs.showEditorialCases);
            if (typeof prefs.largeText === 'boolean') s.setLargeText(prefs.largeText);
            if (typeof prefs.reducedEffects === 'boolean') s.setReducedEffects(prefs.reducedEffects);
            if (typeof prefs.metricsCollapsed === 'boolean') s.setMetricsCollapsed(prefs.metricsCollapsed);
        };

        const restorePreferences = async () => {
            const localPreferences = readStoredJson('gcc-preferences', {});
            applyPreferences(localPreferences);

            try {
                if (user) {
                    const { data, error: selectError } = await supabase
                        .from('user_data').select('value')
                        .eq('user_id', user.id).eq('key', 'gcc-preferences').maybeSingle();
                    if (selectError) throw selectError;
                    if (cancelled) return;
                    if (data?.value) {
                        applyPreferences(data.value);
                        writeStoredJson('gcc-preferences', data.value);
                    }
                }
            } catch (error) {
                console.warn('[GCC] Cloud preferences unavailable:', error?.message || 'unknown error');
            } finally {
                if (!cancelled) setPreferencesHydratedFor(preferenceOwner);
            }
        };

        restorePreferences();
        return () => { cancelled = true; };
    }, [user?.id]);

    useEffect(() => {
        const preferenceOwner = user?.id || 'anonymous';
        if (preferencesHydratedFor !== preferenceOwner) return undefined;

        const prefs = {
            selectedTheory,
            selectedCategory,
            timelineYear,
            stressLevel,
            sidebarCollapsed,
            showEditorialCases,
            largeText,
            reducedEffects,
            metricsCollapsed,
        };
        writeStoredJson('gcc-preferences', prefs);
        if (!user) return undefined;
        const syncTimer = setTimeout(() => {
            supabase.from('user_data').upsert(
                { user_id: user.id, key: 'gcc-preferences', value: prefs, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,key' }
            ).then(({ error }) => {
                if (error) console.warn('[GCC] Failed to sync cloud preferences:', error.message);
            });
        }, 400);
        return () => clearTimeout(syncTimer);
    }, [
        selectedTheory,
        selectedCategory,
        timelineYear,
        stressLevel,
        sidebarCollapsed,
        showEditorialCases,
        largeText,
        reducedEffects,
        metricsCollapsed,
        preferencesHydratedFor,
        user?.id,
    ]);

    return { preferencesHydratedFor };
}
