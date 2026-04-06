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
  rollback_notes: string | null;
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

export type AdjustmentInput = {
  bank_import_row_id: string;
  expected_amount_before: number;
  bank_amount: number;
  accepted_final_amount: number;
  adjustment_amount: number;
  apply_to_future_template: boolean;
  recurring_template_id: string | null;
  notes: string | null;
};

export type TemplateUpdate = {
  template_id: string;
  new_default_amount: number;
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
      // Step 1: get IDs of genuinely applied batches
      const { data: batches, error: batchErr } = await supabase
        .from('bank_import_batches' as any)
        .select('id')
        .eq('status', 'applied');
      if (batchErr) throw batchErr;
      const batchIds = ((batches ?? []) as any[]).map((b: any) => b.id);
      if (batchIds.length === 0) return new Set<string>();

      // Step 2: only fingerprints from rows that were genuinely applied
      const { data, error } = await supabase
        .from('bank_import_rows' as any)
        .select('duplicate_fingerprint')
        .in('batch_id', batchIds)
        .eq('is_duplicate', false)
        .eq('selected_for_apply', true)
        .not('applied_at', 'is', null);
      if (error) throw error;

      const fps = new Set<string>();
      for (const row of (data ?? []) as any[]) {
        fps.add(row.duplicate_fingerprint);
      }
      return fps;
    },
  });
}

export function useImportBatchDetail(batchId: string | undefined) {
  return useQuery({
    queryKey: ['import_batch_detail', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_import_batches' as any)
        .select('*')
        .eq('id', batchId!)
        .single();
      if (error) throw error;
      return data as unknown as ImportBatch;
    },
  });
}

export function useImportBatchRows(batchId: string | undefined) {
  return useQuery({
    queryKey: ['import_batch_rows', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_import_rows' as any)
        .select('*')
        .eq('batch_id', batchId!)
        .order('posted_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ImportRow[];
    },
  });
}

export function useImportBatchChangeLog(batchId: string | undefined) {
  return useQuery({
    queryKey: ['import_batch_changelog', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batch_change_log' as any)
        .select('*')
        .eq('batch_id', batchId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        batch_id: string;
        entity_type: string;
        entity_id: string;
        action_type: string;
        before_state: any;
        after_state: any;
        rollback_state: string;
        rollback_reason: string | null;
        created_at: string;
      }>;
    },
  });
}

export function useImportBatchMatches(batchId: string | undefined) {
  return useQuery({
    queryKey: ['import_batch_matches', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_matches' as any)
        .select('*')
        .eq('batch_id', batchId!);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        batch_id: string;
        bank_import_row_id: string;
        expected_transaction_id: string;
        match_status: string;
        match_confidence: string;
        days_difference: number | null;
        amount_difference: number | null;
      }>;
    },
  });
}

export function useImportBatchAdjustments(batchId: string | undefined) {
  return useQuery({
    queryKey: ['import_batch_adjustments', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_adjustments' as any)
        .select('*')
        .eq('batch_id', batchId!);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        batch_id: string;
        transaction_match_id: string;
      }>;
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
      const { data, error } = await supabase.from('bank_import_rows' as any).insert(rows as any).select('id');
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string }>;
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
      adjustments?: AdjustmentInput[];
      templateUpdates?: TemplateUpdate[];
    }) => {
      // 1. Update matched expected_transactions → status='matched'
      for (const u of params.matchedUpdates) {
        const { error } = await supabase
          .from('expected_transactions' as any)
          .update({ status: 'matched', cleared_at: u.cleared_at } as any)
          .eq('id', u.id);
        if (error) throw error;
      }

      // 2. Insert unmatched rows as new expected_transactions (return IDs for change log)
      let insertedIds: string[] = [];
      if (params.newTransactions.length > 0) {
        const { data: inserted, error } = await supabase
          .from('expected_transactions' as any)
          .insert(params.newTransactions as any)
          .select('id');
        if (error) throw error;
        insertedIds = (inserted ?? []).map((r: any) => r.id);
      }

      // 3. Save transaction_matches — use .select('id, bank_import_row_id') to map adjustments
      let insertedMatches: Array<{ id: string; bank_import_row_id: string }> = [];
      if (params.matchRecords.length > 0) {
        const { data: matchData, error } = await supabase
          .from('transaction_matches' as any)
          .insert(params.matchRecords as any)
          .select('id, bank_import_row_id');
        if (error) throw error;
        insertedMatches = (matchData ?? []) as any;
      }

      // 3b. Insert transaction_adjustments linked to their match IDs
      if (params.adjustments && params.adjustments.length > 0) {
        // Build a map: bank_import_row_id → match ID
        const rowToMatchId = new Map<string, string>();
        for (const m of insertedMatches) {
          rowToMatchId.set(m.bank_import_row_id, m.id);
        }

        const adjRecords = params.adjustments.map(adj => ({
          batch_id: params.batchId,
          transaction_match_id: rowToMatchId.get(adj.bank_import_row_id) ?? '',
          expected_amount_before: adj.expected_amount_before,
          bank_amount: adj.bank_amount,
          accepted_final_amount: adj.accepted_final_amount,
          adjustment_amount: adj.adjustment_amount,
          apply_to_future_template: adj.apply_to_future_template,
          recurring_template_id: adj.recurring_template_id,
          notes: adj.notes,
        }));

        const { error: adjErr } = await supabase
          .from('transaction_adjustments' as any)
          .insert(adjRecords as any);
        if (adjErr) throw adjErr;

        // Add adjustment change log entries
        for (const adj of params.adjustments) {
          const matchId = rowToMatchId.get(adj.bank_import_row_id);
          params.changeLog.push({
            batch_id: params.batchId,
            entity_type: 'transaction_adjustment',
            entity_id: matchId ?? adj.bank_import_row_id,
            action_type: 'adjustment',
            before_state: { expected_amount: adj.expected_amount_before },
            after_state: {
              accepted_final_amount: adj.accepted_final_amount,
              bank_amount: adj.bank_amount,
              adjustment_amount: adj.adjustment_amount,
            },
          });
        }
      }

      // 3c. Apply template updates
      if (params.templateUpdates && params.templateUpdates.length > 0) {
        for (const tu of params.templateUpdates) {
          const { error } = await supabase
            .from('recurring_templates' as any)
            .update({ default_amount: tu.new_default_amount } as any)
            .eq('id', tu.template_id);
          if (error) throw error;
        }
      }

      // 4. Build insert change log entries (with actual inserted IDs)
      const insertChangeLogs = insertedIds.map((id, i) => ({
        batch_id: params.batchId,
        entity_type: 'expected_transaction',
        entity_id: id,
        action_type: 'insert',
        before_state: null,
        after_state: params.newTransactions[i],
      }));

      // 4b. Batch status change log entry
      const batchChangeLog = {
        batch_id: params.batchId,
        entity_type: 'batch',
        entity_id: params.batchId,
        action_type: 'status_update',
        before_state: { status: 'draft' },
        after_state: { status: 'applied', ...params.counts },
      };

      const allChangeLogs = [...params.changeLog, ...insertChangeLogs, batchChangeLog];
      if (allChangeLogs.length > 0) {
        const { error } = await supabase
          .from('batch_change_log' as any)
          .insert(allChangeLogs as any);
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

// ── Rollback ─────────────────────────────────────────────────────────────

export function useRollbackBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { batchId: string; rollbackNotes?: string }) => {
      const { batchId, rollbackNotes } = params;

      try {
        // 1. Fetch pending change log entries
        const { data: logEntries, error: logErr } = await supabase
          .from('batch_change_log' as any)
          .select('*')
          .eq('batch_id', batchId)
          .eq('rollback_state', 'pending');
        if (logErr) throw logErr;
        const entries = (logEntries ?? []) as any[];

        // 2. Restore status_update entries
        const statusUpdates = entries.filter(e => e.action_type === 'status_update' && e.entity_type === 'expected_transaction');
        for (const entry of statusUpdates) {
          const before = entry.before_state || {};
          const { error } = await supabase
            .from('expected_transactions' as any)
            .update({
              status: before.status ?? 'outstanding',
              cleared_at: before.cleared_at ?? null,
            } as any)
            .eq('id', entry.entity_id);
          if (error) throw error;
        }

        // 3. Delete inserted expected_transactions
        const inserts = entries.filter(e => e.action_type === 'insert' && e.entity_type === 'expected_transaction');
        for (const entry of inserts) {
          const { error } = await supabase
            .from('expected_transactions' as any)
            .delete()
            .eq('id', entry.entity_id);
          if (error) throw error;
        }

        // 4. Delete transaction_adjustments for batch
        const { error: adjErr } = await supabase
          .from('transaction_adjustments' as any)
          .delete()
          .eq('batch_id', batchId);
        if (adjErr) throw adjErr;

        // 5. Delete transaction_matches for batch
        const { error: matchErr } = await supabase
          .from('transaction_matches' as any)
          .delete()
          .eq('batch_id', batchId);
        if (matchErr) throw matchErr;

        // 6. Update change log entries
        const { error: clErr } = await supabase
          .from('batch_change_log' as any)
          .update({ rollback_state: 'rolled_back' } as any)
          .eq('batch_id', batchId)
          .eq('rollback_state', 'pending');
        if (clErr) throw clErr;

        // 7. Update batch status
        const { error: batchErr } = await supabase
          .from('bank_import_batches' as any)
          .update({
            status: 'rolled_back',
            rollback_notes: rollbackNotes || null,
          } as any)
          .eq('id', batchId);
        if (batchErr) throw batchErr;

        // 8. Reset import rows
        const { error: rowErr } = await supabase
          .from('bank_import_rows' as any)
          .update({ applied_at: null, review_status: 'pending' } as any)
          .eq('batch_id', batchId);
        if (rowErr) throw rowErr;

      } catch (err) {
        // Mark as partial_rollback on any failure
        try {
          await supabase
            .from('bank_import_batches' as any)
            .update({
              status: 'partial_rollback',
              rollback_notes: `Rollback failed: ${err instanceof Error ? err.message : String(err)}. ${rollbackNotes || ''}`,
            } as any)
            .eq('id', batchId);
        } catch { /* best effort */ }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expected_transactions'] });
      qc.invalidateQueries({ queryKey: ['import_batches'] });
      qc.invalidateQueries({ queryKey: ['existing_fingerprints'] });
      qc.invalidateQueries({ queryKey: ['import_batch_detail'] });
      qc.invalidateQueries({ queryKey: ['import_batch_rows'] });
      qc.invalidateQueries({ queryKey: ['import_batch_changelog'] });
      qc.invalidateQueries({ queryKey: ['import_batch_matches'] });
    },
  });
}
