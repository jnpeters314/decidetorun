import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateRaceGuidePDF = () => {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.width;
  const margin = 20;
  let y = 0;

  const primaryR = 0, primaryG = 74, primaryB = 173;
  const accentR = 0, accentG = 40, accentB = 100;

  const sectionTitle = (text, yPos) => {
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.rect(margin, yPos, W - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(text, margin + 3, yPos + 5.5);
    doc.setTextColor(0, 0, 0);
    return yPos + 14;
  };

  const bodyText = (text, yPos, indent = 0) => {
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, W - margin * 2 - indent);
    doc.text(lines, margin + indent, yPos);
    return yPos + lines.length * 5.5;
  };

  const bullet = (text, yPos) => {
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.circle(margin + 2, yPos - 1.5, 1, 'F');
    return bodyText(text, yPos, 7);
  };

  // ── Cover header ──────────────────────────────────────────────────────────
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(0, 0, W, 60, 'F');

  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(0, 60, W, 6, 'F');

  doc.setTextColor(160, 200, 255);
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.text('DECIDE TO RUN  ·  FREE CANDIDATE GUIDE', margin, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('Choosing the Right Race', margin, 36);

  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text('A Decision Framework for First-Time Candidates', margin, 47);

  doc.setFontSize(8);
  doc.setTextColor(160, 200, 255);
  doc.text('decidetorun.com', margin, 57);

  y = 78;

  // ── Section 1: Why It Matters ─────────────────────────────────────────────
  y = sectionTitle('WHY OFFICE CHOICE MATTERS', y);
  y = bodyText(
    'One of the most common mistakes first-time candidates make is choosing the wrong race — ' +
    'one that\'s too competitive, too expensive, or simply not the right fit for where they are in life. ' +
    'Getting this decision right dramatically increases your chances of winning and sets the foundation ' +
    'for a long career in public service.',
    y
  );
  y += 8;

  // ── Section 2: Four Levels ────────────────────────────────────────────────
  y = sectionTitle('THE FOUR LEVELS OF OFFICE', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Level', 'Examples', 'Typical Budget', 'Time/Week']],
    body: [
      ['Local', 'City Council, School Board,\nWater District', '$5K – $50K', '10–20 hrs'],
      ['County', 'County Commissioner,\nSheriff, Clerk', '$25K – $150K', '15–25 hrs'],
      ['State', 'State House, State Senate', '$50K – $500K', '20–40 hrs'],
      ['Federal', 'U.S. House, U.S. Senate', '$500K – $3M+', 'Full-time'],
    ],
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [primaryR, primaryG, primaryB], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: { 0: { fontStyle: 'bold' } },
  });

  y = doc.lastAutoTable.finalY + 8;

  y = bodyText(
    'First-time candidates almost always win first at the local level. City council and school board ' +
    'seats build name recognition, a voting record, and a donor network — all of which make future races easier.',
    y
  );
  y += 10;

  // ── Section 3: Viability Factors ─────────────────────────────────────────
  y = sectionTitle('SIX KEY VIABILITY FACTORS', y);

  const factors = [
    ['Open seat', 'No incumbent running gives you a significantly better shot as a first-timer.'],
    ['District competitiveness', 'Look at past election margins. Closer races are winnable; heavy partisan districts are hard to flip.'],
    ['Residency', 'Confirm you meet the residency requirement before anything else.'],
    ['Personal network', 'Your existing contacts in the district are your first volunteers, donors, and advocates.'],
    ['Fundraising feasibility', 'Honestly assess whether you can raise the required amount given your network and timeline.'],
    ['Time commitment', 'Running for office is a part-time job at minimum. Make sure your life can accommodate it.'],
  ];

  for (const [label, desc] of factors) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(primaryR, primaryG, primaryB);
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.circle(margin + 2, y - 1.5, 1, 'F');
    doc.text(label + ':', margin + 7, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    const labelWidth = doc.getTextWidth(label + ':  ');
    const rest = doc.splitTextToSize(desc, W - margin * 2 - 7 - labelWidth);
    doc.text(rest[0], margin + 7 + labelWidth, y);
    if (rest.length > 1) {
      for (let i = 1; i < rest.length; i++) {
        y += 5;
        doc.text(rest[i], margin + 7, y);
      }
    }
    y += 7;
  }
  y += 4;

  // ── Page 2 ────────────────────────────────────────────────────────────────
  doc.addPage();
  y = 20;

  // ── Section 4: Research Checklist ────────────────────────────────────────
  y = sectionTitle('WHAT TO RESEARCH BEFORE DECIDING', y);

  const checkItems = [
    'Residency requirement (how long must you have lived in the district?)',
    'Age minimum (some offices require you to be 25 or 30)',
    'Petition signatures needed to get on the ballot',
    'Filing fee amount and deadline',
    'Financial disclosure obligations',
    'Term length and whether the seat pays a salary',
    'Recent election results and margin of victory',
    'Partisan breakdown and voter registration numbers',
    'Turnout patterns in the district (who actually votes?)',
    'Whether any other candidates have already filed',
  ];

  for (const item of checkItems) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setDrawColor(primaryR, primaryG, primaryB);
    doc.rect(margin, y - 3.5, 3.5, 3.5);
    y = bodyText(item, y, 7);
    y += 1;
  }
  y += 8;

  // ── Section 5: Scoring Matrix ─────────────────────────────────────────────
  y = sectionTitle('RACE SELECTION SCORING MATRIX', y);
  y = bodyText(
    'Rate each race you\'re considering on the criteria below (1 = poor fit, 5 = strong fit). ' +
    'Multiply by the weight, then add up your totals. The highest score is your best starting point.',
    y
  );
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Criterion', 'Weight', 'Race Option A\n(score × weight)', 'Race Option B\n(score × weight)']],
    body: [
      ['Seat is open (no incumbent)', '×3', '   /5  →', '   /5  →'],
      ['Personal network strength', '×2', '   /5  →', '   /5  →'],
      ['Fundraising feasibility', '×2', '   /5  →', '   /5  →'],
      ['Time commitment fit', '×2', '   /5  →', '   /5  →'],
      ['District competitiveness', '×1', '   /5  →', '   /5  →'],
      ['Personal motivation', '×1', '   /5  →', '   /5  →'],
      ['TOTAL (max 55)', '', '', ''],
    ],
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [primaryR, primaryG, primaryB], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 18, halign: 'center' } },
  });

  y = doc.lastAutoTable.finalY + 10;

  // ── Section 6: Next Steps ─────────────────────────────────────────────────
  y = sectionTitle('YOUR NEXT STEPS', y);

  const steps = [
    'Score at least 2–3 races using the matrix above before committing to one.',
    'Contact your local election authority to verify filing requirements and deadlines.',
    'Have a honest conversation with your household about time and financial impact.',
    'Talk to 10–15 people in the community and gauge their reaction to your potential run.',
    'Visit decidetorun.com to browse open seats and build your campaign plan.',
  ];

  for (const [i, step] of steps.entries()) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(primaryR, primaryG, primaryB);
    doc.text(`${i + 1}.`, margin, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(step, W - margin * 2 - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 5.5 + 3;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.height - 14;
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(0, footerY - 4, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Decide to Run  ·  decidetorun.com  ·  Free to use, covers all 50 states', margin, footerY + 4);

  doc.save('choosing-the-right-race-guide.pdf');
};

export const generateCampaignPlanPDF = (office, checklist, checkboxStates = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let yPos = 20;

  // Helper function to check if we need a new page
  const checkPageBreak = (neededSpace = 20) => {
    if (yPos + neededSpace > doc.internal.pageSize.height - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('YOUR CAMPAIGN PLAN', margin, yPos);
  yPos += 10;

  // Office details
  doc.setFontSize(14);
  doc.text(office.title, margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`${office.state} - District ${office.district}`, margin, yPos);
  yPos += 6;

  // Filing deadline
  const filingDeadline = new Date(office.filing_deadline);
  const today = new Date();
  const daysUntil = Math.ceil((filingDeadline - today) / (1000 * 60 * 60 * 24));
  
  doc.setFont(undefined, 'bold');
  doc.text('Filing Deadline: ', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(
    `${filingDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${daysUntil} days)`,
    margin + 35,
    yPos
  );
  yPos += 6;

  doc.setFont(undefined, 'bold');
  doc.text('Estimated Budget: ', margin, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(office.estimated_cost, margin + 40, yPos);
  yPos += 12;

  // Divider line
  doc.setDrawColor(200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Helper to render a section
  const renderSection = (title, items) => {
    if (!items || items.length === 0) return;

    checkPageBreak(30);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(title, margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');

    items.forEach(item => {
      checkPageBreak(12);

      // Checkbox
      const checkboxSize = 3;
      doc.rect(margin, yPos - 3, checkboxSize, checkboxSize);
      
      // Check mark if checked
      if (checkboxStates[item.id]) {
        doc.setFont(undefined, 'bold');
        doc.text('✓', margin + 0.5, yPos - 0.5);
        doc.setFont(undefined, 'normal');
      }

      // Task text with priority color
      if (item.priority === 'critical') {
        doc.setTextColor(220, 38, 38); // Red
      } else if (item.priority === 'high') {
        doc.setTextColor(234, 88, 12); // Orange
      } else {
        doc.setTextColor(0, 0, 0); // Black
      }

      // Wrap text if too long
      const maxWidth = pageWidth - margin - margin - 10;
      const textLines = doc.splitTextToSize(item.task, maxWidth);
      
      textLines.forEach((line, index) => {
        if (index > 0) {
          checkPageBreak(6);
        }
        doc.text(line, margin + 6, yPos);
        if (index < textLines.length - 1) {
          yPos += 5;
        }
      });

      doc.setTextColor(0, 0, 0); // Reset color
      yPos += 7;
    });

    yPos += 5;
  };

  // Render all sections
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
    if (checklist[section.key]) {
      renderSection(section.title, checklist[section.key]);
    }
  });

// Budget breakdown
if (checklist.budget) {
    checkPageBreak(40);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('BUDGET BREAKDOWN', margin, yPos);
    yPos += 10;
  
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
  
    Object.entries(checklist.budget).forEach(([category, percentage]) => {
      checkPageBreak(8);
      doc.setFont(undefined, 'bold');
      doc.text(category + ':', margin, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(percentage, margin + 80, yPos);
      yPos += 6;
    });
  
    yPos += 10;
  }

  // Footer
  checkPageBreak(20);
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Generated by Decide to Run - https://www.decidetorun.com', margin, yPos);
  yPos += 5;
  doc.text(`Data sourced from FEC - Verified ${new Date().toLocaleDateString()}`, margin, yPos);

  // Save the PDF
  const filename = `campaign-plan-${office.state}-${office.district}.pdf`;
  doc.save(filename);
}