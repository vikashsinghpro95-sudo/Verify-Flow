import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Copy, Check, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export default function Results() {
  const { jobId } = useParams();
  const [results, setResults] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobRes, resRes] = await Promise.all([
          axios.get(`/api/jobs/${jobId}`),
          axios.get(`/api/jobs/${jobId}/results?limit=100000`)
        ]);
        setJob(jobRes.data);
        setResults(resRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [jobId]);

  const handleExport = (type) => {
    window.open(`/api/jobs/${jobId}/export?type=${type}`, '_blank');
  };

  const handleCopy = (statusFilter) => {
    const emails = results
      .filter(r => statusFilter === 'ALL' ? (r.status === 'DELIVERABLE' || r.status === 'RISKY') : r.status === statusFilter)
      .map(r => r.original_email)
      .join('\n');
    
    if (emails) {
      navigator.clipboard.writeText(emails).then(() => {
        setCopied(statusFilter);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => alert('Failed to copy to clipboard'));
    } else {
      alert(`No ${statusFilter} emails to copy.`);
    }
  };

  const getStatusStyle = (status, verificationLevel) => {
    switch(status) {
      case 'DELIVERABLE': return 'text-green-700 bg-green-100 border border-green-200';
      case 'RISKY': return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'UNDELIVERABLE': return 'text-red-700 bg-red-50 border border-red-200';
      default: return 'text-gray-600 bg-gray-50 border border-gray-200';
    }
  };

  const getStatusLabel = (status, verificationLevel) => {
    if (status === 'RISKY') {
      if (verificationLevel === 'IP_BLOCKED') return '⚠ RISKY (IP Blocked)';
      if (verificationLevel === 'CATCH_ALL') return '⚠ RISKY (Catch-All)';
      if (verificationLevel === 'SOFT_ROLE') return '⚠ RISKY (Role Address)';
      if (verificationLevel === 'GREYLISTED') return '⚠ RISKY (Greylisted)';
      if (verificationLevel === 'TIMEOUT') return '⚠ RISKY (Timeout)';
      return '⚠ RISKY';
    }
    if (status === 'DELIVERABLE') {
      if (verificationLevel === 'CONFIRMED_ROLE') return '✓ DELIVERABLE (Role)';
      return '✓ DELIVERABLE';
    }
    return status || 'PENDING';
  };

  const filteredResults = filter === 'ALL'
    ? results
    : results.filter(r => r.status === filter);

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Results</h1>
          <p className="mt-2 text-gray-600">{job ? `Showing results for ${job.name}` : 'Loading...'}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => handleCopy('DELIVERABLE')} className="bg-white text-gray-700 border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center transition-colors">
            {copied === 'DELIVERABLE' ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
            Copy Deliverable
          </button>
          <button onClick={() => handleCopy('RISKY')} className="bg-white text-amber-700 border border-amber-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 flex items-center transition-colors">
            {copied === 'RISKY' ? <Check className="w-4 h-4 mr-1 text-amber-600" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
            Copy Risky
          </button>
          <button onClick={() => handleExport('deliverable')} className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Deliverable
          </button>
          <button onClick={() => handleExport('risky')} className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Risky
          </button>
          <button onClick={() => handleExport('undeliverable')} className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Undeliverable
          </button>
          <button onClick={() => handleExport('all')} className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Export All
          </button>
        </div>
      </div>

      {/* Summary Counts + Filter Tabs */}
      <div className="flex gap-3 flex-wrap">
        {['ALL', 'DELIVERABLE', 'RISKY', 'UNDELIVERABLE'].map(s => {
          const count = s === 'ALL' ? results.length : (counts[s] || 0);
          const active = filter === s;
          const colorMap = {
            ALL: active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200',
            DELIVERABLE: active ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border border-green-200',
            RISKY: active ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200',
            UNDELIVERABLE: active ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 border border-red-200',
          };
          return (
            <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${colorMap[s]}`}>
              {s} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Score</th>
                <th className="px-6 py-4 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResults.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-gray-900 font-medium">{r.original_email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusStyle(r.status, r.verification_level)}`}>
                      {getStatusLabel(r.status, r.verification_level)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{r.confidence_score !== null ? r.confidence_score : '-'}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs" title={r.risk_reasons}>
                    <span className="truncate block">{r.risk_reasons || '-'}</span>
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No results found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
