import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle, AlertCircle, Info, ChevronRight, MapPin,
  Building, Flag, User, ArrowRight, MessageCircle, Send,
  BookOpen, DollarSign, Calendar, TrendingUp, Users, Heart,
  Share2, BarChart2, LogOut, LogIn, X, Menu, Bell
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { LoginModal } from './components/LoginModal';
import { SubmitRaceModal } from './components/SubmitRaceModal';
import { RaceAlertModal } from './components/RaceAlertModal';
  // Import the template system
  import { getCampaignPlanTemplate, generateMarkdown } from './campaignPlanTemplates';
  import { generateCampaignPlanPDF } from './utils/pdfGenerator';
  import { fetchLocalRaces, fetchStatewideRaces, getCityFromZip, getDistrictsFromLatLng, fetchDistrictRaces } from './utils/ballotpedia';
  import { getLegislatorsForLocation, enrichOfficesWithIncumbents } from './utils/openstates';

// Brand logo mark
const LogoMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="#1F1F1F"/>
    <polygon points="16,12 28,12 38,24 28,36 16,36 26,24" fill="#D83C13"/>
    <rect x="11" y="21" width="7" height="2" rx="1" fill="#D83C13" opacity="0.5"/>
    <rect x="11" y="25" width="5" height="2" rx="1" fill="#D83C13" opacity="0.3"/>
  </svg>
);

// State names mapping
const STATE_NAMES = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// State election filing authority links
const STATE_FILING_LINKS = {
  AL: 'https://www.sos.alabama.gov/alabama-votes/candidates',
  AK: 'https://elections.alaska.gov/candidates/',
  AZ: 'https://azsos.gov/elections/running-for-office',
  AR: 'https://www.sos.arkansas.gov/elections/candidates-ballot-access',
  CA: 'https://www.sos.ca.gov/elections/candidate-filing',
  CO: 'https://www.coloradosos.gov/pubs/elections/candidates/candidateInfo.html',
  CT: 'https://portal.ct.gov/SOTS/Election-Services/Candidate-Information/Candidate-Information',
  DE: 'https://elections.delaware.gov/candidate/index.shtml',
  FL: 'https://dos.fl.gov/elections/candidates/',
  GA: 'https://sos.ga.gov/page/candidates',
  HI: 'https://elections.hawaii.gov/candidates/',
  ID: 'https://sos.idaho.gov/elect-div/candidate-filing/',
  IL: 'https://www.elections.il.gov/candidacyinfo/candidateinformation.aspx',
  IN: 'https://www.in.gov/sos/elections/candidate-information/',
  IA: 'https://sos.iowa.gov/elections/candidates/index.html',
  KS: 'https://sos.ks.gov/elections/candidate-info.html',
  KY: 'https://elect.ky.gov/candidates/Pages/default.aspx',
  LA: 'https://www.sos.la.gov/ElectionsAndVoting/BecomeACandidate/Pages/default.aspx',
  ME: 'https://www.maine.gov/sos/cec/elec/candidate/index.html',
  MD: 'https://elections.maryland.gov/elections/2026/index.html',
  MA: 'https://www.sec.state.ma.us/ele/elecnd/ndinx.htm',
  MI: 'https://mvic.sos.state.mi.us/Candidate',
  MN: 'https://www.sos.state.mn.us/elections-voting/filing-for-office/',
  MS: 'https://www.sos.ms.gov/elections-voting/candidate-filing',
  MO: 'https://www.sos.mo.gov/elections/candidates/candidateInfo',
  MT: 'https://sosmt.gov/elections/candidates/',
  NE: 'https://sos.nebraska.gov/elections/candidate-information',
  NV: 'https://www.nvsos.gov/sos/elections/running-for-office',
  NH: 'https://www.sos.nh.gov/elections/candidates',
  NJ: 'https://www.njelections.org/candidate-info/candidate-info.html',
  NM: 'https://www.sos.nm.gov/voting-and-elections/candidate-and-voter-information/',
  NY: 'https://www.elections.ny.gov/running-for-office.html',
  NC: 'https://www.ncsbe.gov/candidates',
  ND: 'https://vip.sos.nd.gov/PortalListDetails.aspx?ptlhPKID=49&ptlPKID=7',
  OH: 'https://www.ohiosos.gov/elections/candidates/',
  OK: 'https://www.elections.ok.gov/candidates/',
  OR: 'https://sos.oregon.gov/elections/Pages/running-for-office.aspx',
  PA: 'https://www.vote.pa.gov/Resources/Pages/Candidate-Running-For-Office.aspx',
  RI: 'https://vote.sos.ri.gov/Home/RunningForOffice',
  SC: 'https://www.scvotes.gov/candidates',
  SD: 'https://sdsos.gov/elections-voting/candidates/default.aspx',
  TN: 'https://sos.tn.gov/elections/candidates',
  TX: 'https://www.sos.state.tx.us/elections/candidates/guide/index.shtml',
  UT: 'https://elections.utah.gov/candidates',
  VT: 'https://sos.vermont.gov/elections/candidates/',
  VA: 'https://www.elections.virginia.gov/candidatepac-info/',
  WA: 'https://www.sos.wa.gov/elections/candidates/',
  WV: 'https://sos.wv.gov/elections/Pages/CandidateInformation.aspx',
  WI: 'https://elections.wi.gov/candidates',
  WY: 'https://sos.wyo.gov/elections/candidates.aspx',
};

// Generate filing steps and links for an uncontested office
const getFilingInfo = (office) => {
  const isFederal = office.level === 'federal';
  const stateUrl = STATE_FILING_LINKS[office.state];
  const stateName = STATE_NAMES[office.state] || office.state;

  const steps = [
    `Verify eligibility: age ${office.min_age || 18}+, citizenship, and residency requirements for ${stateName}`,
    `Review the filing deadline: ${office.filing_deadline ? new Date(office.filing_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'check with your state'}`,
    'Open a dedicated campaign bank account before collecting any funds',
    isFederal
      ? 'File a Statement of Candidacy (FEC Form 2) and Statement of Organization (FEC Form 1) with the FEC'
      : `File a Declaration of Candidacy with the ${stateName} election authority`,
    'Designate a campaign treasurer',
  ];

  const links = [];
  if (isFederal) {
    links.push({
      label: 'FEC Candidate Registration',
      url: 'https://www.fec.gov/help-candidates-and-committees/candidate-taking-receipts/registering-candidate/',
      note: 'Register and get your FEC ID',
    });
    links.push({
      label: 'FEC Electronic Filing',
      url: 'https://efts.fec.gov/EASE/login',
      note: 'File FEC Form 1 & 2 online',
    });
  }
  if (stateUrl) {
    links.push({
      label: `${stateName} Election Authority`,
      url: stateUrl,
      note: isFederal ? 'State-level requirements (ballot access)' : 'State filing forms and requirements',
    });
  }
  if (isFederal || office.level === 'statewide') {
    links.push({
      label: 'FEC Campaign Finance Guide',
      url: 'https://www.fec.gov/help-candidates-and-committees/',
      note: 'Contribution limits, reporting deadlines',
    });
  }

  return { steps, links };
};

// View <-> URL mapping for browser history
const VIEW_URLS = {
  landing:       '/',
  wizard:        '/start',
  browse:        '/browse',
  uncontested:   '/uncontested',
  results:       '/results',
  planToRun:     '/plan',
  chatbot:       '/chat',
  terms:         '/terms',
  privacy:       '/privacy',
  accessibility: '/accessibility',
  admin:         '/admin',
};
const URL_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_URLS).map(([view, url]) => [url, view])
);

// Normalize district to a plain integer string for comparison ("01" === "1" === 1)
const normalizeDistrict = (d) => {
  if (d == null || d === '') return null;
  const n = parseInt(String(d), 10);
  return isNaN(n) ? String(d).toLowerCase() : String(n);
};

const SOURCE_LABELS = {
  fec: 'Federal Election Commission',
  north_carolina_sbe: 'NC State Board of Elections',
  california_sos: 'CA Secretary of State',
  florida_sos: 'FL Division of Elections',
  washington_sos: 'WA Public Disclosure Commission',
};

const partyPill = (party) => {
  if (party === 'Democratic') return 'bg-blue-100 text-blue-700';
  if (party === 'Republican') return 'bg-red-100 text-red-700';
  if (party === 'Independent') return 'bg-purple-100 text-purple-700';
  if (party === 'Libertarian') return 'bg-yellow-100 text-yellow-700';
  if (party === 'Green') return 'bg-green-100 text-green-700';
  if (party === 'Unaffiliated' || party === 'No Party Affiliation') return 'bg-gray-100 text-gray-500';
  return 'bg-gray-100 text-gray-600';
};

// Match SoS candidate records to office objects and attach as office.sos_candidates
const attachSosCandidates = (offices, sosRecords) => {
  if (!sosRecords || sosRecords.length === 0) return offices;
  return offices.map(office => {
    const matches = sosRecords.filter(r => {
      if (r.state !== office.state) return false;
      if (r.level !== office.level) return false;
      if (office.level === 'statewide') {
        const rTitle = r.office_title.toLowerCase();
        const oType = (office.office_type || '').toLowerCase().replace(/_/g, ' ');
        const oTitle = (office.title || '').toLowerCase();
        return rTitle.includes(oType) || oTitle.includes(rTitle.split(' ')[0]);
      }
      // Normalize districts so "01" matches "1" matches 1
      return normalizeDistrict(r.district) === normalizeDistrict(office.district);
    });
    return { ...office, sos_candidates: matches };
  });
};

const dataBackend = {
  getOffices: async (zipCode, state) => {
    const { data, error } = await supabase
      .from('offices')
      .select('*')
      .eq('state', state)
      .order('district', { ascending: true });
    
    if (error) {
      console.error('Error fetching offices:', error);
      return [];
    }
    
    return data;
  },
  
  getAllStates: async () => {
    const { data, error } = await supabase
      .rpc('get_distinct_states');
    
    if (error) {
      console.error('Error fetching states:', error);
      return [];
    }
    
    return data.map(item => item.state);
  },
  
  getOfficesByState: async (state) => {
    const { data, error } = await supabase
      .from('offices')
      .select('*')
      .eq('state', state)
      .order('district', { ascending: true });

    if (error) {
      console.error('Error fetching offices:', error);
      return [];
    }

    return data;
  },

  getSosCandidates: async (state, year = 2026) => {
    const { data, error } = await supabase
      .from('sos_candidates')
      .select('*')
      .eq('state', state)
      .eq('election_year', year)
      .neq('status', 'withdrew')
      .neq('status', 'disqualified')
      .order('candidate_name', { ascending: true });
    if (error) {
      console.error('Error fetching SoS candidates:', error);
      return [];
    }
    return data;
  },
  
  generatePlan: (office) => {
    return {
      office: office.title,
      timeline: {
        '12-18 months before': ['Form exploratory committee', 'Begin fundraising', 'Hire campaign manager'],
        '6-12 months before': ['File candidacy paperwork', 'Secure ballot access', 'Build campaign team'],
        '3-6 months before': ['Launch advertising', 'Intensify voter contact', 'Participate in debates'],
        'Final 3 months': ['Execute GOTV plan', 'Maximize fundraising', 'Final voter outreach']
      },
      budget: {
        'Staff & Operations': '25-30%',
        'Media': '35-45%',
        'Field Operations': '15-20%',
        'Fundraising': '8-12%',
        'Other': '5-10%'
      },
      requirements: [
        { item: 'Age: ' + office.min_age + ' years old', confidence: 'verified' },
        { item: 'File official paperwork by ' + office.filing_deadline, confidence: 'verified' },
        { item: 'Open campaign bank account', confidence: 'verified' }
      ],
      advice: [
        { item: 'Start fundraising early - first quarter totals signal viability', confidence: 'high' },
        { item: 'Build relationships with party leadership', confidence: 'high' }
      ]
    };
  },
  
  chatbot: async (message) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('cost') || lowerMessage.includes('money')) {
      return {
        message: "Campaign costs vary widely by office level. Federal House races: $800,000-$2,500,000. State legislative: $25,000-$400,000. Local races: $15,000-$50,000. Budget breakdown: 35-45% media, 25-30% staff, 15-20% field operations.",
        confidence: 'high',
        relatedQuestions: ['How should I start fundraising?', 'What are FEC contribution limits?']
      };
    }
    
    if (lowerMessage.includes('fundrais')) {
      return {
        message: "Start fundraising 12-18 months before election for federal races. Individual contribution limits are $3,300 per election. Most campaigns spend 3-5 hours daily on call time. Set up ActBlue (Democrats) or WinRed (Republicans) immediately.",
        confidence: 'verified',
        relatedQuestions: ['When should I hire a finance director?', 'What are reporting requirements?']
      };
    }
    
    return {
      message: "I can help with questions about campaign costs, fundraising, filing requirements, hiring staff, and strategy. What would you like to know?",
      confidence: 'medium',
      relatedQuestions: ['How much will my campaign cost?', 'When should I start fundraising?']
    };
  }
};

const ConfidenceBadge = ({ level }) => {
  const configs = {
    verified: { icon: CheckCircle, color: 'text-green-600 bg-green-50', text: 'Verified' },
    high: { icon: CheckCircle, color: 'text-blue-600 bg-blue-50', text: 'High Confidence' },
    medium: { icon: Info, color: 'text-yellow-600 bg-yellow-50', text: 'Medium Confidence' },
    low: { icon: AlertCircle, color: 'text-orange-600 bg-orange-50', text: 'Low Confidence' }
  };
  
  const config = configs[level] || configs.medium;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.text}
    </span>
  );
};

// User Menu Component
const UserMenu = ({ user, onSignOut, onViewSaved }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        <User className="w-5 h-5" />
        <span className="text-sm font-medium">{user.email}</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
            <div className="p-4 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  onViewSaved();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <Heart className="w-4 h-4" />
                My Saved Offices
              </button>
              <button
                onClick={() => {
                  onSignOut();
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Compare Modal Component
const CompareModal = ({ offices, onClose }) => {
  if (!offices || offices.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-600" />
            Compare Races ({offices.length})
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {offices.length === 1 ? (
            <div className="text-center py-12">
              <BarChart2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Another Race to Compare</h3>
              <p className="text-gray-600 mb-6">
                Click the compare button (📊) on another race to see them side-by-side.
              </p>
              <button
                onClick={onClose}
                className="text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#004AAD' }}
              >
                Got It
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {offices.map((office) => (
                <div key={office.id} className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{office.title}</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">State:</span>
                      <span className="font-medium">{STATE_NAMES[office.state]}</span>
                    </div>
                    {office.office_type !== 'senate' && (
  <div className="flex justify-between">
    <span className="text-gray-600">District:</span>
    <span className="font-medium">{office.district}</span>
  </div>
)}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Incumbent:</span>
                      <span className="font-medium text-right ml-2">{office.incumbent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Candidates:</span>
                      <span className="font-medium">{office.total_candidates || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Filing Deadline:</span>
                      <span className="font-medium">
                        {new Date(office.filing_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Cost:</span>
                      <span className="font-medium text-right ml-2">{office.estimated_cost}</span>
                    </div>
                  </div>

                  {office.candidates_running && office.candidates_running.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Top Candidates by Fundraising:</h4>
                      <div className="space-y-2">
                        {office.candidates_running
                          .sort((a, b) => b.cash_on_hand - a.cash_on_hand)
                          .slice(0, 3)
                          .map((candidate, idx) => (
                            <div key={idx} className="text-xs">
                              <div className="font-medium">{candidate.name}</div>
                              <div className="text-gray-600">
                                ${(candidate.cash_on_hand / 1000).toFixed(0)}K cash on hand
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SiteFooter = ({ onNavigate }) => (
  <footer style={{ backgroundColor: '#1F1F1F' }} className="mt-auto">
    <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-gray-300 text-sm">© {new Date().getFullYear()} Decide to Run. All rights reserved.</span>
      <div className="flex items-center gap-6">
        <button onClick={() => onNavigate('terms')} className="text-gray-300 hover:text-white text-sm transition-colors">
          Terms of Service
        </button>
        <button onClick={() => onNavigate('privacy')} className="text-gray-300 hover:text-white text-sm transition-colors">
          Privacy Policy
        </button>
        <button onClick={() => onNavigate('accessibility')} className="text-gray-300 hover:text-white text-sm transition-colors">
          Accessibility
        </button>
      </div>
    </div>
  </footer>
);

// Persistent Header Component
const AppHeader = ({ currentView, user, onNavigate, onSignOut, onViewSaved, onShowLogin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  if (currentView === 'landing') return null;

  const navItems = [
    { view: 'browse',      label: 'Browse States', icon: Building },
    { view: 'uncontested', label: 'Run Unopposed',  icon: Flag },
    { view: 'chatbot',     label: 'Ask Eleanor',    icon: MessageCircle },
  ].filter(item => item.view !== currentView);

  const breadcrumb = {
    wizard:      'Find Offices',
    browse:      'Browse States',
    uncontested: 'Run Unopposed',
    results:     'Office Results',
    planToRun:   'Campaign Plan',
    chatbot:     'Eleanor',
  }[currentView];

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ backgroundColor: '#004AAD' }}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <LogoMark size={28} />
              <span className="font-bold text-lg text-white hidden sm:inline" style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontWeight: 900, letterSpacing: '0.02em' }}>Decide to Run</span>
            </button>
            {breadcrumb && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-500" />
                <span className="text-white font-medium text-sm">{breadcrumb}</span>
              </>
            )}
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-3">
            {navItems.map(({ view, label, icon: Icon }) => (
              <button
                key={view}
                onClick={() => onNavigate(view)}
                className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white transition-colors"
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
            {user ? (
              <UserMenu user={user} onSignOut={onSignOut} onViewSaved={onViewSaved} />
            ) : (
              <button
                onClick={onShowLogin}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium border border-white/30 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>

          {/* Mobile: sign-in + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {!user && (
              <button
                onClick={onShowLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium border border-white/30 rounded-lg hover:bg-white/10 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-2 space-y-1" style={{ backgroundColor: '#004AAD' }}>
          {navItems.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              onClick={() => { onNavigate(view); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
          {user && (
            <>
              <button
                onClick={() => { onViewSaved(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
              >
                <Heart className="w-5 h-5" />
                My Saved Offices
              </button>
              <button
                onClick={() => { onSignOut(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 text-red-400 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};

function App() {
  const [localRacesMessage, setLocalRacesMessage] = useState(null);
  const [currentView, setCurrentView] = useState(() => {
    return URL_TO_VIEW[window.location.pathname] || 'landing';
  });

  const isInitialMount = useRef(true);

  // Sync browser URL with currentView
  useEffect(() => {
    const url = VIEW_URLS[currentView] || '/';
    if (isInitialMount.current) {
      isInitialMount.current = false;
      window.history.replaceState({ view: currentView }, '', url);
      return;
    }
    if (window.location.pathname !== url) {
      window.history.pushState({ view: currentView }, '', url);
    }
  }, [currentView]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = (e) => {
      const view = e.state?.view || URL_TO_VIEW[window.location.pathname] || 'landing';
      setCurrentView(view);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const {
    user, 
    signOut, 
    saveOffice, 
    unsaveOffice, 
    getSavedOffices,
    saveCampaignPlan,
    loadCampaignPlan
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [savedOfficeIds, setSavedOfficeIds] = useState(new Set());
  const [expandedCandidates, setExpandedCandidates] = useState(new Set());
  const [compareOffices, setCompareOffices] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [checkboxStates, setCheckboxStates] = useState({});
  const [expandedSections, setExpandedSections] = useState({
    preFilingEssentials: true,
    filing: true,
    first30Days: false,
    fundraising: false,
    team: false,
    fieldWork: false,
    messaging: false
  });  
  
  const [userProfile, setUserProfile] = useState({
    zipCode: '',
    city: '',
    state: '',
    age: '',
    citizenship: true,
    residency: true,
    congressionalDistrict: undefined,
    stateSenateDistrict: undefined,
    stateHouseDistrict: undefined,
  });
  const [availableOffices, setAvailableOffices] = useState([]);
  const [filteredOffices, setFilteredOffices] = useState([]);
  const [filters, setFilters] = useState({
    level: 'all',
    searchTerm: '',
    sortBy: 'district',
    showOpenSeats: false,
    showIncumbents: false
  });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [browseMode, setBrowseMode] = useState(false);
  const [browseState, setBrowseState] = useState('');
  const [availableStates, setAvailableStates] = useState([]);
  const [uncontestedOffices, setUncontestedOffices] = useState([]);
  const [uncontestedLoading, setUncontestedLoading] = useState(false);
  const [uncontestedLoaded, setUncontestedLoaded] = useState(false);
  const [uncontestedFilters, setUncontestedFilters] = useState(() => {
    // Seed filters from URL params on first load (e.g. /uncontested?state=NC&level=local)
    const p = new URLSearchParams(window.location.search);
    return {
      level: p.get('level') || 'all',
      state: p.get('state') || '',
      searchTerm: p.get('q') || '',
    };
  });
  const [expandedFiling, setExpandedFiling] = useState(new Set());
  const [openStatesRaces, setOpenStatesRaces] = useState([]);
  const [openStatesLoading, setOpenStatesLoading] = useState(false);
  const [communityRaces, setCommunityRaces] = useState([]);
  const [communityRacesLoaded, setCommunityRacesLoaded] = useState(false);
  const [uncontestedCount, setUncontestedCount] = useState(null);
  const [sosDataFreshness, setSosDataFreshness] = useState(null); // ISO string of last import
  const [showSubmitRaceModal, setShowSubmitRaceModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  // Fetch all offices with no candidates
  useEffect(() => {
    if (currentView === 'uncontested' && !uncontestedLoaded) {
      setUncontestedLoading(true);
      supabase
        .from('offices')
        .select('*')
        .or('total_candidates.is.null,total_candidates.eq.0')
        .order('state', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data) {
            setUncontestedOffices(data);
            setUncontestedLoaded(true);
          }
          setUncontestedLoading(false);
        });
    }
  }, [currentView, uncontestedLoaded]);

  // Fetch total uncontested count once for the landing page callout
  useEffect(() => {
    supabase
      .from('offices')
      .select('id', { count: 'exact', head: true })
      .or('total_candidates.is.null,total_candidates.eq.0')
      .then(({ count }) => { if (count !== null) setUncontestedCount(count); });
  }, []);

  // Fetch community-submitted races once (guard prevents re-fetch on view changes)
  useEffect(() => {
    if (currentView !== 'uncontested') return;
    if (communityRacesLoaded) return;
    supabase
      .from('submitted_races')
      .select('*')
      .eq('status', 'published')
      .then(({ data }) => {
        if (data) {
          setCommunityRaces(data.map(r => ({
            id: `community-${r.id}`,
            title: r.office_title,
            level: r.level,
            state: r.state,
            district: r.district || r.city || null,
            office_type: r.level,
            next_election: r.next_election || null,
            filing_deadline: r.filing_deadline || null,
            estimated_cost: null,
            incumbent: null,
            total_candidates: 0,
            candidates_running: [],
            confidence: r.confidence || 'community',
            data_source: 'community',
            source_url: r.source_url || null,
            notes: r.notes || null,
          })));
          setCommunityRacesLoaded(true);
        }
      });
  }, [currentView, communityRacesLoaded]);

  // Fetch SoS data freshness when a state filter is selected on uncontested view
  useEffect(() => {
    if (!uncontestedFilters.state) { setSosDataFreshness(null); return; }
    supabase
      .from('sos_candidates')
      .select('updated_at')
      .eq('state', uncontestedFilters.state)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setSosDataFreshness(data?.updated_at ?? null));
  }, [uncontestedFilters.state]);

  // Sync uncontested filters to URL query string
  useEffect(() => {
    if (currentView !== 'uncontested') return;
    const p = new URLSearchParams();
    if (uncontestedFilters.level !== 'all') p.set('level', uncontestedFilters.level);
    if (uncontestedFilters.state) p.set('state', uncontestedFilters.state);
    if (uncontestedFilters.searchTerm) p.set('q', uncontestedFilters.searchTerm);
    const qs = p.toString();
    const newUrl = `/uncontested${qs ? `?${qs}` : ''}`;
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({ view: 'uncontested' }, '', newUrl);
    }
  }, [currentView, uncontestedFilters]);

  // Fetch OpenStates state legislature races when a state filter is selected
  useEffect(() => {
    if (!uncontestedFilters.state) {
      setOpenStatesRaces([]);
      return;
    }
    setOpenStatesLoading(true);
    fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/get-uncontested-state-races`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ state: uncontestedFilters.state }),
    })
      .then(r => r.json())
      .then(data => {
        setOpenStatesRaces(data.races ?? []);
        setOpenStatesLoading(false);
      })
      .catch(() => setOpenStatesLoading(false));
  }, [uncontestedFilters.state]);

  useEffect(() => {
    const loadStates = async () => {
      const states = await dataBackend.getAllStates();
      setAvailableStates(states);
    };
    loadStates();
  }, []);
// Load saved campaign plan when selectedOffice changes
useEffect(() => {
  const loadSavedPlan = async () => {
    if (selectedOffice && user) {
      try {
        const saved = await loadCampaignPlan(selectedOffice.id);
        if (saved) {
          setCheckboxStates(saved);
        } else {
          setCheckboxStates({}); // Reset if no saved plan
        }
      } catch (error) {
        console.error('Error loading campaign plan:', error);
      }
    } else if (!user) {
      // Not logged in, reset to empty
      setCheckboxStates({});
    }
  };
  
  if (currentView === 'planToRun') {
    loadSavedPlan();
  }
}, [selectedOffice, user, currentView, loadCampaignPlan]);

// Scroll to top and update page title whenever view changes
useEffect(() => {
  window.scrollTo(0, 0);
  const titles = {
    landing:      'Decide to Run — Find Offices to Run For',
    wizard:       'Find Your Offices | Decide to Run',
    browse:       'Browse Offices by State | Decide to Run',
    uncontested:  'Races with No Candidates | Decide to Run',
    results:      'Available Offices | Decide to Run',
    planToRun:    'Campaign Plan | Decide to Run',
    chatbot:      'Ask Eleanor | Decide to Run',
    terms:        'Terms of Service | Decide to Run',
    privacy:      'Privacy Policy | Decide to Run',
    accessibility:'Accessibility | Decide to Run',
  };
  document.title = titles[currentView] || 'Decide to Run';
}, [currentView]);

  // Load saved offices when user changes
  useEffect(() => {
    if (user) {
      loadSavedOffices();
    } else {
      setSavedOfficeIds(new Set());
    }
  }, [user]);

  const loadSavedOffices = async () => {
    try {
      const saved = await getSavedOffices();
      setSavedOfficeIds(new Set(saved.map(o => o.id)));
    } catch (error) {
      console.error('Error loading saved offices:', error);
    }
  };

  const handleSaveOffice = async (officeId) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    try {
      if (savedOfficeIds.has(officeId)) {
        await unsaveOffice(officeId);
        setSavedOfficeIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(officeId);
          return newSet;
        });
      } else {
        await saveOffice(officeId);
        setSavedOfficeIds(prev => new Set([...prev, officeId]));
      }
    } catch (error) {
      console.error('Error saving office:', error);
    }
  };

  const handleCompareToggle = (office) => {
    setCompareOffices(prev => {
      const exists = prev.find(o => o.id === office.id);
      if (exists) {
        return prev.filter(o => o.id !== office.id);
      } else {
        if (prev.length >= 2) {
          // Replace oldest
          return [prev[1], office];
        }
        return [...prev, office];
      }
    });
  };

  const handleShare = async (office) => {
    const url = `https://www.decidetorun.com`;
    const text = `Check out this race: ${office.title} - ${office.state} District ${office.district}. ${office.total_candidates} candidates running!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Decide to Run',
          text: text,
          url: url
        });
      } catch (error) {
        // User canceled share - this is fine, ignore the error
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      // Fallback to Twitter
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        '_blank'
      );
    }
  };

  const handleViewSavedOffices = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setLoading(true);
    try {
      const saved = await getSavedOffices();
      setAvailableOffices(saved);
      setBrowseMode(true);
      setBrowseState('');
      setCurrentView('results');
    } finally {
      setLoading(false);
    }
  };

  // Filter offices
  useEffect(() => {
    let filtered = [...availableOffices];

    // Eligibility filters (wizard mode only, not browse mode)
    if (!browseMode) {
      // Age filter
      if (userProfile.age) {
        filtered = filtered.filter(office => !office.min_age || office.min_age <= userProfile.age);
      }

      // District filter — only applies when we successfully resolved the user's districts
      if (typeof userProfile.congressionalDistrict === 'number') {
        filtered = filtered.filter(office => {
          if (office.level === 'statewide' || office.level === 'local') return true;
          if (office.level === 'federal') {
            if (office.office_type === 'senate') return true;
            return parseInt(office.district, 10) === userProfile.congressionalDistrict;
          }
          if (office.level === 'state') {
            const titleLower = (office.title || '').toLowerCase();
            const typeLower = (office.office_type || '').toLowerCase();
            const isStateSenate = titleLower.includes('senate') || typeLower.includes('senate');
            if (isStateSenate) {
              if (typeof userProfile.stateSenateDistrict !== 'number') return true;
              return parseInt(office.district, 10) === userProfile.stateSenateDistrict;
            } else {
              if (typeof userProfile.stateHouseDistrict !== 'number') return true;
              return parseInt(office.district, 10) === userProfile.stateHouseDistrict;
            }
          }
          return true;
        });
      }
    }

    if (filters.level !== 'all') {
      filtered = filtered.filter(office => office.level === filters.level);
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(office => 
        office.title.toLowerCase().includes(term) ||
        office.incumbent?.toLowerCase().includes(term) ||
        office.district?.toLowerCase().includes(term)
      );
    }
    
    if (filters.showOpenSeats) {
      filtered = filtered.filter(office => 
        office.incumbent?.includes('Open Seat') || office.incumbent?.includes('TBD')
      );
    }
    
    if (filters.showIncumbents) {
      filtered = filtered.filter(office => 
        office.candidates_running?.some(c => c.incumbent)
      );
    }
    
    // Sort
    if (filters.sortBy === 'district') {
      filtered.sort((a, b) => parseInt(a.district || 0) - parseInt(b.district || 0));
    } else if (filters.sortBy === 'deadline') {
      filtered.sort((a, b) => new Date(a.filing_deadline) - new Date(b.filing_deadline));
    } else if (filters.sortBy === 'candidates') {
      filtered.sort((a, b) => (b.total_candidates || 0) - (a.total_candidates || 0));
    }
    
    setFilteredOffices(filtered);
  }, [availableOffices, filters, browseMode, userProfile]);


 const handleWizardNext = async () => {
      if (wizardStep === 2) {
        setLoading(true);
        try {
          const [zipData, { offices: localOffices, message }, statewideOffices] = await Promise.all([
            getCityFromZip(userProfile.zipCode),
            fetchLocalRaces(userProfile.city, userProfile.state, userProfile.zipCode),
            fetchStatewideRaces(userProfile.state),
          ]);

          // Look up the user's specific congressional and state legislative districts
          let districtOffices = [];
          let legislators = [];
          if (zipData?.lat && zipData?.lng) {
            const [districts, openStatesLegislators] = await Promise.all([
              getDistrictsFromLatLng(zipData.lat, zipData.lng),
              getLegislatorsForLocation(zipData.lat, zipData.lng),
            ]);
            legislators = openStatesLegislators;
            setUserProfile(prev => ({ ...prev, ...districts }));

            if (districts.congressionalDistrict || districts.stateSenateDistrict || districts.stateHouseDistrict) {
              districtOffices = await fetchDistrictRaces(
                userProfile.state,
                districts.congressionalDistrict,
                districts.stateSenateDistrict,
                districts.stateHouseDistrict
              );
            }
          }

          // Fall back to full state query if district lookup failed
          if (districtOffices.length === 0) {
            districtOffices = await dataBackend.getOffices(userProfile.zipCode, userProfile.state);
          }

          // Enrich state legislature offices with real incumbent names from OpenStates
          const allOffices = enrichOfficesWithIncumbents(
            [...localOffices, ...statewideOffices, ...districtOffices],
            legislators
          );

          const sosRecords = await dataBackend.getSosCandidates(userProfile.state);
          setLocalRacesMessage(message);
          setAvailableOffices(attachSosCandidates(allOffices, sosRecords));
          setBrowseMode(false);
          setCurrentView('results');
        } finally {
          setLoading(false);
        }
      } else {
        setWizardStep(wizardStep + 1);
      }
    };

  const handleBrowseState = async (state) => {
    setLoading(true);
    setBrowseState(state);
    try {
      const [offices, statewideOffices, sosRecords] = await Promise.all([
        dataBackend.getOfficesByState(state),
        fetchStatewideRaces(state),
        dataBackend.getSosCandidates(state),
      ]);
      setAvailableOffices(attachSosCandidates([...statewideOffices, ...offices], sosRecords));
      setBrowseMode(true);
      setCurrentView('results');
    } finally {
      setLoading(false);
    }
  };

  const canProceedWizard = () => {
    if (wizardStep === 0) {
      return userProfile.zipCode.length === 5 && userProfile.state.length > 0;
    }
    if (wizardStep === 1) {
      return userProfile.age >= 18 && userProfile.citizenship && userProfile.residency;
    }
    return true;
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      role: 'user',
      content: chatInput
    };

    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/eleanor-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          }),
        }
      );

      const data = await response.json();
      const assistantText = data?.content?.[0]?.text ?? "Sorry, I couldn't get a response. Please try again.";

      const assistantMessage = {
        role: 'assistant',
        content: assistantText,
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Calculate statistics
  const getStatistics = () => {
    const openSeats = availableOffices.filter(o => 
      o.incumbent?.includes('Open Seat') || o.incumbent?.includes('TBD')
    ).length;
    const withIncumbents = availableOffices.filter(o => 
      o.candidates_running?.some(c => c.incumbent)
    ).length;
    const totalCandidates = availableOffices.reduce((sum, o) => sum + (o.total_candidates || 0), 0);
    
    const mostCompetitive = [...availableOffices]
      .filter(o => o.total_candidates > 0)
      .sort((a, b) => (b.total_candidates || 0) - (a.total_candidates || 0))
      .slice(0, 5);
    
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = availableOffices
      .filter(o => {
        const deadline = new Date(o.filing_deadline);
        return deadline >= now && deadline <= ninetyDaysFromNow;
      })
      .sort((a, b) => new Date(a.filing_deadline) - new Date(b.filing_deadline))
      .slice(0, 5);
    
    const partyCount = { D: 0, R: 0, I: 0, Other: 0 };
    availableOffices.forEach(office => {
      if (office.incumbent?.includes('(D)')) partyCount.D++;
      else if (office.incumbent?.includes('(R)')) partyCount.R++;
      else if (office.incumbent?.includes('(I)')) partyCount.I++;
      else partyCount.Other++;
    });
    
    return { 
      openSeats, 
      withIncumbents, 
      totalCandidates,
      mostCompetitive,
      upcomingDeadlines,
      partyCount
    };
  };

  // Landing Page
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Top nav bar */}
        <div style={{ backgroundColor: '#004AAD' }}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <LogoMark size={32} />
              <span className="font-bold text-xl text-white" style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontWeight: 900, letterSpacing: '0.02em' }}>Decide to Run</span>
            </div>
            {user ? (
              <UserMenu user={user} onSignOut={signOut} onViewSaved={handleViewSavedOffices} />
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium border border-white/30 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors text-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Hero */}
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-8 text-center">
          <h1 className="font-bold mb-4" style={{ fontFamily: "'proxima-nova', Helvetica, Arial, sans-serif", fontWeight: 800, color: '#1F1F1F', fontSize: '3rem', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
            Decide to <span style={{ color: '#D83C13' }}>Run</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Discover offices you can run for and get everything you need to launch your campaign.
          </p>
        </div>

        {/* Section label */}
        <div className="max-w-6xl mx-auto px-6 mb-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-gray-300" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">How would you like to get started?</p>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* Two cards */}
        <div className="max-w-6xl mx-auto px-6 pb-12">
          <div className="relative grid md:grid-cols-2 gap-8 items-stretch">

            {/* Left: Find an Office */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col gap-6 h-full">
              <div>
                <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 text-white" style={{ backgroundColor: '#D83C13' }}>
                  I know what I want
                </span>
                <h2 className="text-2xl font-bold mb-3" style={{ color: '#1F1F1F' }}>Find an Office to Run For</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Search by your zip code or city to see every elected position available near you — with filing deadlines, eligibility requirements, estimated costs, and a personalized campaign plan.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#F9CABD' }}>
                    <MapPin className="w-4 h-4" style={{ color: '#D83C13' }} />
                  </span>
                  Search by zip code to find offices near you
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#F9CABD' }}>
                    <Calendar className="w-4 h-4" style={{ color: '#D83C13' }} />
                  </span>
                  See filing deadlines and eligibility requirements
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#F9CABD' }}>
                    <TrendingUp className="w-4 h-4" style={{ color: '#D83C13' }} />
                  </span>
                  Get a personalized campaign plan
                </div>
              </div>

              <button
                onClick={() => setCurrentView('wizard')}
                className="w-full text-white py-4 px-6 rounded-xl font-bold text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-auto"
                style={{ backgroundColor: '#004AAD' }}
              >
                Search by Location
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => setCurrentView('browse')}
                className="w-full py-3 px-6 rounded-xl font-semibold text-sm border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Building className="w-4 h-4" />
                Browse all offices by state
              </button>
            </div>

            {/* OR pill */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <span className="bg-white border-2 border-gray-200 text-gray-400 font-semibold text-xs rounded-full w-10 h-10 flex items-center justify-center shadow-sm">or</span>
            </div>

            {/* OR divider mobile */}
            <div className="flex md:hidden items-center gap-4">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-sm font-medium text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>

            {/* Right: Eleanor */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-6" style={{ backgroundColor: '#004AAD' }}>
                <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 text-white" style={{ backgroundColor: '#D83C13' }}>
                  I'm not sure where to start
                </span>
                <div className="flex items-start gap-3 text-white">
                  <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    <MessageCircle className="w-5 h-5 text-white" />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold">Ask Eleanor</h2>
                    <p className="text-gray-300 text-sm mt-1">Not sure what office to run for, or whether you're eligible? Eleanor can walk you through requirements, deadlines, costs, and next steps — just ask.</p>
                  </div>
                </div>
              </div>

              <div className="h-64 overflow-y-auto p-5 space-y-3 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="py-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Try asking:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Campaign costs', 'Fundraising strategies', 'Filing requirements', 'Hiring staff'].map((topic, idx) => (
                        <button
                          key={idx}
                          onClick={() => setChatInput(`Tell me about ${topic.toLowerCase()}`)}
                          className="bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left shadow-sm"
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs rounded-xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}
                        style={msg.role === 'user' ? { backgroundColor: '#004AAD' } : {}}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex gap-1.5 shadow-sm">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 p-4 bg-white mt-auto">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    onPaste={(e) => {
                      // Only allow plain text — block files, images, and rich content
                      const items = e.clipboardData?.items || [];
                      for (const item of items) {
                        if (item.kind === 'file' || item.type.startsWith('image/')) {
                          e.preventDefault();
                          return;
                        }
                      }
                      const text = e.clipboardData?.getData('text/plain');
                      if (!text) { e.preventDefault(); return; }
                      // Strip anything that looks like code blocks or script tags
                      const clean = text.replace(/<[^>]+>/g, '').replace(/```[\s\S]*?```/g, '').trim();
                      e.preventDefault();
                      setChatInput(prev => (prev + clean).slice(0, 500));
                    }}
                    placeholder="Ask Eleanor a question..."
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:outline-none text-sm bg-gray-50"
                    style={{ '--tw-ring-color': '#004AAD' }}
                    disabled={chatLoading}
                    maxLength={500}
                  />
                  <button
                    onClick={handleSendChatMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    className="text-white px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center"
                    style={{ backgroundColor: '#004AAD' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom callouts */}
          <div className="mt-8 max-w-xl mx-auto space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F9CABD' }}>
                  <Flag className="w-4 h-4" style={{ color: '#D83C13' }} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {uncontestedCount !== null ? `${uncontestedCount.toLocaleString()} races` : 'Races'} with zero candidates
                  </p>
                  <p className="text-xs text-gray-400">See every office where no one has filed yet</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentView('uncontested')}
                className="flex-shrink-0 text-sm font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#D83C13' }}
              >
                View races →
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f3f4f6' }}>
                  <Users className="w-4 h-4 text-gray-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Know a race we're missing?</p>
                  <p className="text-xs text-gray-400">Help others find it by submitting it to the platform</p>
                </div>
              </div>
              <button
                onClick={() => setShowSubmitRaceModal(true)}
                className="flex-shrink-0 text-sm font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#004AAD' }}
              >
                Submit a race →
              </button>
            </div>
          </div>

          <div className="text-center mt-6 text-xs text-gray-400">
            Free to use · Covers all 50 states · Real FEC data
          </div>
        </div>
      <SiteFooter onNavigate={setCurrentView} />
      <SubmitRaceModal isOpen={showSubmitRaceModal} onClose={() => setShowSubmitRaceModal(false)} />
      </div>
    );
  }

  // Browse by State View
  if (currentView === 'browse') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <AppHeader 
          currentView={currentView}
          user={user}
          onNavigate={setCurrentView}
          onSignOut={signOut}
          onViewSaved={handleViewSavedOffices}
          onShowLogin={() => setShowLoginModal(true)}
        />
        <div className="max-w-4xl mx-auto px-4 py-16">
          
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Offices by State</h1>
            <p className="text-gray-600 mb-8">
              Explore federal offices across all 50 states
            </p>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(STATE_NAMES).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => handleBrowseState(code)}
                  disabled={!availableStates.includes(code) || loading}
                  className={`p-4 rounded-lg text-left transition-colors ${
                    availableStates.includes(code)
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className="font-semibold">{name}</div>
                  <div className="text-sm opacity-75">{code}</div>
                </button>
              ))}
            </div>
            
            {loading && (
              <div className="mt-6 text-center text-gray-600">
                Loading offices...
              </div>
            )}
          </div>
        </div>
        <SiteFooter onNavigate={setCurrentView} />
        <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
      </div>
    );
  }

  // Wizard (existing - keeping as is)
  if (currentView === 'wizard') {
    const wizardSteps = [
      {
        title: 'Where are you located?',
        description: 'This helps us find offices available in your area',
        content: (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
              <input
                type="text"
                value={userProfile.zipCode}
                onChange={(e) => setUserProfile({...userProfile, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                placeholder="12345"
                maxLength={5}
              />
            </div>
            <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
  <input
    type="text"
    value={userProfile.city}
    onChange={(e) => setUserProfile({...userProfile, city: e.target.value})}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD]"
    placeholder="San Jose"
  />
</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <select
                value={userProfile.state}
                onChange={(e) => setUserProfile({...userProfile, state: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
              >
                <option value="">Select a state</option>
                {Object.entries(STATE_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        )
      },
      {
        title: 'Basic eligibility',
        description: 'Most offices have minimum requirements',
        content: (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your age</label>
              <input
                type="number"
                value={userProfile.age}
                onChange={(e) => setUserProfile({...userProfile, age: parseInt(e.target.value) || ''})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                placeholder="18"
                min="18"
              />
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={userProfile.citizenship}
                  onChange={(e) => setUserProfile({...userProfile, citizenship: e.target.checked})}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-[#004AAD]"
                />
                <span className="text-sm text-gray-700">I am a U.S. citizen</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={userProfile.residency}
                  onChange={(e) => setUserProfile({...userProfile, residency: e.target.checked})}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-[#004AAD]"
                />
                <span className="text-sm text-gray-700">I live in the area where I want to run</span>
              </label>
            </div>
          </div>
        )
      },
      {
        title: 'Almost there!',
        description: 'Ready to see your offices',
        content: (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-gray-700">
              We'll show you all available offices in your area with detailed information about costs, deadlines, and who's already running.
            </p>
          </div>
        )
      }
    ];

    const currentStep = wizardSteps[wizardStep];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <AppHeader 
          currentView={currentView}
          user={user}
          onNavigate={setCurrentView}
          onSignOut={signOut}
          onViewSaved={handleViewSavedOffices}
          onShowLogin={() => setShowLoginModal(true)}
        />
        <div className="flex items-center justify-center px-4 py-8">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-500">
                  Step {wizardStep + 1} of {wizardSteps.length}
                </span>
                <Flag className="w-8 h-8" style={{ color: '#D83C13' }} />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((wizardStep + 1) / wizardSteps.length) * 100}%`, backgroundColor: '#D83C13' }}
                />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentStep.title}</h2>
              <p className="text-gray-600">{currentStep.description}</p>
            </div>
    
            <div className="mb-8">{currentStep.content}</div>
    
            <div className="flex gap-3">
              <button
                onClick={() => wizardStep === 0 ? setCurrentView('landing') : setWizardStep(wizardStep - 1)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleWizardNext}
                disabled={!canProceedWizard() || loading}
                className="flex-1 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#004AAD' }}
              >
                {loading ? 'Loading...' : wizardStep === wizardSteps.length - 1 ? 'See My Offices' : 'Continue'}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
        <SiteFooter onNavigate={setCurrentView} />
        <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
      </div>
    );
  }

  // Results View (ENHANCED with inline compare)
  if (currentView === 'results') {
    const stats = getStatistics();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <AppHeader 
          currentView={currentView}
          user={user}
          onNavigate={setCurrentView}
          onSignOut={signOut}
          onViewSaved={handleViewSavedOffices}
          onShowLogin={() => setShowLoginModal(true)}
        />
        <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}


        <div className="flex gap-6">
          {/* Main Content */}
          <div className={`flex-1 transition-all duration-300 ${compareOffices.length > 0 ? 'lg:w-2/3' : 'w-full'}`}>
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {browseMode && !browseState ? 'My Saved Offices' : 
                     browseMode ? `${STATE_NAMES[browseState]} Offices` : 
                     'Your Available Offices'}
                  </h1>
                  <p className="text-gray-600">
                    {filteredOffices.length} of {availableOffices.length} offices
                    {browseMode && browseState ? ` in ${STATE_NAMES[browseState]}` : 
                     !browseMode ? ` in ${userProfile.zipCode}, ${userProfile.state}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setCurrentView('chatbot')}
                  className="text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                  style={{ backgroundColor: '#004AAD' }}
                >
                  <MessageCircle className="w-5 h-5" />
                  Ask Eleanor
                </button>
              </div>

              {/* Statistics */}
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Total Offices</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{availableOffices.length}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Flag className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-600">Open Seats</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.openSeats}</p>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-gray-600">With Incumbents</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.withIncumbents}</p>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-gray-600">Total Candidates</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCandidates}</p>
                </div>
              </div>

              {/* Insights Section */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {stats.mostCompetitive.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      Most Competitive Races
                    </h3>
                    <div className="space-y-3">
                      {stats.mostCompetitive.map((office) => (
                        <div key={office.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900">
                              {office.state}-{office.district}
                            </p>
                            <p className="text-xs text-gray-600">
                              {office.incumbent}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-purple-600">
                              {office.total_candidates}
                            </p>
                            <p className="text-xs text-gray-500">candidates</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {stats.upcomingDeadlines.length > 0 && (
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-lg border border-orange-200">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-orange-600" />
                      Upcoming Deadlines (90 Days)
                    </h3>
                    <div className="space-y-3">
                      {stats.upcomingDeadlines.map((office) => (
                        <div key={office.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900">
                              {office.state}-{office.district}
                            </p>
                            <p className="text-xs text-gray-600">
                              {office.incumbent}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-orange-600">
                              {new Date(office.filing_deadline).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                            <p className="text-xs text-gray-500">deadline</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Level Filter */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: 'All Offices', value: 'all' },
                  { label: 'Federal', value: 'federal' },
                  { label: 'Statewide', value: 'statewide' },
                  { label: 'State Legislature', value: 'state' },
                  { label: 'Local', value: 'local' },
                ].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setFilters({ ...filters, level: value })}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      filters.level === value
                        ? 'text-white border-transparent'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                    style={filters.level === value ? { backgroundColor: '#004AAD', borderColor: '#004AAD' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search districts, names..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                />
                
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                >
                  <option value="district">Sort by District</option>
                  <option value="deadline">Sort by Deadline</option>
                  <option value="candidates">Sort by # Candidates</option>
                </select>
                
                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={filters.showOpenSeats}
                    onChange={(e) => setFilters({...filters, showOpenSeats: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Open Seats Only</span>
                </label>
                
                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={filters.showIncumbents}
                    onChange={(e) => setFilters({...filters, showIncumbents: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Has Incumbent</span>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Real FEC Data:</strong> All candidate and finance information is verified from the Federal Election Commission.
                </p>
              </div>
              {localRacesMessage && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 flex items-center gap-3">
    <Info className="w-5 h-5 text-yellow-600 shrink-0" />
    <p className="text-sm text-yellow-800">
      <strong>Local races:</strong> {localRacesMessage}
    </p>
  </div>
)}
            </div>

            {/* Office Cards */}
            {availableOffices.length === 0 && !loading && (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm mb-4">
                <Flag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-700 font-semibold mb-1">No offices found for your area.</p>
                <p className="text-gray-400 text-sm mb-4">Try browsing by state to see what's available near you.</p>
                <button
                  onClick={() => setCurrentView('browse')}
                  className="text-sm font-semibold text-white px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#D83C13' }}
                >
                  Browse by State →
                </button>
              </div>
            )}
            <div className="space-y-4">
              {filteredOffices.map((office) => {
                const isComparing = compareOffices.find(o => o.id === office.id);
                
                return (
                  <div key={office.id} className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all ${isComparing ? 'ring-2 ring-purple-500' : ''}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{office.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            office.level === 'federal' ? 'bg-purple-100 text-purple-700' :
                            office.level === 'statewide' ? 'bg-indigo-100 text-indigo-700' :
                            office.level === 'state' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {office.level.charAt(0).toUpperCase() + office.level.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ConfidenceBadge level={office.confidence} />
                          {office.data_source && (
                            <span className="text-xs text-gray-500">
                              Source: {office.data_source}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveOffice(office.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            savedOfficeIds.has(office.id)
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={savedOfficeIds.has(office.id) ? 'Unsave' : 'Save office'}
                        >
                          <Heart className={`w-5 h-5 ${savedOfficeIds.has(office.id) ? 'fill-current' : ''}`} />
                        </button>
                        
                        <button
                          onClick={() => handleCompareToggle(office)}
                          className={`p-2 rounded-lg transition-colors ${
                            isComparing
                              ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={isComparing ? 'Remove from comparison' : 'Add to comparison'}
                        >
                          <BarChart2 className="w-5 h-5" />
                        </button>
                        
                        <button
                          onClick={() => handleShare(office)}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          title="Share race"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Next Election</p>
                        <p className="font-medium text-gray-900">
                          {new Date(office.next_election).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      {office.office_type !== 'senate' && (
  <div>
    <p className="text-sm text-gray-500 mb-1">District</p>
    <p className="font-medium text-gray-900">{office.district}</p>
  </div>
)}
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Filing Deadline</p>
                        <p className="font-medium text-gray-900">
                          {new Date(office.filing_deadline).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Incumbent</p>
                        <p className="font-medium text-gray-900">{office.incumbent}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Estimated Cost</p>
                        <p className="font-medium text-gray-900">{office.estimated_cost}</p>
                      </div>
                    </div>

                    {/* Candidates Section - Collapsed */}
                    {office.candidates_running && office.candidates_running.length > 0 && (
                      <div className="border-t pt-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Candidates Running ({office.total_candidates})
                          </h4>
                          <ConfidenceBadge level="verified" />
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {office.candidates_running.slice(0, 3).map((candidate, idx) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-gray-900">{candidate.name}</p>
                                    {candidate.incumbent && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                        Incumbent
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{candidate.party}</p>
                                </div>
                              </div>
                              
                              {(candidate.receipts > 0 || candidate.cash_on_hand > 0 || candidate.disbursements > 0) && (
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
                                  {candidate.receipts > 0 && (
                                    <div>
                                      <p className="text-xs text-gray-500">Raised</p>
                                      <p className="text-sm font-semibold text-green-600">
                                        ${(candidate.receipts / 1000).toFixed(0)}K
                                      </p>
                                    </div>
                                  )}
                                  {candidate.disbursements > 0 && (
                                    <div>
                                      <p className="text-xs text-gray-500">Spent</p>
                                      <p className="text-sm font-semibold text-red-600">
                                        ${(candidate.disbursements / 1000).toFixed(0)}K
                                      </p>
                                    </div>
                                  )}
                                  {candidate.cash_on_hand > 0 && (
                                    <div>
                                      <p className="text-xs text-gray-500">Cash On Hand</p>
                                      <p className="text-sm font-semibold text-blue-600">
                                        ${(candidate.cash_on_hand / 1000).toFixed(0)}K
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {candidate.receipts === 0 && candidate.cash_on_hand === 0 && candidate.disbursements === 0 && (
                                <p className="text-xs text-gray-400 italic pt-2 border-t border-gray-200">
                                  No finance data filed yet
                                </p>
                              )}
                            </div>
                          ))}
                          {office.candidates_running.length > 3 && (
                            <p className="text-sm text-gray-500 text-center">
                              + {office.candidates_running.length - 3} more candidates
                            </p>
                          )}
                        </div>
                      </div>
                    )}

{/* SoS Filed Candidates */}
{office.sos_candidates && (() => {
  const cands = office.sos_candidates;
  const SHOW = 5;
  const officeKey = `${office.state}-${office.level}-${office.district ?? ''}-${office.title ?? ''}`;
  const showAll = expandedCandidates.has(officeKey);
  const source = cands.length > 0 ? (SOURCE_LABELS[cands[0].source] || cands[0].source) : null;

  const partyCounts = cands.reduce((acc, c) => {
    const p = c.party || 'Other';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const partyOrder = ['Democratic', 'Republican', 'Independent', 'Libertarian', 'Green', 'Unaffiliated', 'No Party Affiliation'];
  const breakdown = partyOrder.filter(p => partyCounts[p]).map(p => ({ party: p, count: partyCounts[p] }));
  Object.keys(partyCounts).filter(p => !partyOrder.includes(p)).forEach(p => breakdown.push({ party: p, count: partyCounts[p] }));

  const visible = showAll ? cands : cands.slice(0, SHOW);

  return (
    <div className="border-t pt-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Candidates Who Have Filed
          {cands.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {cands.length}
            </span>
          )}
        </h4>
        {source && <span className="text-xs text-gray-400">{source}</span>}
      </div>

      {breakdown.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {breakdown.map(({ party, count }) => (
            <span key={party} className={`px-2 py-0.5 text-xs rounded-full font-medium ${partyPill(party)}`}>
              {count} {party}
            </span>
          ))}
        </div>
      )}

      {cands.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No filings yet — you could be the first.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {visible.map((cand, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-900 text-sm truncate">{cand.candidate_name}</span>
                  {cand.party && (
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${partyPill(cand.party)}`}>
                      {cand.party === 'No Party Affiliation' ? 'NPA' : cand.party}
                    </span>
                  )}
                </div>
                {cand.filing_date && (
                  <span className="text-xs text-gray-400 shrink-0 ml-2">
                    Filed {new Date(cand.filing_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
          {cands.length > SHOW && (
            <button
              onClick={() => setExpandedCandidates(prev => {
                const next = new Set(prev);
                if (next.has(officeKey)) next.delete(officeKey); else next.add(officeKey);
                return next;
              })}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAll ? 'Show fewer' : `+ ${cands.length - SHOW} more candidates`}
            </button>
          )}
        </>
      )}
    </div>
  );
})()}

<button
  onClick={() => {
    const plan = dataBackend.generatePlan(office);
    setCurrentPlan(plan);
    setSelectedOffice(office);
    setCurrentView('planToRun');
    window.scrollTo(0, 0); // Scroll to top
  }}
  className="w-full text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity"
  style={{ backgroundColor: '#004AAD' }}
>
  View Campaign Plan
</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comparison Sidebar */}
          {compareOffices.length > 0 && (
            <div className="hidden lg:block w-1/3">
              <div className="sticky top-8 bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-purple-600" />
                    Comparing ({compareOffices.length})
                  </h3>
                  <button
                    onClick={() => setCompareOffices([])}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {compareOffices.length === 1 ? (
                  <div className="text-center py-8">
                    <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      Select another race to compare side-by-side
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {compareOffices.map((office, idx) => (
                      <div key={office.id} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-semibold text-sm text-gray-900 flex-1">
                            {office.state}-{office.district}
                          </h4>
                          <button
                            onClick={() => handleCompareToggle(office)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Incumbent:</span>
                            <span className="font-medium text-right ml-2">{office.incumbent}</span>
                          </div>
                          {office.office_type !== 'senate' && (
  <div className="flex justify-between">
    <span className="text-gray-600">District:</span>
    <span className="font-medium">{office.district}</span>
  </div>
)}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Candidates:</span>
                            <span className="font-medium">{office.total_candidates || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Deadline:</span>
                            <span className="font-medium">
                              {new Date(office.filing_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Cost:</span>
                            <span className="font-medium text-right ml-2">{office.estimated_cost}</span>
                          </div>
                        </div>

                        {office.candidates_running && office.candidates_running.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-purple-200">
                            <p className="text-xs font-semibold text-gray-900 mb-2">Top Fundraiser:</p>
                            {(() => {
                              const topCandidate = office.candidates_running
                                .sort((a, b) => b.cash_on_hand - a.cash_on_hand)[0];
                              return (
                                <div className="text-xs">
                                  <div className="font-medium">{topCandidate.name}</div>
                                  <div className="text-gray-600">
                                    ${(topCandidate.cash_on_hand / 1000).toFixed(0)}K on hand
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <SiteFooter onNavigate={setCurrentView} />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

// Plan to Run View
if (currentView === 'planToRun' && currentPlan) {
  const checklist = selectedOffice ? getCampaignPlanTemplate(selectedOffice) : {};


  const handleCheckboxToggle = async (itemId) => {
    const newStates = {
      ...checkboxStates,
      [itemId]: !checkboxStates[itemId]
    };
    
    setCheckboxStates(newStates);
    
    // Save to database if logged in
    if (user && selectedOffice) {
      try {
        await saveCampaignPlan(selectedOffice.id, newStates);
      } catch (error) {
        console.error('Error saving campaign plan:', error);
        // Optionally show a toast notification here
      }
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleDownloadPDF = () => {
    generateCampaignPlanPDF(selectedOffice, checklist, checkboxStates);
  };

  const handleDownloadMarkdown = () => {
    const markdown = generateMarkdown(selectedOffice, checklist, checkboxStates);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-plan-${selectedOffice.state}-${selectedOffice.district}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filingDeadline = new Date(selectedOffice.filing_deadline);
  const today = new Date();
  const daysUntil = Math.ceil((filingDeadline - today) / (1000 * 60 * 60 * 24));
  const isUrgent = daysUntil < 30;

  // Calculate completion
  const allItems = [
    ...(checklist.preFilingEssentials || []),
    ...(checklist.filing || []),
    ...(checklist.first30Days || []),
    ...(checklist.fundraising || []),
    ...(checklist.team || []),
    ...(checklist.fieldWork || []),
    ...(checklist.messaging || [])
  ];
  const completedCount = allItems.filter(item => checkboxStates[item.id]).length;
  const totalCount = allItems.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const sections = [
    { key: 'preFilingEssentials', title: 'Pre-Filing Essentials', icon: AlertCircle, colorClass: 'text-red-600', bgClass: 'bg-red-600' },
    { key: 'filing', title: 'Filing Requirements', icon: Flag, colorClass: 'text-[#004AAD]', bgClass: 'bg-[#004AAD]' },
    { key: 'first30Days', title: 'First 30 Days', icon: Calendar, colorClass: 'text-purple-600', bgClass: 'bg-purple-600' },
    { key: 'fundraising', title: 'Fundraising Checklist', icon: DollarSign, colorClass: 'text-green-600', bgClass: 'bg-green-600' },
    { key: 'team', title: 'Team to Build', icon: Users, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-600' },
    { key: 'fieldWork', title: 'Field Work & Outreach', icon: MapPin, colorClass: 'text-orange-600', bgClass: 'bg-orange-600' },
    { key: 'messaging', title: 'Messaging & Communications', icon: MessageCircle, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <AppHeader 
        currentView={currentView}
        user={user}
        onNavigate={setCurrentView}
        onSignOut={signOut}
        onViewSaved={handleViewSavedOffices}
        onShowLogin={() => setShowLoginModal(true)}
      />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-10 h-10 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Your Campaign Plan</h1>
                  <p className="text-gray-600">{selectedOffice.title}</p>
                </div>
              </div>
              
              {/* Key Info */}
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${isUrgent ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <p className="text-sm text-gray-600 mb-1">Filing Deadline</p>
                  <p className={`text-lg font-bold ${isUrgent ? 'text-red-700' : 'text-blue-700'}`}>
                    {filingDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className={`text-sm ${isUrgent ? 'text-red-600' : 'text-blue-600'}`}>
                    {daysUntil} days remaining {isUrgent && '⚠️'}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Estimated Budget</p>
                  <p className="text-lg font-bold text-green-700">{selectedOffice.estimated_cost}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-semibold text-blue-600">{completionPercentage}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="h-3 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%`, backgroundColor: '#004AAD' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {completedCount} of {totalCount} items completed
            </p>
          </div>

{/* Sign in prompt for non-logged-in users */}
{!user && (
  <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-900 mb-1">
          Sign in to save your progress
        </p>
        <p className="text-xs text-yellow-700 mb-3">
          Your checklist progress won't be saved unless you sign in. Create a free account to access your plan from any device.
        </p>
        <button
  onClick={() => setShowLoginModal(true)}
  className="text-sm font-medium text-yellow-900 hover:text-yellow-800 underline"
>
  Sign in now →
</button>
      </div>
    </div>
  </div>
)}

          {/* Download Buttons */}
          <div className="flex gap-3 mb-6 pb-6 border-b">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Download PDF
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="flex-1 bg-gray-700 text-white py-3 px-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Download Markdown
            </button>
          </div>

          {/* Checklist Sections */}
          <div className="space-y-4">
            {sections.map(section => {
              const items = checklist[section.key];
              if (!items || items.length === 0) return null;

              const Icon = section.icon;
              const sectionCompleted = items.filter(item => checkboxStates[item.id]).length;
              const sectionTotal = items.length;
              const sectionPercentage = Math.round((sectionCompleted / sectionTotal) * 100);

              return (
                <div key={section.key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection(section.key)}
                    className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${section.colorClass}`} />
                      <h3 className="font-semibold text-gray-900">{section.title}</h3>
                      <span className="text-sm text-gray-500">
                        ({sectionCompleted}/{sectionTotal})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className={`${section.bgClass} h-2 rounded-full transition-all`}
  style={{ width: `${sectionPercentage}%` }}/>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections[section.key] ? 'rotate-90' : ''}`} />
                    </div>
                  </button>

                  {expandedSections[section.key] && (
                    <div className="p-4 space-y-3">
                      {items.map(item => (
                        <label
                          key={item.id}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            checkboxStates[item.id] 
                              ? 'bg-green-50 border border-green-200' 
                              : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checkboxStates[item.id] || false}
                            onChange={() => handleCheckboxToggle(item.id)}
                            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-[#004AAD]"
                          />
                          <div className="flex-1">
                            <p className={`text-gray-900 ${checkboxStates[item.id] ? 'line-through text-gray-500' : ''}`}>
                              {item.task}
                            </p>
                            {item.priority === 'critical' && !checkboxStates[item.id] && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                                Critical
                              </span>
                            )}
                            {item.priority === 'high' && !checkboxStates[item.id] && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                High Priority
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Budget Breakdown */}
          {checklist.budget && (
            <div className="mt-6 pt-6 border-t">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                Budget Allocation Guide
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="space-y-3">
                  {Object.entries(checklist.budget).map(([category, percentage]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium">{category}</span>
                      <span className="text-blue-600 font-semibold">{percentage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentView('chatbot')}
                className="flex-1 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{ backgroundColor: '#004AAD' }}
              >
                <MessageCircle className="w-5 h-5" />
                Ask Questions
              </button>
              
                <a href="https://crowdblue.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors text-center flex items-center justify-center gap-2"
              >
                Start Your Campaign
              </a>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter onNavigate={setCurrentView} />
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

// Chatbot View
if (currentView === 'chatbot') {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <AppHeader 
        currentView={currentView}
        user={user}
        onNavigate={setCurrentView}
        onSignOut={signOut}
        onViewSaved={handleViewSavedOffices}
        onShowLogin={() => setShowLoginModal(true)}
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <div className="flex items-center gap-3 text-white">
              <MessageCircle className="w-10 h-10" />
              <div>
                <h1 className="text-2xl font-bold">Eleanor</h1>
                <p className="text-blue-100">Your campaign guide — ask me anything about running for office</p>
              </div>
            </div>
          </div>

          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Start a conversation</h3>
                <p className="text-gray-600 mb-6">Try asking about:</p>
                <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {['Campaign costs', 'Fundraising strategies', 'Filing requirements', 'Hiring staff'].map((topic, idx) => (
                    <button
                      key={idx}
                      onClick={() => setChatInput(`Tell me about ${topic.toLowerCase()}`)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-3xl ${msg.role === 'user' ? 'text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-4`} style={msg.role === 'user' ? { backgroundColor: '#004AAD' } : {}}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.confidence && (
                      <div className="mt-2">
                        <ConfidenceBadge level={msg.confidence} />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                disabled={chatLoading}
              />
              <button
                onClick={handleSendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#004AAD' }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <LoginModal 
        isOpen={showLoginModal} loadStates
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

// Terms of Service
if (currentView === 'terms') {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div style={{ backgroundColor: '#004AAD' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => setCurrentView('landing')} className="text-gray-300 hover:text-white text-sm transition-colors">← Back</button>
          <span className="font-bold text-white text-lg" style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontWeight: 900 }}>Decide to Run</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Decide to Run ("the Service"), operated by CrowdBlue, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Description of Service</h2>
            <p>Decide to Run is a civic information platform that helps individuals explore running for elected office. The Service provides publicly available election data, candidate filing information, district lookup tools, campaign planning resources, and an AI-powered assistant named Eleanor.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. Informational Purpose Only</h2>
            <p>All content provided through the Service — including candidate data, election deadlines, filing requirements, and AI-generated responses — is for general informational purposes only. It does not constitute legal, financial, or political advice. You should consult qualified professionals before making decisions about running for office.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Data Accuracy</h2>
            <p>We source election data from government agencies including the Federal Election Commission (FEC), state Secretaries of State, and state election boards. While we strive to keep this information accurate and current, we make no warranties regarding the completeness, accuracy, or timeliness of any data. Always verify information directly with your state or local election authority.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. User Accounts</h2>
            <p>You may create an account to save offices and campaign plans. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. You must provide accurate information and keep it up to date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">6. Acceptable Use</h2>
            <p>You agree not to use the Service to: (a) violate any applicable law or regulation; (b) transmit harmful, offensive, or misleading content; (c) attempt to gain unauthorized access to any part of the Service; (d) scrape or bulk-download data without permission; or (e) use the Service for any commercial purpose without our written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. AI Assistant (Eleanor)</h2>
            <p>Eleanor is an AI assistant powered by Anthropic's Claude. Responses are generated automatically and may contain errors or outdated information. Eleanor's responses do not constitute professional advice. Do not rely solely on Eleanor for decisions about candidacy, campaign finance, or legal compliance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Intellectual Property</h2>
            <p>The Service and its original content (excluding publicly sourced government data) are owned by CrowdBlue and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Disclaimer of Warranties</h2>
            <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied. CrowdBlue does not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, CrowdBlue shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">11. Changes to Terms</h2>
            <p>We may update these Terms at any time. We will notify users of material changes by posting the updated Terms on this page with a revised date. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">12. Contact</h2>
            <p>Questions about these Terms? Contact us at <a href="mailto:hello@decidetorun.com" className="text-blue-600 hover:underline">hello@decidetorun.com</a>.</p>
          </section>
        </div>
      </div>
      <SiteFooter onNavigate={setCurrentView} />
    </div>
  );
}

// Privacy Policy
if (currentView === 'privacy') {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div style={{ backgroundColor: '#004AAD' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => setCurrentView('landing')} className="text-gray-300 hover:text-white text-sm transition-colors">← Back</button>
          <span className="font-bold text-white text-lg" style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontWeight: 900 }}>Decide to Run</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">1. Who We Are</h2>
            <p>Decide to Run is operated by CrowdBlue. This Privacy Policy explains how we collect, use, and protect your information when you use our Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> Email address when you create an account.</li>
              <li><strong>Location data:</strong> ZIP code you enter to look up your districts and local races. We do not store your precise location; it is used only to identify your legislative districts and is not retained.</li>
              <li><strong>Usage data:</strong> Pages visited, features used, and interactions with the Service, collected via standard server logs.</li>
              <li><strong>AI conversations:</strong> Messages you send to Eleanor are processed by Anthropic's API to generate responses. We do not store full conversation histories beyond your current session.</li>
              <li><strong>Saved data:</strong> Offices and campaign plans you choose to save are stored in your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and improve the Service</li>
              <li>To personalize your experience (e.g., showing races in your district)</li>
              <li>To save your preferences and campaign plans across sessions</li>
              <li>To communicate service updates (only with your consent)</li>
              <li>To analyze aggregate usage patterns and improve our features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services, each with their own privacy policies:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Anthropic</strong> — AI responses via the Claude API (messages sent to Eleanor are processed by Anthropic)</li>
              <li><strong>Cloudflare</strong> — hosting and CDN</li>
              <li><strong>Federal Election Commission (FEC)</strong> — publicly available candidate data</li>
              <li><strong>State election authorities</strong> — publicly available candidate filing data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">5. Cookies and Analytics</h2>
            <p>We use cookies and similar tracking technologies to operate the Service and understand how it is used.</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Essential cookies:</strong> Set by Supabase to manage your login session. These are required for the Service to function and cannot be disabled.</li>
              <li><strong>Analytics cookies:</strong> We use Google Analytics to collect anonymous information about how visitors use the site — including pages visited, time on site, and general location (city/region level). This data is aggregated and does not identify you personally. Google Analytics sets cookies such as <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">_ga</code> and <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">_gid</code> that persist for up to 2 years.</li>
            </ul>
            <p className="mt-2"><strong>Opt out of Google Analytics:</strong> You can prevent Google Analytics from collecting your data by installing the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Analytics Opt-out Browser Add-on</a>, or by enabling "Do Not Track" in your browser settings. You can also manage cookies through your browser's privacy settings.</p>
            <p className="mt-2">We do not use advertising cookies, retargeting pixels, or any cookies that track you across other websites.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">7. Data Sharing</h2>
            <p>We do not sell your personal information. We do not share your information with third parties except: (a) as described above for service providers necessary to operate the Service; (b) when required by law; or (c) with your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">8. Data Retention</h2>
            <p>We retain your account information for as long as your account is active. You may delete your account at any time by contacting us at <a href="mailto:hello@crowdblue.com" className="text-blue-600 hover:underline">hello@crowdblue.com</a>, after which we will delete your personal information within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">9. Security</h2>
            <p>We use industry-standard security measures including encrypted connections (HTTPS) and secure authentication via Supabase. No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">10. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal information. To exercise these rights, contact us at <a href="mailto:hello@crowdblue.com" className="text-blue-600 hover:underline">hello@crowdblue.com</a>. If you are in the European Economic Area or California, you may have additional rights under GDPR or CCPA respectively.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">11. Children's Privacy</h2>
            <p>The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">12. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes by posting the updated policy on this page with a revised date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">13. Contact</h2>
            <p>Questions about this Privacy Policy? Contact us at <a href="mailto:hello@crowdblue.com" className="text-blue-600 hover:underline">hello@crowdblue.com</a>.</p>
          </section>
        </div>
      </div>
      <SiteFooter onNavigate={setCurrentView} />
    </div>
  );
}

// Accessibility Statement
if (currentView === 'accessibility') {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div style={{ backgroundColor: '#004AAD' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => setCurrentView('landing')} className="text-gray-300 hover:text-white text-sm transition-colors">← Back</button>
          <span className="font-bold text-white text-lg" style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontWeight: 900 }}>Decide to Run</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Accessibility Statement</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Our Commitment</h2>
            <p>CrowdBlue is committed to making Decide to Run accessible to everyone, including people with disabilities. We believe civic participation tools should be usable by all people, regardless of ability. We are working toward conformance with the <strong>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</strong>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">What We Do</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Keyboard navigation:</strong> All interactive elements — buttons, forms, and navigation — are reachable and operable using a keyboard alone.</li>
              <li><strong>Color contrast:</strong> Text and interactive elements meet or exceed WCAG AA contrast ratio requirements.</li>
              <li><strong>Responsive design:</strong> The site is fully usable on mobile devices and adjusts to different screen sizes and zoom levels.</li>
              <li><strong>Semantic HTML:</strong> We use proper heading structure, landmark regions, and semantic elements to support screen readers.</li>
              <li><strong>Focus indicators:</strong> Visible focus states are maintained for all interactive elements.</li>
              <li><strong>Text alternatives:</strong> Icons and images used for informational purposes include descriptive labels.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Known Limitations</h2>
            <p>We are actively improving the site and are aware of the following areas in progress:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Some dynamic content updates (such as live search results) may not announce changes to screen reader users in all cases. We are working to improve ARIA live region support.</li>
              <li>The AI assistant (Eleanor) is a conversational interface that may present challenges for some assistive technologies. We are evaluating improvements to its accessibility.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Technical Standards</h2>
            <p>Decide to Run is built with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>React with semantic HTML5 elements</li>
              <li>Tailwind CSS with accessible color system</li>
              <li>Lucide icons with accompanying text labels</li>
              <li>No auto-playing media</li>
              <li>No content that flashes more than three times per second</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Browser and Assistive Technology Support</h2>
            <p>We aim to support the following combinations:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>NVDA + Chrome on Windows</li>
              <li>VoiceOver + Safari on macOS and iOS</li>
              <li>TalkBack + Chrome on Android</li>
              <li>JAWS + Chrome or Edge on Windows</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Report an Accessibility Issue</h2>
            <p>If you experience a barrier or have difficulty using any part of this site, please contact us. We take accessibility feedback seriously and will respond within 5 business days.</p>
            <p className="mt-2">
              Email: <a href="mailto:hello@crowdblue.com" className="text-blue-600 hover:underline">hello@crowdblue.com</a><br />
              Please include: the page or feature you were using, the assistive technology and browser you were using, and a description of the issue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Formal Complaints</h2>
            <p>If you are not satisfied with our response, you may contact the <a href="https://www.ada.gov/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">U.S. Department of Justice ADA Information Line</a> at 1-800-514-0301 or file a complaint with the relevant authority in your jurisdiction.</p>
          </section>
        </div>
      </div>
      <SiteFooter onNavigate={setCurrentView} />
    </div>
  );
}

// Uncontested Races View
if (currentView === 'uncontested') {
  const levelLabels = {
    all: 'All Levels',
    federal: 'Federal',
    statewide: 'Statewide',
    state: 'State Legislature',
    local: 'Local',
  };

  const filteredUncontested = uncontestedOffices.filter(office => {
    if (uncontestedFilters.level !== 'all' && office.level !== uncontestedFilters.level) return false;
    if (uncontestedFilters.state && office.state !== uncontestedFilters.state) return false;
    if (uncontestedFilters.searchTerm) {
      const term = uncontestedFilters.searchTerm.toLowerCase();
      return (
        office.title?.toLowerCase().includes(term) ||
        String(office.district || '').toLowerCase().includes(term) ||
        STATE_NAMES[office.state]?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const filteredOpenStates = openStatesRaces.filter(office => {
    if (uncontestedFilters.level !== 'all' && office.level !== uncontestedFilters.level) return false;
    if (uncontestedFilters.state && office.state !== uncontestedFilters.state) return false;
    if (uncontestedFilters.searchTerm) {
      const term = uncontestedFilters.searchTerm.toLowerCase();
      return (
        office.title?.toLowerCase().includes(term) ||
        String(office.district || '').toLowerCase().includes(term) ||
        STATE_NAMES[office.state]?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Merge, deduplicate by id (sos_candidates data wins over OpenStates)
  const filteredCommunity = communityRaces.filter(office => {
    if (uncontestedFilters.level !== 'all' && office.level !== uncontestedFilters.level) return false;
    if (uncontestedFilters.state && office.state !== uncontestedFilters.state) return false;
    if (uncontestedFilters.searchTerm) {
      const term = uncontestedFilters.searchTerm.toLowerCase();
      return (
        office.title?.toLowerCase().includes(term) ||
        String(office.district || '').toLowerCase().includes(term) ||
        STATE_NAMES[office.state]?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const existingIds = new Set(filteredUncontested.map(o => o.id));
  const afterOpenStates = [...filteredUncontested, ...filteredOpenStates.filter(o => !existingIds.has(o.id))];
  const afterOpenStatesIds = new Set(afterOpenStates.map(o => o.id));
  const mergedUncontested = [
    ...afterOpenStates,
    ...filteredCommunity.filter(o => !afterOpenStatesIds.has(o.id)),
  ];

  const hasOpenStatesData = filteredOpenStates.length > 0;

  // All 50 states for the dropdown (not just states with SoS data)
  const statesInResults = Object.keys(STATE_NAMES).sort();

  const toggleFiling = (id) => {
    setExpandedFiling(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <AppHeader
        currentView={currentView}
        user={user}
        onNavigate={setCurrentView}
        onSignOut={signOut}
        onViewSaved={handleViewSavedOffices}
        onShowLogin={() => setShowLoginModal(true)}
      />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0" style={{ backgroundColor: '#F9CABD' }}>
                <Flag className="w-5 h-5" style={{ color: '#D83C13' }} />
              </span>
              <h1 className="text-3xl font-bold text-gray-900">Races With No Candidates Yet</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowAlertModal(true)}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Get Alerts
              </button>
              <button
                onClick={() => setShowSubmitRaceModal(true)}
                className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#D83C13' }}
              >
                <Flag className="w-4 h-4" />
                Submit a Race
              </button>
            </div>
          </div>
          <p className="text-gray-500 mb-6 max-w-2xl">
            These offices currently have zero filed candidates — meaning you could run unopposed.
            Each card includes a filing plan and direct links to the official filing authority.
            Know one we're missing? Submit it to help others find it.
          </p>

          {/* Level filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(levelLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setUncontestedFilters(f => ({ ...f, level: value }))}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  uncontestedFilters.level === value
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                style={uncontestedFilters.level === value ? { backgroundColor: '#004AAD', borderColor: '#004AAD' } : {}}
              >
                {label}
              </button>
            ))}
          </div>

          {/* State + city/search row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={uncontestedFilters.state}
              onChange={e => setUncontestedFilters(f => ({ ...f, state: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none bg-white"
            >
              <option value="">All States</option>
              {statesInResults.map(code => (
                <option key={code} value={code}>{STATE_NAMES[code] || code}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search by city, district, or office name…"
              value={uncontestedFilters.searchTerm}
              onChange={e => setUncontestedFilters(f => ({ ...f, searchTerm: e.target.value }))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:outline-none"
            />
          </div>

          {!uncontestedLoading && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <p className="text-sm text-gray-400">
                Showing <span className="font-semibold text-gray-700">{mergedUncontested.length}</span> of{' '}
                <span className="font-semibold text-gray-700">{uncontestedOffices.length + openStatesRaces.length}</span> uncontested races
              </p>
              {sosDataFreshness && uncontestedFilters.state && (
                <p className="text-xs text-gray-400">
                  SoS data as of{' '}
                  <span className="font-medium text-gray-500">
                    {new Date(sosDataFreshness).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Loading state */}
        {uncontestedLoading && (
          <div className="text-center py-16 text-gray-500">
            <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin mb-3" />
            <p>Loading uncontested races…</p>
          </div>
        )}

        {/* OpenStates info banner */}
        {hasOpenStatesData && !openStatesLoading && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mb-4 text-sm text-blue-800 flex flex-wrap items-center gap-2">
            <span className="font-semibold">State legislature races from OpenStates.</span>
            <span>
              Races marked <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 mx-1">No candidates filed</span> are confirmed via SoS data.
              Races marked <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 mx-1">Unverified</span> are based on incumbent roster only — candidate filing data for this state may not yet be imported.
            </span>
          </div>
        )}

        {/* Empty state */}
        {!uncontestedLoading && !openStatesLoading && mergedUncontested.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <Flag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No races match your filters.</p>
            <button
              onClick={() => setUncontestedFilters({ level: 'all', state: '', searchTerm: '' })}
              className="mt-3 text-sm underline text-gray-400 hover:text-gray-600"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Race cards */}
        <div className="space-y-4">
          {mergedUncontested.map(office => {
            const isOpenStates = office.data_source === 'OpenStates';
            const isCommunity = office.data_source === 'community';
            const { steps, links } = getFilingInfo(office);
            const isExpanded = expandedFiling.has(office.id);
            const levelColor =
              office.level === 'federal'    ? 'bg-purple-100 text-purple-700' :
              office.level === 'statewide'  ? 'bg-indigo-100 text-indigo-700' :
              office.level === 'state'      ? 'bg-blue-100 text-blue-700' :
                                              'bg-green-100 text-green-700';

            return (
              <div key={office.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                {/* Card header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{office.title}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${levelColor}`}>
                        {office.level?.charAt(0).toUpperCase() + office.level?.slice(1)}
                      </span>
                      {isCommunity ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {office.confidence === 'community_reviewed' ? 'Community · AI Reviewed' : 'Community Submitted'}
                        </span>
                      ) : isOpenStates && !office.verified_uncontested ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          Unverified
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          No candidates filed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {STATE_NAMES[office.state] || office.state}
                      {office.district && office.office_type !== 'senate' ? ` · District ${office.district}` : ''}
                      {isOpenStates && office.incumbent ? ` · Incumbent: ${office.incumbent}` : ''}
                      {isCommunity && office.notes ? ` · ${office.notes}` : ''}
                    </p>
                  </div>
                </div>

                {/* Key info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm">
                  {office.filing_deadline && (
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Filing Deadline</p>
                      <p className="font-medium text-gray-800">
                        {new Date(office.filing_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {office.next_election && (
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Election Date</p>
                      <p className="font-medium text-gray-800">
                        {new Date(office.next_election).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {office.estimated_cost && (
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Est. Budget</p>
                      <p className="font-medium text-gray-800">{office.estimated_cost}</p>
                    </div>
                  )}
                </div>

                {/* Filing plan / actions */}
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => toggleFiling(office.id)}
                    className="flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color: isExpanded ? '#1F1F1F' : '#D83C13' }}
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    {isExpanded ? 'Hide filing plan' : 'How to run for this office'}
                  </button>
                  {isCommunity && office.source_url && (
                    <a
                      href={office.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                    >
                      Source →
                    </a>
                  )}
                  {isCommunity && (
                    <button
                      onClick={async () => {
                        const rawId = office.id.replace('community-', '');
                        await fetch(
                          `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/flag-submission`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
                            },
                            body: JSON.stringify({ id: rawId }),
                          }
                        );
                        alert('Thanks — this submission has been flagged for review.');
                      }}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors ml-auto"
                      title="Report this submission"
                    >
                      Report
                    </button>
                  )}
                </div>

                {/* Expanded filing plan */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid sm:grid-cols-2 gap-6">
                      {/* Steps */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          Key Filing Steps
                        </h4>
                        <ol className="space-y-2">
                          {steps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-600">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white mt-0.5" style={{ backgroundColor: '#004AAD' }}>
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Links */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          Official Filing Resources
                        </h4>
                        <div className="space-y-2">
                          {links.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 group-hover:underline">{link.label}</p>
                                <p className="text-xs text-gray-400">{link.note}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-gray-400 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                            </a>
                          ))}
                        </div>

                        <button
                          onClick={() => { setSelectedOffice(office); setCurrentPlan(getCampaignPlanTemplate(office)); setCurrentView('planToRun'); }}
                          className="mt-3 w-full text-sm font-medium text-white py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: '#D83C13' }}
                        >
                          Build Full Campaign Plan →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* OpenStates loading spinner */}
        {openStatesLoading && (
          <div className="text-center py-8 text-gray-500">
            <div className="inline-block w-6 h-6 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mb-2" />
            <p className="text-sm">Loading state legislature races from OpenStates…</p>
          </div>
        )}
      </div>
      <SiteFooter onNavigate={setCurrentView} />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <SubmitRaceModal isOpen={showSubmitRaceModal} onClose={() => setShowSubmitRaceModal(false)} />
      <RaceAlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        defaultState={uncontestedFilters.state}
      />
    </div>
  );
}

  // Admin View
  if (currentView === 'admin') {
    return (
      <AdminView
        supabase={supabase}
        onNavigate={setCurrentView}
        user={user}
        onShowLogin={() => setShowLoginModal(true)}
      />
    );
  }

return null;
}

// ── Admin View Component ──────────────────────────────────────────────────────
const AdminView = ({ supabase, onNavigate, user, onShowLogin }) => {
  const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL;
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const isAdmin = user && ADMIN_EMAIL && user.email === ADMIN_EMAIL;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('submitted_races')
      .select('*')
      .in('status', ['pending', 'flagged'])
      .order('submitted_at', { ascending: false });
    setSubmissions(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]); // eslint-disable-line

  const updateStatus = async (id, status) => {
    setActionLoading(id + status);
    await supabase.from('submitted_races').update({ status }).eq('id', id);
    setSubmissions(prev => prev.filter(s => s.id !== id));
    setActionLoading(null);
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Sign in to access the admin panel.</p>
        <button onClick={onShowLogin} className="text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90" style={{ backgroundColor: '#004AAD' }}>Sign In</button>
      </div>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600 mb-4">You don't have access to this page.</p>
        <button onClick={() => onNavigate('landing')} className="text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90" style={{ backgroundColor: '#004AAD' }}>Go Home</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ backgroundColor: '#004AAD' }} className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('landing')} className="text-gray-400 hover:text-white text-sm transition-colors">← Home</button>
          <span className="text-white font-bold text-lg">Admin — Submissions Review</span>
        </div>
        <span className="text-gray-400 text-sm">{user.email}</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-16 text-gray-500">
            <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin mb-3" />
            <p>Loading submissions…</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">All clear — no pending or flagged submissions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map(s => (
              <div key={s.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{s.office_title}</h3>
                    <p className="text-sm text-gray-500">
                      {s.level} · {s.state}{s.city ? ` · ${s.city}` : ''}{s.district ? ` · District ${s.district}` : ''}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {s.status} {s.status === 'flagged' ? `(${s.reported_count} reports)` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                  {s.filing_deadline && <div><span className="text-gray-400">Filing:</span> {s.filing_deadline}</div>}
                  {s.next_election && <div><span className="text-gray-400">Election:</span> {s.next_election}</div>}
                  {s.submitter_email && <div><span className="text-gray-400">Submitted by:</span> {s.submitter_email}</div>}
                  {s.submitter_ip && <div><span className="text-gray-400">IP:</span> {s.submitter_ip}</div>}
                  {s.source_url && <div className="col-span-2"><span className="text-gray-400">Source:</span> <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{s.source_url}</a></div>}
                  {s.notes && <div className="col-span-2"><span className="text-gray-400">Notes:</span> {s.notes}</div>}
                  {s.review_note && <div className="col-span-3"><span className="text-gray-400">AI review:</span> {s.review_note}</div>}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => updateStatus(s.id, 'published')}
                    disabled={actionLoading === s.id + 'published'}
                    className="flex-1 text-sm font-semibold text-white py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: '#D83C13' }}
                  >
                    Approve & Publish
                  </button>
                  <button
                    onClick={() => updateStatus(s.id, 'removed')}
                    disabled={actionLoading === s.id + 'removed'}
                    className="flex-1 text-sm font-semibold text-gray-700 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;