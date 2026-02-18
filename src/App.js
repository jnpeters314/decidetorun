import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, AlertCircle, Info, ChevronRight, MapPin, 
  Building, Flag, User, ArrowRight, MessageCircle, Send, 
  BookOpen, DollarSign, Calendar, TrendingUp, Users, Heart,
  Share2, BarChart2, LogOut, LogIn, X
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { LoginModal } from './components/LoginModal';
  // Import the template system
  import { getCampaignPlanTemplate, generateMarkdown } from './campaignPlanTemplates';
  import { generateCampaignPlanPDF } from './utils/pdfGenerator';

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

const simulatedBackend = {
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
      .from('offices')
      .select('state')
      .order('state');
    
    if (error) {
      console.error('Error fetching states:', error);
      return [];
    }
    
    const uniqueStates = [...new Set(data.map(item => item.state))];
    return uniqueStates;
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
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
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

// Persistent Header Component
const AppHeader = ({ currentView, user, onNavigate, onSignOut, onViewSaved, onShowLogin }) => {
  if (currentView === 'landing') return null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Breadcrumbs */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Flag className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-lg text-gray-900 hidden sm:inline">Decide to Run</span>
            </button>
            
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              {currentView === 'wizard' && (
                <span className="text-gray-600">Find Offices</span>
              )}
              {currentView === 'browse' && (
                <span className="text-gray-600">Browse States</span>
              )}
              {currentView === 'results' && (
                <span className="text-gray-900 font-medium">Office Results</span>
              )}
              {currentView === 'planToRun' && (
                <>
                  <button
                    onClick={() => onNavigate('results')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Results
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 font-medium">Campaign Plan</span>
                </>
              )}
              {currentView === 'chatbot' && (
                <>
                  <button
                    onClick={() => onNavigate('results')}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Results
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 font-medium">Q&A Assistant</span>
                </>
              )}
            </div>
          </div>

          {/* Navigation & User Menu */}
          <div className="flex items-center gap-3">
            {currentView !== 'results' && currentView !== 'browse' && (
              <button
                onClick={() => onNavigate('browse')}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Building className="w-4 h-4" />
                <span className="text-sm font-medium">Browse States</span>
              </button>
            )}
            
            {currentView !== 'chatbot' && (
              <button
                onClick={() => onNavigate('chatbot')}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Ask Questions</span>
              </button>
            )}

            {user ? (
              <UserMenu 
                user={user} 
                onSignOut={onSignOut}
                onViewSaved={onViewSaved}
              />
            ) : (
              <button
                onClick={onShowLogin}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const { 
    user, 
    signOut, 
    saveOffice, 
    unsaveOffice, 
    getSavedOffices,
    saveCampaignPlan,
    loadCampaignPlan
  } = useAuth();
  const [currentView, setCurrentView] = useState('landing');
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [savedOfficeIds, setSavedOfficeIds] = useState(new Set());
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
    state: '',
    age: '',
    citizenship: true,
    residency: true
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

  // Load available states and saved offices on mount
  useEffect(() => {
    const loadStates = async () => {
      const states = await simulatedBackend.getAllStates();
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

// Scroll to top whenever view changes
useEffect(() => {
  window.scrollTo(0, 0);
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
  }, [availableOffices, filters]);

  const handleWizardNext = async () => {
    if (wizardStep === 2) {
      setLoading(true);
      try {
        const offices = await simulatedBackend.getOffices(userProfile.zipCode, userProfile.state);
        setAvailableOffices(offices);
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
      const offices = await simulatedBackend.getOfficesByState(state);
      setAvailableOffices(offices);
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
    
    setChatMessages([...chatMessages, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      const response = await simulatedBackend.chatbot(chatInput);
      
      const assistantMessage = {
        role: 'assistant',
        content: response.message,
        confidence: response.confidence,
        relatedQuestions: response.relatedQuestions
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
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

  // PASSWORD PROTECTION
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <Flag className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Decide to Run</h1>
          <p className="text-gray-600 mb-6 text-center">Private Beta - Enter password to continue</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (password === 'decidetorun2026') {
              setIsAuthenticated(true);
            } else {
              alert('Incorrect password');
            }
          }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button 
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Access Beta
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Landing Page
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header with Login */}
        <div className="max-w-4xl mx-auto px-4 pt-8">
          <div className="flex justify-end">
            {user ? (
              <UserMenu 
                user={user} 
                onSignOut={signOut}
                onViewSaved={handleViewSavedOffices}
              />
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-6">
              <Flag className="w-12 h-12 text-blue-600" />
              <h1 className="text-5xl font-bold text-gray-900">Decide to Run</h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover what offices you can run for in your area and get the information you need to launch your campaign.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Get Started</h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <MapPin className="w-10 h-10 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Find Offices</h3>
                <p className="text-sm text-gray-600">See every elected position available in your area</p>
              </div>
              
              <div className="text-center p-6 bg-indigo-50 rounded-xl">
                <Building className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Get Answers</h3>
                <p className="text-sm text-gray-600">Learn filing requirements, costs, and deadlines</p>
              </div>
              
              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <User className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Launch Your Campaign</h3>
                <p className="text-sm text-gray-600">Connect to resources to start running</p>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('wizard')}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-4"
            >
              Begin Your Journey
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <button
                onClick={() => setCurrentView('browse')}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Or browse offices by state →
              </button>
            </div>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>Free to use • Covers all 50 states • Real FEC data</p>
          </div>
        </div>
      </div>
    );
  }

  // Browse by State View
  if (currentView === 'browse') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-900'
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="12345"
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <select
                value={userProfile.state}
                onChange={(e) => setUserProfile({...userProfile, state: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">I am a U.S. citizen</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={userProfile.residency}
                  onChange={(e) => setUserProfile({...userProfile, residency: e.target.checked})}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
                <Flag className="w-8 h-8 text-blue-600" />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((wizardStep + 1) / wizardSteps.length) * 100}%` }}
                />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentStep.title}</h2>
              <p className="text-gray-600">{currentStep.description}</p>
            </div>
    
            <div className="mb-8">{currentStep.content}</div>
    
            <div className="flex gap-3">
              {wizardStep > 0 && (
                <button
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleWizardNext}
                disabled={!canProceedWizard() || loading}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Loading...' : wizardStep === wizardSteps.length - 1 ? 'See My Offices' : 'Continue'}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Ask Questions
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

              {/* Filters */}
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search districts, names..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            </div>

            {/* Office Cards */}
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

<button
  onClick={() => {
    const plan = simulatedBackend.generatePlan(office);
    setCurrentPlan(plan);
    setSelectedOffice(office);
    setCurrentView('planToRun');
    window.scrollTo(0, 0); // Scroll to top
  }}
  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
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
    { key: 'filing', title: 'Filing Requirements', icon: Flag, colorClass: 'text-blue-600', bgClass: 'bg-blue-600' },
    { key: 'first30Days', title: 'First 30 Days', icon: Calendar, colorClass: 'text-purple-600', bgClass: 'bg-purple-600' },
    { key: 'fundraising', title: 'Fundraising Checklist', icon: DollarSign, colorClass: 'text-green-600', bgClass: 'bg-green-600' },
    { key: 'team', title: 'Team to Build', icon: Users, colorClass: 'text-indigo-600', bgClass: 'bg-indigo-600' },
    { key: 'fieldWork', title: 'Field Work & Outreach', icon: MapPin, colorClass: 'text-orange-600', bgClass: 'bg-orange-600' },
    { key: 'messaging', title: 'Messaging & Communications', icon: MessageCircle, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
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
                            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
                <h1 className="text-2xl font-bold">Campaign Q&A Assistant</h1>
                <p className="text-blue-100">Ask me anything about running for office</p>
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
                  <div className={`max-w-3xl ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-4`}>
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
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={chatLoading}
              />
              <button
                onClick={handleSendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}

return null;
}

export default App;