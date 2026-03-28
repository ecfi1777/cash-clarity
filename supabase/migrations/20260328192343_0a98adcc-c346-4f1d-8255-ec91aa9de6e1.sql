
DROP POLICY IF EXISTS "Allow all on bank_balance" ON bank_balance;
DROP POLICY IF EXISTS "Allow all on templates" ON templates;
DROP POLICY IF EXISTS "Allow all on transactions" ON transactions;

CREATE POLICY "authenticated users can select transactions"
  ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert transactions"
  ON transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update transactions"
  ON transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated users can delete transactions"
  ON transactions FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated users can select templates"
  ON templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert templates"
  ON templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update templates"
  ON templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "authenticated users can delete templates"
  ON templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated users can select bank_balance"
  ON bank_balance FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can update bank_balance"
  ON bank_balance FOR UPDATE TO authenticated USING (true);
