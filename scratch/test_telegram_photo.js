const telegramBotService = require('../server/services/telegramBotService');

async function testAlert() {
  console.log("Subscribers:", telegramBotService.getSubscribers());
  
  const res = await telegramBotService.broadcastRequisitionAlert({
    reqId: 'REQ-SR-CIVIL-710',
    department: 'Civil / Track (P-Way)',
    fromStation: 'KPD',
    toStation: 'JTJ',
    sectionName: 'Katpadi Junction – Jolarpettai Junction',
    trackLine: 'UP Main Line',
    blockType: 'UP Line Block',
    worksiteStartKm: 7.10,
    worksiteEndKm: 10.30,
    kmRange: 'KM 7.10 – KM 10.30',
    workType: 'Plain track tamping & track geometry alignment',
    durationMin: 150,
    urgency: 'Due',
    sanctionedSlot: '16:30 – 19:00 IST',
    recommendedBlock: '16:30 – 19:00 IST',
    status: 'SCHEDULED (OPTIMIZED)'
  }, 'SUBMITTED');

  console.log("Broadcast Result:", JSON.stringify(res, null, 2));
}

testAlert().catch(console.error);
