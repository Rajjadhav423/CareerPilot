-- Sign-up, passwords and email verification are handled by Clerk.
-- Our users table now just links a Clerk user to CareerPilot data (jobs, resumes, ...).
-- The table is still empty at this point, so the NOT NULL column can be added directly.
alter table users add column clerk_user_id varchar(64) not null;
alter table users add constraint users_clerk_user_id_key unique (clerk_user_id);

alter table users drop column password_hash;
alter table users drop column email_verified_at;

-- Email comes from the Clerk session token; Clerk guarantees uniqueness, so we only index it.
alter table users alter column email drop not null;
alter table users drop constraint users_email_key;
create index users_email_idx on users (email);
