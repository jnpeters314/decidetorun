// Fetch current state legislators for a lat/lng via OpenStates (proxied through Supabase)
export const getLegislatorsForLocation = async (lat, lng) => {
  try {
    const res = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/get-legislators`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ lat, lng }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// Match OpenStates legislators to our office objects and fill in real incumbent names + party
export const enrichOfficesWithIncumbents = (offices, legislators) => {
  if (!legislators.length) return offices;

  return offices.map(office => {
    if (office.level !== 'state') return office;

    const districtNum = parseInt(office.district, 10);
    const titleLower = (office.title || '').toLowerCase();
    const typeLower = (office.office_type || '').toLowerCase();
    const isStateSenate = titleLower.includes('senate') || typeLower.includes('senate');
    const chamber = isStateSenate ? 'upper' : 'lower';

    const match = legislators.find(leg =>
      leg.chamber === chamber &&
      parseInt(leg.district, 10) === districtNum
    );

    if (!match) return office;

    const partyAbbr =
      match.party === 'Democratic' ? 'D' :
      match.party === 'Republican' ? 'R' :
      match.party?.charAt(0) ?? '?';

    return { ...office, incumbent: `${match.name} (${partyAbbr})` };
  });
};
