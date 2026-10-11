-- Google Drive now uses the Google token Clerk already manages for sign-in and Gmail, so CareerPilot no
-- longer stores Google tokens or runs its own OAuth flow. The V6 token tables were never used in production.
drop table drive_oauth_states;
drop table drive_connections;

-- Per-user Drive preferences. No credentials here.
create table drive_settings (
    user_id      uuid primary key references users (id) on delete cascade,
    -- false after the user chose "Disconnect" in CareerPilot (Google's permission itself stays with Clerk)
    enabled      boolean      not null default true,
    -- Google account the document list belongs to; a different account clears the list
    google_email varchar(320),
    folder_id    varchar(128),
    folder_name  varchar(255),
    updated_at   timestamptz  not null
);
