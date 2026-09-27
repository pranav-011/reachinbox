import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { X, Upload, FileText, CheckCircle2, Clock, ShieldAlert, Send, Plus, Trash2 } from 'lucide-react';
import { SchedulePayload } from '../types/index.js';
import { toast } from 'sonner';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SchedulePayload) => Promise<void>;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderEmail, setSenderEmail] = useState('outreach@reachinbox.ai');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [isImmediate, setIsImmediate] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Regex to extract valid email addresses
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((e) => e.toLowerCase())));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          const flatText = results.data.flat().join(' ');
          const parsed = extractEmails(flatText);
          if (parsed.length === 0) {
            toast.error('No valid email addresses found in the CSV.');
          } else {
            setRecipients((prev) => Array.from(new Set([...prev, ...parsed])));
            toast.success(`Detected ${parsed.length} email addresses from ${file.name}`);
          }
        },
        error: (err) => {
          toast.error(`Error parsing CSV: ${err.message}`);
        },
      });
    } else {
      // Text or other files
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = extractEmails(text);
        if (parsed.length === 0) {
          toast.error('No valid email addresses found in file.');
        } else {
          setRecipients((prev) => Array.from(new Set([...prev, ...parsed])));
          toast.success(`Detected ${parsed.length} email addresses from ${file.name}`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAddManualEmail = () => {
    if (!manualInput.trim()) return;
    const parsed = extractEmails(manualInput);
    if (parsed.length === 0) {
      toast.error('Please enter a valid email address');
      return;
    }
    setRecipients((prev) => Array.from(new Set([...prev, ...parsed])));
    setManualInput('');
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients((prev) => prev.filter((r) => r !== emailToRemove));
  };

  const handleClearAllRecipients = () => {
    setRecipients([]);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast.error('Please enter an email subject');
      return;
    }

    if (!body.trim()) {
      toast.error('Please enter email body content');
      return;
    }

    if (recipients.length === 0) {
      toast.error('Please upload or enter at least one recipient email address');
      return;
    }

    if (!isImmediate && !startTime) {
      toast.error('Please select a scheduled start time');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        subject,
        body,
        recipients,
        senderEmail,
        startTime: isImmediate ? undefined : new Date(startTime).toISOString(),
        delayBetweenEmails,
        hourlyLimit,
      });

      toast.success(`Successfully scheduled ${recipients.length} emails!`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#171a26]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Compose & Schedule Email Campaign</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Configure parameters, leads, and provider rate-limiting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sender & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sender Email</label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="outreach@reachinbox.ai"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Scaling outbound outreach with ReachInbox"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Body</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,&#10;&#10;I wanted to connect and share how we can accelerate your outbound pipeline...&#10;&#10;Best,&#10;ReachInbox Team"
              className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-sans"
              required
            />
          </div>

          {/* Lead Upload (CSV / TXT) & Recipients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Recipients & Leads List</label>
              {recipients.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {recipients.length} {recipients.length === 1 ? 'lead' : 'leads'} detected
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllRecipients}
                    className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/70 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Upload className="h-4 w-4" />
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Click to upload CSV</span> or drag and drop
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Supports .csv or .txt lead lists with multiple columns</p>
              </div>
            </div>

            {/* Manual Email Input */}
            <div className="flex gap-2 mt-2.5">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualEmail();
                  }
                }}
                placeholder="Or paste email address(es) and press Enter"
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddManualEmail}
                className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>

            {/* Recipients Chips Preview */}
            {recipients.length > 0 && (
              <div className="mt-2.5 max-h-28 overflow-y-auto p-2 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap gap-1.5">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="hover:text-rose-500 dark:hover:text-rose-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              Scheduling & Provider Throttling
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Start Time Option */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time</label>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsImmediate(true)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        isImmediate
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Send Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsImmediate(false)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        !isImmediate
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Schedule
                    </button>
                  </div>
                  {!isImmediate && (
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                      required={!isImmediate}
                    />
                  )}
                </div>
              </div>

              {/* Delay Between Emails */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Delay Between Sends (sec)
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Prevents provider spam flags</p>
              </div>

              {/* Hourly Rate Limit */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Hourly Limit (per sender)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Triggers auto-reschedule & Slack alert</p>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171a26] flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {recipients.length > 0
              ? `${recipients.length} emails will be scheduled`
              : 'Add recipients to proceed'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || recipients.length === 0}
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Schedule Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
