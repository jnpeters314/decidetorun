// Convert city + state to Ballotpedia page title format
export const cityToPageTitle = (city, state) => {
    const stateNames = {
      'CA': 'California', 'TX': 'Texas', 'NY': 'New York', // add more as needed
      'FL': 'Florida', 'IL': 'Illinois', 'PA': 'Pennsylvania',
      'OH': 'Ohio', 'GA': 'Georgia', 'NC': 'North Carolina',
      'MI': 'Michigan', 'WA': 'Washington', 'AZ': 'Arizona',
      'CO': 'Colorado', 'TN': 'Tennessee', 'OR': 'Oregon',
    };
    const stateName = stateNames[state] || state;
    return `${city.replace(/ /g, '_')},_${stateName.replace(/ /g, '_')}`;
  };
  
  // Fetch local election data from Ballotpedia wiki API
  export const fetchLocalRaces = async (city, state) => {
    try {
      const pageTitle = cityToPageTitle(city, state);
  
      // First get sections to find the Elections section index
      const sectionsRes = await fetch(
        `https://ballotpedia.org/wiki/api.php?action=parse&page=${pageTitle}&prop=sections&format=json&origin=*`
      );
      const sectionsData = await sectionsRes.json();
  
      if (sectionsData.error || !sectionsData.parse) {
        return { offices: [], message: `No local data found for ${city}.` };
      }
  
      const sections = sectionsData.parse.sections;
      const electionsSection = sections.find(s => s.line === 'Elections');
  
      if (!electionsSection) {
        return { offices: [], message: `No local election data found for ${city}.` };
      }
  
      // Fetch the Elections section content
      const contentRes = await fetch(
        `https://ballotpedia.org/wiki/api.php?action=parse&page=${pageTitle}&section=${electionsSection.index}&prop=wikitext&format=json&origin=*`
      );
      const contentData = await contentRes.json();
      const wikitext = contentData.parse.wikitext['*'];
  
      // Parse upcoming elections from wikitext
      const offices = parseElectionsFromWikitext(wikitext, city, state);
      
      if (offices.length === 0) {
        return { offices: [], message: `No upcoming local elections found for ${city}.` };
      }
  
      return { offices, message: null };
  
    } catch (error) {
      console.error('Ballotpedia fetch error:', error);
      return { offices: [], message: `Could not load local data for ${city}.` };
    }
  };
  
  // Parse wikitext into office objects matching your existing format
  const parseElectionsFromWikitext = (wikitext, city, state) => {
    const offices = [];
    const currentYear = new Date().getFullYear();
  
    // Match year sections
    const yearSections = wikitext.split(/===(\d{4})===/);
    
    for (let i = 1; i < yearSections.length; i += 2) {
      const year = parseInt(yearSections[i]);
      const content = yearSections[i + 1];
  
      if (year < currentYear) continue; // Skip past elections
  
      // Extract election date
      const electionDateMatch = content.match(/start=(\d{2}\/\d{2}\/\d{4})/);
      const electionDate = electionDateMatch 
        ? new Date(electionDateMatch[1]).toISOString().split('T')[0]
        : `${year}-11-03`;
  
      // Extract filing deadline
      const filingMatch = content.match(/filing deadline.*?start=(\d{2}\/\d{2}\/\d{4})/i);
      const filingDeadline = filingMatch
        ? new Date(filingMatch[1]).toISOString().split('T')[0]
        : `${year}-03-01`;
  
      // Determine office type from content
      const hasMayor = content.toLowerCase().includes('mayor');
      const hasCouncil = content.toLowerCase().includes('city council') || content.toLowerCase().includes('council');
      const hasSchoolBoard = content.toLowerCase().includes('school board');
  
      if (hasMayor) {
        offices.push(createLocalOffice(`Mayor of ${city}`, city, state, electionDate, filingDeadline, 'mayor'));
      }
      if (hasCouncil) {
        offices.push(createLocalOffice(`${city} City Council`, city, state, electionDate, filingDeadline, 'city_council'));
      }
      if (hasSchoolBoard) {
        offices.push(createLocalOffice(`${city} School Board`, city, state, electionDate, filingDeadline, 'school_board'));
      }
    }
  
    return offices;
  };
  
  // Create an office object matching your existing data format
  const createLocalOffice = (title, city, state, electionDate, filingDeadline, type) => ({
    id: `local-${type}-${city}-${state}`.toLowerCase().replace(/ /g, '-'),
    title,
    level: 'local',
    state,
    district: city,
    office_type: type,
    next_election: electionDate,
    filing_deadline: filingDeadline,
    incumbent: 'See Ballotpedia',
    estimated_cost: type === 'mayor' ? '$50,000-$500,000' : '$10,000-$100,000',
    total_candidates: 0,
    candidates_running: [],
    confidence: 'medium',
    data_source: 'Ballotpedia',
  });