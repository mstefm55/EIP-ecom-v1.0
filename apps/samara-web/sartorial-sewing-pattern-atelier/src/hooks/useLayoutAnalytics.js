import { useCallback, useState, useEffect } from 'react';
import { useRole } from '../context/RoleContext';

const LOCAL_STORAGE_KEY = 'perfectfit_layout_analytics_logs';

/**
 * Custom hook to record and retrieve user interaction analytics within the Perfect Fit Bureau DynamicLayout Workspace.
 */
export function useLayoutAnalytics() {
  const { role, actualRole } = useRole();
  // Fetch current logs from local storage
  const fetchLogs = useCallback(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  const [logs, setLogs] = useState(() => fetchLogs());

  // Track a new user interaction
  const trackInteraction = useCallback((actionType, details = {}) => {
    try {
      const savedLogs = fetchLogs();
      const newEntry = {
        id: `analytic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        role,
        actualRole,
        actionType, // 'role_switched' | 'rule_toggled' | 'config_toggled' | 'block_viewed' | 'access_denied' | 'custom_action'
        details,
      };

      const updatedLogs = [newEntry, ...savedLogs].slice(0, 500); // Limit to last 500 actions
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedLogs));
      setLogs(updatedLogs);

      // Trigger custom window event to allow multi-component real-time reactivity if needed
      window.dispatchEvent(new CustomEvent('layout_analytics_updated', { detail: updatedLogs }));
    } catch (e) {
      console.error('Failed to log workspace telemetry:', e);
    }
  }, [role, actualRole, fetchLogs]);

  // Clear analytics records
  const clearAnalytics = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setLogs([]);
      window.dispatchEvent(new CustomEvent('layout_analytics_updated', { detail: [] }));
    } catch {}
  }, []);

  const refreshLogs = useCallback(() => {
    setLogs(fetchLogs());
  }, [fetchLogs]);

  return {
    logs,
    trackInteraction,
    clearAnalytics,
    refreshLogs
  };
}
