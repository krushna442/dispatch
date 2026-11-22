import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { toast } from 'sonner';
import { getNormalizedCustomer } from './PlansPage';
import {
  Users,
  UserPlus,
  Pencil,
  Shield,
  UserCheck,
  UserX,
  Search,
  Building2,
  X,
  Loader2,
  Mail,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';

interface ManagedUser {
  id: number;
  name: string;
  username: string;
  password?: string;
  email: string | null;
  role: 'admin' | 'sales' | 'operator';
  vendor_code: string | null;
  customer_name: string | null;
  receive_despatch_mail?: boolean | number;
  is_active: number | boolean;
  created_at: string;
}

// Preset known customers / vendor codes for convenience
const CUSTOMER_PRESETS = [
  { name: 'ASL PNR MBP', code: '7201012' },
  { name: 'ASL ALW MBP', code: '7205761' },
  { name: 'ASL ALH MBP', code: '7200868' },
  { name: 'Switch Mobility', code: '7207001' },
  { name: 'Tata Motors (TML)', code: 'R64535' },
  { name: 'IPLT', code: '10830-6' },
  { name: 'VE Commercial Vehicles (VECV)', code: 'V113072' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'sales' | 'operator'>('operator');
  const [customerName, setCustomerName] = useState('');
  const [vendorCode, setVendorCode] = useState('');
  const [receiveDespatchMail, setReceiveDespatchMail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'sales' | 'operator'>('operator');
  const [editCustomer, setEditCustomer] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editReceiveDespatchMail, setEditReceiveDespatchMail] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Password Visibility & Clipboard States
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Password copied to clipboard');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get('/api/users');
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSelectPreset = (preset: { name: string; code: string }, isEdit = false) => {
    if (isEdit) {
      setEditCustomer(preset.name);
      setEditVendor(preset.code);
    } else {
      setCustomerName(preset.name);
      setVendorCode(preset.code);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) {
      toast.error('Name, username and password are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/users', {
        name: name.trim(),
        username: username.trim(),
        password: password.trim(),
        email: email.trim() || null,
        role,
        customer_name: customerName.trim() || null,
        vendor_code: vendorCode.trim() || null,
        receive_despatch_mail: receiveDespatchMail,
      });
      toast.success(`User ${username} created successfully`);
      setIsAddOpen(false);
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setCustomerName('');
      setVendorCode('');
      setReceiveDespatchMail(false);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: ManagedUser) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email || '');
    setEditRole(u.role);
    setEditCustomer(u.customer_name || '');
    setEditVendor(u.vendor_code || '');
    setEditReceiveDespatchMail(Boolean(u.receive_despatch_mail));
    setEditIsActive(Boolean(u.is_active));
    setEditPassword(u.password || '');
    setShowEditPassword(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(true);
    try {
      await api.put(`/api/users/${editingUser.id}`, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        role: editRole,
        customer_name: editCustomer.trim() || null,
        vendor_code: editVendor.trim() || null,
        receive_despatch_mail: editReceiveDespatchMail,
        is_active: editIsActive,
        password: editPassword.trim() ? editPassword.trim() : undefined,
      });
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleDeactivate = async (u: ManagedUser) => {
    const isCurrentlyActive = Boolean(u.is_active);
    const confirmMsg = isCurrentlyActive
      ? `Deactivate user "${u.username}"?`
      : `Reactivate user "${u.username}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isCurrentlyActive) {
        await api.delete(`/api/users/${u.id}`);
        toast.info(`User ${u.username} deactivated`);
      } else {
        await api.put(`/api/users/${u.id}`, {
          name: u.name,
          email: u.email,
          role: u.role,
          vendor_code: u.vendor_code,
          customer_name: u.customer_name,
          receive_despatch_mail: Boolean(u.receive_despatch_mail),
          is_active: true,
        });
        toast.success(`User ${u.username} reactivated`);
      }
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.customer_name && u.customer_name.toLowerCase().includes(q)) ||
        (u.vendor_code && u.vendor_code.toLowerCase().includes(q))
      );
    });
  }, [users, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Admin Control Panel
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-teal-400" />
            User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assign users to specific customers and vendor codes to enforce scanning restrictions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search user or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-teal-600/20 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-300">
                <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                <th className="px-4 py-3 font-semibold">User Details</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold min-w-[170px]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                      Password
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllPasswords(!showAllPasswords)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
                    >
                      {showAllPasswords ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Show All</span>
                        </>
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold">Assigned Customer</th>
                <th className="px-4 py-3 font-semibold font-mono">Vendor Code</th>
                <th className="px-4 py-3 font-semibold text-center">Dispatch Mail</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-400" />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => {
                  const isActive = Boolean(u.is_active);

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-500 font-bold">
                        {idx + 1}
                      </td>

                      {/* User details */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white text-sm">{u.name}</div>
                        <div className="text-slate-400 text-[11px] font-mono">@{u.username}</div>
                        {u.email && <div className="text-slate-500 text-[11px]">{u.email}</div>}
                      </td>

                      {/* Role badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : u.role === 'sales'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          {u.role.toUpperCase()}
                        </span>
                      </td>

                      {/* Password */}
                      <td className="px-4 py-3 font-mono">
                        {u.password ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                showAllPasswords || visiblePasswordIds.has(u.id)
                                  ? 'bg-slate-800 text-teal-300 border-teal-500/30 font-bold select-all'
                                  : 'bg-slate-800/60 text-slate-500 border-slate-700/60 tracking-wider'
                              }`}
                            >
                              {showAllPasswords || visiblePasswordIds.has(u.id) ? u.password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(u.id)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title={showAllPasswords || visiblePasswordIds.has(u.id) ? 'Hide password' : 'Show password'}
                            >
                              {showAllPasswords || visiblePasswordIds.has(u.id) ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.password!, u.id)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy password to clipboard"
                            >
                              {copiedId === u.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Customer Name */}
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {u.customer_name || u.vendor_code ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-teal-400" />
                            {getNormalizedCustomer(u.customer_name, u.vendor_code).name || u.customer_name}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">All Customers</span>
                        )}
                      </td>

                      {/* Vendor Code */}
                      <td className="px-4 py-3 font-mono font-bold text-teal-400">
                        {u.vendor_code || getNormalizedCustomer(u.customer_name, u.vendor_code).code ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                            {getNormalizedCustomer(u.customer_name, u.vendor_code).code || u.vendor_code}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-normal">—</span>
                        )}
                      </td>

                      {/* Despatch Mail Notification */}
                      <td className="px-4 py-3 text-center">
                        {Boolean(u.receive_despatch_mail) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                            <Mail className="w-3 h-3" />
                            Enabled
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            title="Edit User"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleDeactivate(u)}
                            title={isActive ? 'Deactivate User' : 'Reactivate User'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {isActive ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-400" />
                Create New Dispatch User
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Nihar Dash"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. nihar"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showAddPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Set password"
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPassword(!showAddPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      title={showAddPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'sales' | 'operator')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="operator">Operator (Scan & Gate Pass only)</option>
                    <option value="sales">Sales (Dispatch Plan, Scan & Gate Pass)</option>
                    <option value="admin">Admin (All Access)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@rsb.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Quick Customer Presets */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Quick Select Customer Preset:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOMER_PRESETS.map((p) => (
                    <button
                      key={p.code + p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p, false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-teal-300 font-medium transition-colors"
                    >
                      {p.name} ({p.code})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    list="user-customer-preset-options"
                    value={customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerName(val);
                      const matched = CUSTOMER_PRESETS.find(
                        (p) => p.name.toLowerCase() === val.toLowerCase()
                      );
                      if (matched) {
                        setVendorCode(matched.code);
                      }
                    }}
                    placeholder="e.g. ASL PNR MBP"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <datalist id="user-customer-preset-options">
                    {CUSTOMER_PRESETS.map((p) => (
                      <option key={p.code + p.name} value={p.name}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Vendor Code
                  </label>
                  <input
                    type="text"
                    value={vendorCode}
                    onChange={(e) => setVendorCode(e.target.value)}
                    placeholder="e.g. 7201012"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Receive Despatch Mails Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-colors">
                  <input
                    type="checkbox"
                    checked={receiveDespatchMail}
                    onChange={(e) => setReceiveDespatchMail(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-teal-600 focus:ring-teal-500 bg-slate-700 border-slate-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-teal-400" />
                      Receive Dispatch Mails
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Receive automated emails with gate pass and parts tabular breakdown whenever a gate pass is submitted.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md shadow-teal-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-teal-400" />
                Edit User: @{editingUser.username}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'admin' | 'sales' | 'operator')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="operator">Operator (Scan & Gate Pass only)</option>
                    <option value="sales">Sales (Dispatch Plan, Scan & Gate Pass)</option>
                    <option value="admin">Admin (All Access)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-400">
                      Password
                    </label>
                    {editingUser.password && (
                      <span className="text-[11px] text-teal-400 font-mono">
                        Current: <strong className="select-all bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-teal-300">{editingUser.password}</strong>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder={editingUser.password ? `Current: ${editingUser.password}` : 'Leave blank to keep unchanged'}
                      className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      title={showEditPassword ? 'Hide password' : 'Show password'}
                    >
                      {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Active Status
                  </label>
                  <select
                    value={editIsActive ? '1' : '0'}
                    onChange={(e) => setEditIsActive(e.target.value === '1')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="1">Active</option>
                    <option value="0">Deactivated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Customer Presets */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Quick Select Customer Preset:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOMER_PRESETS.map((p) => (
                    <button
                      key={p.code + p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p, true)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-teal-300 font-medium transition-colors"
                    >
                      {p.name} ({p.code})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    list="edit-user-customer-preset-options"
                    value={editCustomer}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditCustomer(val);
                      const matched = CUSTOMER_PRESETS.find(
                        (p) => p.name.toLowerCase() === val.toLowerCase()
                      );
                      if (matched) {
                        setEditVendor(matched.code);
                      }
                    }}
                    placeholder="e.g. ASL PNR MBP"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <datalist id="edit-user-customer-preset-options">
                    {CUSTOMER_PRESETS.map((p) => (
                      <option key={p.code + p.name} value={p.name}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Vendor Code
                  </label>
                  <input
                    type="text"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    placeholder="e.g. 7201012"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Receive Despatch Mails Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer bg-slate-800/60 p-3 rounded-xl border border-slate-700/80 hover:border-slate-600 transition-colors">
                  <input
                    type="checkbox"
                    checked={editReceiveDespatchMail}
                    onChange={(e) => setEditReceiveDespatchMail(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-teal-600 focus:ring-teal-500 bg-slate-700 border-slate-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-teal-400" />
                      Receive Dispatch Mails
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Receive automated emails with gate pass and parts tabular breakdown whenever a gate pass is submitted.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md shadow-teal-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
