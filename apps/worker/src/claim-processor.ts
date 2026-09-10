import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { evaluateClaimRulesDetailed } from '@kit/claims/lib/validate-claim';
import { loadClaimValidationContext } from '@kit/claims/server/validate-claim';
import type { Database } from '@kit/supabase/database';

import { generateControlNumbers } from './lib/control-numbers';
import { sha256Hex } from './lib/hash';
import {
  CONTRACTUAL_ALLOWANCE_RATE,
  CONTRACTUAL_ADJUSTMENT_CODE,
  resolveDenialAdjustmentCode,
} from './lib/simulated-adjustment-codes';
import { generate835Payload, generate837Payload, generateAckPayload } from './lib/synthetic-x12';
import { resolveClaimTransactionType } from './lib/transaction-type';

export interface ClaimProcessorContext {
  claimId: string;
  organizationId: string;
  userId: string;
  idempotencyKey: string;
}

export interface ClaimSubmissionResult {
  outcome: 'processed' | 'duplicate_ignored' | 'rejected';
  claimStatus: string;
  processingJobId: string | null;
  correlationId: string;
}

export interface AdjudicationContext {
  claimId: string;
  organizationId: string;
  userId: string;
}

export interface AdjudicationResult {
  outcome: 'processed' | 'duplicate_ignored';
  claimStatus: string;
  remittanceId: string | null;
  correlationId: string;
}

export interface EftMatchContext {
  remittanceId: string;
  organizationId: string;
  userId: string;
}

export interface EftMatchResult {
  outcome: 'processed' | 'duplicate_ignored';
  remittanceStatus: string;
  paymentMatchId: string | null;
  correlationId: string;
}

/**
 * The processing contract. Kept intentionally free of any Next.js/HTTP
 * concern so these methods can move behind a durable queue later (a
 * worker process pulling jobs, not a request handler) without touching
 * any feature package -- see docs/05-claim-lifecycle.md and CLAUDE.md's
 * API design section. For the MVP, `submitClaimAction`/`adjudicateClaimAction`/
 * `matchEftAction` (packages/features/edi, packages/features/remittances)
 * call these synchronously from the request path.
 */
export interface ClaimProcessor {
  process(
    client: SupabaseClient<Database>,
    context: ClaimProcessorContext,
  ): Promise<ClaimSubmissionResult>;
  adjudicate(
    client: SupabaseClient<Database>,
    context: AdjudicationContext,
  ): Promise<AdjudicationResult>;
  matchEft(
    client: SupabaseClient<Database>,
    context: EftMatchContext,
  ): Promise<EftMatchResult>;
}

interface TransactionEventFields {
  eventName: string;
  category: 'submission' | 'acknowledgment' | 'validation' | 'state_transition';
  status: string;
  code?: string | null;
  explanation: string;
  actorType: 'user' | 'system';
  controlNumbers?: { isa13: string; gs06: string; st02: string } | null;
  payerId?: string | null;
  route?: string | null;
  requestPayloadHash?: string | null;
  responsePayloadHash?: string | null;
  ediTransactionId?: string | null;
  ruleId?: string | null;
  nextRecommendedAction: string | null;
}

function inferRuleCategory(ruleCode: string): string {
  if (ruleCode.startsWith('SIM-RULE-EDIT-')) {
    return 'payer_edit';
  }

  if (ruleCode.startsWith('SIM-RULE-UNIV-')) {
    return 'universal';
  }

  if (ruleCode.startsWith('SIM-RULE-CT-')) {
    return 'claim_type';
  }

  return 'unknown';
}

function providerDisplayName(provider: {
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
} | null) {
  if (!provider) {
    return 'SIM Unknown Provider';
  }

  return provider.organization_name ?? `${provider.first_name} ${provider.last_name}`;
}

function randomSimId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export class DeterministicClaimProcessor implements ClaimProcessor {
  private async insertTransactionEvent(
    client: SupabaseClient<Database>,
    params: {
      organizationId: string;
      claimId: string;
      batchId: string | null;
      correlationId: string;
      previousEventId: string | null;
      userId: string;
    } & TransactionEventFields,
  ): Promise<string> {
    const { data: event, error } = await client
      .from('transaction_events')
      .insert({
        organization_id: params.organizationId,
        claim_id: params.claimId,
        batch_id: params.batchId,
        edi_transaction_id: params.ediTransactionId ?? null,
        event_name: params.eventName,
        event_category: params.category,
        actor_type: params.actorType,
        actor_id: params.userId,
        isa13: params.controlNumbers?.isa13 ?? null,
        gs06: params.controlNumbers?.gs06 ?? null,
        st02: params.controlNumbers?.st02 ?? null,
        payer_id: params.payerId ?? null,
        route: params.route ?? null,
        request_payload_hash: params.requestPayloadHash ?? null,
        response_payload_hash: params.responsePayloadHash ?? null,
        status: params.status,
        code: params.code ?? null,
        explanation: params.explanation,
        rule_id: params.ruleId ?? null,
        correlation_id: params.correlationId,
        previous_event_id: params.previousEventId,
        next_recommended_action: params.nextRecommendedAction,
        created_by: params.userId,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return event.id;
  }

  private async resolvePayerContext(client: SupabaseClient<Database>, payerId: string | null) {
    let payerName = 'SIM Unknown Payer';
    let payerSimId = 'SIM-UNKNOWN';
    let route: string | null = null;

    if (payerId) {
      const { data: payer } = await client
        .from('payers')
        .select('sim_payer_id, display_name')
        .eq('id', payerId)
        .maybeSingle();

      if (payer) {
        payerName = payer.display_name;
        payerSimId = payer.sim_payer_id;
      }

      const { data: payerRoute } = await client
        .from('payer_routes')
        .select('route_name')
        .eq('payer_id', payerId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      route = payerRoute?.route_name ?? null;
    }

    return { payerName, payerSimId, route };
  }

  async process(
    client: SupabaseClient<Database>,
    context: ClaimProcessorContext,
  ): Promise<ClaimSubmissionResult> {
    const correlationId = crypto.randomUUID();

    // Step 1: claim the idempotency slot. processing_jobs.claim_id is
    // UNIQUE -- if this insert fails on a uniqueness violation, this claim
    // was already submitted, full stop. No other write happens.
    const { data: job, error: jobError } = await client
      .from('processing_jobs')
      .insert({
        organization_id: context.organizationId,
        claim_id: context.claimId,
        idempotency_key: context.idempotencyKey,
        correlation_id: correlationId,
        status: 'processing',
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (jobError) {
      if (jobError.code === '23505') {
        const { data: existingJob } = await client
          .from('processing_jobs')
          .select('id')
          .eq('claim_id', context.claimId)
          .maybeSingle();

        await client.from('replay_attempts').insert({
          organization_id: context.organizationId,
          claim_id: context.claimId,
          idempotency_key: context.idempotencyKey,
          outcome: 'duplicate_ignored',
          processing_job_id: existingJob?.id ?? null,
          attempted_by: context.userId,
        });

        const { data: currentClaim } = await client
          .from('claims')
          .select('status')
          .eq('id', context.claimId)
          .single();

        return {
          outcome: 'duplicate_ignored',
          claimStatus: currentClaim?.status ?? 'unknown',
          processingJobId: existingJob?.id ?? null,
          correlationId,
        };
      }

      throw jobError;
    }

    await client.from('replay_attempts').insert({
      organization_id: context.organizationId,
      claim_id: context.claimId,
      idempotency_key: context.idempotencyKey,
      outcome: 'processed',
      processing_job_id: job.id,
      attempted_by: context.userId,
    });

    // Step 2: re-validate. Submission must never trust a stale
    // last-validated status -- data (e.g. payer enrollment) can change
    // between the interactive Validate click and Submit.
    const { claim, input, applicableRules, payerSimId } =
      await loadClaimValidationContext(client, context.claimId);

    const detailedResults = evaluateClaimRulesDetailed(input, applicableRules);

    if (detailedResults.length > 0) {
      await client.from('rule_evaluations').insert(
        detailedResults.map((result) => ({
          organization_id: context.organizationId,
          claim_id: context.claimId,
          processing_job_id: job.id,
          rule_code: result.ruleCode,
          category: inferRuleCategory(result.ruleCode),
          passed: result.passed,
          severity: result.severity,
          rejection_or_denial: result.rejectionOrDenial,
          explanation: result.explanation,
          created_by: context.userId,
        })),
      );
    }

    const failures = detailedResults.filter((result) => !result.passed);
    let previousEventId: string | null = null;

    const emit = (fields: TransactionEventFields) =>
      this.insertTransactionEvent(client, {
        organizationId: context.organizationId,
        claimId: context.claimId,
        batchId: claim.batch_id,
        correlationId,
        previousEventId,
        userId: context.userId,
        ...fields,
      }).then((id) => {
        previousEventId = id;

        return id;
      });

    if (failures.length > 0) {
      const first = failures[0]!;

      await emit({
        eventName: 'submission_rejected',
        category: 'validation',
        status: 'rejected',
        code: first.ruleCode,
        explanation: `Submission rejected pre-adjudication: ${first.explanation}`,
        actorType: 'system',
        nextRecommendedAction:
          'Fix the listed validation errors and re-validate before resubmitting.',
      });

      await client
        .from('claims')
        .update({ status: 'validation_failed', updated_by: context.userId })
        .eq('id', context.claimId);

      await client
        .from('processing_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          result: { outcome: 'rejected', failedRules: failures.map((f) => f.ruleCode) },
        })
        .eq('id', job.id);

      return {
        outcome: 'rejected',
        claimStatus: 'validation_failed',
        processingJobId: job.id,
        correlationId,
      };
    }

    // Step 3: resolve payer + route (denormalized onto every event, since a
    // trace row should reflect what was true at the time, not a live join).
    const coverage = Array.isArray(claim.coverage) ? claim.coverage[0] : claim.coverage;
    const payerId = coverage?.payer_id ?? null;
    const { payerName, route } = await this.resolvePayerContext(client, payerId);

    // Step 3b: the payer must support this claim's transaction type
    // (837P/837I), resolved via payer_supported_transactions -- Phase 4
    // scaffolding that nothing consulted until now. This is a genuine
    // pre-adjudication REJECTION (same shape as a failed validation rule
    // above), never a denial -- checked here specifically because it
    // needs the payer resolved, but still strictly before any EDI is
    // generated.
    if (payerId) {
      const transactionType = resolveClaimTransactionType(claim.claim_type);

      const { data: supportedTransaction } = await client
        .from('payer_supported_transactions')
        .select('is_active')
        .eq('payer_id', payerId)
        .eq('transaction_type', transactionType)
        .maybeSingle();

      if (!supportedTransaction || !supportedTransaction.is_active) {
        await emit({
          eventName: 'submission_rejected',
          category: 'validation',
          status: 'rejected',
          code: 'unsupported_payer_route',
          explanation: `Submission rejected pre-adjudication: ${payerName ?? 'this payer'} does not support ${transactionType} submissions.`,
          actorType: 'system',
          payerId,
          route,
          nextRecommendedAction:
            'Verify the payer supports this transaction type, or route the claim through a different payer/clearinghouse connection.',
        });

        await client
          .from('claims')
          .update({ status: 'validation_failed', updated_by: context.userId })
          .eq('id', context.claimId);

        await client
          .from('processing_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            result: { outcome: 'rejected', failedRules: ['unsupported_payer_route'] },
          })
          .eq('id', job.id);

        return {
          outcome: 'rejected',
          claimStatus: 'validation_failed',
          processingJobId: job.id,
          correlationId,
        };
      }
    }

    // Step 4: fetch full display data (names, NPIs, diagnoses, lines) --
    // loadClaimValidationContext only fetches what rule evaluation needs.
    const { data: fullClaim, error: fullClaimError } = await client
      .from('claims')
      .select(
        `patient:patients(first_name, last_name, date_of_birth),
         subscriber:subscribers(first_name, last_name),
         billing_provider:providers!claims_billing_provider_id_fkey(npi, first_name, last_name, organization_name),
         professional:professional_claim_details(rendering_provider:providers(npi)),
         institutional:institutional_claim_details(type_of_bill, facility:facilities(name)),
         diagnoses:claim_diagnoses(diagnosis_code, diagnosis_pointer),
         lines:claim_lines(line_number, service_date, procedure_code, revenue_code, units, charge_amount)`,
      )
      .eq('id', context.claimId)
      .single();

    if (fullClaimError) {
      throw fullClaimError;
    }

    const patient = Array.isArray(fullClaim.patient) ? fullClaim.patient[0] : fullClaim.patient;
    const subscriber = Array.isArray(fullClaim.subscriber)
      ? fullClaim.subscriber[0]
      : fullClaim.subscriber;
    const billingProvider = Array.isArray(fullClaim.billing_provider)
      ? fullClaim.billing_provider[0]
      : fullClaim.billing_provider;
    const professional = Array.isArray(fullClaim.professional)
      ? fullClaim.professional[0]
      : fullClaim.professional;
    const institutional = Array.isArray(fullClaim.institutional)
      ? fullClaim.institutional[0]
      : fullClaim.institutional;

    const renderingProvider = professional
      ? Array.isArray(professional.rendering_provider)
        ? professional.rendering_provider[0]
        : professional.rendering_provider
      : null;
    const facility = institutional
      ? Array.isArray(institutional.facility)
        ? institutional.facility[0]
        : institutional.facility
      : null;

    const totalCharge = (fullClaim.lines ?? []).reduce(
      (sum, line) => sum + Number(line.charge_amount),
      0,
    );

    const controlNumbers = generateControlNumbers();

    const requestPayload = generate837Payload({
      simClaimId: claim.sim_claim_id,
      claimType: claim.claim_type as 'professional' | 'institutional',
      controlNumbers,
      billingProviderNpi: billingProvider?.npi ?? '0000000000',
      billingProviderName: providerDisplayName(billingProvider ?? null),
      renderingProviderNpi: renderingProvider?.npi ?? null,
      facilityName: facility?.name ?? null,
      typeOfBill: institutional?.type_of_bill ?? null,
      subscriberName: subscriber ? `${subscriber.first_name} ${subscriber.last_name}` : 'SIM Unknown Subscriber',
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'SIM Unknown Patient',
      patientDob: patient?.date_of_birth ?? '1900-01-01',
      payerSimId: payerSimId ?? 'SIM-UNKNOWN',
      payerName,
      diagnoses: (fullClaim.diagnoses ?? []).map((d) => ({
        diagnosisCode: d.diagnosis_code,
        diagnosisPointer: d.diagnosis_pointer,
      })),
      lines: (fullClaim.lines ?? []).map((line) => ({
        lineNumber: line.line_number,
        serviceDate: line.service_date,
        code: line.procedure_code ?? line.revenue_code ?? '0000',
        units: line.units,
        chargeAmount: Number(line.charge_amount),
      })),
      totalCharge,
    });

    const requestHash = sha256Hex(requestPayload);

    const { data: ediTransaction, error: ediTxError } = await client
      .from('edi_transactions')
      .insert({
        organization_id: context.organizationId,
        claim_id: context.claimId,
        batch_id: claim.batch_id,
        transaction_type: claim.claim_type === 'professional' ? '837P' : '837I',
        isa13: controlNumbers.isa13,
        gs06: controlNumbers.gs06,
        st02: controlNumbers.st02,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (ediTxError) {
      throw ediTxError;
    }

    await client.from('edi_payloads').insert({
      organization_id: context.organizationId,
      edi_transaction_id: ediTransaction.id,
      direction: 'outbound',
      transaction_type: claim.claim_type === 'professional' ? '837P' : '837I',
      raw_payload: requestPayload,
      payload_hash: requestHash,
      created_by: context.userId,
    });

    const { error: submittedError } = await client
      .from('claims')
      .update({ status: 'submitted', updated_by: context.userId })
      .eq('id', context.claimId);

    if (submittedError) {
      throw submittedError;
    }

    await emit({
      eventName: 'claim_submitted',
      category: 'submission',
      status: 'submitted',
      explanation: 'Claim submitted for processing.',
      actorType: 'user',
      payerId,
      route,
      nextRecommendedAction: 'Awaiting EDI generation.',
    });

    await emit({
      eventName: 'edi_generated',
      category: 'submission',
      status: 'submitted',
      explanation: `Synthetic ${claim.claim_type === 'professional' ? '837P' : '837I'} transaction generated (control numbers ISA13=${controlNumbers.isa13}, GS06=${controlNumbers.gs06}, ST02=${controlNumbers.st02}).`,
      actorType: 'system',
      controlNumbers,
      payerId,
      route,
      requestPayloadHash: requestHash,
      ediTransactionId: ediTransaction.id,
      nextRecommendedAction: 'Awaiting TA1 interchange acknowledgment.',
    });

    // TA1 -> 999 -> 277CA, all accepted on the happy path -- there is no
    // rule basis in this simulator for a mid-pipeline X12 syntax
    // rejection once submit-time re-validation has already passed.
    const acks: { type: 'TA1' | '999' | '277CA'; eventName: string; next: string }[] = [
      { type: 'TA1', eventName: 'ta1_received', next: 'Awaiting 999 functional acknowledgment.' },
      { type: '999', eventName: '999_received', next: 'Awaiting 277CA claim acknowledgment.' },
      {
        type: '277CA',
        eventName: '277ca_received',
        next: 'Awaiting payer adjudication.',
      },
    ];

    for (const ack of acks) {
      const ackPayload = generateAckPayload(ack.type, controlNumbers, 'accepted');
      const ackHash = sha256Hex(ackPayload);

      await client.from('edi_payloads').insert({
        organization_id: context.organizationId,
        edi_transaction_id: ediTransaction.id,
        direction: 'inbound',
        transaction_type: ack.type,
        raw_payload: ackPayload,
        payload_hash: ackHash,
        created_by: context.userId,
      });

      await client.from('acknowledgments').insert({
        organization_id: context.organizationId,
        edi_transaction_id: ediTransaction.id,
        ack_type: ack.type,
        status: 'accepted',
        code: `${ack.type}-A`,
        explanation: `Simulated ${ack.type} acknowledgment: accepted.`,
        isa13: controlNumbers.isa13,
        gs06: controlNumbers.gs06,
        st02: controlNumbers.st02,
        created_by: context.userId,
      });

      await emit({
        eventName: ack.eventName,
        category: 'acknowledgment',
        status: 'accepted',
        code: `${ack.type}-A`,
        explanation: `Simulated ${ack.type} acknowledgment received: accepted.`,
        actorType: 'system',
        controlNumbers,
        payerId,
        route,
        responsePayloadHash: ackHash,
        ediTransactionId: ediTransaction.id,
        nextRecommendedAction: ack.next,
      });
    }

    const { error: acceptedError } = await client
      .from('claims')
      .update({ status: 'accepted_for_adjudication', updated_by: context.userId })
      .eq('id', context.claimId);

    if (acceptedError) {
      throw acceptedError;
    }

    await emit({
      eventName: 'accepted_for_adjudication',
      category: 'state_transition',
      status: 'accepted_for_adjudication',
      explanation: "Claim accepted into the payer's adjudication queue.",
      actorType: 'system',
      payerId,
      route,
      ediTransactionId: ediTransaction.id,
      nextRecommendedAction: 'Ready to adjudicate.',
    });

    await client
      .from('processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: { outcome: 'accepted_for_adjudication', ediTransactionId: ediTransaction.id },
      })
      .eq('id', job.id);

    return {
      outcome: 'processed',
      claimStatus: 'accepted_for_adjudication',
      processingJobId: job.id,
      correlationId,
    };
  }

  /**
   * Adjudicates a claim already accepted_for_adjudication. The outcome is
   * a deterministic function of the claim's actual payer (via
   * coverage.payer_id) and that payer's payer_test_profiles row -- never
   * a per-claim-ID or per-payer-ID branch in this code. Idempotency is
   * guarded by remittances.claim_id being UNIQUE (a distinct guard from
   * processing_jobs, which covers submission specifically).
   */
  async adjudicate(
    client: SupabaseClient<Database>,
    context: AdjudicationContext,
  ): Promise<AdjudicationResult> {
    const correlationId = crypto.randomUUID();

    const { data: claim, error: claimError } = await client
      .from('claims')
      .select(
        `id, organization_id, batch_id, sim_claim_id, status,
         coverage:coverages(payer_id),
         patient:patients(first_name, last_name),
         lines:claim_lines(id, charge_amount)`,
      )
      .eq('id', context.claimId)
      .single();

    if (claimError) {
      throw claimError;
    }

    if (claim.status !== 'accepted_for_adjudication') {
      throw new Error(
        'Only a claim accepted for adjudication can be adjudicated -- submit it first.',
      );
    }

    const coverage = Array.isArray(claim.coverage) ? claim.coverage[0] : claim.coverage;
    const patient = Array.isArray(claim.patient) ? claim.patient[0] : claim.patient;
    const payerId = coverage?.payer_id ?? null;
    const { payerName, payerSimId, route } = await this.resolvePayerContext(client, payerId);

    let defaultOutcome: 'paid' | 'denied' = 'paid';
    let denialRuleCode: string | null = null;

    if (payerId) {
      const { data: profile } = await client
        .from('payer_test_profiles')
        .select('default_outcome, denial_rule_code')
        .eq('payer_id', payerId)
        .maybeSingle();

      if (profile?.default_outcome === 'denied') {
        defaultOutcome = 'denied';
        denialRuleCode = profile.denial_rule_code;
      }
    }

    const chargeAmount = (claim.lines ?? []).reduce(
      (sum, line) => sum + Number(line.charge_amount),
      0,
    );

    let paidAmount = 0;
    const patientResponsibility = 0;
    let triggeringRuleId: string | null = null;
    let outcomeExplanation: string;
    let nextRecommendedAction: string;

    const adjustments: {
      group: 'CO' | 'PR' | 'OA' | 'PI';
      carcCode: string;
      rarcCode: string | null;
      amount: number;
      explanation: string;
      ruleId: string | null;
    }[] = [];

    if (defaultOutcome === 'paid') {
      paidAmount = Math.round(chargeAmount * CONTRACTUAL_ALLOWANCE_RATE * 100) / 100;
      const adjustmentAmount = Math.round((chargeAmount - paidAmount) * 100) / 100;

      adjustments.push({
        group: 'CO',
        carcCode: CONTRACTUAL_ADJUSTMENT_CODE.carcCode,
        rarcCode: CONTRACTUAL_ADJUSTMENT_CODE.rarcCode,
        amount: adjustmentAmount,
        explanation: CONTRACTUAL_ADJUSTMENT_CODE.label,
        ruleId: null,
      });

      outcomeExplanation = `Claim paid: $${paidAmount.toFixed(2)} of $${chargeAmount.toFixed(2)} billed (simulated ${(CONTRACTUAL_ALLOWANCE_RATE * 100).toFixed(0)}% contractual allowance).`;
      nextRecommendedAction = 'Await EFT deposit, then match and post the payment.';
    } else {
      let fieldPath: string | null = null;
      outcomeExplanation = 'Claim denied.';

      if (denialRuleCode) {
        const { data: rule } = await client
          .from('payer_rules')
          .select('id, versions:payer_rule_versions(*)')
          .eq('rule_code', denialRuleCode)
          .maybeSingle();

        if (rule) {
          triggeringRuleId = rule.id;

          const latestVersion = [...(rule.versions ?? [])]
            .filter((version) => version.is_active)
            .sort((a, b) => b.version_number - a.version_number)[0];

          if (latestVersion) {
            outcomeExplanation = latestVersion.explanation;
            fieldPath = latestVersion.field_path;
          }
        }
      }

      const code = resolveDenialAdjustmentCode(fieldPath);

      adjustments.push({
        group: 'CO',
        carcCode: code.carcCode,
        rarcCode: code.rarcCode,
        amount: chargeAmount,
        explanation: outcomeExplanation,
        ruleId: triggeringRuleId,
      });

      nextRecommendedAction =
        'Review the denial reason; correct and resubmit if the underlying issue can be fixed.';
    }

    const controlNumbers = generateControlNumbers();
    const simRemittanceId = randomSimId('SIM-ERA');

    const payload835 = generate835Payload({
      simClaimId: claim.sim_claim_id,
      simRemittanceId,
      controlNumbers,
      payerName,
      payerSimId,
      patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'SIM Unknown Patient',
      chargeAmount,
      paidAmount,
      patientResponsibility,
      outcome: defaultOutcome,
      adjustments: adjustments.map((a) => ({
        group: a.group,
        carcCode: a.carcCode,
        amount: a.amount,
      })),
    });

    const payloadHash = sha256Hex(payload835);

    // Idempotency: remittances.claim_id is UNIQUE. A duplicate adjudicate
    // attempt fails this insert before any other write happens.
    const { data: remittance, error: remitError } = await client
      .from('remittances')
      .insert({
        organization_id: context.organizationId,
        claim_id: context.claimId,
        payer_id: payerId,
        sim_remittance_id: simRemittanceId,
        isa13: controlNumbers.isa13,
        gs06: controlNumbers.gs06,
        st02: controlNumbers.st02,
        raw_835_payload: payload835,
        payload_hash: payloadHash,
        total_paid_amount: paidAmount,
        outcome: defaultOutcome,
        status: defaultOutcome,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (remitError) {
      if (remitError.code === '23505') {
        const { data: existing } = await client
          .from('remittances')
          .select('id')
          .eq('claim_id', context.claimId)
          .maybeSingle();

        return {
          outcome: 'duplicate_ignored',
          claimStatus: claim.status,
          remittanceId: existing?.id ?? null,
          correlationId,
        };
      }

      throw remitError;
    }

    const { data: remitClaim, error: remitClaimError } = await client
      .from('remit_claims')
      .insert({
        organization_id: context.organizationId,
        remittance_id: remittance.id,
        claim_id: context.claimId,
        charge_amount: chargeAmount,
        paid_amount: paidAmount,
        patient_responsibility: patientResponsibility,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (remitClaimError) {
      throw remitClaimError;
    }

    const serviceLines = claim.lines ?? [];

    if (serviceLines.length > 0) {
      const { error: serviceLineError } = await client.from('remit_service_lines').insert(
        serviceLines.map((line) => {
          const lineCharge = Number(line.charge_amount);
          const linePaid =
            defaultOutcome === 'paid'
              ? Math.round(lineCharge * CONTRACTUAL_ALLOWANCE_RATE * 100) / 100
              : 0;

          return {
            organization_id: context.organizationId,
            remit_claim_id: remitClaim.id,
            claim_line_id: line.id,
            charge_amount: lineCharge,
            paid_amount: linePaid,
            created_by: context.userId,
          };
        }),
      );

      if (serviceLineError) {
        throw serviceLineError;
      }
    }

    const { error: adjustmentError } = await client.from('claim_adjustments').insert(
      adjustments.map((a) => ({
        organization_id: context.organizationId,
        remit_claim_id: remitClaim.id,
        adjustment_group: a.group,
        carc_code: a.carcCode,
        rarc_code: a.rarcCode,
        amount: a.amount,
        explanation: a.explanation,
        rule_id: a.ruleId,
        created_by: context.userId,
      })),
    );

    if (adjustmentError) {
      throw adjustmentError;
    }

    let previousEventId: string | null = null;

    const emit = (fields: TransactionEventFields) =>
      this.insertTransactionEvent(client, {
        organizationId: context.organizationId,
        claimId: context.claimId,
        batchId: claim.batch_id,
        correlationId,
        previousEventId,
        userId: context.userId,
        ...fields,
      }).then((id) => {
        previousEventId = id;

        return id;
      });

    await emit({
      eventName: 'adjudicating',
      category: 'state_transition',
      status: 'adjudicating',
      explanation: 'Claim submitted to payer for adjudication.',
      actorType: 'system',
      payerId,
      route,
      nextRecommendedAction: 'Awaiting 835 remittance advice.',
    });

    await emit({
      eventName: '835_received',
      category: 'acknowledgment',
      status: defaultOutcome,
      code: defaultOutcome === 'paid' ? '835-PAID' : '835-DENIED',
      explanation: `Simulated 835 remittance advice received: ${defaultOutcome}.`,
      actorType: 'system',
      controlNumbers,
      payerId,
      route,
      responsePayloadHash: payloadHash,
      nextRecommendedAction:
        defaultOutcome === 'paid'
          ? 'Awaiting EFT deposit and reconciliation.'
          : 'Review denial reason and determine next action.',
    });

    const { error: outcomeError } = await client
      .from('claims')
      .update({ status: defaultOutcome, updated_by: context.userId })
      .eq('id', context.claimId);

    if (outcomeError) {
      throw outcomeError;
    }

    await emit({
      eventName: defaultOutcome,
      category: 'state_transition',
      status: defaultOutcome,
      code: defaultOutcome === 'denied' ? adjustments[0]?.carcCode ?? null : null,
      explanation: outcomeExplanation,
      actorType: 'system',
      payerId,
      route,
      ruleId: triggeringRuleId,
      nextRecommendedAction,
    });

    if (defaultOutcome === 'paid') {
      const { error: eftError } = await client.from('eft_traces').insert({
        organization_id: context.organizationId,
        remittance_id: remittance.id,
        eft_trace_number: randomSimId('SIM-EFT'),
        amount: paidAmount,
        created_by: context.userId,
      });

      if (eftError) {
        throw eftError;
      }
    }

    return {
      outcome: 'processed',
      claimStatus: defaultOutcome,
      remittanceId: remittance.id,
      correlationId,
    };
  }

  /**
   * The explicit reconciliation step: matches a paid remittance's
   * simulated EFT deposit and posts it. Never runs automatically during
   * adjudication. Idempotency guarded by payment_matches.eft_trace_id
   * being UNIQUE.
   */
  async matchEft(
    client: SupabaseClient<Database>,
    context: EftMatchContext,
  ): Promise<EftMatchResult> {
    const correlationId = crypto.randomUUID();

    const { data: remittance, error: remittanceError } = await client
      .from('remittances')
      .select('id, claim_id, outcome, status, total_paid_amount')
      .eq('id', context.remittanceId)
      .single();

    if (remittanceError) {
      throw remittanceError;
    }

    if (remittance.outcome !== 'paid') {
      throw new Error('Only a paid remittance can be matched to an EFT deposit.');
    }

    const { data: eftTrace, error: eftFetchError } = await client
      .from('eft_traces')
      .select('id, amount')
      .eq('remittance_id', context.remittanceId)
      .single();

    if (eftFetchError) {
      throw eftFetchError;
    }

    const { data: claim, error: claimError } = await client
      .from('claims')
      .select('id, batch_id, coverage:coverages(payer_id)')
      .eq('id', remittance.claim_id)
      .single();

    if (claimError) {
      throw claimError;
    }

    const coverage = Array.isArray(claim.coverage) ? claim.coverage[0] : claim.coverage;
    const { route } = await this.resolvePayerContext(client, coverage?.payer_id ?? null);

    // Idempotency: payment_matches.eft_trace_id is UNIQUE.
    const { data: match, error: matchError } = await client
      .from('payment_matches')
      .insert({
        organization_id: context.organizationId,
        eft_trace_id: eftTrace.id,
        remittance_id: context.remittanceId,
        matched_amount: eftTrace.amount,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (matchError) {
      if (matchError.code === '23505') {
        return {
          outcome: 'duplicate_ignored',
          remittanceStatus: remittance.status,
          paymentMatchId: null,
          correlationId,
        };
      }

      throw matchError;
    }

    let previousEventId: string | null = null;

    const emit = (fields: TransactionEventFields) =>
      this.insertTransactionEvent(client, {
        organizationId: context.organizationId,
        claimId: remittance.claim_id,
        batchId: claim.batch_id,
        correlationId,
        previousEventId,
        userId: context.userId,
        ...fields,
      }).then((id) => {
        previousEventId = id;

        return id;
      });

    await emit({
      eventName: 'eft_matched',
      category: 'state_transition',
      status: 'eft_matched',
      explanation: `Simulated EFT deposit of $${Number(eftTrace.amount).toFixed(2)} matched to remittance.`,
      actorType: 'user',
      route,
      nextRecommendedAction: 'Post the matched payment.',
    });

    await emit({
      eventName: 'posted',
      category: 'state_transition',
      status: 'posted',
      explanation: 'Matched payment posted.',
      actorType: 'system',
      route,
      nextRecommendedAction: 'None -- claim payment fully reconciled.',
    });

    const { error: statusError } = await client
      .from('remittances')
      .update({ status: 'posted', updated_by: context.userId })
      .eq('id', context.remittanceId);

    if (statusError) {
      throw statusError;
    }

    return {
      outcome: 'processed',
      remittanceStatus: 'posted',
      paymentMatchId: match.id,
      correlationId,
    };
  }
}
