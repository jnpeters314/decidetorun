const STATE_FULL_NAMES = {
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

const STATEWIDE_OFFICE_TYPES = [
  { keyword: 'governor', title: (s) => `Governor of ${STATE_FULL_NAMES[s] || s}`, type: 'governor', cost: '$5,000,000-$50,000,000' },
  { keyword: 'lieutenant governor', title: (s) => `Lieutenant Governor of ${STATE_FULL_NAMES[s] || s}`, type: 'lt_governor', cost: '$500,000-$5,000,000' },
  { keyword: 'secretary of state', title: (s) => `Secretary of State of ${STATE_FULL_NAMES[s] || s}`, type: 'secretary_of_state', cost: '$500,000-$5,000,000' },
  { keyword: 'attorney general', title: (s) => `Attorney General of ${STATE_FULL_NAMES[s] || s}`, type: 'attorney_general', cost: '$1,000,000-$10,000,000' },
  { keyword: 'state treasurer', title: (s) => `State Treasurer of ${STATE_FULL_NAMES[s] || s}`, type: 'state_treasurer', cost: '$300,000-$3,000,000' },
  { keyword: 'state comptroller', title: (s) => `State Comptroller of ${STATE_FULL_NAMES[s] || s}`, type: 'state_comptroller', cost: '$300,000-$3,000,000' },
  { keyword: 'state controller', title: (s) => `State Controller of ${STATE_FULL_NAMES[s] || s}`, type: 'state_controller', cost: '$300,000-$3,000,000' },
  { keyword: 'state auditor', title: (s) => `State Auditor of ${STATE_FULL_NAMES[s] || s}`, type: 'state_auditor', cost: '$200,000-$2,000,000' },
  { keyword: 'superintendent of public instruction', title: (s) => `Superintendent of Public Instruction of ${STATE_FULL_NAMES[s] || s}`, type: 'superintendent', cost: '$300,000-$3,000,000' },
  { keyword: 'insurance commissioner', title: (s) => `Insurance Commissioner of ${STATE_FULL_NAMES[s] || s}`, type: 'insurance_commissioner', cost: '$300,000-$2,000,000' },
  { keyword: 'commissioner of agriculture', title: (s) => `Commissioner of Agriculture of ${STATE_FULL_NAMES[s] || s}`, type: 'ag_commissioner', cost: '$200,000-$2,000,000' },
  { keyword: 'labor commissioner', title: (s) => `Labor Commissioner of ${STATE_FULL_NAMES[s] || s}`, type: 'labor_commissioner', cost: '$200,000-$2,000,000' },
];

// Convert city + state to Ballotpedia page title format
export const cityToPageTitle = (city, state) => {
    const stateNames = {
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
    const stateName = stateNames[state] || state;
    return `${city.trim().replace(/ /g, '_')},_${stateName.replace(/ /g, '_')}`;
  };
  
  // Look up congressional and state legislative districts using Census TIGERweb REST API
  // (ArcGIS REST service — supports browser CORS, no API key required)
  export const getDistrictsFromLatLng = async (lat, lng) => {
    const base = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer';
    const params = `geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=BASENAME&returnGeometry=false&f=json`;

    try {
      const [cdRes, senateRes, houseRes] = await Promise.all([
        fetch(`${base}/0/query?${params}`),  // Congressional districts
        fetch(`${base}/1/query?${params}`),  // State Senate (upper)
        fetch(`${base}/2/query?${params}`),  // State House/Assembly (lower)
      ]);

      const [cdData, senateData, houseData] = await Promise.all([
        cdRes.json(),
        senateRes.json(),
        houseRes.json(),
      ]);

      const congressionalDistrict = cdData.features?.[0]?.attributes?.BASENAME != null
        ? parseInt(cdData.features[0].attributes.BASENAME, 10)
        : null;

      const stateSenateDistrict = senateData.features?.[0]?.attributes?.BASENAME != null
        ? parseInt(senateData.features[0].attributes.BASENAME, 10)
        : null;

      const stateHouseDistrict = houseData.features?.[0]?.attributes?.BASENAME != null
        ? parseInt(houseData.features[0].attributes.BASENAME, 10)
        : null;

      console.log('[DEBUG] TIGERweb districts:', { congressionalDistrict, stateSenateDistrict, stateHouseDistrict });
      return { congressionalDistrict, stateSenateDistrict, stateHouseDistrict };
    } catch (error) {
      console.error('TIGERweb district lookup error:', error);
      return { congressionalDistrict: null, stateSenateDistrict: null, stateHouseDistrict: null };
    }
  };

  // Look up county from lat/long using FCC API
  export const getCountyFromLatLng = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json`
      );
      const data = await res.json();
      if (data.status === 'OK' && data.County) {
        return data.County.name; // e.g. "Contra Costa County"
      }
      return null;
    } catch (error) {
      console.error('FCC county lookup error:', error);
      return null;
    }
  };
  
  // Look up city + lat/long from ZIP using Zippopotam.us
  export const getCityFromZip = async (zip) => {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      const data = await res.json();
      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        return {
          city: place['place name'],
          lat: place.latitude,
          lng: place.longitude,
          state: place['state abbreviation']
        };
      }
      return null;
    } catch (error) {
      console.error('ZIP lookup error:', error);
      return null;
    }
  };
  
  // Fetch and parse a single Ballotpedia page
  const fetchPageRaces = async (pageTitle, state) => {
    try {
      const sectionsRes = await fetch(
        `https://ballotpedia.org/wiki/api.php?action=parse&page=${pageTitle}&prop=sections&format=json&origin=*`
      );
      const sectionsData = await sectionsRes.json();
  
      if (sectionsData.error || !sectionsData.parse) return [];
  
      const sections = sectionsData.parse.sections;
      const electionsSection = sections.find(s => s.line === 'Elections');
      if (!electionsSection) return [];
  
      const contentRes = await fetch(
        `https://ballotpedia.org/wiki/api.php?action=parse&page=${pageTitle}&section=${electionsSection.index}&prop=wikitext&format=json&origin=*`
      );
      const contentData = await contentRes.json();
      const wikitext = contentData.parse.wikitext['*'];
  
      return parseElectionsFromWikitext(wikitext, pageTitle.replace(/_/g, ' ').split(',')[0], state);
    } catch (error) {
      console.error(`Ballotpedia fetch error for ${pageTitle}:`, error);
      return [];
    }
  };
  
  // Main function to fetch all local races
  export const fetchLocalRaces = async (city, state, zipCode) => {
    try {
      let resolvedCity = city;
      let county = null;
  
      // If we have a ZIP, use it to get accurate city and county
      if (zipCode) {
        const zipData = await getCityFromZip(zipCode);
        if (zipData) {
          resolvedCity = zipData.city;
          county = await getCountyFromLatLng(zipData.lat, zipData.lng);
        }
      }
  
      // Fetch city page races
      const cityPageTitle = cityToPageTitle(resolvedCity, state);
      const cityRaces = await fetchPageRaces(cityPageTitle, state);
  
      // Fetch county page races if we have a county
      let countyRaces = [];
      if (county) {
        const countyPageTitle = cityToPageTitle(county.replace(' County', '') + ' County', state);
        countyRaces = await fetchPageRaces(countyPageTitle, state);
      }
  
      // Merge, deduplicate by title
      const allRaces = [...cityRaces, ...countyRaces];
      const unique = allRaces.filter((race, index, self) =>
        index === self.findIndex(r => r.title === race.title)
      );
  
      if (unique.length === 0) {
        return {
          offices: [],
          message: `No local election data found for ${resolvedCity}${county ? ` or ${county}` : ''}.`
        };
      }
  
      return { offices: unique, message: null };
  
    } catch (error) {
      console.error('fetchLocalRaces error:', error);
      return { offices: [], message: 'Could not load local race data.' };
    }
  };
  
  // Parse wikitext into office objects
  const parseElectionsFromWikitext = (wikitext, location, state) => {
    const offices = [];
    const currentYear = new Date().getFullYear();
    const yearSections = wikitext.split(/===(\d{4})===/);
  
    for (let i = 1; i < yearSections.length; i += 2) {
      const year = parseInt(yearSections[i]);
      const content = yearSections[i + 1];
      if (year < currentYear) continue;
  
      const electionDateMatch = content.match(/start=(\d{2}\/\d{2}\/\d{4})/);
      const electionDate = electionDateMatch
        ? new Date(electionDateMatch[1]).toISOString().split('T')[0]
        : `${year}-11-03`;
  
      const filingMatch = content.match(/filing deadline.*?start=(\d{2}\/\d{2}\/\d{4})/i);
      const filingDeadline = filingMatch
        ? new Date(filingMatch[1]).toISOString().split('T')[0]
        : `${year}-03-01`;

        const officeTypes = [
            { keyword: 'mayor', title: `Mayor of ${location}`, type: 'mayor', cost: '$50,000-$500,000' },
            { keyword: 'city council', title: `${location} City Council`, type: 'city_council', cost: '$10,000-$100,000' },
            { keyword: 'board of supervisors', title: `${location} Board of Supervisors`, type: 'board_of_supervisors', cost: '$50,000-$200,000' },
            { keyword: 'school board', title: `${location} School Board`, type: 'school_board', cost: '$5,000-$50,000' },
            { keyword: 'community college board', title: `${location} Community College Board`, type: 'college_board', cost: '$5,000-$30,000' },
            { keyword: 'county supervisor', title: `${location} County Supervisor`, type: 'county_supervisor', cost: '$50,000-$200,000' },
            { keyword: 'county clerk', title: `${location} County Clerk`, type: 'county_clerk', cost: '$20,000-$100,000' },
            { keyword: 'sheriff', title: `${location} Sheriff`, type: 'sheriff', cost: '$50,000-$200,000' },
            { keyword: 'district attorney', title: `${location} District Attorney`, type: 'district_attorney', cost: '$50,000-$300,000' },
            { keyword: 'city attorney', title: `${location} City Attorney`, type: 'city_attorney', cost: '$50,000-$200,000' },
            { keyword: 'water board', title: `${location} Water Board`, type: 'water_board', cost: '$5,000-$30,000' },
            { keyword: 'assessor', title: `${location} Assessor-Recorder`, type: 'assessor', cost: '$20,000-$100,000' },
            { keyword: 'public defender', title: `${location} Public Defender`, type: 'public_defender', cost: '$20,000-$100,000' },
            { keyword: 'treasurer', title: `${location} Treasurer`, type: 'treasurer', cost: '$20,000-$100,000' },
            { keyword: 'bart director', title: `BART Board of Directors`, type: 'bart_director', cost: '$10,000-$50,000' },
            { keyword: 'superior court', title: `${location} Superior Court Judge`, type: 'judge', cost: '$50,000-$200,000' },
          ];
  
      officeTypes.forEach(({ keyword, title, type, cost }) => {
        if (content.toLowerCase().includes(keyword)) {
          offices.push(createLocalOffice(title, location, state, electionDate, filingDeadline, type, cost));
        }
      });
    }
  
    return offices;
  };
  
  // Create office object matching existing data format
  const createLocalOffice = (title, location, state, electionDate, filingDeadline, type, cost) => ({
    id: `local-${type}-${location}-${state}`.toLowerCase().replace(/ /g, '-'),
    title,
    level: 'local',
    state,
    district: location,
    office_type: type,
    next_election: electionDate,
    filing_deadline: filingDeadline,
    incumbent: 'See Ballotpedia',
    estimated_cost: cost,
    total_candidates: 0,
    candidates_running: [],
    confidence: 'medium',
    data_source: 'Ballotpedia',
  });

// Parse statewide offices from wikitext
const parseStatewideFromWikitext = (wikitext, state) => {
  const offices = [];
  const currentYear = new Date().getFullYear();
  const yearSections = wikitext.split(/===(\d{4})===/);

  for (let i = 1; i < yearSections.length; i += 2) {
    const year = parseInt(yearSections[i]);
    const content = yearSections[i + 1];
    if (year < currentYear) continue;

    const electionDateMatch = content.match(/start=(\d{2}\/\d{2}\/\d{4})/);
    const electionDate = electionDateMatch
      ? new Date(electionDateMatch[1]).toISOString().split('T')[0]
      : `${year}-11-03`;

    const filingMatch = content.match(/filing deadline.*?start=(\d{2}\/\d{2}\/\d{4})/i);
    const filingDeadline = filingMatch
      ? new Date(filingMatch[1]).toISOString().split('T')[0]
      : `${year}-03-01`;

    STATEWIDE_OFFICE_TYPES.forEach(({ keyword, title, type, cost }) => {
      if (content.toLowerCase().includes(keyword)) {
        offices.push({
          id: `statewide-${type}-${state}`.toLowerCase(),
          title: title(state),
          level: 'statewide',
          state,
          district: STATE_FULL_NAMES[state] || state,
          office_type: type,
          next_election: electionDate,
          filing_deadline: filingDeadline,
          incumbent: 'See Ballotpedia',
          estimated_cost: cost,
          total_candidates: 0,
          candidates_running: [],
          confidence: 'medium',
          data_source: 'Ballotpedia',
        });
      }
    });
  }

  return offices;
};

// Fetch statewide offices for a given state from Ballotpedia
export const fetchStatewideRaces = async (state) => {
  const stateName = (STATE_FULL_NAMES[state] || state).replace(/ /g, '_');
  try {
    const sectionsRes = await fetch(
      `https://ballotpedia.org/wiki/api.php?action=parse&page=${stateName}&prop=sections&format=json&origin=*`
    );
    const sectionsData = await sectionsRes.json();

    if (sectionsData.error || !sectionsData.parse) return [];

    const sections = sectionsData.parse.sections;
    const electionsSection = sections.find(s => s.line === 'Elections');
    if (!electionsSection) return [];

    const contentRes = await fetch(
      `https://ballotpedia.org/wiki/api.php?action=parse&page=${stateName}&section=${electionsSection.index}&prop=wikitext&format=json&origin=*`
    );
    const contentData = await contentRes.json();
    const wikitext = contentData.parse.wikitext['*'];

    return parseStatewideFromWikitext(wikitext, state);
  } catch (error) {
    console.error(`Ballotpedia statewide fetch error for ${state}:`, error);
    return [];
  }
};

// Ordinal suffix helper (1 → "1st", 2 → "2nd", etc.)
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Build Ballotpedia page title for a congressional district
// e.g. state=CA, district=11 → "California's_11th_congressional_district"
const congressionalPageTitle = (state, district) => {
  const stateName = (STATE_FULL_NAMES[state] || state).replace(/ /g, '_');
  return `${stateName}%27s_${ordinal(district)}_congressional_district`;
};

// Build Ballotpedia page title for a state legislative district
// e.g. state=CA, district=7, chamber='senate' → "California_State_Senate,_District_7"
const stateLegPageTitle = (state, district, chamber) => {
  const stateName = (STATE_FULL_NAMES[state] || state).replace(/ /g, '_');
  const chamberLabel = chamber === 'senate' ? 'State_Senate' : 'State_Assembly';
  return `${stateName}_${chamberLabel},_District_${district}`;
};

// Parse a congressional district Ballotpedia page into an office object
const parseCongressionalPage = (wikitext, state, district) => {
  const currentYear = new Date().getFullYear();
  const yearSections = wikitext.split(/===(\d{4})===/);
  const offices = [];

  for (let i = 1; i < yearSections.length; i += 2) {
    const year = parseInt(yearSections[i]);
    const content = yearSections[i + 1];
    if (year < currentYear) continue;

    const electionDateMatch = content.match(/start=(\d{2}\/\d{2}\/\d{4})/);
    const electionDate = electionDateMatch
      ? new Date(electionDateMatch[1]).toISOString().split('T')[0]
      : `${year}-11-03`;

    const filingMatch = content.match(/filing deadline.*?start=(\d{2}\/\d{2}\/\d{4})/i);
    const filingDeadline = filingMatch
      ? new Date(filingMatch[1]).toISOString().split('T')[0]
      : `${year}-03-01`;

    offices.push({
      id: `federal-house-${state}-${district}`.toLowerCase(),
      title: `U.S. House — ${STATE_FULL_NAMES[state] || state} District ${district}`,
      level: 'federal',
      state,
      district: String(district),
      office_type: 'house',
      next_election: electionDate,
      filing_deadline: filingDeadline,
      incumbent: 'See Ballotpedia',
      estimated_cost: '$1,000,000-$5,000,000',
      total_candidates: 0,
      candidates_running: [],
      min_age: 25,
      confidence: 'medium',
      data_source: 'Ballotpedia',
    });
  }

  return offices;
};

// Parse a state legislative district Ballotpedia page into an office object
const parseStateLegPage = (wikitext, state, district, chamber) => {
  const currentYear = new Date().getFullYear();
  const yearSections = wikitext.split(/===(\d{4})===/);
  const offices = [];

  for (let i = 1; i < yearSections.length; i += 2) {
    const year = parseInt(yearSections[i]);
    const content = yearSections[i + 1];
    if (year < currentYear) continue;

    const electionDateMatch = content.match(/start=(\d{2}\/\d{2}\/\d{4})/);
    const electionDate = electionDateMatch
      ? new Date(electionDateMatch[1]).toISOString().split('T')[0]
      : `${year}-11-03`;

    const filingMatch = content.match(/filing deadline.*?start=(\d{2}\/\d{2}\/\d{4})/i);
    const filingDeadline = filingMatch
      ? new Date(filingMatch[1]).toISOString().split('T')[0]
      : `${year}-03-01`;

    const isSenate = chamber === 'senate';
    offices.push({
      id: `state-${chamber}-${state}-${district}`.toLowerCase(),
      title: `${STATE_FULL_NAMES[state] || state} State ${isSenate ? 'Senate' : 'Assembly'} — District ${district}`,
      level: 'state',
      state,
      district: String(district),
      office_type: isSenate ? 'state_senate' : 'state_assembly',
      next_election: electionDate,
      filing_deadline: filingDeadline,
      incumbent: 'See Ballotpedia',
      estimated_cost: isSenate ? '$100,000-$500,000' : '$50,000-$300,000',
      total_candidates: 0,
      candidates_running: [],
      min_age: 18,
      confidence: 'medium',
      data_source: 'Ballotpedia',
    });
  }

  return offices;
};

// Fetch offices for a specific congressional district from Ballotpedia
const fetchDistrictPage = async (pageTitle, parser) => {
  try {
    const sectionsRes = await fetch(
      `https://ballotpedia.org/wiki/api.php?action=parse&page=${pageTitle}&prop=sections&format=json&origin=*`
    );
    const sectionsData = await sectionsRes.json();
    if (sectionsData.error || !sectionsData.parse) return [];

    const electionsSection = sectionsData.parse.sections.find(s => s.line === 'Elections');
    if (!electionsSection) return [];

    const contentRes = await fetch(
      `https://ballotpedia.org/wiki/api.php?action=parse&page=${pageTitle}&section=${electionsSection.index}&prop=wikitext&format=json&origin=*`
    );
    const contentData = await contentRes.json();
    const wikitext = contentData.parse.wikitext['*'];
    return parser(wikitext);
  } catch (error) {
    console.error(`Ballotpedia district fetch error for ${pageTitle}:`, error);
    return [];
  }
};

// Fetch congressional + state legislative district races for a user's specific districts
export const fetchDistrictRaces = async (state, congressionalDistrict, stateSenateDistrict, stateHouseDistrict) => {
  const fetches = [];

  if (congressionalDistrict) {
    const title = congressionalPageTitle(state, congressionalDistrict);
    fetches.push(fetchDistrictPage(title, (wt) => parseCongressionalPage(wt, state, congressionalDistrict)));
  }

  if (stateSenateDistrict) {
    const title = stateLegPageTitle(state, stateSenateDistrict, 'senate');
    fetches.push(fetchDistrictPage(title, (wt) => parseStateLegPage(wt, state, stateSenateDistrict, 'senate')));
  }

  if (stateHouseDistrict) {
    const title = stateLegPageTitle(state, stateHouseDistrict, 'assembly');
    fetches.push(fetchDistrictPage(title, (wt) => parseStateLegPage(wt, state, stateHouseDistrict, 'assembly')));
  }

  const results = await Promise.all(fetches);
  return results.flat();
};