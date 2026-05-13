import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilSquareIcon, BuildingOffice2Icon, MapPinIcon, PhoneIcon, InboxIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Hospital {
  id: number;
  name: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  isEdgeSite: boolean;
}

const emptyForm = {
  name: '',
  country: '',
  city: '',
  address: '',
  phone: '',
  isEdgeSite: false,
};

const Hospitals: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: hospitals, isLoading } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const res = await api.get('/api/hospitals');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await api.post('/api/hospitals', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await api.put(`/api/hospitals/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
      closeModal();
    },
  });

  const openCreateModal = () => {
    setEditingHospital(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setForm({
      name: hospital.name,
      country: hospital.country || '',
      city: hospital.city || '',
      address: hospital.address || '',
      phone: hospital.phone || '',
      isEdgeSite: hospital.isEdgeSite || false,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingHospital(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHospital) {
      updateMutation.mutate({ id: editingHospital.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="医院管理"
        action={
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            添加医院
          </button>
        }
      />

      {hospitals && hospitals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hospitals.map((hospital) => (
            <div key={hospital.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BuildingOffice2Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{hospital.name}</h3>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(hospital)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPinIcon className="w-4 h-4 mr-2 text-gray-400" />
                  <span>
                    {hospital.country && `${hospital.country}, `}{hospital.city}
                  </span>
                </div>
                {hospital.address && (
                  <div className="flex items-start text-sm text-gray-600">
                    <MapPinIcon className="w-4 h-4 mr-2 mt-0.5 text-gray-400" />
                    <span>{hospital.address}</span>
                  </div>
                )}
                {hospital.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{hospital.phone}</span>
                  </div>
                )}
              </div>

              {hospital.isEdgeSite && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    边缘站点
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<InboxIcon className="w-16 h-16" />} title="暂无医院数据" description="点击上方按钮添加第一个医院" />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingHospital ? '编辑医院' : '添加医院'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">医院名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">国家</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
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
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={form.isEdgeSite}
              onChange={(e) => setForm({ ...form, isEdgeSite: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              id="isEdgeSite"
            />
            <label htmlFor="isEdgeSite" className="ml-2 text-sm text-gray-700">边缘站点</label>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={closeModal} className="btn-secondary">取消</button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) ? '提交中...' : (editingHospital ? '保存' : '创建')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Hospitals;
