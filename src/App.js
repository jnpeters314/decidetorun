import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, AlertCircle, Info, ChevronRight, MapPin, 
  Building, Flag, User, ArrowRight, MessageCircle, Send, 
  BookOpen, DollarSign, Calendar, TrendingUp, Users
} from 'lucide-react';
import { supabase } from './supabaseClient';

// Simulated backend - chatbot and plan generation
const simulatedBackend = {
  getOffices: async (zipCode, state) => {
    // Now fetching from Supabase instead of hardcoded data
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
    // Get unique states from database
    const { data, error } = await supabase
      .from('offices')
      .select('state')
      .order('state');
    
    if (error) {
      console.error('Error fetching states:', error);
      return [];
    }
    
    // Get unique states
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

function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
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

  // Load available states on mount
  useEffect(() => {
    const loadStates = async () => {
      const states = await simulatedBackend.getAllStates();
      setAvailableStates(states);
    };
    loadStates();
  }, []);

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
  
  // NEW: Most competitive races
  const mostCompetitive = [...availableOffices]
    .filter(o => o.total_candidates > 0)
    .sort((a, b) => (b.total_candidates || 0) - (a.total_candidates || 0))
    .slice(0, 5);
  
  // NEW: Upcoming deadlines (next 90 days)
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = availableOffices
    .filter(o => {
      const deadline = new Date(o.filing_deadline);
      return deadline >= now && deadline <= ninetyDaysFromNow;
    })
    .sort((a, b) => new Date(a.filing_deadline) - new Date(b.filing_deadline))
    .slice(0, 5);
  
  // NEW: Party breakdown
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 py-16">
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
        <div className="max-w-4xl mx-auto px-4 py-16">
          <button
            onClick={() => setCurrentView('landing')}
            className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Home
          </button>
          
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
      </div>
    );
  }

  // Wizard (existing code - unchanged)
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-8">
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
    );
  }

  // Results View (ENHANCED)
  if (currentView === 'results') {
    const stats = getStatistics();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {browseMode ? `${STATE_NAMES[browseState]} Offices` : 'Your Available Offices'}
                </h1>
                <p className="text-gray-600">
                  {filteredOffices.length} of {availableOffices.length} offices
                  {browseMode ? ` in ${STATE_NAMES[browseState]}` : ` in ${userProfile.zipCode}, ${userProfile.state}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentView('chatbot')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Ask Questions
                </button>
                <button
                  onClick={() => setCurrentView('landing')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Start Over
                </button>
              </div>
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

{/* NEW: Insights Section */}
<div className="grid md:grid-cols-2 gap-6 mb-6">
  {/* Most Competitive Races */}
  {stats.mostCompetitive.length > 0 && (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-purple-600" />
        Most Competitive Races
      </h3>
      <div className="space-y-3">
        {stats.mostCompetitive.map((office, idx) => (
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
  
  {/* Upcoming Deadlines */}
  {stats.upcomingDeadlines.length > 0 && (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-lg border border-orange-200">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-orange-600" />
        Upcoming Deadlines (90 Days)
      </h3>
      <div className="space-y-3">
        {stats.upcomingDeadlines.map((office, idx) => (
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
  
  {/* Party Breakdown */}
  {!browseMode && (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-200">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600" />
        Current Incumbents by Party
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-700">Democratic</span>
          <span className="text-2xl font-bold text-blue-600">{stats.partyCount.D}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-700">Republican</span>
          <span className="text-2xl font-bold text-red-600">{stats.partyCount.R}</span>
        </div>
        {stats.partyCount.I > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Independent</span>
            <span className="text-2xl font-bold text-purple-600">{stats.partyCount.I}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-gray-700">Open/Other</span>
          <span className="text-2xl font-bold text-gray-600">{stats.partyCount.Other}</span>
        </div>
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
            {filteredOffices.map((office) => (
              <div key={office.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
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

                {/* Candidates Running Section */}
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
                      {office.candidates_running.map((candidate, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded-lg flex items-start justify-between">
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
                            {candidate.cash_on_hand > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                Cash on hand: ${candidate.cash_on_hand.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    const plan = simulatedBackend.generatePlan(office);
                    setCurrentPlan(plan);
                    setCurrentView('planToRun');
                  }}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  View Campaign Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Plan to Run View (existing code - unchanged)
  if (currentView === 'planToRun' && currentPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <button
            onClick={() => setCurrentView('results')}
            className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Offices
          </button>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="w-10 h-10 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Your Campaign Plan</h1>
                <p className="text-gray-600">{currentPlan.office}</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Campaign Timeline
              </h2>
              <div className="space-y-6">
                {Object.entries(currentPlan.timeline).map(([period, tasks]) => (
                  <div key={period} className="border-l-4 border-blue-500 pl-6">
                    <h3 className="font-semibold text-lg text-gray-900 mb-3">{period}</h3>
                    <ul className="space-y-2">
                      {tasks.map((task, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{task}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                Budget Allocation
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="space-y-3">
                  {Object.entries(currentPlan.budget).map(([category, percentage]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium">{category}</span>
                      <span className="text-blue-600 font-semibold">{percentage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentView('chatbot')}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Ask Questions
                </button>
                <a
                  href="https://crowdblue.com"
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
      </div>
    );
  }

  // Chatbot View (existing code - unchanged)
  if (currentView === 'chatbot') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => setCurrentView('results')}
            className="mb-6 text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back
          </button>

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
      </div>
    );
  }

  return null;
}

export default App;