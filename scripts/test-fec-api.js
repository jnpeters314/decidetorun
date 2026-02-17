require('dotenv').config();
const axios = require('axios');

const FEC_API_KEY = process.env.REACT_APP_FEC_API_KEY;
const FEC_BASE_URL = 'https://api.open.fec.gov/v1';

async function testFECAPI() {
  try {
    console.log('Testing FEC API...\n');
    
    // Test 1: Fetch some House races
    console.log('1. Fetching House races for 2026...');
    const response = await axios.get(`${FEC_BASE_URL}/election-dates/`, {
      params: {
        api_key: FEC_API_KEY,
        election_year: 2026,
        office_sought: 'H',
        per_page: 5
      }
    });
    
    console.log(`Found ${response.data.results.length} races`);
    console.log('\nFirst race data:');
    console.log(JSON.stringify(response.data.results[0], null, 2));
    
    // Test 2: Fetch candidates for California District 5
    console.log('\n\n2. Fetching candidates for CA-05...');
    const candidatesResponse = await axios.get(`${FEC_BASE_URL}/candidates/`, {
      params: {
        api_key: FEC_API_KEY,
        cycle: 2026,
        state: 'CA',
        office: 'H',
        district: '05',
        per_page: 10
      }
    });
    
    console.log(`Found ${candidatesResponse.data.results.length} candidates`);
    if (candidatesResponse.data.results.length > 0) {
      console.log('\nFirst candidate:');
      console.log(JSON.stringify(candidatesResponse.data.results[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testFECAPI();
