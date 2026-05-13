import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilSquareIcon, InboxIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  realName: string;
  email: string;
  phone: string;
  status: string;
  role?: Role;
  roleId: number;
  hospitalId?: number;
  hospital?: { id: number; name: string };
}

interface Hospital {
  id: number;
  name: string;
}

const roleNameMap: Record<string, string> = {
  ADMIN: '系统管理员',
  DOCTOR_LOCAL: '本地医生',
  DOCTOR_REMOTE: '远程专家',
  TECHNICIAN: '技师',
};

const emptyForm = {
  username: '',
  password: '',
  realName: '',
  email: '',
  phone: '',
  roleId: '',
  hospitalId: '',
};

const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data;
    },
  });

  const { data: hospitals } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const res = await api.get('/api/hospitals');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload: Record<string, unknown> = {
        username: data.username,
        password: data.password,
        realName: data.realName,
        email: data.email,
        phone: data.phone,
        roleId: Number(data.roleId),
      };
      if (data.hospitalId) payload.hospitalId = Number(data.hospitalId);
      const res = await api.post('/api/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const payload: Record<string, unknown> = {
        realName: data.realName,
        email: data.email,
        phone: data.phone,
        roleId: Number(data.roleId),
      };
      if (data.password) payload.password = data.password;
      if (data.hospitalId) payload.hospitalId = Number(data.hospitalId);
      const res = await api.put(`/api/users/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put(`/api/users/${id}/status`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      realName: user.realName || '',
      email: user.email || '',
      phone: user.phone || '',
      roleId: user.roleId?.toString() || '',
      hospitalId: user.hospitalId?.toString() || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const uniqueRoles = users?.reduce<Role[]>((acc, u) => {
    if (u.role && !acc.find((r) => r.id === u.role!.id)) {
      acc.push(u.role!);
    }
    return acc;
  }, []) || [];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="用户管理"
        action={
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            添加用户
          </button>
        }
      />

      {users && users.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.realName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        {roleNameMap[user.role?.name || ''] || user.role?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <StatusBadge status={user.status} type="user" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        <button onClick={() => openEditModal(user)} className="text-blue-600 hover:text-blue-900 inline-flex items-center">
                          <PencilSquareIcon className="w-4 h-4 mr-1" />
                          编辑
                        </button>
                        <button
                          onClick={() => toggleStatusMutation.mutate(user.id)}
                          className={`inline-flex items-center ${user.status === 'active' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {user.status === 'active' ? '禁用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState icon={<InboxIcon className="w-16 h-16" />} title="暂无用户数据" description="点击上方按钮添加第一个用户" />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingUser ? '编辑用户' : '添加用户'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input"
              disabled={!!editingUser}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码{editingUser && '（留空则不修改）'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              required={!editingUser}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input
              type="text"
              value={form.realName}
              onChange={(e) => setForm({ ...form, realName: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
            <select
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              className="input"
              required
            >
              <option value="">请选择角色</option>
              {uniqueRoles.map((role) => (
                <option key={role.id} value={role.id}>{roleNameMap[role.name] || role.name}</option>
              ))}
              {uniqueRoles.length === 0 && (
                <>
                  <option value="1">系统管理员</option>
                  <option value="2">本地医生</option>
                  <option value="3">远程专家</option>
                  <option value="4">技师</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所属医院</label>
            <select
              value={form.hospitalId}
              onChange={(e) => setForm({ ...form, hospitalId: e.target.value })}
              className="input"
            >
              <option value="">请选择医院</option>
              {hospitals?.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={closeModal} className="btn-secondary">取消</button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) ? '提交中...' : (editingUser ? '保存' : '创建')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;
