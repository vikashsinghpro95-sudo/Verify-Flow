import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import axios from 'axios';

export default function Results() {
  const { jobId } = useParams();
  const [results, setResults] = useState([]);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobRes, resRes] = await Promise.all([
          axios.get(`/api/jobs/${jobId}`),
          axios.get(`/api/jobs/${jobId}/results?limit=100`)
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

  const getStatusColor = (status) => {
    switch(status) {
      case 'DELIVERABLE': return 'text-green-600 bg-green-50';
      case 'RISKY': return 'text-amber-600 bg-amber-50';
      case 'UNDELIVERABLE': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Results</h1>
          <p className="mt-2 text-gray-600">{job ? `Showing results for ${job.name}` : 'Loading...'}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => handleExport('deliverable')} className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Deliverable
          </button>
          <button onClick={() => handleExport('risky')} className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Risky
          </button>
          <button onClick={() => handleExport('undeliverable')} className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Undeliverable
          </button>
          <button onClick={() => handleExport('unknown')} className="bg-gray-50 text-gray-700 border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Unknown
          </button>
          <button onClick={() => handleExport('all')} className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center">
            <Download className="w-4 h-4 mr-1" />
            Export All
          </button>
        </div>
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
              {results.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-gray-900 font-medium">{r.original_email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>
                      {r.status || 'PENDING'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{r.confidence_score !== null ? r.confidence_score : '-'}</td>
                  <td className="px-6 py-4 text-gray-500 truncate max-w-xs" title={r.risk_reasons}>{r.risk_reasons || '-'}</td>
                </tr>
              ))}
              {results.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No results found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
