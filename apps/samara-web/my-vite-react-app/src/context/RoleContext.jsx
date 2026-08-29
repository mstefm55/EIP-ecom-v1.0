import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import React, { createContext, useContext, useState, useEffect } from 'react';

const RoleContext = createContext(null);

const buildAvailableRoles = () =>
  Object.entries(perfectFitMetadata.auth.roles || {}).map(([id, role]) => ({
    id,
    name: pfUiT(`role.${id}.name`, {}, role.name || id),
    desc: pfUiT(`role.${id}.description`, {}, role.description || '')
  }));

export function mapUserToRole(user) {
  if (!user) return 'visitor';
  const roleStr = String(user.role || '').toLowerCase();
  if (roleStr === 'administrator' || roleStr === 'admin' || roleStr === 'professional') {
    return 'professional';
  }
  if (roleStr === 'collaborator' || roleStr === 'partner') {
    return 'partner';
  }
  if (roleStr === 'buyer' || roleStr === 'member' || roleStr === 'user') {
    return 'member';
  }
  return 'visitor';
}

export function RoleProvider({ children, currentUser }) {
  const availableRoles = buildAvailableRoles();
  const [role, setRole] = useState(() => {
    return mapUserToRole(currentUser);
  });

  const [simulationActive, setSimulationActive] = useState(false);

  // Sync role when current user changes, unless user manually chose to override (simulation)
  useEffect(() => {
    if (!simulationActive) {
      setRole(mapUserToRole(currentUser));
    }
  }, [currentUser, simulationActive]);

  const selectRole = (newRole) => {
    setRole(newRole);
    setSimulationActive(true);
  };

  const resetRoleToActual = () => {
    setRole(mapUserToRole(currentUser));
    setSimulationActive(false);
  };

  return (
    <RoleContext.Provider value={{
      role,
      setRole: selectRole,
      simulationActive,
      resetRoleToActual,
      actualRole: mapUserToRole(currentUser),
      availableRoles
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
