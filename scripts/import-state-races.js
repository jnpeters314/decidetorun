const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');

const supabase = createClient(
  'https://pmiqbxxvoabowwiedrej.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtaXFieHh2b2Fib3d3aWVkcmVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk5NDI5NiwiZXhwIjoyMDg2NTcwMjk2fQ.FCtTA7IPOYA_S9OEY4OKmVxRjHABkLf3JOqwohjJl00'
);

// All 50 states
const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// State-specific election info (you can update these)
const STATE_INFO = {
  'CA': { 
    filing_deadline: '2026-03-12', 
    min_cost: 100000, 
    max_cost: 500000,
    term_house: '2 years',
    term_senate: '4 years',
    house_name: 'Assembly',
    senate_name: 'Senate'
  },
  'TX': { 
    filing_deadline: '2026-12-13', 
    min_cost: 50000, 
    max_cost: 300000,
    term_house: '2 years',
    term_senate: '4 years',
    house_name: 'House',
    senate_name: 'Senate'
  },
  // Default for all other states
  'DEFAULT': { 
    filing_deadline: '2026-06-30', 
    min_cost: 25000, 
    max_cost: 200000,
    term_house: '2 years',
    term_senate: '4 years',
    house_name: 'House',
    senate_name: 'Senate'
  }
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchStateLegislators(state) {
  const url = `https://data.openstates.org/people/current/${state.toLowerCase()}.csv`;
  
  console.log(`📥 Fetching ${state} legislators from Open States...`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });
    
    return parsed.data;
  } catch (error) {
    console.error(`❌ Error fetching ${state}:`, error);
    return [];
  }
}

function getChamberName(chamber, state) {
  const info = STATE_INFO[state] || STATE_INFO.DEFAULT;
  if (chamber === 'upper') return info.senate_name;
  if (chamber === 'lower') return info.house_name;
  return chamber;
}

function getOfficeCost(state, chamber) {
  const info = STATE_INFO[state] || STATE_INFO.DEFAULT;
  const min = (info.min_cost / 1000).toFixed(0);
  const max = (info.max_cost / 1000).toFixed(0);
  return `$${min},000 - $${max},000`;
}

function getTerm(state, chamber) {
  const info = STATE_INFO[state] || STATE_INFO.DEFAULT;
  return chamber === 'upper' ? info.term_senate : info.term_house;
}

async function importStateLegislature(state) {
  console.log(`\n🏛️  Processing ${state} State Legislature...`);
  
  const legislators = await fetchStateLegislators(state);
  await delay(1000); // Be nice to their servers
  
  if (legislators.length === 0) {
    console.log(`  ⚠️  No legislators found for ${state}`);
    return;
  }
  
  console.log(`  📊 Found ${legislators.length} current legislators`);
  
  // Group by district to create one race per district
  const districtMap = {};
  
  for (const legislator of legislators) {
    const chamber = legislator.current_chamber;
    const district = legislator.current_district;
    const key = `${chamber}-${district}`;
    
    if (!districtMap[key]) {
      districtMap[key] = [];
    }
    
    districtMap[key].push(legislator);
  }
  
  console.log(`  📍 Creating ${Object.keys(districtMap).length} district races`);
  
  // Create office records
  let successCount = 0;
  let errorCount = 0;
  
  for (const [key, legislators] of Object.entries(districtMap)) {
    const firstLeg = legislators[0];
    const chamber = firstLeg.current_chamber;
    const district = firstLeg.current_district;
    const chamberName = getChamberName(chamber, state);
    
    // Find incumbent (should be the one listed)
    const incumbent = legislators.length > 0 
      ? `${legislators[0].name} (${legislators[0].current_party})`
      : 'TBD';
    
    const stateInfo = STATE_INFO[state] || STATE_INFO.DEFAULT;
    
    const officeData = {
      title: `${state} State ${chamberName} - District ${district}`,
      level: 'state',
      office_type: 'state_legislature',
      office_category: 'state_legislature',
      state: state,
      district: district.toString(),
      chamber: chamber,
      next_election: '2026-11-03',
      filing_deadline: stateInfo.filing_deadline,
      incumbent: incumbent,
      estimated_cost: getOfficeCost(state, chamber),
      confidence: 'verified',
      term: getTerm(state, chamber),
      min_age: 18, // Most states, can override
      salary: 'Varies by state', // Would need to look up per state
      data_source: 'Open States',
      candidates_running: legislators.map(leg => ({
        name: leg.name,
        party: leg.current_party,
        incumbent: true,
        email: leg.email || null,
        image: leg.image || null
      })),
      total_candidates: legislators.length,
      last_updated: new Date().toISOString()
    };
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('offices')
      .select('id')
      .eq('state', state)
      .eq('district', district.toString())
      .eq('office_type', 'state_legislature')
      .eq('chamber', chamber)
      .single();
    
    let result, error;
    
    if (existing) {
      // Update existing
      ({ data: result, error } = await supabase
        .from('offices')
        .update(officeData)
        .eq('id', existing.id));
    } else {
      // Insert new
      ({ data: result, error } = await supabase
        .from('offices')
        .insert(officeData));
    }
    
    if (error) {
      console.error(`  ❌ Error inserting ${chamberName} District ${district}:`, error.message);
      errorCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`  ✅ Successfully imported ${successCount} races`);
  if (errorCount > 0) {
    console.log(`  ⚠️  ${errorCount} errors`);
  }
}

async function main() {
  console.log('🚀 Starting State Legislature Import from Open States...');
  console.log(`📊 Importing ${STATES.length} states\n`);
  
  let totalRaces = 0;
  
  for (const state of STATES) {
    await importStateLegislature(state);
    await delay(2000); // 2 second delay between states
    totalRaces++;
  }
  
  console.log('\n✅ State legislature import complete!');
  console.log(`📊 Processed ${STATES.length} states`);
  
  // Get final count
  const { count } = await supabase
    .from('offices')
    .select('*', { count: 'exact', head: true })
    .eq('office_type', 'state_legislature');
  
  console.log(`📈 Total state legislature races in database: ${count}`);
  
  process.exit(0);
}

main();
