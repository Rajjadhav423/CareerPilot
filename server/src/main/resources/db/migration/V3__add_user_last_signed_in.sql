-- Set from Clerk's session.created webhook (each sign-in).
alter table users add column last_signed_in_at timestamptz;
