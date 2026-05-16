-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Messages UPDATE RLS vulnerability
--
-- Problem:
--   The policy "Recipients can mark messages as read" allowed any conversation
--   participant to UPDATE *any* column on public.messages (body, sender_id,
--   created_at, etc.) — not just read_at.
--
-- Fix:
--   1. Drop the overly-broad UPDATE policy entirely.
--   2. Replace with a SECURITY DEFINER RPC that:
--        - verifies the caller is an authenticated conversation participant
--        - only ever writes read_at = NOW()
--        - never exposes body / sender_id / created_at to modification
--   3. Grant EXECUTE to authenticated only; revoke from PUBLIC (anon).
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Remove the vulnerable UPDATE policy
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;

-- Step 2: Create the locked-down RPC
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id         UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Niet geauthenticeerd';
  END IF;

  -- Resolve the conversation this message belongs to
  SELECT conversation_id
    INTO v_conversation_id
    FROM public.messages
   WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN; -- unknown message ID: silently no-op
  END IF;

  -- Verify the caller is a participant (tenant or landlord) of that conversation
  IF NOT EXISTS (
    SELECT 1
      FROM public.conversations
     WHERE id = v_conversation_id
       AND (tenant_id = v_user_id OR landlord_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'Toegang geweigerd';
  END IF;

  -- Only set read_at; only on messages sent by someone else; only if not yet read
  UPDATE public.messages
     SET read_at = NOW()
   WHERE id         = p_message_id
     AND read_at    IS NULL
     AND sender_id <> v_user_id;
END;
$$;

-- Step 3: Lock down execution rights
REVOKE EXECUTE ON FUNCTION public.mark_message_read(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_message_read(UUID) TO authenticated;
