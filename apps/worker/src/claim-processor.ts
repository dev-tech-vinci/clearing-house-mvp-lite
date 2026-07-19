import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { evaluateClaimRulesDetailed } from '@kit/claims/lib/validate-claim';
import { loadClaimValidationContext } from '@kit/claims/server/validate-claim';
import type { Database } from '@kit/supabase/database';

import { generateControlNumbers } from './lib/control-numbers';
import { sha256Hex } from './lib/hash';
import { generate837Payload, generateAckPayload } from './lib/synthetic-x12';

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

/**
 * The processing contract. Kept intentionally free of any Next.js/HTTP
 * concern so `process()` can move behind a durable queue later (a worker
 * process pulling jobs, not a request handler) without touching any
 * feature package -- see docs/05-claim-lifecycle.md and CLAUDE.md's API
 * design section. For the MVP, `submitClaimAction` (packages/features/edi)
 * calls this synchronously from the request path.
 */
export interface ClaimProcessor {
  process(
    client: SupabaseClient<Database>,
    context: ClaimProcessorContext,
  ): Promise<ClaimSubmissionResult>;
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

export class DeterministicClaimProcessor implements ClaimProcessor {
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

    const insertEvent = async (fields: {
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
      nextRecommendedAction: string | null;
    }) => {
      const { data: event, error } = await client
        .from('transaction_events')
        .insert({
          organization_id: context.organizationId,
          claim_id: context.claimId,
          batch_id: claim.batch_id,
          edi_transaction_id: fields.ediTransactionId ?? null,
          event_name: fields.eventName,
          event_category: fields.category,
          actor_type: fields.actorType,
          actor_id: context.userId,
          isa13: fields.controlNumbers?.isa13 ?? null,
          gs06: fields.controlNumbers?.gs06 ?? null,
          st02: fields.controlNumbers?.st02 ?? null,
          payer_id: fields.payerId ?? null,
          route: fields.route ?? null,
          request_payload_hash: fields.requestPayloadHash ?? null,
          response_payload_hash: fields.responsePayloadHash ?? null,
          status: fields.status,
          code: fields.code ?? null,
          explanation: fields.explanation,
          correlation_id: correlationId,
          previous_event_id: previousEventId,
          next_recommended_action: fields.nextRecommendedAction,
          created_by: context.userId,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      previousEventId = event.id;

      return event.id;
    };

    if (failures.length > 0) {
      const first = failures[0]!;

      await insertEvent({
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
    let payerId: string | null = null;
    let payerName = 'SIM Unknown Payer';
    let route: string | null = null;

    if (claim.coverage) {
      const coverage = Array.isArray(claim.coverage) ? claim.coverage[0] : claim.coverage;

      if (coverage?.payer_id) {
        payerId = coverage.payer_id;

        const { data: payer } = await client
          .from('payers')
          .select('display_name')
          .eq('id', coverage.payer_id)
          .maybeSingle();

        payerName = payer?.display_name ?? payerName;

        const { data: payerRoute } = await client
          .from('payer_routes')
          .select('route_name')
          .eq('payer_id', coverage.payer_id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        route = payerRoute?.route_name ?? null;
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

    await insertEvent({
      eventName: 'claim_submitted',
      category: 'submission',
      status: 'submitted',
      explanation: 'Claim submitted for processing.',
      actorType: 'user',
      payerId,
      route,
      nextRecommendedAction: 'Awaiting EDI generation.',
    });

    await insertEvent({
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
        next: 'Awaiting payer adjudication (Phase 7 scope).',
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

      await insertEvent({
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

    await insertEvent({
      eventName: 'accepted_for_adjudication',
      category: 'state_transition',
      status: 'accepted_for_adjudication',
      explanation: "Claim accepted into the payer's adjudication queue.",
      actorType: 'system',
      payerId,
      route,
      ediTransactionId: ediTransaction.id,
      nextRecommendedAction:
        "None -- claim is now in the payer's adjudication queue (Phase 7 scope).",
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
}
