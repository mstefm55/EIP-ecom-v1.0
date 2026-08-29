import { localizeMetadataTree } from '../lib/localizedMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import React from 'react';
import DynamicGallery from './subcomponents/DynamicGallery';
import CollaboratorWorkspace from './subcomponents/CollaboratorWorkspace';
import DynamicInventory from './subcomponents/DynamicInventory';
import ProfessionalDashboard from './subcomponents/ProfessionalDashboard';
import WorkspaceAnalyticsPanel from './subcomponents/WorkspaceAnalyticsPanel';
import PermissionsOverview from './subcomponents/PermissionsOverview';
import CheckoutStore from './subcomponents/CheckoutStore';
import { Compass, TrendingUp, Layers, Briefcase, BarChart3, Shield, ShoppingBag } from 'lucide-react';

const REGISTRY_COPY = localizeMetadataTree(
  perfectFitMetadata.componentUi.componentRegistry,
  'component.componentRegistry',
  pfUiT
);

export const ComponentRegistry = {
  gallery: {
    id: 'gallery',
    ...REGISTRY_COPY.gallery,
    icon: Compass,
    component: DynamicGallery,
    defaultAllowedRoles: ['visitor', 'member', 'partner', 'professional'],
  },
  checkoutStore: {
    id: 'checkoutStore',
    ...REGISTRY_COPY.checkoutStore,
    icon: ShoppingBag,
    component: CheckoutStore,
    defaultAllowedRoles: ['visitor', 'member', 'partner', 'professional'],
  },
  projectManagement: {
    id: 'projectManagement',
    ...REGISTRY_COPY.projectManagement,
    icon: TrendingUp,
    component: CollaboratorWorkspace,
    defaultAllowedRoles: ['member', 'partner', 'professional'],
  },
  inventory: {
    id: 'inventory',
    ...REGISTRY_COPY.inventory,
    icon: Layers,
    component: DynamicInventory,
    defaultAllowedRoles: ['partner', 'professional'],
  },
  professionalDashboard: {
    id: 'professionalDashboard',
    ...REGISTRY_COPY.professionalDashboard,
    icon: Briefcase,
    component: ProfessionalDashboard,
    defaultAllowedRoles: ['partner', 'professional'],
  },
  permissionsOverview: {
    id: 'permissionsOverview',
    ...REGISTRY_COPY.permissionsOverview,
    icon: Shield,
    component: PermissionsOverview,
    defaultAllowedRoles: ['visitor', 'member', 'partner', 'professional'],
  },
  analytics: {
    id: 'analytics',
    ...REGISTRY_COPY.analytics,
    icon: BarChart3,
    component: WorkspaceAnalyticsPanel,
    defaultAllowedRoles: ['professional'],
  }
};
