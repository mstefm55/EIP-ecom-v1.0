import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRole } from './RoleContext';
import { ComponentRegistry } from '../components/ComponentRegistry';
import { useLayoutAnalytics } from '../hooks/useLayoutAnalytics';
import rolePermissions from '../rolePermissions.json';

const DynamicLayoutContext = createContext(null);

const INITIAL_VISIBILITY_RULES = Object.keys(ComponentRegistry).reduce((acc, key) => {
  const allowedRoles = [];
  Object.entries(rolePermissions.roles).forEach(([roleId, roleData]) => {
    if (roleData.permissions[key] === 'allowed') {
      allowedRoles.push(roleId);
    }
  });
  acc[key] = allowedRoles;
  return acc;
}, {});

export function DynamicLayoutProvider({ children }) {
  const { role } = useRole();
  const { trackInteraction } = useLayoutAnalytics();

  // Load and manage the rules state
  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_layout_rules');
      return saved ? JSON.parse(saved) : INITIAL_VISIBILITY_RULES;
    } catch {
      return INITIAL_VISIBILITY_RULES;
    }
  });

  // State to determine how to render gated components (hide completely or show a lock-screen placeholder card)
  const [gatedRenderMode, setGatedRenderMode] = useState('hide');

  // Sync rules state changes with local storage to keep tabs/components synchronized in real-time
  useEffect(() => {
    try {
      localStorage.setItem('sartorial_layout_rules', JSON.stringify(rules));
      // Dispatch a custom event so other components (e.g., PermissionsOverview) know rules have changed
      window.dispatchEvent(new Event('sartorial_layout_rules_updated'));
    } catch {}
  }, [rules]);

  // Check if a specific component block is allowed to be accessed by the current role
  const isAllowed = useCallback((componentKey) => {
    // Only the administrator (professional) has full access to all workspace blocks at all times
    if (role === 'professional') return true;
    const allowedRoles = rules[componentKey] || [];
    return allowedRoles.includes(role);
  }, [role, rules]);

  // Toggle permission rules for a specific component and role ID
  const handleToggleRule = useCallback((componentKey, roleId) => {
    const isChecked = (rules[componentKey] || []).includes(roleId);
    setRules(prev => {
      const activeList = prev[componentKey] || [];
      const updatedList = activeList.includes(roleId)
        ? activeList.filter(r => r !== roleId)
        : [...activeList, roleId];
      return {
        ...prev,
        [componentKey]: updatedList
      };
    });
    trackInteraction('rule_toggled', {
      componentKey,
      roleId,
      nextState: !isChecked
    });
  }, [rules, trackInteraction]);

  // Reset rules to the factory configurations defined in rolePermissions.json
  const handleResetRules = useCallback(() => {
    setRules(INITIAL_VISIBILITY_RULES);
    trackInteraction('rules_reset_to_default', { role });
  }, [role, trackInteraction]);

  // Dynamically obtain only the registry items that are fully allowed for the active role
  const allowedComponents = Object.values(ComponentRegistry).filter(item => isAllowed(item.id));

  return (
    <DynamicLayoutContext.Provider value={{
      rules,
      setRules,
      isAllowed,
      allowedComponents,
      gatedRenderMode,
      setGatedRenderMode,
      handleToggleRule,
      handleResetRules,
      allComponents: Object.values(ComponentRegistry)
    }}>
      {children}
    </DynamicLayoutContext.Provider>
  );
}

export function useDynamicLayout() {
  const context = useContext(DynamicLayoutContext);
  if (!context) {
    throw new Error('useDynamicLayout must be used within a DynamicLayoutProvider');
  }
  return context;
}
