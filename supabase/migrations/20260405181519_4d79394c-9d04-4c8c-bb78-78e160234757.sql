
-- Delete the old seed row with no owner
DELETE FROM public.bank_balance;

-- Add user_id column as nullable first
ALTER TABLE public.bank_balance ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make it NOT NULL with default
ALTER TABLE public.bank_balance ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.bank_balance ALTER COLUMN user_id SET NOT NULL;

-- Drop old policies on bank_balance
DROP POLICY IF EXISTS "authenticated users can select bank_balance" ON public.bank_balance;
DROP POLICY IF EXISTS "authenticated users can update bank_balance" ON public.bank_balance;

-- New owner-scoped policies on bank_balance
CREATE POLICY "users can select own bank_balance" ON public.bank_balance FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own bank_balance" ON public.bank_balance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own bank_balance" ON public.bank_balance FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
