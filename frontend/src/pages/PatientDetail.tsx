import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  UserIcon,
  ClipboardDocumentListIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';

interface Study {
  id: number;
  orthancStudyId: string;
  modality: string;
  studyDate: string;
  studyDescription: string;
  seriesCount: number;
}

interface Consultation {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  participants?: { id: number; realName: string }[];
}

interface Hospital {
  id: number;
  name: string;
}

interface Patient {
  id: number;
  patientId: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  hospitalId: number;
  hospital?: { id: number; name: string };
  studies: Study[];
  consultations: Consultation[];
  createdAt: string;
}

const PatientDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'studies' | 'consultations'>('studies');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: '',
    name: '',
    gender: 'MALE',
    birthDate: '',
    phone: '',
    email: '',
    address: '',
    hospitalId: '',
  });

  const genderMap: Record<string, string> = {
    MALE: t('gender.male'),
    FEMALE: t('gender.female'),
    OTHER: t('gender.other'),
  };

  const { data: patient, isLoading } = useQuery<Patient>({
    queryKey: ['patient', id],
    queryFn: async () => {
      const res = await api.get(`/api/patients/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: hospitals } = useQuery<Hospital[]>({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const res = await api.get('/api/hospitals');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await api.put(`/api/patients/${id}`, { ...data, hospitalId: Number(data.hospitalId) || undefined });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      setEditModalOpen(false);
    },
  });

  const openEditModal = () => {
    if (patient) {
      setForm({
        patientId: patient.patientId,
        name: patient.name,
        gender: patient.gender,
        birthDate: patient.birthDate?.split('T')[0] || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        hospitalId: patient.hospitalId?.toString() || '',
      });
      setEditModalOpen(true);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!patient) return <div className="text-center py-12 text-gray-500">{t('patient.notFound')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/patients')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{t('patient.detail')}</h1>
        </div>
        <button onClick={openEditModal} className="btn-primary inline-flex items-center">
          <PencilSquareIcon className="w-4 h-4 mr-1" />
          {t('common.edit')}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start space-x-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-8 h-8 text-blue-600" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
            <div>
              <p className="text-sm text-gray-500">{t('patient.name')}</p>
              <p className="text-base font-medium text-gray-900">{patient.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.patientId')}</p>
              <p className="text-base font-medium text-primary-600">{patient.patientId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.gender')}</p>
              <p className="text-base font-medium text-gray-900">{genderMap[patient.gender] || patient.gender}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.birthDate')}</p>
              <p className="text-base font-medium text-gray-900">
                {patient.birthDate ? new Date(patient.birthDate).toLocaleDateString(i18n.language) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.phone')}</p>
              <p className="text-base font-medium text-gray-900">{patient.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.email')}</p>
              <p className="text-base font-medium text-gray-900">{patient.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.hospital')}</p>
              <p className="text-base font-medium text-gray-900">{patient.hospital?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('patient.createdAt')}</p>
              <p className="text-base font-medium text-gray-900">
                {new Date(patient.createdAt).toLocaleDateString(i18n.language)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('studies')}
              className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center ${
                activeTab === 'studies'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ClipboardDocumentListIcon className="w-4 h-4 mr-2" />
              {t('patient.relatedStudies')}
            </button>
            <button
              onClick={() => setActiveTab('consultations')}
              className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center ${
                activeTab === 'consultations'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <VideoCameraIcon className="w-4 h-4 mr-2" />
              {t('patient.consultationRecords')}
            </button>
          </nav>
        </div>

        <div className="mt-4">
          {activeTab === 'studies' && (
            patient.studies && patient.studies.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('study.studyId')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('study.modality')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('study.studyDate')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('study.description')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('study.series')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {patient.studies.map((study) => (
                      <tr key={study.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-primary-600">{study.orthancStudyId}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{study.modality}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {study.studyDate ? new Date(study.studyDate).toLocaleDateString(i18n.language) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{study.studyDescription || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{study.seriesCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-400">{t('patient.noRelatedStudies')}</div>
            )
          )}

          {activeTab === 'consultations' && (
            patient.consultations && patient.consultations.length > 0 ? (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('consultation.consultationTitle')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('accessRequest.status')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('consultation.participants')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('patient.createdAt')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {patient.consultations.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/consultations/${c.id}`)}>
                        <td className="px-6 py-4 text-sm font-medium text-primary-600">{c.title}</td>
                        <td className="px-6 py-4 text-sm"><StatusBadge status={c.status} type="consultation" /></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{c.participants?.length || 0}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(c.createdAt).toLocaleDateString(i18n.language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-400">{t('patient.noConsultationRecords')}</div>
            )
          )}
        </div>
      </div>

      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={t('patient.editPatient')}
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.patientId')}</label>
              <input type="text" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.name')}</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.gender')}</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input">
                <option value="MALE">{t('gender.male')}</option>
                <option value="FEMALE">{t('gender.female')}</option>
                <option value="OTHER">{t('gender.other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.birthDate')}</label>
              <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.phone')}</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.email')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.address')}</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('patient.hospital')}</label>
              <select value={form.hospitalId} onChange={(e) => setForm({ ...form, hospitalId: e.target.value })} className="input">
                <option value="">{t('patient.selectHospital')}</option>
                {hospitals?.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={updateMutation.isPending} className="btn-primary disabled:opacity-50">
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PatientDetail;
