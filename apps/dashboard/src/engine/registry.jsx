import AuthShell from "../components/auth/AuthShell";
import AuthHero from "../components/auth/AuthHero";
import AuthPanelStack from "../components/auth/AuthPanelStack";
import AuthLoginCard from "../components/auth/AuthLoginCard";
import AuthTotpCard from "../components/auth/AuthTotpCard";
import AuthModal from "../components/auth/AuthModal";
import AuthFeatureGrid from "../components/auth/AuthFeatureGrid";
import AuthSecurityNote from "../components/auth/AuthSecurityNote";
import DataBlock from "../components/engine/DataBlock";
import Box from "../components/engine/Box";
import Text from "../components/engine/Text";
import Grid from "../components/engine/Grid";
import StatCard from "../components/engine/StatCard";
import FormCard from "../components/engine/FormCard";
import AdminShell from "../components/admin/AdminShell";
import AdminHeader from "../components/admin/AdminHeader";
import TenantRequestBoard from "../components/admin/TenantRequestBoard";
import AdminPanel from "../components/admin/AdminPanel";
import AdminMetrics from "../components/admin/AdminMetrics";
import AdminSecurityPanel from "../components/admin/AdminSecurityPanel";
import AdminAuditPanel from "../components/admin/AdminAuditPanel";
import AdminPlaceholderPanel from "../components/admin/AdminPlaceholderPanel";
import AdminMonitoringDashboard from "../components/admin/AdminMonitoringDashboard";
import AdminConnectionsPanel from "../components/admin/AdminConnectionsPanelSafe";
import AdminProcessBuilder from "../components/admin/AdminProcessBuilder";
import AdminDbExplorer from "../components/admin/AdminDbExplorer";
import AdminPortfolioPanel from "../components/admin/AdminPortfolioPanel";
import AdminTemplateClonePanel from "../components/admin/AdminTemplateClonePanel";
import AdminUsersPanel from "../components/admin/AdminUsersPanel";
import AdminModulesPanel from "../components/admin/AdminModulesPanel";
import UserShell from "../components/user/UserShell";
import UserDashboardPanel from "../components/user/UserDashboardPanel";
import UserPanel from "../components/user/UserPanel";
import TenantAdminAccessPanel from "../components/user/TenantAdminAccessPanel";
import UserSecurityPanel from "../components/user/UserSecurityPanel";
import UserPlaceholderPanel from "../components/user/UserPlaceholderPanel";
import EcomProductWorkspace from "../components/ecom/EcomProductWorkspace";
import EcomOrderManagementPanel from "../components/ecom/EcomOrderManagementPanel";
import EcomCommerceSettingsPanel from "../components/ecom/EcomCommerceSettingsPanel";
import EcomCommerceLifecyclePanel from "../components/ecom/EcomCommerceLifecyclePanel";
import CrmWorkspace from "../components/crm/CrmWorkspace";
import InventoryWorkspace from "../components/inventory/InventoryWorkspace";
import ProcurementWorkspace from "../components/procurement/ProcurementWorkspace";

function Fallback({ node }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      Missing component for type: <strong>{node?.type || "unknown"}</strong>
    </div>
  );
}

export const registry = {
  AuthShell,
  AuthHero,
  AuthPanelStack,
  AuthLoginCard,
  AuthTotpCard,
  AuthModal,
  AuthFeatureGrid,
  AuthSecurityNote,
  DataBlock,
  Box,
  Text,
  Grid,
  StatCard,
  FormCard,
  AdminShell,
  AdminHeader,
  TenantRequestBoard,
  AdminPanel,
  AdminMetrics,
  AdminSecurityPanel,
  AdminAuditPanel,
  AdminPlaceholderPanel,
  AdminMonitoringDashboard,
  AdminConnectionsPanel,
  AdminProcessBuilder,
  AdminDbExplorer,
  AdminPortfolioPanel,
  AdminTemplateClonePanel,
  AdminUsersPanel,
  AdminModulesPanel,
  UserShell,
  UserDashboardPanel,
  UserPanel,
  TenantAdminAccessPanel,
  UserSecurityPanel,
  UserPlaceholderPanel,
  EcomProductWorkspace,
  EcomOrderManagementPanel,
  EcomCommerceSettingsPanel,
  EcomCommerceLifecyclePanel,
  CrmWorkspace,
  InventoryWorkspace,
  ProcurementWorkspace,
  Fallback,
};
