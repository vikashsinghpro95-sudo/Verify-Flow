import React, { useState, useEffect } from 'react';
import { Shield, Wifi, CheckCircle2, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export default function Settings() {
  const [proxy, setProxy] = useState({ enabled: false, host: '', port: 1080 });
  const [proxyStatus, setProxyStatus] = useState(null); // 'saved' | 'error'
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    axios.get('/api/settings/proxy').then(r => setProxy(r.data)).catch(() => {});
  }, []);

  const saveProxy = async () => {
    try {
      const res = await axios.post('/api/settings/proxy', proxy);
      setProxyStatus('saved');
      setTimeout(() => setProxyStatus(null), 3000);
    } catch {
      setProxyStatus('error');
    }
  };

  const disableProxy = async () => {
    const updated = { ...proxy, enabled: false };
    setProxy(updated);
    try {
      await axios.post('/api/settings/proxy', updated);
      setProxyStatus('saved');
      setTimeout(() => setProxyStatus(null), 3000);
    } catch {}
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">Configure verification engine preferences.</p>
      </div>

      {/* SOCKS5 Proxy Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-100 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">SMTP Proxy (Fix IP Blocks)</h2>
            <p className="text-sm text-gray-500">Route SMTP checks through a clean VPS IP to bypass Spamhaus blocks</p>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* How-to Guide */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-2">
            <p className="font-semibold flex items-center gap-2"><Wifi className="w-4 h-4" /> How to set up a free SOCKS5 proxy:</p>
            <ol className="list-decimal ml-4 space-y-1 text-blue-700">
              <li>Rent a cheap VPS (Hetzner €3.79/mo, Vultr $5/mo, DigitalOcean $6/mo)</li>
              <li>Open a terminal and run: <code className="bg-blue-100 px-1 rounded font-mono">ssh -D 1080 -N root@YOUR_VPS_IP</code></li>
              <li>Leave that terminal open, then configure below with <strong>Host: 127.0.0.1</strong>, <strong>Port: 1080</strong></li>
              <li>All SMTP checks will now use your VPS's clean IP!</li>
            </ol>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable SOCKS5 Proxy</p>
              <p className="text-sm text-gray-500">When enabled, all SMTP verifications route through the proxy</p>
            </div>
            <button
              onClick={() => setProxy(p => ({ ...p, enabled: !p.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${proxy.enabled ? 'bg-primary-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${proxy.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {proxy.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Proxy Host</label>
                <input
                  type="text"
                  value={proxy.host}
                  onChange={e => setProxy(p => ({ ...p, host: e.target.value }))}
                  placeholder="127.0.0.1 or your VPS IP"
                  className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary-500 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Proxy Port</label>
                <input
                  type="number"
                  value={proxy.port}
                  onChange={e => setProxy(p => ({ ...p, port: parseInt(e.target.value) || 1080 }))}
                  placeholder="1080"
                  className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-primary-500 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={saveProxy}
              className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-700 transition-colors"
            >
              {proxy.enabled ? 'Enable Proxy' : 'Disable Proxy'}
            </button>
            {proxy.enabled && (
              <button
                onClick={disableProxy}
                className="bg-white text-gray-600 border border-gray-200 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Turn Off
              </button>
            )}
            {proxyStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved!
              </span>
            )}
            {proxyStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" /> Failed to save
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Verification Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Verification Engine</h2>
        <div>
          <label className="block text-sm font-medium text-gray-900">Verification Mode</label>
          <select className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-primary-500 focus:outline-none sm:text-sm">
            <option>STANDARD (Recommended)</option>
            <option>FAST (Syntax &amp; DNS only)</option>
            <option>DEEP (Thorough SMTP + Catch-all)</option>
          </select>
          <p className="mt-2 text-sm text-gray-500">Standard performs full checks including SMTP handshakes.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">SMTP Timeout (ms)</label>
          <input type="number" defaultValue={10000} className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-primary-500 focus:outline-none sm:text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-900">Concurrent Jobs (Worker)</label>
          <input type="number" defaultValue={5} className="mt-2 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-primary-500 focus:ring-primary-500 focus:outline-none sm:text-sm" />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-primary-700 transition-colors">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
