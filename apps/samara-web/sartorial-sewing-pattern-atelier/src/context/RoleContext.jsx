import React, { createContext, useContext, useState, useEffect } from 'react';

const RoleContext = createContext(null);

export const availableRoles = [
  { id: 'visitor', name: 'Casual Visitor', desc: 'Public guest exploring public galleries and basic features.' },
  { id: 'member', name: 'Perfect Fit Member', desc: 'Registered user with access to project tracking and personal catalogs.' },
  { id: 'partner', name: 'Creative Partner', desc: 'Professional collaborator with access to inventory tracking and licensing.' },
  { id: 'professional', name: 'Master Professional', desc: 'Enterprise tailoring administrator with full administrative capability.' }
];

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
