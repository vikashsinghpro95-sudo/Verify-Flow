import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CheckCircle2, XCircle, AlertTriangle, Mail } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, deliverable: 0, undeliverable: 0, risky: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/jobs').then(res => {
      const data = res.data.reduce((acc, job) => {
        acc.total += job.total_count || 0;
        acc.deliverable += job.deliverable_count || 0;
        acc.undeliverable += job.undeliverable_count || 0;
        acc.risky += job.risky_count || 0;
        return acc;
      }, { total: 0, deliverable: 0, undeliverable: 0, risky: 0 });
      setStats(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const chartData = [
    { name: 'Deliverable', value: stats.deliverable, color: '#22c55e' },
    { name: 'Risky', value: stats.risky, color: '#f59e0b' },
    { name: 'Undeliverable', value: stats.undeliverable, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const StatCard = ({ title, value, icon: Icon, bg, text }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-4 rounded-xl ${bg}`}>
        <Icon className={`w-8 h-8 ${text}`} />
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
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>)}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Total Verified" value={stats.total} icon={Mail} bg="bg-blue-100" text="text-blue-600" />
            <StatCard title="Deliverable" value={stats.deliverable} icon={CheckCircle2} bg="bg-green-100" text="text-green-600" />
            <StatCard title="Risky (Send With Caution)" value={stats.risky} icon={AlertTriangle} bg="bg-amber-100" text="text-amber-600" />
            <StatCard title="Undeliverable" value={stats.undeliverable} icon={XCircle} bg="bg-red-100" text="text-red-600" />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-96">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Distribution</h2>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={70} outerRadius={120} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString()} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
