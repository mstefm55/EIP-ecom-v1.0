import React from 'react';
import DynamicGallery from './subcomponents/DynamicGallery';
import CollaboratorWorkspace from './subcomponents/CollaboratorWorkspace';
import DynamicInventory from './subcomponents/DynamicInventory';
import ProfessionalDashboard from './subcomponents/ProfessionalDashboard';
import WorkspaceAnalyticsPanel from './subcomponents/WorkspaceAnalyticsPanel';
import PermissionsOverview from './subcomponents/PermissionsOverview';
import CheckoutStore from './subcomponents/CheckoutStore';
import { Compass, TrendingUp, Layers, Briefcase, BarChart3, Shield, ShoppingBag } from 'lucide-react';

export const ComponentRegistry = {
  gallery: {
    id: 'gallery',
    name: 'Curated Gallery Interface',
    description: 'Public design catalog displaying available patterns, difficulty grading, and interactive sewing specs.',
    icon: Compass,
    component: DynamicGallery,
    defaultAllowedRoles: ['visitor', 'member', 'partner', 'professional'],
  },
  checkoutStore: {
    id: 'checkoutStore',
    name: 'Atelier Seamless Checkout & Store Center',
    description: 'An interactive premium store experience with a live mock cart state, dynamic pattern selection summaries, and a seamless multi-stage checkout wizard.',
    icon: ShoppingBag,
    component: CheckoutStore,
    defaultAllowedRoles: ['visitor', 'member', 'partner', 'professional'],
  },
  projectManagement: {
    id: 'projectManagement',
    name: 'Consolidated Collaborator Workspace',
    description: 'A fully operational workspace to manage projects, drafting checklists, B2B textile supplies, suppliers, and real-time sewing timers.',
    icon: TrendingUp,
    component: CollaboratorWorkspace,
    defaultAllowedRoles: ['member', 'partner', 'professional'],
  },
  inventory: {
    id: 'inventory',
    name: 'B2B Material & Textile Inventory Ledger',
    description: 'Premium supply chain dashboard with automatic GSM weight specs, live receiving docks, and low-yardage warnings.',
    icon: Layers,
    component: DynamicInventory,
    defaultAllowedRoles: ['partner', 'professional'],
  },
  professionalDashboard: {
    id: 'professionalDashboard',
    name: 'Professional Partner Operations Dashboard',
    description: 'High-level aggregated portal summarizing commissioned projects, fabric expenditure metrics, and sewing session time logs.',
    icon: Briefcase,
    component: ProfessionalDashboard,
    defaultAllowedRoles: ['partner', 'professional'],
  },
  permissionsOverview: {
    id: 'permissionsOverview',
    name: 'Permissions & Access Overview Matrix',
    description: 'Comprehensive interactive security audit interface tracking authorized credential tiers, gate criteria, and sandbox policy overrides.',
    icon: Shield,
    component: PermissionsOverview,
    defaultAllowedRoles: ['visitor', 'member', 'partner', 'professional'],
  },
  analytics: {
    id: 'analytics',
    name: 'Workspace Auditing & Telemetry Analytics',
    description: 'Provides deep diagnostic graphs, security access denial tracing, and workflow optimization audits for administrators.',
    icon: BarChart3,
    component: WorkspaceAnalyticsPanel,
    defaultAllowedRoles: ['professional'],
  }
};
