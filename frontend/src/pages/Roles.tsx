import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheckIcon, PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import PermissionGuard from '@/components/ui/PermissionGuard';
import { PERMISSIONS } from '@/lib/permissions';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Role {
  id: number;
  name: string;
  displayName: string;
  permissions: string[];
  isSystem: boolean;
  _count?: { users: number };
}

interface PermissionGroup {
  label: string;
  permissions: string[];
}

const Roles: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ displayName: '', permissions: [] as string[] });
  const [permissionGroups, setPermissionGroups] = useState<Record<string, PermissionGroup>>({});

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get('/api/roles');
      return data as Role[];
    },
  });

  useEffect(() => {
    api.get('/api/permissions/groups').then(({ data }) => {
      setPermissionGroups(data);
    }).catch(() => {});
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data: { displayName: string; permissions: string[] }) => {
      const resp = await api.post('/api/roles', { name: data.displayName.toUpperCase().replace(/\s+/g, '_'), ...data });
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { displayName?: string; permissions: string[] } }) => {
      const resp = await api.put(`/api/roles/${id}`, data);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteConfirm(null);
    },
  });

  const resetForm = () => {
    setFormData({ displayName: '', permissions: [] });
    setEditingRole(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setFormData({
      displayName: role.displayName,
      permissions: Array.isArray(role.permissions) ? role.permissions : [],
    });
    setShowModal(true);
  };

  const togglePermission = (perm: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleGroup = (groupPerms: string[]) => {
    const allSelected = groupPerms.every((p) => formData.permissions.includes(p));
    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !groupPerms.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...groupPerms])],
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateMutation.mutate({
        id: editingRole.id,
        data: {
          displayName: formData.displayName,
          permissions: formData.permissions,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getPermLabel = (perm: string) => {
    const [module, action] = perm.split(':');
    const moduleLabels: Record<string, string> = {
      user: t('permission.module.user'),
      patient: t('permission.module.patient'),
      study: t('permission.module.study'),
      consultation: t('permission.module.consultation'),
      report: t('permission.module.report'),
      'access-request': t('permission.module.accessRequest'),
      hospital: t('permission.module.hospital'),
      system: t('permission.module.system'),
    };
    const actionLabels: Record<string, string> = {
      list: t('permission.action.list'),
      create: t('permission.action.create'),
      read: t('permission.action.read'),
      update: t('permission.action.update'),
      delete: t('permission.action.delete'),
      upload: t('permission.action.upload'),
      annotate: t('permission.action.annotate'),
      export: t('permission.action.export'),
      join: t('permission.action.join'),
      manage: t('permission.action.manage'),
      close: t('permission.action.close'),
      submit: t('permission.action.submit'),
      sign: t('permission.action.sign'),
      approve: t('permission.action.approve'),
      review: t('permission.action.review'),
      'assign-role': t('permission.action.assignRole'),
      config: t('permission.action.config'),
      audit: t('permission.action.audit'),
    };
    return `${moduleLabels[module] || module}:${actionLabels[action] || action}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ShieldCheckIcon className="w-7 h-7 mr-2 text-primary-600" />
            {t('role.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('role.description')}</p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.USER_ASSIGN_ROLE]}>
          <button onClick={openCreateModal} className="btn-primary flex items-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            {t('role.create')}
          </button>
        </PermissionGuard>
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{role.displayName}</h3>
                {role.isSystem && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    {t('role.systemRole')}
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {role._count?.users || 0} {t('role.usersCount')}
                </span>
              </div>
              <PermissionGuard permissions={[PERMISSIONS.USER_ASSIGN_ROLE]}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(role)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => setDeleteConfirm(role)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </PermissionGuard>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(role.permissions) ? role.permissions : []).map((perm) => (
                <span
                  key={perm}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                >
                  {getPermLabel(perm)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {editingRole ? t('role.edit') : t('role.create')}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('role.displayName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="input"
                  required
                  disabled={editingRole?.isSystem}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('role.permissions')}
                </label>
                <div className="space-y-3">
                  {Object.entries(permissionGroups).map(([key, group]) => {
                    const groupPerms = group.permissions;
                    const allSelected = groupPerms.every((p) => formData.permissions.includes(p));
                    const someSelected = groupPerms.some((p) => formData.permissions.includes(p));

                    return (
                      <div key={key} className="border border-gray-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={() => toggleGroup(groupPerms)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{group.label}</span>
                        </label>
                        <div className="ml-6 flex flex-wrap gap-2">
                          {groupPerms.map((perm) => (
                            <label key={perm} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(perm)}
                                onChange={() => togglePermission(perm)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="text-xs text-gray-600">{getPermLabel(perm)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={t('role.deleteConfirmTitle')}
        message={t('role.deleteConfirmMessage', { name: deleteConfirm?.displayName })}
        confirmText={t('common.delete')}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default Roles;
