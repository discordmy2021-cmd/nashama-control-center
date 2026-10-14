/*
# Lock direct writes to Nashama Drive wallet tables

1. Modified Tables
- `nashama_drive_state`: removes direct INSERT, UPDATE, and DELETE privileges from the public client roles.
- `nashama_drive_transactions`: removes direct INSERT, UPDATE, and DELETE privileges from the public client roles.

2. Security Changes
- The anon and authenticated roles retain SELECT access for displaying wallet and history data.
- Balance changes and receipt creation remain available only through `perform_nashama_topup`, which validates the amount and applies both changes together.

3. Important Notes
- No user data is removed or changed by this migration.
- Existing row-level security policies remain in place as an additional protection layer.
*/

REVOKE INSERT, UPDATE, DELETE ON public.nashama_drive_state FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.nashama_drive_transactions FROM anon, authenticated;
GRANT SELECT ON public.nashama_drive_state, public.nashama_drive_transactions TO anon, authenticated;
