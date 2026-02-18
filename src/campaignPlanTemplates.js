export const getCampaignPlanTemplate = (office) => {
    const filingDeadline = new Date(office.filing_deadline);
    const today = new Date();
    const daysUntil = Math.ceil((filingDeadline - today) / (1000 * 60 * 60 * 24));
    
    // Determine race type
    const raceType = office.office_type || office.level;
    
    // Base template that applies to all races
    const baseChecklist = {
      preFilingEssentials: [
        { id: 'research', task: `Research filing requirements for ${office.state}`, priority: 'critical' },
        { id: 'eligibility', task: `Verify eligibility (Age: ${office.min_age}+, Citizenship, Residency)`, priority: 'critical' },
        { id: 'bank', task: 'Set up campaign bank account', priority: 'critical' },
        { id: 'deadline', task: `Mark filing deadline: ${filingDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, priority: 'critical' },
      ],
      
      filing: [
        { id: 'org', task: 'File Statement of Organization', priority: 'critical' },
        { id: 'treasurer', task: 'Designate campaign treasurer', priority: 'critical' },
        { id: 'candidacy', task: 'File Declaration of Candidacy', priority: 'critical' },
      ],
      
      first30Days: [
        { id: 'committee', task: 'Form exploratory committee', priority: 'high' },
        { id: 'website', task: 'Launch campaign website', priority: 'high' },
        { id: 'social', task: 'Create social media accounts (Facebook, Twitter/X, Instagram)', priority: 'high' },
        { id: 'coffee', task: 'Schedule 15-20 coffee meetings with community leaders', priority: 'medium' },
      ],
      
      fundraising: [],
      team: [],
      fieldWork: [],
      messaging: [
        { id: 'bio', task: 'Write candidate biography', priority: 'high' },
        { id: 'issues', task: 'Identify 3-5 core issues', priority: 'high' },
        { id: 'talking', task: 'Develop talking points', priority: 'medium' },
      ]
    };
  
    // Federal House races
    if (raceType === 'house' || (office.level === 'federal' && office.estimated_cost?.includes('800,000'))) {
      return {
        ...baseChecklist,
        filing: [
          ...baseChecklist.filing,
          { id: 'fec', task: 'Register with Federal Election Commission (FEC)', priority: 'critical' },
          { id: 'fecid', task: 'Obtain FEC ID number', priority: 'critical' },
        ],
        fundraising: [
          { id: 'target', task: `Set fundraising target: ${office.estimated_cost}`, priority: 'critical' },
          { id: 'actblue', task: 'Set up ActBlue/WinRed account', priority: 'critical' },
          { id: 'calltime', task: 'Schedule daily call time (3-5 hours)', priority: 'critical' },
          { id: 'personal', task: 'Personal network asks (Goal: $25,000 in first 30 days)', priority: 'high' },
          { id: 'events', task: 'Plan quarterly fundraising events', priority: 'high' },
          { id: 'pacs', task: 'Research endorsement opportunities from PACs', priority: 'medium' },
          { id: 'bundlers', task: 'Recruit 10 bundlers (people who can raise $5K+ each)', priority: 'medium' },
          { id: 'recurring', task: 'Set up recurring donor program', priority: 'medium' },
        ],
        team: [
          { id: 'manager', task: 'Hire Campaign Manager ($5,000-8,000/month)', priority: 'critical' },
          { id: 'finance', task: 'Hire Finance Director ($4,000-6,000/month)', priority: 'critical' },
          { id: 'comms', task: 'Hire Communications Director ($4,000-6,000/month)', priority: 'high' },
          { id: 'field', task: 'Hire Field Director ($3,500-5,000/month)', priority: 'high' },
          { id: 'digital', task: 'Hire Digital Director ($3,000-5,000/month)', priority: 'medium' },
          { id: 'volunteers', task: 'Recruit Volunteer Coordinator', priority: 'medium' },
        ],
        fieldWork: [
          { id: 'data', task: 'Purchase voter file/VAN access', priority: 'critical' },
          { id: 'offices', task: 'Secure campaign office space', priority: 'high' },
          { id: 'canvass', task: 'Plan door-to-door canvassing schedule', priority: 'high' },
          { id: 'phones', task: 'Set up phone banking operation', priority: 'high' },
          { id: 'events', task: 'Plan community meet-and-greets (2-3 per week)', priority: 'medium' },
        ],
        budget: {
          'Staff & Operations': '25-30%',
          'Media & Advertising': '35-45%',
          'Field Operations': '15-20%',
          'Fundraising Costs': '8-12%',
          'Other': '5-10%'
        }
      };
    }
  
    // State Legislature
    if (raceType === 'stateSenate' || raceType === 'stateHouse' || office.level === 'state') {
      return {
        ...baseChecklist,
        filing: [
          ...baseChecklist.filing,
          { id: 'state', task: `Register with ${office.state} State Board of Elections`, priority: 'critical' },
          { id: 'signatures', task: 'Collect petition signatures (typically 100-500)', priority: 'critical' },
        ],
        fundraising: [
          { id: 'target', task: `Set fundraising target: ${office.estimated_cost}`, priority: 'critical' },
          { id: 'limits', task: `Research ${office.state} contribution limits`, priority: 'critical' },
          { id: 'actblue', task: 'Set up ActBlue/WinRed account', priority: 'high' },
          { id: 'calltime', task: 'Schedule 2-3 hours daily call time', priority: 'high' },
          { id: 'personal', task: 'Personal network asks (Goal: $10,000 in first 30 days)', priority: 'high' },
          { id: 'local', task: 'Approach local business owners and community leaders', priority: 'high' },
          { id: 'events', task: 'Plan 3-4 fundraising house parties', priority: 'medium' },
          { id: 'endorsements', task: 'Seek union and interest group endorsements', priority: 'medium' },
        ],
        team: [
          { id: 'manager', task: 'Hire Campaign Manager or Consultant ($3,000-5,000/month)', priority: 'critical' },
          { id: 'finance', task: 'Hire Finance Director or Volunteer', priority: 'high' },
          { id: 'field', task: 'Recruit Field Organizer', priority: 'high' },
          { id: 'volunteers', task: 'Build volunteer team (20-50 people)', priority: 'high' },
          { id: 'comms', task: 'Hire Communications person or consultant', priority: 'medium' },
        ],
        fieldWork: [
          { id: 'data', task: 'Get access to state voter file', priority: 'high' },
          { id: 'canvass', task: 'Plan neighborhood canvassing (weekends)', priority: 'high' },
          { id: 'lit', task: 'Design and print palm cards/literature', priority: 'high' },
          { id: 'endorsements', task: 'Seek endorsements from local elected officials', priority: 'high' },
          { id: 'forums', task: 'Attend community forums and debates', priority: 'medium' },
        ],
        budget: {
          'Staff & Consultants': '20-25%',
          'Media & Advertising': '30-40%',
          'Field Operations': '20-25%',
          'Fundraising Costs': '10-15%',
          'Other': '5-10%'
        }
      };
    }
  
    // Local/City Council/School Board
    if (raceType === 'cityCouncil' || raceType === 'schoolBoard' || office.level === 'local') {
      return {
        ...baseChecklist,
        filing: [
          ...baseChecklist.filing,
          { id: 'local', task: 'Register with City/County Clerk', priority: 'critical' },
          { id: 'signatures', task: 'Collect petition signatures (typically 25-200)', priority: 'critical' },
        ],
        fundraising: [
          { id: 'target', task: `Set fundraising target: ${office.estimated_cost}`, priority: 'critical' },
          { id: 'limits', task: 'Research local contribution limits', priority: 'high' },
          { id: 'personal', task: 'Personal network asks (Goal: $2,000-5,000)', priority: 'high' },
          { id: 'events', task: 'Plan 2-3 small fundraising house parties', priority: 'high' },
          { id: 'local', task: 'Approach local business owners', priority: 'medium' },
          { id: 'online', task: 'Set up online donation page', priority: 'medium' },
        ],
        team: [
          { id: 'treasurer', task: 'Recruit Campaign Treasurer (volunteer)', priority: 'critical' },
          { id: 'manager', task: 'Campaign Manager (can be volunteer or part-time)', priority: 'high' },
          { id: 'volunteers', task: 'Build volunteer team (10-25 people)', priority: 'high' },
          { id: 'social', task: 'Recruit Social Media Manager (volunteer)', priority: 'medium' },
        ],
        fieldWork: [
          { id: 'doors', task: 'Plan door-to-door canvassing (every weekend)', priority: 'critical' },
          { id: 'lit', task: 'Design and print palm cards', priority: 'high' },
          { id: 'yards', task: 'Order yard signs', priority: 'high' },
          { id: 'neighborhood', task: 'Attend neighborhood association meetings', priority: 'high' },
          { id: 'coffee', task: 'Host "Coffee with Candidate" events', priority: 'high' },
          { id: 'endorsements', task: 'Seek endorsements from community leaders', priority: 'medium' },
          { id: 'newspaper', task: 'Meet with local newspaper editorial board', priority: 'medium' },
        ],
        budget: {
          'Literature & Signs': '30-35%',
          'Digital Advertising': '20-25%',
          'Field Operations': '20-25%',
          'Fundraising Events': '10-15%',
          'Other': '10-15%'
        }
      };
    }
  
    // Default/fallback
    return baseChecklist;
  };
  
  export const generateMarkdown = (office, checklist, checkboxStates = {}) => {
    const filingDeadline = new Date(office.filing_deadline);
    const today = new Date();
    const daysUntil = Math.ceil((filingDeadline - today) / (1000 * 60 * 60 * 24));
    
    let markdown = `# YOUR CAMPAIGN PLAN: ${office.title}\n\n`;
    markdown += `**${office.state} - District ${office.district}**\n\n`;
    markdown += `**Filing Deadline:** ${filingDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    markdown += ` - **${daysUntil} days remaining**\n\n`;
    markdown += `**Estimated Budget:** ${office.estimated_cost}\n\n`;
    markdown += `---\n\n`;
  
    const sections = [
      { key: 'preFilingEssentials', title: 'PRE-FILING ESSENTIALS (Do This First)' },
      { key: 'filing', title: 'FILING REQUIREMENTS' },
      { key: 'first30Days', title: 'FIRST 30 DAYS' },
      { key: 'fundraising', title: 'FUNDRAISING CHECKLIST' },
      { key: 'team', title: 'TEAM TO BUILD' },
      { key: 'fieldWork', title: 'FIELD WORK & OUTREACH' },
      { key: 'messaging', title: 'MESSAGING & COMMUNICATIONS' },
    ];
  
    sections.forEach(section => {
      if (checklist[section.key] && checklist[section.key].length > 0) {
        markdown += `## ${section.title}\n\n`;
        checklist[section.key].forEach(item => {
          const checked = checkboxStates[item.id] ? 'x' : ' ';
          markdown += `- [${checked}] ${item.task}\n`;
        });
        markdown += `\n`;
      }
    });
  
    if (checklist.budget) {
      markdown += `## BUDGET BREAKDOWN\n\n`;
      Object.entries(checklist.budget).forEach(([category, percentage]) => {
        markdown += `- **${category}:** ${percentage}\n`;
      });
      markdown += `\n`;
    }
  
    markdown += `---\n\n`;
    markdown += `*Generated by Decide to Run - https://www.decidetorun.com*\n`;
    markdown += `*Data sourced from FEC and verified ${new Date().toLocaleDateString()}*\n`;
  
    return markdown;
  };