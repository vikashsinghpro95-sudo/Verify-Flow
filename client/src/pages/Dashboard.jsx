import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, XCircle } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, deliverable: 0, undeliverable: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app we'd have a specific /api/stats endpoint, but we can compute from jobs
    axios.get('/api/jobs').then(res => {
      const data = res.data.reduce((acc, job) => {
        acc.total += job.total_count;
        acc.deliverable += job.deliverable_count;
        acc.undeliverable += job.undeliverable_count;
        return acc;
      }, { total: 0, deliverable: 0, undeliverable: 0 });
      setStats(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const chartData = [
    { name: 'Deliverable', value: stats.deliverable, color: '#22c55e' },
    { name: 'Undeliverable', value: stats.undeliverable, color: '#ef4444' },
  ];

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-4 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon className={`w-8 h-8 ${colorClass.replace('bg-', 'text-').replace('-100', '-600')}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      
      {loading ? (
        <div className="animate-pulse space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Deliverable" value={stats.deliverable} icon={CheckCircle2} colorClass="bg-green-100 text-green-600" />
            <StatCard title="Undeliverable" value={stats.undeliverable} icon={XCircle} colorClass="bg-red-100 text-red-600" />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-96">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Verification Distribution</h2>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
