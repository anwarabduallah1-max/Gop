/*
# Allow anonymous read access to requests and profiles

The Explore page is public and should be visible to unauthenticated visitors.
This migration updates the SELECT policies on requests and profiles to also
allow the `anon` role to read data, so the explore page works without login.
Write (insert/update/delete) operations remain authenticated-only.
*/

DROP POLICY IF EXISTS "requests_select_all" ON requests;
CREATE POLICY "requests_select_all" ON requests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO anon, authenticated USING (true);
