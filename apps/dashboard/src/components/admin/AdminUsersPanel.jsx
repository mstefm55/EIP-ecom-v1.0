import { useEffect, useMemo, useState } from "react";
import { RefreshCw, UserPlus, Users, XCircle, Image, Pencil } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const DEFAULT_LAYOUT = {
  title: "Users & roles",
  subtitle: "Manage tenant users and their role assignments.",
  tenant: {
    title: "Tenant",
    placeholder: "Search tenant by name or code...",
    empty: "No tenants found.",
  },
  assignment: {
    title: "Assign role",
    userLabel: "User",
    roleLabel: "Role",
    action: "Assign",
  },
  users: {
    title: "Users",
    empty: "No users found for this tenant.",
  },
};

function mergeLayout(base, override) {
  if (!override || typeof override !== "object") return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  Object.keys(override).forEach((key) => {
    const baseValue = base ? base[key] : undefined;
    const overrideValue = override[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue)
    ) {
      output[key] = mergeLayout(baseValue, overrideValue);
    } else {
      output[key] = overrideValue;
    }
  });
  return output;
}

function formatTenantLabel(tenant) {
  if (!tenant) return "";
  const name = tenant.name || "Unnamed tenant";
  const code = tenant.code || tenant.id;
  return `${name} - ${code}`;
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BASE_URL}${url}`;
}

export default function AdminUsersPanel({ node }) {
  const layout = useMemo(
    () => mergeLayout(DEFAULT_LAYOUT, node?.props?.layout),
    [node?.props?.layout]
  );

  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantQuery, setTenantQuery] = useState("");
  const [tenantInput, setTenantInput] = useState("");
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const [assignForm, setAssignForm] = useState({
    profileRoleId: "",
    accessRoleId: "",
    permissionCode: "",
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    profileRoleId: "",
    accessRoleId: "",
    permissionCode: "",
  });
  const [permissions, setPermissions] = useState([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createNotice, setCreateNotice] = useState(null);
  const [createError, setCreateError] = useState(null);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    title: "",
    phone: "",
    locale: "",
    timezone: "",
    avatar_url: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const tenantDisplay = tenantMenuOpen
    ? tenantInput
    : tenantInput || (selectedTenant ? formatTenantLabel(selectedTenant) : "");

  const roleById = useMemo(() => {
    const map = new Map();
    roles.forEach((role) => {
      map.set(role.id, role);
    });
    return map;
  }, [roles]);

  const profileRoles = useMemo(() => roles.filter((role) => role.is_system), [roles]);
  const accessRoles = useMemo(() => roles.filter((role) => !role.is_system), [roles]);
  const profileRoleOptions = profileRoles.length ? profileRoles : roles;
  const accessRoleOptions = accessRoles.length ? accessRoles : roles;
  const permissionOptions = permissions || [];

  const loadTenants = async (query) => {
    setTenantLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const result = await apiFetch(`/api/eip/admin/tenants?${params.toString()}`);
      setTenantOptions(result.tenants || []);
    } catch (err) {
      setTenantOptions([]);
    } finally {
      setTenantLoading(false);
    }
  };

  const loadTenantData = async (tenantId) => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [userResult, roleResult, permissionResult] = await Promise.all([
        apiFetch(`/api/eip/admin/tenants/${tenantId}/users`),
        apiFetch(`/api/eip/admin/tenants/${tenantId}/roles`),
        apiFetch(`/api/eip/admin/tenants/${tenantId}/permissions`),
      ]);
      setUsers(userResult.users || []);
      setRoles(roleResult.roles || []);
      setPermissions(permissionResult.permissions || []);
    } catch (err) {
      setError(err.message || "Unable to load users.");
      setUsers([]);
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (tenantId, user) => {
    if (!tenantId || !user?.id) return;
    setProfileLoading(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const result = await apiFetch(
        `/api/eip/admin/tenants/${tenantId}/users/${user.id}/profile`
      );
      const profile = result.profile || {};
      setProfileForm({
        display_name: profile.display_name || user.display_name || "",
        title: profile.title || user.title || "",
        phone: profile.phone || user.phone || "",
        locale: profile.locale || user.locale || "",
        timezone: profile.timezone || user.timezone || "",
        avatar_url: profile.avatar_url || user.avatar_url || "",
      });
    } catch (err) {
      setProfileError(err.message || "Unable to load profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleTenantPick = (tenant) => {
    setSelectedTenant(tenant);
    setTenantInput(formatTenantLabel(tenant));
    setTenantQuery("");
    setTenantMenuOpen(false);
    setAssignForm({ profileRoleId: "", accessRoleId: "", permissionCode: "" });
    setSelectedUser(null);
    setCreateForm({ email: "", password: "", profileRoleId: "", accessRoleId: "", permissionCode: "" });
    setCreateNotice(null);
    setCreateError(null);
    loadTenantData(tenant.id);
  };

  const handleAssign = async () => {
    if (!selectedTenant || !selectedUser) {
      setNotice("Select a user first.");
      return;
    }
    const roleIds = [assignForm.profileRoleId, assignForm.accessRoleId].filter(Boolean);
    const uniqueRoleIds = Array.from(new Set(roleIds));
    const permissionCode = assignForm.permissionCode;
    if (uniqueRoleIds.length === 0 && !permissionCode) {
      setNotice("Select a profile, access type, or permission.");
      return;
    }
    setNotice(null);
    setError(null);
    try {
      const tasks = [];
      if (uniqueRoleIds.length) {
        tasks.push(
          ...uniqueRoleIds.map((roleId) =>
            apiFetch(`/api/eip/admin/tenants/${selectedTenant.id}/users/${selectedUser.id}/roles`, {
              method: "POST",
              body: { role_id: roleId },
            })
          )
        );
      }
      if (permissionCode) {
        tasks.push(
          apiFetch(`/api/eip/admin/tenants/${selectedTenant.id}/users/${selectedUser.id}/permissions`, {
            method: "POST",
            body: { permission_code: permissionCode },
          })
        );
      }
      await Promise.all(tasks);
      await loadTenantData(selectedTenant.id);
      setAssignForm({ profileRoleId: "", accessRoleId: "", permissionCode: "" });
    } catch (err) {
      setError(err.message || "Failed to assign role.");
    }
  };

  const handleRemoveRole = async (identityId, roleId) => {
    if (!selectedTenant) return;
    setNotice(null);
    setError(null);
    try {
      await apiFetch(
        `/api/eip/admin/tenants/${selectedTenant.id}/users/${identityId}/roles/${roleId}`,
        { method: "DELETE", body: {} }
      );
      await loadTenantData(selectedTenant.id);
    } catch (err) {
      setError(err.message || "Failed to revoke role.");
    }
  };

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setAssignForm({ profileRoleId: "", accessRoleId: "", permissionCode: "" });
    if (selectedTenant?.id) {
      await loadProfile(selectedTenant.id, user);
    }
  };

  const handleRemovePermission = async (identityId, permissionCode) => {
    if (!selectedTenant) return;
    setNotice(null);
    setError(null);
    try {
      await apiFetch(
        `/api/eip/admin/tenants/${selectedTenant.id}/users/${identityId}/permissions/${encodeURIComponent(
          permissionCode
        )}`,
        { method: "DELETE", body: {} }
      );
      await loadTenantData(selectedTenant.id);
    } catch (err) {
      setError(err.message || "Failed to revoke permission.");
    }
  };

  const handleCreateUser = async () => {
    if (!selectedTenant) {
      setCreateError("Select a tenant first.");
      return;
    }
    if (!createForm.email || !createForm.password) {
      setCreateError("Email and password are required.");
      return;
    }
    setCreateError(null);
    setCreateNotice(null);
    setCreatingUser(true);
    try {
      const result = await apiFetch(`/api/eip/admin/tenants/${selectedTenant.id}/users`, {
        method: "POST",
        body: {
          email: createForm.email,
          password: createForm.password,
          profile_role_id: createForm.profileRoleId || undefined,
          access_role_id: createForm.accessRoleId || undefined,
          permission_code: createForm.permissionCode || undefined,
        },
      });
      await loadTenantData(selectedTenant.id);
      setCreateForm({
        email: "",
        password: "",
        profileRoleId: "",
        accessRoleId: "",
        permissionCode: "",
      });
      setCreateNotice("User created.");
      if (result?.user?.id) {
        const newUser = { id: result.user.id, login: result.user.login };
        await handleSelectUser(newUser);
      }
    } catch (err) {
      setCreateError(err.message || "Failed to create user.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedTenant || !selectedUser) return;
    setProfileSaving(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      await apiFetch(
        `/api/eip/admin/tenants/${selectedTenant.id}/users/${selectedUser.id}/profile`,
        {
          method: "PUT",
          body: { ...profileForm },
        }
      );
      await loadTenantData(selectedTenant.id);
      setProfileNotice("Profile saved.");
    } catch (err) {
      setProfileError(err.message || "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTenant || !selectedUser) return;
    setProfileError(null);
    setProfileNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const csrf = readCookie("csrf");
      const response = await fetch(
        `${BASE_URL}/api/eip/admin/tenants/${selectedTenant.id}/users/${selectedUser.id}/avatar`,
        {
          method: "POST",
          headers: csrf ? { "x-csrf": csrf } : undefined,
          credentials: "include",
          body: formData,
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }
      const data = await response.json();
      setProfileForm((prev) => ({ ...prev, avatar_url: data.avatar_url || prev.avatar_url }));
      await loadTenantData(selectedTenant.id);
      setProfileNotice("Avatar updated.");
    } catch (err) {
      setProfileError(err.message || "Failed to upload avatar.");
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    loadTenants("");
  }, []);

  useEffect(() => {
    if (!tenantMenuOpen) return undefined;
    const handle = setTimeout(() => {
      loadTenants(tenantQuery.trim());
    }, 200);
    return () => clearTimeout(handle);
  }, [tenantMenuOpen, tenantQuery]);

  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">{layout.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{layout.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (selectedTenant?.id) loadTenantData(selectedTenant.id);
          }}
          className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {notice}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-ink-100 bg-white/90 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-ink-500" />
          <h3 className="text-sm font-semibold text-ink-900">{layout.tenant.title}</h3>
        </div>
        <div className="relative mt-3">
          <input
            value={tenantDisplay}
            onChange={(event) => {
              setTenantInput(event.target.value);
              setTenantQuery(event.target.value);
              setSelectedTenant(null);
              setTenantMenuOpen(true);
            }}
            onFocus={() => setTenantMenuOpen(true)}
            onBlur={() => setTimeout(() => setTenantMenuOpen(false), 150)}
            placeholder={layout.tenant.placeholder}
            className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
          />
          {tenantMenuOpen ? (
            <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white p-1 shadow-lg">
              {tenantLoading ? (
                <div className="px-3 py-2 text-xs text-ink-500">Loading...</div>
              ) : null}
              {!tenantLoading && tenantOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-ink-500">{layout.tenant.empty}</div>
              ) : null}
              {tenantOptions.map((tenant) => (
                <button
                  type="button"
                  key={tenant.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleTenantPick(tenant);
                  }}
                  onClick={() => handleTenantPick(tenant)}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-xs text-ink-700 hover:bg-ink-50"
                >
                  <span className="font-semibold">{tenant.name || tenant.code || tenant.id}</span>
                  <span className="text-[0.65rem] text-ink-400">{tenant.code}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">{layout.users.title}</h3>
            {loading ? <span className="text-xs text-ink-400">Loading...</span> : null}
          </div>
          <div className="mt-4 space-y-3">
            {!loading && selectedTenant && users.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-2 text-xs text-ink-500">
                {layout.users.empty}
              </div>
            ) : null}
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`rounded-2xl border bg-white/95 px-4 py-3 transition hover:border-ink-200 hover:bg-white cursor-pointer ${
                  selectedUser?.id === user.id ? "border-ink-400 shadow-soft" : "border-ink-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 text-ink-400">
                      {user.avatar_url ? (
                        <img
                          src={resolveAssetUrl(user.avatar_url)}
                          alt="avatar"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {user.display_name || user.login || user.id}
                      </p>
                      <p className="text-xs text-ink-400">
                        {user.is_active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSelectUser(user);
                    }}
                    className="rounded-full border border-ink-200/70 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 hover:bg-ink-50"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(user.roles || []).length === 0 ? (
                    <span className="rounded-full border border-ink-200/70 bg-ink-50 px-3 py-1 text-xs text-ink-500">
                      No roles
                    </span>
                  ) : (
                    user.roles.map((roleCode, idx) => {
                      const roleId = user.role_ids?.[idx];
                      const role = roleById.get(roleId);
                      return (
                        <span
                          key={`${user.id}-${roleId || roleCode}`}
                          className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-3 py-1 text-xs text-ink-600"
                        >
                          {role?.code || roleCode}
                          {roleId ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveRole(user.id, roleId);
                              }}
                              className="text-ink-400 hover:text-rose-500"
                              aria-label="Remove role"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          ) : null}
                        </span>
                      );
                    })
                  )}
                </div>
                {(user.permissions || []).length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[...new Set(user.permissions)].map((permCode) => (
                      <span
                        key={`${user.id}-${permCode}`}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-xs text-amber-700"
                      >
                        {permCode}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemovePermission(user.id, permCode);
                          }}
                          className="text-amber-500 hover:text-rose-500"
                          aria-label="Remove permission"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-500" />
              <h3 className="text-sm font-semibold text-ink-900">Create user</h3>
            </div>
            {createError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
                {createError}
              </div>
            ) : null}
            {createNotice ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                {createNotice}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3">
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Email
                <input
                  value={createForm.email}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  placeholder="name@company.com"
                />
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Temporary password
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  placeholder="Set a strong password"
                />
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Profile (optional)
                <select
                  value={createForm.profileRoleId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, profileRoleId: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">Select profile</option>
                  {profileRoleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.code} {role.label ? `- ${role.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Access type (optional)
                <select
                  value={createForm.accessRoleId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, accessRoleId: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">Select access</option>
                  {accessRoleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.code} {role.label ? `- ${role.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Additional access (permission)
                <select
                  value={createForm.permissionCode}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, permissionCode: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">Select permission</option>
                  {permissionOptions.map((perm) => (
                    <option key={perm.code} value={perm.code}>
                      {perm.code} {perm.label ? `- ${perm.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={handleCreateUser}
              disabled={!selectedTenant || creatingUser}
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:bg-ink-300"
            >
              <UserPlus className="h-4 w-4" />
              {creatingUser ? "Creating..." : "Create user"}
            </button>
          </div>
          <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-ink-500" />
              <h3 className="text-sm font-semibold text-ink-900">{layout.assignment.title}</h3>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                {layout.assignment.userLabel}
                <div className="mt-2 flex items-center justify-between rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700">
                  <span className={selectedUser ? "text-ink-800" : "text-ink-400"}>
                    {selectedUser
                      ? selectedUser.display_name || selectedUser.login || selectedUser.id
                      : "Select a user from the list"}
                  </span>
                  {selectedUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setAssignForm({ profileRoleId: "", accessRoleId: "", permissionCode: "" });
                      }}
                      className="rounded-full border border-ink-200/70 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-500 hover:bg-ink-50"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>

              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Profile
                <select
                  value={assignForm.profileRoleId}
                  onChange={(event) =>
                    setAssignForm((prev) => ({ ...prev, profileRoleId: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">Select profile</option>
                  {profileRoleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.code} {role.label ? `- ${role.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Access type
                <select
                  value={assignForm.accessRoleId}
                  onChange={(event) =>
                    setAssignForm((prev) => ({ ...prev, accessRoleId: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">Select access</option>
                  {accessRoleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.code} {role.label ? `- ${role.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                Additional access (permission)
                <select
                  value={assignForm.permissionCode}
                  onChange={(event) =>
                    setAssignForm((prev) => ({ ...prev, permissionCode: event.target.value }))
                  }
                  className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                >
                  <option value="">Select permission</option>
                  {permissionOptions.map((perm) => (
                    <option key={perm.code} value={perm.code}>
                      {perm.code} {perm.label ? `- ${perm.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>

            <button
              type="button"
              onClick={handleAssign}
              disabled={
                !selectedTenant ||
                !selectedUser ||
                (!assignForm.profileRoleId && !assignForm.accessRoleId && !assignForm.permissionCode)
              }
              className="mt-2 flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:bg-ink-300"
            >
                <UserPlus className="h-4 w-4" />
                {layout.assignment.action}
              </button>
            </div>
          </div>

          {selectedUser ? (
            <div className="rounded-2xl border border-ink-100 bg-white/90 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">Profile</h3>
                  <p className="text-xs text-ink-400">{selectedUser.login}</p>
                </div>
                {profileLoading ? <span className="text-xs text-ink-400">Loading...</span> : null}
              </div>

              {profileError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
                  {profileError}
                </div>
              ) : null}
              {profileNotice ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                  {profileNotice}
                </div>
              ) : null}

              <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-ink-100 bg-ink-50 text-ink-400">
                  {profileForm.avatar_url ? (
                    <img
                      src={resolveAssetUrl(profileForm.avatar_url)}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 hover:bg-ink-50">
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    Upload avatar
                  </label>
                  <p className="mt-2 text-[0.65rem] text-ink-400">PNG/JPG up to 15MB.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Display name
                  <input
                    value={profileForm.display_name}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, display_name: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Title
                  <input
                    value={profileForm.title}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Phone
                  <input
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Locale
                  <input
                    value={profileForm.locale}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, locale: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
                <label className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                  Timezone
                  <input
                    value={profileForm.timezone}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, timezone: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-xs text-ink-700"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow disabled:bg-ink-300"
              >
                <Pencil className="h-4 w-4" />
                {profileSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
