/*
 * -------------------------------------------------------
 * Phase 9: makes payer_supported_transactions (Phase 4 scaffolding, never
 * enforced until apps/worker's DeterministicClaimProcessor.process() was
 * extended to consult it) produce a real, testable negative case,
 * without touching any of the ten payers' 837P/institutional-fixture-
 * exercised transaction types.
 *
 * SIM-MCFFS-001 ("SIM Medicare FFS National") is used as a professional
 * (837P) fixture in the Phase 9 ten-claim happy-path set -- its 837I
 * support is never exercised there. Disabling 837I for that one payer
 * gives the "unsupported payer route" negative test a genuine,
 * deterministic case (submit an institutional claim against
 * SIM-MCFFS-001) with zero risk of breaking the ten happy-path
 * submissions, all of which must still pass TA1/999/277CA unchanged.
 * -------------------------------------------------------
 */
update public.payer_supported_transactions
set is_active = false
where transaction_type = '837I'
  and payer_id = (select id from public.payers where sim_payer_id = 'SIM-MCFFS-001');
