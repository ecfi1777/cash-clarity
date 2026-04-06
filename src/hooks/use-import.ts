import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────

export type ImportBatch = {
  id: string;
  file_name: string;
  imported_at: string;
  statement_start_date: string | null;
  statement_end_date: string | null;
  row_count: number;
  matched_count: number;
  partial_match_count: number;
  unmatched_count: number;
  duplicate_count: number;
  status: string;
};

export type ImportRow = {
  id: string;
  batch_id: string;
  raw_description: string;
  normalized_description: string;
  check_number: string | null;
  posted_date: string;
  amount: number;
  direction: string;
  type: string | null;
  duplicate_fingerprint: string;
  is_duplicate: boolean;
  suggested_match_id: string | null;
  suggested_match_confidence: string | null;
  suggested_amount_difference: number | null;
  review_status: string;
  selected_for_apply: boolean;
};

// ── Query hooks ──────────────────────────────────────────────────────────

export function useImportBatches() {
  return useQuery({
    queryKey: ['import_batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_import_batches' as any)
        .select('*')
        .order('imported_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ImportBatch[];
    },
  });
}

export function useFetchExistingFingerprints() {
  return useQuery({
    queryKey: ['existing_fingerprints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_import_rows' as any)
        .select('duplicate_fingerprint');
      if (error) throw error;
      const fps = new Set<string>();
      for (const row of (data ?? []) as any[]) {
        fps.add(row.duplicate_fingerprint);
      }
      return fps;
    },
  });
}

// ── Mutation hooks ───────────────────────────────────────────────────────

export function useCreateImportBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (batch: {
      file_name: string;
      row_count: number;
      statement_start_date?: string | null;
      statement_end_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('bank_import_batches' as any)
        .insert(batch as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ImportBatch;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['import_batches'] }),
  });
}

export function useInsertImportRows() {
  return useMutation({
    mutationFn: async (rows: Array<{
      batch_id: string;
      raw_description: string;
      normalized_description: string;
      check_number: string | null;
      posted_date: string;
      amount: number;
      direction: string;
      type: string | null;
      duplicate_fingerprint: string;
      is_duplicate: boolean;
      suggested_match_id: string | null;
      suggested_match_confidence: string | null;
      suggested_amount_difference: number | null;
      review_status: string;
      selected_for_apply: boolean;
    }>) => {
      const { error } = await supabase.from('bank_import_rows' as any).insert(rows as any);
      if (error) throw error;
    },
  });
}

export function useApplyBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      batchId: string;
      matchedUpdates: Array<{ id: string; cleared_at: string }>;
      newTransactions: Array<{
        name: string;
        expected_amount: number;
        direction: string;
        type: string;
        scheduled_date: string;
        status: string;
        cleared_at: string;
        source: string;
        source_batch_id: string;
      }>;
      matchRecords: Array<{
        batch_id: string;
        bank_import_row_id: string;
        expected_transaction_id: string;
        match_status: string;
        match_confidence: string;
        days_difference: number | null;
        amount_difference: number | null;
      }>;
      changeLog: Array<{
        batch_id: string;
        entity_type: string;
        entity_id: string;
        action_type: string;
        before_state: any;
        after_state: any;
      }>;
      counts: {
        matched_count: number;
        partial_match_count: number;
        unmatched_count: number;
        duplicate_count: number;
      };
    }) => {
      // 1. Update matched expected_transactions → status='matched'
      for (const u of params.matchedUpdates) {
        const { error } = await supabase
          .from('expected_transactions' as any)
          .update({ status: 'matched', cleared_at: u.cleared_at } as any)
          .eq('id', u.id);
        if (error) throw error;
      }

      // 2. Insert unmatched rows as new expected_transactions
      if (params.newTransactions.length > 0) {
        const { error } = await supabase
          .from('expected_transactions' as any)
          .insert(params.newTransactions as any);
        if (error) throw error;
      }

      // 3. Save transaction_matches
      if (params.matchRecords.length > 0) {
        const { error } = await supabase
          .from('transaction_matches' as any)
          .insert(params.matchRecords as any);
        if (error) throw error;
      }

      // 4. Write batch_change_log
      if (params.changeLog.length > 0) {
        const { error } = await supabase
          .from('batch_change_log' as any)
          .insert(params.changeLog as any);
        if (error) throw error;
      }

      // 5. Update batch status and counts
      const { error: batchErr } = await supabase
        .from('bank_import_batches' as any)
        .update({
          status: 'applied',
          matched_count: params.counts.matched_count,
          partial_match_count: params.counts.partial_match_count,
          unmatched_count: params.counts.unmatched_count,
          duplicate_count: params.counts.duplicate_count,
        } as any)
        .eq('id', params.batchId);
      if (batchErr) throw batchErr;

      // 6. Mark import rows as applied
      const { error: rowErr } = await supabase
        .from('bank_import_rows' as any)
        .update({ applied_at: new Date().toISOString(), review_status: 'applied' } as any)
        .eq('batch_id', params.batchId)
        .eq('selected_for_apply', true);
      if (rowErr) throw rowErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expected_transactions'] });
      qc.invalidateQueries({ queryKey: ['import_batches'] });
      qc.invalidateQueries({ queryKey: ['existing_fingerprints'] });
    },
  });
}
