require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const FEC_API_KEY = process.env.REACT_APP_FEC_API_KEY;
const FEC_BASE_URL = 'https://api.open.fec.gov/v1';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CYCLE = 2026;

// All 50 states with their House district counts
const STATES = {
  'AL': { name: 'Alabama', districts: 7 },
  'AK': { name: 'Alaska', districts: 1 },
  'AZ': { name: 'Arizona', districts: 9 },
  'AR': { name: 'Arkansas', districts: 4 },
  'CA': { name: 'California', districts: 52 },
  'CO': { name: 'Colorado', districts: 8 },
  'CT': { name: 'Connecticut', districts: 5 },
  'DE': { name: 'Delaware', districts: 1 },
  'FL': { name: 'Florida', districts: 28 },
  'GA': { name: 'Georgia', districts: 14 },
  'HI': { name: 'Hawaii', districts: 2 },
  'ID': { name: 'Idaho', districts: 2 },
  'IL': { name: 'Illinois', districts: 17 },
  'IN': { name: 'Indiana', districts: 9 },
  'IA': { name: 'Iowa', districts: 4 },
  'KS': { name: 'Kansas', districts: 4 },
  'KY': { name: 'Kentucky', districts: 6 },
  'LA': { name: 'Louisiana', districts: 6 },
  'ME': { name: 'Maine', districts: 2 },
  'MD': { name: 'Maryland', districts: 8 },
  'MA': { name: 'Massachusetts', districts: 9 },
  'MI': { name: 'Michigan', districts: 13 },
  'MN': { name: 'Minnesota', districts: 8 },
  'MS': { name: 'Mississippi', districts: 4 },
  'MO': { name: 'Missouri', districts: 8 },
  'MT': { name: 'Montana', districts: 2 },
  'NE': { name: 'Nebraska', districts: 3 },
  'NV': { name: 'Nevada', districts: 4 },
  'NH': { name: 'New Hampshire', districts: 2 },
  'NJ': { name: 'New Jersey', districts: 12 },
  'NM': { name: 'New Mexico', districts: 3 },
  'NY': { name: 'New York', districts: 26 },
  'NC': { name: 'North Carolina', districts: 14 },
  'ND': { name: 'North Dakota', districts: 1 },
  'OH': { name: 'Ohio', districts: 15 },
  'OK': { name: 'Oklahoma', districts: 5 },
  'OR': { name: 'Oregon', districts: 6 },
  'PA': { name: 'Pennsylvania', districts: 17 },
  'RI': { name: 'Rhode Island', districts: 2 },
  'SC': { name: 'South Carolina', districts: 7 },
  'SD': { name: 'South Dakota', districts: 1 },
  'TN': { name: 'Tennessee', districts: 9 },
  'TX': { name: 'Texas', districts: 38 },
  'UT': { name: 'Utah', districts: 4 },
  'VT': { name: 'Vermont', districts: 1 },
  'VA': { name: 'Virginia', districts: 11 },
  'WA': { name: 'Washington', districts: 10 },
  'WV': { name: 'West Virginia', districts: 2 },
  'WI': { name: 'Wisconsin', districts: 8 },
  'WY': { name: 'Wyoming', districts: 1 }
};

async function fetchCandidatesForDistrict(state, district) {
  try {
    const response = await axios.get(`${FEC_BASE_URL}/candidates/`, {
      params: {
        api_key: FEC_API_KEY,
        cycle: CYCLE,
        state: state,
        office: 'H',
        district: district.toString().padStart(2, '0'),
        per_page: 100
      }
    });
    
    return response.data.results || [];
  } catch (error) {
    if (error.response?.status === 429) {
      console.log(`⏸️  Rate limited, waiting 30 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      // Retry once
      return fetchCandidatesForDistrict(state, district);
    }
    console.error(`Error: ${error.message}`);
    return [];
  }
}

async function fetchCandidateFinances(candidateId) {
  try {
    const response = await axios.get(`${FEC_BASE_URL}/candidate/${candidateId}/totals/`, {
      params: {
        api_key: FEC_API_KEY,
        cycle: CYCLE,
        per_page: 1
      }
    });
    
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
  } catch (error) {
    if (error.response?.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    // Silent fail for finance data
  }
  return null;
}

async function importAllHouseSeats() {
  console.log('🏛️  Importing all 435 U.S. House seats...\n');
  
  let totalCreated = 0;
  const statesList = Object.entries(STATES);
  const totalStates = statesList.length;
  
  // Resume from California (change this to 'AL' to start from beginning)
  const startFrom = statesList.findIndex(([code]) => code === 'CA');
  const statesToProcess = statesList.slice(startFrom);
  
  console.log(`Starting from state #${startFrom + 1}: California\n`);
  
  let statesProcessed = startFrom;
  
  for (const [stateCode, stateInfo] of statesToProcess) {
    statesProcessed++;
    console.log(`\n[${statesProcessed}/${totalStates}] Processing ${stateInfo.name} (${stateInfo.districts} districts)...`);
    
    for (let district = 1; district <= stateInfo.districts; district++) {
      const districtLabel = stateInfo.districts === 1 ? 'At-Large' : district.toString();
      process.stdout.write(`  ${stateCode}-${districtLabel.padEnd(8)} `);
      
      const candidates = await fetchCandidatesForDistrict(stateCode, district);
      
      if (candidates.length === 0) {
        console.log('(no candidates filed yet)');
      } else {
        process.stdout.write(`${candidates.length} candidates... `);
      }
      
      // Get finance data for each candidate
      const candidatesWithFinances = await Promise.all(
        candidates.slice(0, 20).map(async (candidate) => {
          const finances = await fetchCandidateFinances(candidate.candidate_id);
          return {
            name: candidate.name,
            party: candidate.party_full || candidate.party,
            incumbent: candidate.incumbent_challenge === 'I',
            candidate_id: candidate.candidate_id,
            receipts: finances?.receipts || 0,
            disbursements: finances?.disbursements || 0,
            cash_on_hand: finances?.cash_on_hand_end_period || 0
          };
        })
      );
      
      const incumbent = candidatesWithFinances.find(c => c.incumbent);
      
      const office = {
        title: `U.S. House of Representatives - District ${districtLabel}`,
        level: 'federal',
        office_type: 'house',
        state: stateCode,
        district: district.toString(),
        next_election: '2026-11-03',
        filing_deadline: '2026-06-01',
        incumbent: incumbent ? `${incumbent.name} (${incumbent.party})` : (candidates.length > 0 ? 'Open Seat' : 'TBD'),
        estimated_cost: '$800,000 - $2,500,000',
        confidence: 'verified',
        term: '2 years',
        min_age: 25,
        salary: '$174,000/year',
        candidates_running: candidatesWithFinances,
        total_candidates: candidates.length,
        data_source: 'FEC API',
        last_updated: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('offices')
        .insert(office);
      
      if (error) {
        console.log(`❌ ${error.message}`);
      } else {
        console.log('✓');
        totalCreated++;
      }
      
      // Rate limit: 2 seconds between each district
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Longer pause between states
    console.log(`  ✅ Completed ${stateInfo.name}. Pausing 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  return totalCreated;
}

async function clearOldData() {
  console.log('🗑️  Removing old test data...');
  
  const { error } = await supabase
    .from('offices')
    .delete()
    .neq('data_source', 'FEC API');
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error clearing old data:', error);
  } else {
    console.log('✓ Old data cleared\n');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Decide to Run - Federal Offices Data Import');
  console.log('═══════════════════════════════════════════════════\n');
  
  await clearOldData();
  const houseCount = await importAllHouseSeats();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ Successfully imported ${houseCount} federal offices`);
  console.log('═══════════════════════════════════════════════════\n');
  
  process.exit(0);
}

main();