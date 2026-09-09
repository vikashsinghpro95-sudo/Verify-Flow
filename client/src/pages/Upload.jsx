import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [pastedEmails, setPastedEmails] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (pastedEmails) {
      formData.append('emails', pastedEmails);
    }

    try {
      const res = await axios.post('/api/jobs', formData);
      navigate('/history');
    } catch (err) {
      console.error(err);
      alert('Error uploading list');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Verify Emails</h1>
        <p className="mt-2 text-gray-600">Upload a CSV, XLSX, or TXT file containing email addresses to clean your list.</p>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-primary-500 transition-colors">
          <UploadCloud className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Drag & drop your file here</h3>
          <p className="text-sm text-gray-500 mt-1">or click to browse from your computer</p>
          <input 
            type="file" 
            accept=".csv,.xlsx,.txt" 
            onChange={handleFileChange}
            className="hidden" 
            id="file-upload" 
          />
          <label 
            htmlFor="file-upload" 
            className="mt-6 inline-block bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium cursor-pointer hover:bg-gray-50"
          >
            Browse Files
          </label>
        </div>

        {file && (
          <div className="mt-6 flex items-center p-4 bg-primary-50 rounded-lg text-primary-700">
            <FileText className="w-5 h-5 mr-3" />
            <span className="font-medium flex-1">{file.name}</span>
            <CheckCircle className="w-5 h-5 text-primary-500" />
          </div>
        )}

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or paste emails</span>
          </div>
        </div>

        <div className="mt-6">
          <textarea
            rows={5}
            className="w-full border border-gray-300 rounded-xl p-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="john@example.com&#10;jane@company.com"
            value={pastedEmails}
            onChange={(e) => setPastedEmails(e.target.value)}
          />
        </div>

        <div className="mt-8 flex justify-end">
          <button
            disabled={(!file && !pastedEmails) || uploading}
            onClick={handleUpload}
            className="bg-primary-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {uploading ? 'Uploading...' : 'Start Verification'}
          </button>
        </div>
      </div>
    </div>
  );
}
