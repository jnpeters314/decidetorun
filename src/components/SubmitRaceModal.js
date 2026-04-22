import React, { useState } from 'react';
import { X, CheckCircle, Flag, AlertCircle } from 'lucide-react';

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const EMPTY_FORM = {
  office_title: '',
  level: '',
  state: '',
  district: '',
  city: '',
  filing_deadline: '',
  next_election: '',
  source_url: '',
  notes: '',
  submitter_email: '',
  website: '', // honeypot — never shown to real users
};

export const SubmitRaceModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.office_title.trim()) { setError('Office name is required.'); return; }
    if (!form.level) { setError('Please select a level.'); return; }
    if (!form.state) { setError('Please select a state.'); return; }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/submit-race`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>

        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#D83C13' }} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Thanks for the tip!</h3>
            <p className="text-gray-500 mb-6 text-sm">
              Your submission was reviewed and added to the platform with a "Community Submitted" badge.
              Other users can use it to find this race and build a campaign plan.
            </p>
            <button
              onClick={handleClose}
              className="text-sm font-semibold text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#D83C13' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex items-center gap-3 mb-1">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ backgroundColor: '#F9CABD' }}>
                <Flag className="w-4 h-4" style={{ color: '#D83C13' }} />
              </span>
              <h2 className="text-xl font-bold text-gray-900">Submit a Race</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Know about an office with no candidates? Add it so others can find it and consider running.
            </p>

            {/* Hidden honeypot — real users never see this; bots fill it and get silently dropped */}
            <input
              type="text"
              name="website"
              value={form.website ?? ''}
              onChange={e => set('website', e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ display: 'none' }}
              aria-hidden="true"
            />

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Office name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Office Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.office_title}
                  onChange={e => set('office_title', e.target.value)}
                  placeholder="e.g. Millbrook City Council, Seat 3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                  maxLength={200}
                />
              </div>

              {/* Level + State row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.level}
                    onChange={e => set('level', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none bg-white"
                  >
                    <option value="">Select…</option>
                    <option value="federal">Federal</option>
                    <option value="statewide">Statewide</option>
                    <option value="state">State Legislature</option>
                    <option value="local">Local</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.state}
                    onChange={e => set('state', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none bg-white"
                  >
                    <option value="">Select…</option>
                    {Object.entries(STATE_NAMES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* City + District row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City / County</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    placeholder="e.g. Springfield"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <input
                    type="text"
                    value={form.district}
                    onChange={e => set('district', e.target.value)}
                    placeholder="e.g. 12 or At-Large"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                    maxLength={50}
                  />
                </div>
              </div>

              {/* Filing deadline + Election date row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filing Deadline</label>
                  <input
                    type="date"
                    value={form.filing_deadline}
                    onChange={e => set('filing_deadline', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Election Date</label>
                  <input
                    type="date"
                    value={form.next_election}
                    onChange={e => set('next_election', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Source URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
                <input
                  type="url"
                  value={form.source_url}
                  onChange={e => set('source_url', e.target.value)}
                  placeholder="Link to official election page or news article"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                  maxLength={500}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Anything else that might be helpful (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none resize-none"
                  maxLength={500}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="email"
                  value={form.submitter_email}
                  onChange={e => set('submitter_email', e.target.value)}
                  placeholder="In case we need to follow up"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#D83C13' }}
              >
                {loading ? 'Submitting…' : 'Submit Race'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Submissions are reviewed instantly and published with a "Community Submitted" badge.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
