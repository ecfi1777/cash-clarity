
-- =============================================
-- Phase 1: Create 9 new tables
-- =============================================

-- 1. vendors
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  canonical_name text NOT NULL,
  default_direction text,
  default_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. vendor_aliases
CREATE TABLE public.vendor_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  raw_alias text NOT NULL,
  normalized_alias text NOT NULL,
  confidence_source text NOT NULL DEFAULT 'manual',
  times_seen int NOT NULL DEFAULT 1,
  last_seen_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, normalized_alias)
);

-- 3. recurring_templates
CREATE TABLE public.recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  vendor_id uuid REFERENCES public.vendors(id),
  name text NOT NULL,
  direction text NOT NULL,
  type text NOT NULL,
  frequency text NOT NULL,
  default_amount numeric NOT NULL,
  next_due_date date,
  last_generated_date date,
  day_tolerance int NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. bank_import_batches (must exist before expected_transactions references it)
CREATE TABLE public.bank_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  file_name text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  statement_start_date date,
  statement_end_date date,
  row_count int NOT NULL DEFAULT 0,
  matched_count int NOT NULL DEFAULT 0,
  partial_match_count int NOT NULL DEFAULT 0,
  unmatched_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  rollback_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. expected_transactions
CREATE TABLE public.expected_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  recurring_template_id uuid REFERENCES public.recurring_templates(id),
  vendor_id uuid REFERENCES public.vendors(id),
  name text NOT NULL,
  direction text NOT NULL,
  type text NOT NULL,
  expected_amount numeric NOT NULL,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'outstanding',
  cleared_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  source_batch_id uuid REFERENCES public.bank_import_batches(id),
  check_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. bank_import_rows
CREATE TABLE public.bank_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.bank_import_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  raw_description text NOT NULL,
  normalized_description text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id),
  check_number text,
  posted_date date NOT NULL,
  amount numeric NOT NULL,
  direction text NOT NULL,
  type text,
  duplicate_fingerprint text NOT NULL,
  is_duplicate boolean NOT NULL DEFAULT false,
  suggested_match_id uuid REFERENCES public.expected_transactions(id),
  suggested_match_confidence text,
  suggested_amount_difference numeric,
  review_status text NOT NULL DEFAULT 'pending',
  selected_for_apply boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. transaction_matches
CREATE TABLE public.transaction_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  batch_id uuid NOT NULL REFERENCES public.bank_import_batches(id),
  bank_import_row_id uuid NOT NULL REFERENCES public.bank_import_rows(id),
  expected_transaction_id uuid NOT NULL REFERENCES public.expected_transactions(id),
  match_status text NOT NULL DEFAULT 'confirmed',
  match_confidence text NOT NULL,
  days_difference int,
  amount_difference numeric,
  matched_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes for one-to-one enforcement
CREATE UNIQUE INDEX idx_matches_row_unique ON public.transaction_matches(bank_import_row_id)
  WHERE match_status IN ('confirmed', 'partial_confirmed');
CREATE UNIQUE INDEX idx_matches_tx_unique ON public.transaction_matches(expected_transaction_id)
  WHERE match_status IN ('confirmed', 'partial_confirmed');

-- 8. transaction_adjustments
CREATE TABLE public.transaction_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  batch_id uuid NOT NULL REFERENCES public.bank_import_batches(id),
  transaction_match_id uuid NOT NULL REFERENCES public.transaction_matches(id),
  expected_amount_before numeric NOT NULL,
  bank_amount numeric NOT NULL,
  accepted_final_amount numeric NOT NULL,
  adjustment_amount numeric NOT NULL,
  apply_to_future_template boolean NOT NULL DEFAULT false,
  recurring_template_id uuid REFERENCES public.recurring_templates(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. batch_change_log
CREATE TABLE public.batch_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.bank_import_batches(id),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action_type text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  rollback_state text NOT NULL DEFAULT 'pending',
  rollback_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- updated_at triggers for all 9 tables
-- =============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vendor_aliases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.recurring_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bank_import_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expected_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bank_import_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transaction_matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transaction_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.batch_change_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_expected_tx_user_status ON public.expected_transactions(user_id, status, direction);
CREATE INDEX idx_import_rows_batch ON public.bank_import_rows(batch_id);
CREATE INDEX idx_import_rows_fingerprint ON public.bank_import_rows(duplicate_fingerprint);
CREATE INDEX idx_matches_expected ON public.transaction_matches(expected_transaction_id);
CREATE INDEX idx_matches_row ON public.transaction_matches(bank_import_row_id);
CREATE INDEX idx_vendor_aliases_lookup ON public.vendor_aliases(user_id, normalized_alias);

-- =============================================
-- RLS: enable + owner-scoped policies on all 9 tables
-- =============================================
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expected_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_change_log ENABLE ROW LEVEL SECURITY;

-- vendors
CREATE POLICY "users can select own vendors" ON public.vendors FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own vendors" ON public.vendors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own vendors" ON public.vendors FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own vendors" ON public.vendors FOR DELETE TO authenticated USING (user_id = auth.uid());

-- vendor_aliases
CREATE POLICY "users can select own vendor_aliases" ON public.vendor_aliases FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own vendor_aliases" ON public.vendor_aliases FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own vendor_aliases" ON public.vendor_aliases FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own vendor_aliases" ON public.vendor_aliases FOR DELETE TO authenticated USING (user_id = auth.uid());

-- recurring_templates
CREATE POLICY "users can select own recurring_templates" ON public.recurring_templates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own recurring_templates" ON public.recurring_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own recurring_templates" ON public.recurring_templates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own recurring_templates" ON public.recurring_templates FOR DELETE TO authenticated USING (user_id = auth.uid());

-- bank_import_batches
CREATE POLICY "users can select own bank_import_batches" ON public.bank_import_batches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own bank_import_batches" ON public.bank_import_batches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own bank_import_batches" ON public.bank_import_batches FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own bank_import_batches" ON public.bank_import_batches FOR DELETE TO authenticated USING (user_id = auth.uid());

-- expected_transactions
CREATE POLICY "users can select own expected_transactions" ON public.expected_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own expected_transactions" ON public.expected_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own expected_transactions" ON public.expected_transactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own expected_transactions" ON public.expected_transactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- bank_import_rows
CREATE POLICY "users can select own bank_import_rows" ON public.bank_import_rows FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own bank_import_rows" ON public.bank_import_rows FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own bank_import_rows" ON public.bank_import_rows FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own bank_import_rows" ON public.bank_import_rows FOR DELETE TO authenticated USING (user_id = auth.uid());

-- transaction_matches
CREATE POLICY "users can select own transaction_matches" ON public.transaction_matches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own transaction_matches" ON public.transaction_matches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own transaction_matches" ON public.transaction_matches FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own transaction_matches" ON public.transaction_matches FOR DELETE TO authenticated USING (user_id = auth.uid());

-- transaction_adjustments
CREATE POLICY "users can select own transaction_adjustments" ON public.transaction_adjustments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own transaction_adjustments" ON public.transaction_adjustments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own transaction_adjustments" ON public.transaction_adjustments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own transaction_adjustments" ON public.transaction_adjustments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- batch_change_log
CREATE POLICY "users can select own batch_change_log" ON public.batch_change_log FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own batch_change_log" ON public.batch_change_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own batch_change_log" ON public.batch_change_log FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own batch_change_log" ON public.batch_change_log FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- Data migration: templates -> recurring_templates
-- =============================================
INSERT INTO public.recurring_templates (id, user_id, name, direction, type, frequency, default_amount, next_due_date, last_generated_date, is_active, created_at, updated_at)
SELECT id, user_id, name, direction, type, frequency, amount, next_due_date, last_generated_date, is_active, created_at, updated_at
FROM public.templates;

-- =============================================
-- Data migration: transactions -> expected_transactions
-- =============================================
INSERT INTO public.expected_transactions (id, user_id, recurring_template_id, name, direction, type, expected_amount, scheduled_date, status, cleared_at, source, created_at, updated_at)
SELECT
  id,
  user_id,
  template_id,
  name,
  direction,
  type,
  amount,
  date,
  CASE WHEN cleared THEN 'cleared_manual' ELSE 'outstanding' END,
  CASE WHEN cleared THEN cleared_date::timestamptz ELSE NULL END,
  CASE
    WHEN source = 'csv_unmatched' THEN 'import_unmatched'
    WHEN is_recurring THEN 'recurring_generated'
    ELSE 'manual'
  END,
  created_at,
  updated_at
FROM public.transactions;

-- =============================================
-- Validate row counts
-- =============================================
DO $$
DECLARE
  old_tx_count bigint;
  new_tx_count bigint;
  old_tpl_count bigint;
  new_tpl_count bigint;
BEGIN
  SELECT count(*) INTO old_tx_count FROM public.transactions;
  SELECT count(*) INTO new_tx_count FROM public.expected_transactions;
  IF old_tx_count <> new_tx_count THEN
    RAISE EXCEPTION 'Transaction migration count mismatch: old=%, new=%', old_tx_count, new_tx_count;
  END IF;

  SELECT count(*) INTO old_tpl_count FROM public.templates;
  SELECT count(*) INTO new_tpl_count FROM public.recurring_templates;
  IF old_tpl_count <> new_tpl_count THEN
    RAISE EXCEPTION 'Template migration count mismatch: old=%, new=%', old_tpl_count, new_tpl_count;
  END IF;
END $$;

-- =============================================
-- Drop FK on old transactions table, then rename legacy tables
-- =============================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_template_id_fkey;
ALTER TABLE public.transactions RENAME TO legacy_transactions;
ALTER TABLE public.templates RENAME TO legacy_templates;
