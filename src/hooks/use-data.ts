import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayStr } from '@/lib/format';

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  direction: string;
  type: string;
  date: string;
  cleared: boolean;
  cleared_date: string | null;
  is_recurring: boolean;
  template_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type Template = {
  id: string;
  name: string;
  amount: number;
  direction: string;
  type: string;
  frequency: string;
  last_generated_date: string | null;
  next_due_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

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
      // Create a balance row for this user if none exists
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

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Template[];
    },
  });
}

export function useUpdateBankBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (balance: number) => {
      // Get the single row id first
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

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: {
      name: string;
      amount: number;
      direction: string;
      type: string;
      date: string;
      cleared?: boolean;
      cleared_date?: string | null;
      is_recurring?: boolean;
      template_id?: string | null;
    }) => {
      const { error } = await supabase.from('transactions').insert(tx);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Transaction> & { id: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: {
      name: string;
      amount: number;
      direction: string;
      type: string;
      frequency: string;
    }) => {
      const { error } = await supabase.from('templates').insert(t);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Template> & { id: string }) => {
      const { error } = await supabase
        .from('templates')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useBulkInsertTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txs: Array<{
      name: string;
      amount: number;
      direction: string;
      type: string;
      date: string;
      cleared?: boolean;
      cleared_date?: string | null;
      is_recurring?: boolean;
      template_id?: string | null;
      source?: string;
    }>) => {
      const { error } = await supabase.from('transactions').insert(txs);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useBulkUpdateTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; cleared: boolean; cleared_date: string | null }>) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('transactions')
          .update({ cleared: u.cleared, cleared_date: u.cleared_date })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
