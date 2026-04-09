import React, { useState } from 'react';
import { X, Bell, CheckCircle, AlertCircle } from 'lucide-react';

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

export const RaceAlertModal = ({ isOpen, onClose, defaultState = '' }) => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState(defaultState);
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required.'); return; }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/subscribe-race-alerts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: email.trim(), state: state || null, level: level || null }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscription failed');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail(''); setState(defaultState); setLevel('');
    setDone(false); setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8 relative">
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: '#D85A30' }} />
            <h3 className="text-xl font-bold text-gray-900 mb-2">You're in!</h3>
            <p className="text-gray-500 text-sm mb-6">
              We'll email you when new uncontested races are added
              {state ? ` in ${STATE_NAMES[state] || state}` : ''}.
            </p>
            <button
              onClick={handleClose}
              className="text-sm font-semibold text-white px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#D85A30' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex items-center gap-3 mb-1">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full" style={{ backgroundColor: '#fbe8e0' }}>
                <Bell className="w-4 h-4" style={{ color: '#D85A30' }} />
              </span>
              <h2 className="text-xl font-bold text-gray-900">Get Race Alerts</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              We'll notify you when new uncontested races are added to the platform.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select
                    value={state}
                    onChange={e => setState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none bg-white"
                  >
                    <option value="">All states</option>
                    {Object.entries(STATE_NAMES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select
                    value={level}
                    onChange={e => setLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none bg-white"
                  >
                    <option value="">All levels</option>
                    <option value="federal">Federal</option>
                    <option value="statewide">Statewide</option>
                    <option value="state">State Legislature</option>
                    <option value="local">Local</option>
                  </select>
                </div>
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
                style={{ backgroundColor: '#D85A30' }}
              >
                {loading ? 'Subscribing…' : 'Notify Me'}
              </button>

              <p className="text-xs text-gray-400 text-center">
                No spam. Unsubscribe anytime by emailing hello@crowdblue.com.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
