import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, XCircle, FileText, Trash2 } from 'lucide-react';
import axios from 'axios';

export default function History() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const res = await axios.get('/api/jobs');
      setJobs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id, action) => {
    try {
      if (action === 'delete') {
        await axios.delete(`/api/jobs/${id}`);
      } else {
        await axios.post(`/api/jobs/${id}/${action}`);
      }
      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED': return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Completed</span>;
      case 'RUNNING': return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium animate-pulse">Running</span>;
      case 'PAUSED': return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">Paused</span>;
      case 'PENDING': return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">Pending</span>;
      case 'CANCELLED': return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">Cancelled</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Verification History</h1>
        <p className="mt-2 text-gray-600">View and manage your past and current verification jobs.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-medium">Job Name</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Progress</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <Link to={`/results/${job.id}`} className="hover:text-primary-600">{job.name}</Link>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(job.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-gray-900">{job.total_count.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-500" 
                          style={{ width: `${(job.processed_count / job.total_count) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round((job.processed_count / job.total_count) * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(job.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {job.status === 'PENDING' || job.status === 'PAUSED' ? (
                        <button onClick={() => handleAction(job.id, 'start')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Start">
                          <Play className="w-4 h-4" />
                        </button>
                      ) : null}
                      {job.status === 'RUNNING' ? (
                        <button onClick={() => handleAction(job.id, 'pause')} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Pause">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : null}
                      {job.status === 'RUNNING' || job.status === 'PAUSED' || job.status === 'PENDING' ? (
                        <button onClick={() => handleAction(job.id, 'cancel')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Cancel">
                          <XCircle className="w-4 h-4" />
                        </button>
                      ) : null}
                      <Link to={`/results/${job.id}`} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="View Results">
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleAction(job.id, 'delete')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">No jobs found. Start by uploading a list.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
