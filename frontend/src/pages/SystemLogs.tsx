import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ServerIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface LogService {
  id: string;
  name: string;
}

interface LogLine {
  index: number;
  content: string;
  isError: boolean;
}

interface LogResponse {
  service: string;
  name: string;
  lines: LogLine[];
  total: number;
}

const SystemLogs: React.FC = () => {
  const { t } = useTranslation();
  const [selectedService, setSelectedService] = useState('backend');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [linesCount, setLinesCount] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const { data: services } = useQuery<LogService[]>({
    queryKey: ['log-services'],
    queryFn: async () => {
      const res = await api.get('/api/logs/services');
      return res.data;
    },
  });

  const {
    data: logData,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery<LogResponse>({
    queryKey: ['logs', selectedService, linesCount, errorsOnly],
    queryFn: async () => {
      const res = await api.get(`/api/logs/${selectedService}`, {
        params: { lines: linesCount, errors: errorsOnly },
      });
      return res.data;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logData]);

  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const handleCopy = useCallback(() => {
    if (!logData?.lines) return;
    const text = logData.lines.map((l) => l.content).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [logData]);

  const getLineClassName = (line: LogLine) => {
    if (line.isError) {
      return 'text-red-400 bg-red-950/30';
    }
    return 'text-gray-300';
  };

  const highlightContent = (content: string, isErr: boolean) => {
    if (!isErr) return content;
    return content.replace(
      /\b(error|err|fatal|panic|crit|alert|emerg|fail|exception|warn|warning)\b/gi,
      '<span class="font-bold text-red-300">$1</span>'
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')} />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="input pr-8 appearance-none min-w-[180px]"
          >
            {services?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={linesCount}
            onChange={(e) => setLinesCount(Number(e.target.value))}
            className="input pr-8 appearance-none min-w-[120px]"
          >
            <option value={50}>50 {t('logs.lines')}</option>
            <option value={200}>200 {t('logs.lines')}</option>
            <option value={500}>500 {t('logs.lines')}</option>
            <option value={1000}>1000 {t('logs.lines')}</option>
          </select>
          <ChevronDownIcon className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => setErrorsOnly(!errorsOnly)}
          className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            errorsOnly
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FunnelIcon className="w-4 h-4 mr-1.5" />
          {t('logs.errorsOnly')}
        </button>

        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          {t('logs.refresh')}
        </button>

        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            autoRefresh
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <ServerIcon className="w-4 h-4 mr-1.5" />
          {autoRefresh ? t('logs.autoRefreshOn') : t('logs.autoRefreshOff')}
        </button>

        <button
          onClick={handleCopy}
          className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <ClipboardDocumentIcon className="w-4 h-4 mr-1.5" />
          {copied ? t('logs.copied') : t('logs.copy')}
        </button>

        {dataUpdatedAt > 0 && (
          <span className="text-xs text-gray-400 ml-auto">
            {t('logs.lastUpdate')}: {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex-1 bg-gray-900 rounded-lg shadow-md overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-gray-400 text-xs font-mono ml-2">
              {logData?.name || selectedService} — {logData?.total || 0} {t('logs.linesCount')}
            </span>
          </div>
          {errorsOnly && logData?.total !== undefined && (
            <span className="text-red-400 text-xs font-medium">
              {logData.total} {t('logs.errorLines')}
            </span>
          )}
        </div>

        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto font-mono text-xs leading-5 p-4"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
            </div>
          ) : !logData?.lines?.length ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {errorsOnly ? t('logs.noErrors') : t('logs.noLogs')}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {logData.lines.map((line) => (
                  <tr key={line.index} className={`hover:bg-gray-800/50 ${getLineClassName(line)}`}>
                    <td className="text-right text-gray-600 pr-3 select-none border-r border-gray-700/50 whitespace-nowrap w-1">
                      {line.index + 1}
                    </td>
                    <td className="pl-3 whitespace-pre-wrap break-all">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: highlightContent(line.content, line.isError),
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
