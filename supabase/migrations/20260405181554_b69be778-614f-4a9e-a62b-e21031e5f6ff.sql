
-- Add user_id to transactions
ALTER TABLE public.transactions ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to templates  
ALTER TABLE public.templates ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop old policies on transactions
DROP POLICY IF EXISTS "authenticated users can select transactions" ON public.transactions;
DROP POLICY IF EXISTS "authenticated users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "authenticated users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "authenticated users can delete transactions" ON public.transactions;

-- New owner-scoped policies on transactions
CREATE POLICY "users can select own transactions" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own transactions" ON public.transactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own transactions" ON public.transactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Drop old policies on templates
DROP POLICY IF EXISTS "authenticated users can select templates" ON public.templates;
DROP POLICY IF EXISTS "authenticated users can insert templates" ON public.templates;
DROP POLICY IF EXISTS "authenticated users can update templates" ON public.templates;
DROP POLICY IF EXISTS "authenticated users can delete templates" ON public.templates;

-- New owner-scoped policies on templates
CREATE POLICY "users can select own templates" ON public.templates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users can insert own templates" ON public.templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can update own templates" ON public.templates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can delete own templates" ON public.templates FOR DELETE TO authenticated USING (user_id = auth.uid());
