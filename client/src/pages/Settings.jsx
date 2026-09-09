import React from 'react';

export default function Settings() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Configure verification engine preferences.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900">Verification Mode</label>
          <select className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-primary-500 sm:text-sm">
            <option>STANDARD (Recommended)</option>
            <option>FAST (Syntax & DNS only)</option>
            <option>DEEP (Thorough SMTP + Catch-all)</option>
          </select>
          <p className="mt-2 text-sm text-gray-500">Standard performs full checks including SMTP handshakes.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">SMTP Timeout (ms)</label>
          <input type="number" defaultValue={10000} className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-900">Concurrent Jobs (Worker)</label>
          <input type="number" defaultValue={5} className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-primary-500 sm:text-sm" />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-700">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
