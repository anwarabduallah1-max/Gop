/*
# Create request-images storage bucket

1. Storage
- Creates a public bucket `request-images` for storing user-uploaded product photos.
- Public bucket so uploaded images are readable by anyone (including unauthenticated visitors on the Explore page).

2. Policies
- SELECT (read): public — anyone can view uploaded images.
- INSERT (upload): authenticated users only.
- UPDATE / DELETE: authenticated users only, scoped to files they own (storage.foldername prefix = user id).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('request-images', 'request-images', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT: public read
DROP POLICY IF EXISTS "request_images_public_read" ON storage.objects;
CREATE POLICY "request_images_public_read" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'request-images');

-- INSERT: authenticated users can upload to their own folder
DROP POLICY IF EXISTS "request_images_authed_insert" ON storage.objects;
CREATE POLICY "request_images_authed_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'request-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- UPDATE: owner only
DROP POLICY IF EXISTS "request_images_owner_update" ON storage.objects;
CREATE POLICY "request_images_owner_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'request-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'request-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- DELETE: owner only
DROP POLICY IF EXISTS "request_images_owner_delete" ON storage.objects;
CREATE POLICY "request_images_owner_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'request-images' AND (storage.foldername(name))[1] = auth.uid()::text);
