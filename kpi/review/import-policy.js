/** Keep verified source data uploadable before monthly targets are available. */
export function sourceOnlyImport(parsed){
 return parsed?.ok===true&&parsed.profile?.id==='01-01-05'&&parsed.profile?.confidence==='verified'&&(parsed.basisEvidence?.basis==='unknown');
}
export function importDefinitions(parsed,basis,edited=false){
 return parsed.metricDefinitions.map(d=>basis==='source-only'
  ? {...d,targetBasis:'source-only',calculation:'source-only',reminderEligible:false}
  : {...d,targetBasis:edited?basis:d.targetBasis&&d.targetBasis!=='unknown'?d.targetBasis:basis});
}
export const SOURCE_ONLY_NOTICE='目標尚未更新或目標基準待確認：已保留原表實績與進度，不猜測目標、不計算差額，也不據此判定需回報。之後上傳目標完整的新報表會自動重新判讀。';
