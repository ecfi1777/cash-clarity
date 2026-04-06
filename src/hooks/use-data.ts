import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayStr } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────

export type ExpectedTransaction = {
  id: string;
  name: string;
  direction: string;
  type: string;
  expected_amount: number;
  scheduled_date: string;
  status: string;
  cleared_at: string | null;
  source: string;
  source_batch_id: string | null;
  recurring_template_id: string | null;
  vendor_id: string | null;
  check_number: string | null;
  notes: string | null;
  secondary_description: string | null;
  created_at: string;
  updated_at: string;
};

// Legacy alias for easier migration
export type Transaction = ExpectedTransaction;

export type RecurringTemplate = {
  id: string;
  name: string;
  direction: string;
  type: string;
  frequency: string;
  default_amount: number;
  next_due_date: string | null;
  last_generated_date: string | null;
  day_tolerance: number;
  is_active: boolean;
  vendor_id: string | null;
  created_at: string;
  updated_at: string;
};

// Legacy alias
export type Template = RecurringTemplate;

// ── Query hooks ──────────────────────────────────────────────────────────

export function useExpectedTransactions() {
  return useQuery({
    queryKey: ['expected_transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expected_transactions' as any)
        .select('*')
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ExpectedTransaction[];
    },
  });
}

// Legacy alias
export const useTransactions = useExpectedTransactions;

export function useRecurringTemplates() {
  return useQuery({
    queryKey: ['recurring_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_templates' as any)
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as RecurringTemplate[];
    },
  });
}

// Legacy alias
export const useTemplates = useRecurringTemplates;

export function useBankBalance() {
  return useQuery({
    queryKey: ['bank_balance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_balance')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: newRow, error: insertErr } = await supabase
        .from('bank_balance')
        .insert({ balance: 0 })
        .select()
        .single();
      if (insertErr) throw insertErr;
      return newRow;
    },
  });
}

// ── Mutation hooks ───────────────────────────────────────────────────────

export function useUpdateBankBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (balance: number) => {
      const { data: existing } = await supabase
        .from('bank_balance')
        .select('id')
        .limit(1)
        .single();
      if (!existing) throw new Error('No bank balance row');
      const { error } = await supabase
        .from('bank_balance')
        .update({ balance })
        .eq('id', existing.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank_balance'] }),
  });
}

export function useCreateExpectedTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: {
      name: string;
      expected_amount: number;
      direction: string;
      type: string;
      scheduled_date: string;
      status?: string;
      cleared_at?: string | null;
      source?: string;
      recurring_template_id?: string | null;
    }) => {
      const { error } = await supabase.from('expected_transactions' as any).insert(tx as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expected_transactions'] }),
  });
}

// Legacy alias
export const useCreateTransaction = useCreateExpectedTransaction;

export function useUpdateExpectedTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { error } = await supabase
        .from('expected_transactions' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expected_transactions'] }),
  });
}

// Legacy alias
export const useUpdateTransaction = useUpdateExpectedTransaction;

export function useDeleteExpectedTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expected_transactions' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expected_transactions'] }),
  });
}

// Legacy alias
export const useDeleteTransaction = useDeleteExpectedTransaction;

export function useCreateRecurringTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: {
      name: string;
      default_amount: number;
      direction: string;
      type: string;
      frequency: string;
      next_due_date?: string | null;
    }) => {
      const { error } = await supabase.from('recurring_templates' as any).insert(t as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_templates'] }),
  });
}

// Legacy alias
export const useCreateTemplate = useCreateRecurringTemplate;

export function useUpdateRecurringTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { error } = await supabase
        .from('recurring_templates' as any)
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring_templates'] }),
  });
}

// Legacy alias
export const useUpdateTemplate = useUpdateRecurringTemplate;

export function useBulkInsertExpectedTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txs: Array<{
      name: string;
      expected_amount: number;
      direction: string;
      type: string;
      scheduled_date: string;
      status?: string;
      cleared_at?: string | null;
      source?: string;
      recurring_template_id?: string | null;
      source_batch_id?: string | null;
    }>) => {
      const { error } = await supabase.from('expected_transactions' as any).insert(txs as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expected_transactions'] }),
  });
}

// Legacy alias
export const useBulkInsertTransactions = useBulkInsertExpectedTransactions;

export function useBulkUpdateExpectedTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; status: string; cleared_at: string | null }>) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('expected_transactions' as any)
          .update({ status: u.status, cleared_at: u.cleared_at } as any)
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expected_transactions'] }),
  });
}

// Legacy alias
export const useBulkUpdateTransactions = useBulkUpdateExpectedTransactions;
