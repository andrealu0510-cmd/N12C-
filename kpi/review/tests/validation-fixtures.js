/** Synthetic test data. Do not seed this fixture into production records. */
export function makeValidContext() {
  const employee = {
    employeeId: 'DEMO001', name: '測試同仁', store: '示範門市', job: '業務代表',
    rank: 150, overallProgress: 75,
    metrics: { A999: { actual: 3, target: 5, unit: '筆' }, R1399: { actual: 4, target: 6, unit: '筆' }, broadband: { actual: 1.5, target: 3, unit: '點' } },
  };
  return {
    employee,
    snapshot: { id: 'snapshot-test-20261020', cutoffDate: '2026-10-20', rows: [employee], metricDefinitions: [{ key: 'A999', label: 'A999', unit: '筆' }, { key: 'R1399', label: 'R1399', unit: '筆' }, { key: 'broadband', label: '寬頻', unit: '點' }], sourceName: '測試資料' },
    role: 'employee', nowDate: '2026-10-21',
  };
}

/** All contact records below are invented examples, not customer data. */
export function makeValidContacts() {
  const base = {
    maskedName: '', phoneMasked: '', minutes: 6,
    icebreaker: '今天除了繳費，也想確認目前方案是否合用嗎？',
    need: '希望確認目前月租與上網流量是否合適',
    proposal: '確認用量後比較999與1399方案的費用及適用情境',
    outcome: 'noDeal', result: '尚未成交，用戶希望先與家人討論月租預算',
    followup: '已約定下一出勤日下午回訪確認方案意願',
  };
  const serviceOnly = {
    need: '僅需完成本期帳單繳費並取得收據',
    proposal: '協助核對帳單金額、完成繳費並說明收據查詢方式',
    outcome: 'serviceOnly', result: '繳費已完成，用戶確認收據金額正確',
    followup: '繳費服務已完成且收據已交付，無需再次聯繫',
  };
  return [
    { ...base, code: 'C01', maskedName: '陳○○', phoneMasked: '0958***896', categories: ['bill', 'renewal'], outcome: 'deal', result: '用戶同意申辦R1399，完成1筆認列', followup: '下一出勤日確認方案生效及用量查詢方式' },
    { ...base, code: 'C02', categories: ['bill', 'renewal', 'earlyRenewal'] },
    { ...base, code: 'C03', categories: ['bill', 'renewal', 'special'], outcome: 'followup', result: '用戶希望再比較家庭門號費用，已約定下次說明' },
    { ...base, code: 'C04', categories: ['bill', 'renewal'] },
    { ...base, ...serviceOnly, code: 'C05', categories: ['bill', 'earlyRenewal', 'consult'] },
    { ...base, code: 'C06', categories: ['consult'] },
    { ...base, code: 'C07', categories: ['apply'] },
    { ...base, ...serviceOnly, code: 'C08', categories: ['other'], need: '查詢先前帳單收據，未提出新的申辦需求', proposal: '協助查詢收據並說明可自行下載的位置', result: '已提供收據查詢結果，確認問題解決', followup: '收據查詢問題已解決，無需再次聯繫' },
  ];
}

export function makeValidReport() {
  return {
    reportDate: '2026-10-21', employeeId: 'DEMO001', snapshotId: 'snapshot-test-20261020',
    meta: { managerName: '測試主管', checkDate: '2026-10-24', remainingWorkdays: 3 },
    previous: { firstReport: false, promise: '向3位到期用戶說明續約差異', quantity: 3, execution: '已完成3位到期用戶的方案比較', completedQty: 3, result: '成交1筆R1399，另2位約定週五回訪', unfinished: '已完成', reason: '', remedy: '', deadline: '' },
    today: { icebreaker: '您目前月租與網路使用都還合適嗎？', averageMinutes: 6, serviceCount: 8, billCount: 5, renewalCount: 4, earlyRenewalCount: 2, specialCount: 1, dealCount: 1, roster: '門市共用資料夾／10月21日接觸名單', priorityMetric: 'R1399', action: '逐位確認用量，再比較999與1399方案', audience: '今日到期的4位用戶', actionCount: 4, recognizedResult: '完成4次提案，認列R1399 1筆' },
    contacts: makeValidContacts(),
    case: { notApplicable: false, context: '一位到期用戶希望降低每月支出', proposal: '比較999與1399的月費及上網需求', objection: '用戶須先與家人討論預算', response: '提供兩案費用整理並確認回訪時段', improvement: '下次先確認可接受的月費再推薦', followup: '10月23日下午電話回訪' },
    tomorrow: { date: '2026-10-22', metric: '寬頻', target: 1.5, action: '先確認同住人數與卡頓情況，再查供裝', audience: '有家庭上網需求的繳費用戶', count: 3, roster: '門市共用資料夾／寬頻待聯繫名單', time: '15:00–17:00', help: '請店長協助確認1G供裝資格', checkTime: '20:30' },
    learning: {
      A999: { store: '台北公館', person: '甲同仁', question: '如何從繳費需求自然詢問新門號商機', skill: '先詢問家人目前門號使用，再比較整體費用' },
      R1399: { store: '台北東區', person: '乙同仁', question: '用戶只看月租時如何說明升轉價值', skill: '先核對流量需求，再用兩種資費對照說明' },
      broadband: { store: '台北南京東', person: '丙同仁', question: '如何判斷用戶需要的家庭網路速度', skill: '先問同住人數、用途與順暢度，再查供裝' },
    },
    selfCheck: true,
  };
}

