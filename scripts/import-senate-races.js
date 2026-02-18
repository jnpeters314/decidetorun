require('dotenv').config({ path: '.env.local' });


const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FEC_API_KEY = process.env.FEC_API_KEY;

// States with Senate races in 2026
const SENATE_STATES_2026 = [
  'AL', 'AK', 'AR', 'CO', 'DE', 'GA', 'ID', 'IL', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MA', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH',
  'NJ', 'NM', 'NC', 'OK', 'OR', 'RI', 'SC', 'SD', 'TN', 'TX',
  'VA', 'WV', 'WY', 'AZ'
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSenateCandidates(state) {
    const url = `https://api.open.fec.gov/v1/candidates/?office=S&state=${state}&election_year=2026&is_active_candidate=true&per_page=100&api_key=${FEC_API_KEY}`;
    
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.log(`Rate limited for ${state}, waiting 30 seconds...`);
        await delay(30000);
        return fetchSenateCandidates(state);
      }
      
      if (!response.ok) {
        console.error(`API Error for ${state}: ${response.status}`);
        const errorText = await response.text();
        console.error(`Response: ${errorText}`);
        return [];
      }
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.log(`  No active candidates found for ${state} Senate`);
        return [];
      }
      
      return data.results;
    } catch (error) {
      console.error(`Error fetching candidates for ${state}:`, error);
      return [];
    }
  }

async function importSenateRace(state) {
  console.log(`\n🏛️ Importing Senate race for ${state}...`);
  
  // Fetch all candidates
  const candidates = await fetchSenateCandidates(state);
  await delay(2000);
  
  if (candidates.length === 0) {
    console.log(`  ⚠️  No candidates found for ${state}`);
    return;
  }
  
  console.log(`  Found ${candidates.length} candidates`);
  
  // Process candidates
  const candidatesRunning = candidates.map(candidate => ({
    name: candidate.name,
    party: candidate.party_full || candidate.party || 'Unknown',
    incumbent: candidate.incumbent_challenge === 'I',
    receipts: parseFloat(candidate.total_receipts || 0),
    disbursements: parseFloat(candidate.total_disbursements || 0),
    cash_on_hand: parseFloat(candidate.cash_on_hand_end_period || 0)
  }));
  
  // Identify incumbent
  const incumbent = candidatesRunning.find(c => c.incumbent);
  const incumbentName = incumbent 
    ? `${incumbent.name} (${incumbent.party.charAt(0)})`
    : 'Open Seat';
  
  // Prepare office record
  const officeData = {
    title: `U.S. Senate - ${state}`,
    level: 'federal',
    office_type: 'senate',
    state: state,
    district: '0',
    next_election: '2026-11-03',
    filing_deadline: '2026-06-30',
    incumbent: incumbentName,
    estimated_cost: '$5,000,000 - $50,000,000',
    confidence: 'verified',
    term: '6 years',
    min_age: 30,
    salary: '$174,000/year',
    candidates_running: candidatesRunning,
    total_candidates: candidatesRunning.length,
    data_source: 'FEC API',
    last_updated: new Date().toISOString()
  };
  
// Check if race already exists
const { data: existing } = await supabase
  .from('offices')
  .select('id')
  .eq('state', state)
  .eq('office_type', 'senate')
  .single();

let data, error;

if (existing) {
  // Update existing record
  ({ data, error } = await supabase
    .from('offices')
    .update(officeData)
    .eq('id', existing.id));
} else {
  // Insert new record
  ({ data, error } = await supabase
    .from('offices')
    .insert(officeData));
}
  
  if (error) {
    console.error(`  ❌ Error inserting ${state}:`, error);
  } else {
    console.log(`  ✅ Successfully imported ${state} Senate race`);
    console.log(`     Incumbent: ${incumbentName}`);
    console.log(`     Candidates: ${candidatesRunning.length}`);
  }
}

async function main() {
  console.log('🚀 Starting Senate races import for 2026...');
  console.log(`📊 Importing ${SENATE_STATES_2026.length} Senate races\n`);
  
  for (const state of SENATE_STATES_2026) {
    await importSenateRace(state);
    await delay(5000);
  }
  
  console.log('\n✅ Senate import complete!');
  process.exit(0);
}

main();
