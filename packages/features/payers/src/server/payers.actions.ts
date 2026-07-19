'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ImportPayersSchema } from '../schema/payer-import.schema';
import {
  CreatePayerSchema,
  SetPayerActiveSchema,
  SoftDeletePayerSchema,
  UpdatePayerSchema,
} from '../schema/payer.schema';

function toRow(data: {
  simPayerId: string;
  displayName: string;
  legalName?: string;
  category: string;
  lineOfBusiness?: string;
  scope: string;
  state?: string;
  publicProgramId?: string;
  clearinghousePayerId?: string;
  networkName?: string;
  enrollmentRequired: boolean;
  testProduction: string;
  effectiveDate?: string;
  terminationDate?: string;
  notes?: string;
  source?: string;
}) {
  return {
    sim_payer_id: data.simPayerId,
    display_name: data.displayName,
    legal_name: data.legalName || null,
    category: data.category,
    line_of_business: data.lineOfBusiness || null,
    scope: data.scope,
    state: data.state || null,
    public_program_id: data.publicProgramId || null,
    clearinghouse_payer_id: data.clearinghousePayerId || null,
    network_name: data.networkName || null,
    enrollment_required: data.enrollmentRequired,
    test_production: data.testProduction,
    effective_date: data.effectiveDate || null,
    termination_date: data.terminationDate || null,
    notes: data.notes || null,
    source: data.source || null,
  };
}

export const createPayerAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client.from('payers').insert({
      ...toRow(data),
      created_by: user.id,
      updated_by: user.id,
    });

    if (error) {
      throw error;
    }

    revalidatePath('/admin/payers');
    revalidatePath('/home/payers');

    return { success: true };
  },
  { schema: CreatePayerSchema },
);

export const updatePayerAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('payers')
      .update({ ...toRow(data), updated_by: user.id })
      .eq('id', data.payerId);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/payers');
    revalidatePath('/home/payers');

    return { success: true };
  },
  { schema: UpdatePayerSchema },
);

export const setPayerActiveAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('payers')
      .update({ is_active: data.isActive, updated_by: user.id })
      .eq('id', data.payerId);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/payers');
    revalidatePath('/home/payers');

    return { success: true };
  },
  { schema: SetPayerActiveSchema },
);

export const softDeletePayerAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('payers')
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', data.payerId);

    if (error) {
      throw error;
    }

    revalidatePath('/admin/payers');
    revalidatePath('/home/payers');

    return { success: true };
  },
  { schema: SoftDeletePayerSchema },
);

export const importPayersAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const rows = data.rows.map((row) => ({
      sim_payer_id: row.sim_payer_id,
      display_name: row.display_name,
      legal_name: row.legal_name || null,
      category: row.category,
      scope: row.scope,
      state: row.state || null,
      network_name: row.network_name || null,
      enrollment_required: row.enrollment_required,
      test_production: row.test_production,
      is_active: row.is_active,
      updated_by: user.id,
    }));

    const { error } = await client.from('payers').upsert(rows, { onConflict: 'sim_payer_id' });

    if (error) {
      throw error;
    }

    revalidatePath('/admin/payers');
    revalidatePath('/home/payers');

    return { success: true, count: rows.length };
  },
  { schema: ImportPayersSchema },
);
