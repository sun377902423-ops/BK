import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrashIcon, EyeIcon, MagnifyingGlassIcon, InboxIcon, CloudArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Study {
  id: number;
  orthancStudyId: string;
  modality: string;
  studyDate: string;
  studyDescription: string;
  seriesCount: number;
  patient?: { id: number; name: string; patientId: string };
  hospital?: { id: number; name: string };
}

interface Patient {
  id: number;
  name: string;
  patientId: string;
}

interface Hospital {
  id: number;
  name: string;
}

const Studies: React.FC = () => {
  const queryClient = useQueryClient();
  const [modality, setModality] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Study | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    patientId: '',
    hospitalId: '',
    studyDescription: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [uploadResults, setUploadResults] = useState<Array<{ fileName: string; success: boolean; message: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: studies, isLoading } = useQuery<Study[]>({
    queryKey: ['studies', modality, patientSearch],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (modality) params.modality = modality;
      if (patientSearch) params.patientId = patientSearch;
      const res = await api.get('/api/studies', { params });
      return res.data;
    },
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: async () => {
      const res = await api.get('/api/patients');
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/studies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      setDeleteTarget(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.patientId || selectedFiles.length === 0) return;

    setUploadResults([]);
    const results: Array<{ fileName: string; success: boolean; message: string }> = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length, fileName: file.name });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('patientId', uploadForm.patientId);
      if (uploadForm.hospitalId) formData.append('hospitalId', uploadForm.hospitalId);
      if (uploadForm.studyDescription) formData.append('studyDescription', uploadForm.studyDescription);

      try {
        const res = await api.post('/api/studies/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        results.push({ fileName: file.name, success: true, message: res.data.message || '上传成功' });
      } catch (err: any) {
        const msg = err.response?.data?.error || '上传失败';
        results.push({ fileName: file.name, success: false, message: msg });
      }
    }

    setUploadProgress(null);
    setUploadResults(results);
    queryClient.invalidateQueries({ queryKey: ['studies'] });
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setSelectedFiles([]);
    setUploadForm({ patientId: '', hospitalId: '', studyDescription: '' });
    setUploadProgress(null);
    setUploadResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="影像检查"
        action={
          <button
            onClick={() => setUploadModalOpen(true)}
            className="btn-primary inline-flex items-center"
          >
            <CloudArrowUpIcon className="w-4 h-4 mr-1" />
            上传影像
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="input w-40"
          >
            <option value="">全部类型</option>
            <option value="CT">CT</option>
            <option value="MR">MR</option>
            <option value="XR">XR</option>
            <option value="US">US</option>
            <option value="NM">NM</option>
            <option value="PT">PT</option>
          </select>
        </div>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="input pl-10 w-64"
            placeholder="搜索患者ID..."
          />
        </div>
      </div>

      {studies && studies.length > 0 ? (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">检查ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">患者</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">检查类型</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">检查日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">描述</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">系列</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studies.map((study) => (
                  <tr key={study.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">{study.orthancStudyId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {study.patient ? `${study.patient.name} (${study.patient.patientId})` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800">
                        {study.modality}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {study.studyDate ? new Date(study.studyDate).toLocaleDateString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{study.studyDescription || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{study.seriesCount || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        <a
                          href={`/ohif/viewer?StudyInstanceUIDs=${study.orthancStudyId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-900 inline-flex items-center"
                        >
                          <EyeIcon className="w-4 h-4 mr-1" />
                          查看影像
                        </a>
                        <button
                          onClick={() => setDeleteTarget(study)}
                          className="text-red-600 hover:text-red-900 inline-flex items-center"
                        >
                          <TrashIcon className="w-4 h-4 mr-1" />
                          删除
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
        <EmptyState
          icon={<InboxIcon className="w-16 h-16" />}
          title="暂无检查数据"
          description="点击上方按钮上传DICOM影像文件"
          action={
            <button onClick={() => setUploadModalOpen(true)} className="btn-primary inline-flex items-center mt-2">
              <CloudArrowUpIcon className="w-4 h-4 mr-1" />
              上传影像
            </button>
          }
        />
      )}

      <Modal
        isOpen={uploadModalOpen}
        onClose={closeUploadModal}
        title="上传影像文件"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择患者 <span className="text-red-500">*</span></label>
            <select
              value={uploadForm.patientId}
              onChange={(e) => setUploadForm({ ...uploadForm, patientId: e.target.value })}
              className="input"
              required
              disabled={!!uploadProgress}
            >
              <option value="">请选择患者</option>
              {patients?.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所属医院</label>
            <select
              value={uploadForm.hospitalId}
              onChange={(e) => setUploadForm({ ...uploadForm, hospitalId: e.target.value })}
              className="input"
              disabled={!!uploadProgress}
            >
              <option value="">请选择医院</option>
              {hospitals?.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">检查描述</label>
            <input
              type="text"
              value={uploadForm.studyDescription}
              onChange={(e) => setUploadForm({ ...uploadForm, studyDescription: e.target.value })}
              className="input"
              placeholder="例如：胸部CT平扫"
              disabled={!!uploadProgress}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择文件 <span className="text-red-500">*</span></label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary-400 transition-colors">
              <div className="space-y-2 text-center">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none"
                  >
                    <span>选择文件</span>
                    <input
                      id="file-upload"
                      ref={fileInputRef}
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".dcm,.dicom,*/*"
                      multiple
                      onChange={handleFileSelect}
                      disabled={!!uploadProgress}
                    />
                  </label>
                  <p className="pl-1">或拖拽文件到此处</p>
                </div>
                <p className="text-xs text-gray-500">支持 DICOM (.dcm) 文件，可多选，单文件最大100MB</p>
              </div>
            </div>
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-gray-700">已选择 {selectedFiles.length} 个文件：</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center text-sm text-gray-600">
                      <DocumentTextIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto text-gray-400 flex-shrink-0">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {uploadProgress && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-700">
                  正在上传: {uploadProgress.fileName}
                </span>
                <span className="text-sm text-blue-600">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {uploadResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">上传结果：</p>
              {uploadResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center text-sm p-2 rounded ${
                    result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <DocumentTextIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{result.fileName}</span>
                  <span className="ml-auto flex-shrink-0">{result.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={closeUploadModal} className="btn-secondary" disabled={!!uploadProgress}>
              {uploadResults.length > 0 ? '关闭' : '取消'}
            </button>
            {uploadResults.length === 0 && (
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadForm.patientId || selectedFiles.length === 0 || !!uploadProgress}
                className="btn-primary disabled:opacity-50"
              >
                {uploadProgress ? `上传中 (${uploadProgress.current}/${uploadProgress.total})...` : `上传 ${selectedFiles.length > 0 ? `(${selectedFiles.length}个文件)` : ''}`}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="确认删除"
        message={`确定要删除检查「${deleteTarget?.orthancStudyId}」吗？此操作不可撤销。`}
        confirmText="删除"
        variant="danger"
      />
    </div>
  );
};

export default Studies;
