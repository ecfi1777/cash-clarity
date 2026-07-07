
CREATE TABLE public.dismissed_recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.recurring_templates(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id, occurrence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dismissed_recurring_occurrences TO authenticated;
GRANT ALL ON public.dismissed_recurring_occurrences TO service_role;

ALTER TABLE public.dismissed_recurring_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissed occurrences"
ON public.dismissed_recurring_occurrences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
