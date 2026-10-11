-- Resumes the user writes in CareerPilot. The content is validated JSON (see ResumeData.java);
-- PDFs are generated from it on demand and are not stored here.
create table resumes (
    id          uuid primary key,
    user_id     uuid         not null references users (id) on delete cascade,
    title       varchar(120) not null,
    template_id varchar(40)  not null,
    page_size   varchar(10)  not null,
    data        jsonb        not null,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);

create index resumes_user_updated_idx on resumes (user_id, updated_at desc);

-- One Google Drive connection per user, made with the drive.file permission only.
-- Tokens are encrypted by the application (AES-256-GCM, see TokenCipher.java) before they are stored.
create table drive_connections (
    user_id                 uuid primary key references users (id) on delete cascade,
    google_email            varchar(320),
    google_permission_id    varchar(128),
    refresh_token           bytea        not null,
    access_token            bytea,
    access_token_expires_at timestamptz,
    scopes                  varchar(1000) not null,
    folder_id               varchar(128),
    folder_name             varchar(255),
    connected_at            timestamptz  not null,
    updated_at              timestamptz  not null
);

-- Short-lived, single-use OAuth "state" values that tie Google's redirect back to the user who started it.
-- Only a SHA-256 hash of the state is stored.
create table drive_oauth_states (
    state_hash    varchar(64) primary key,
    user_id       uuid        not null references users (id) on delete cascade,
    code_verifier varchar(128) not null,
    expires_at    timestamptz not null,
    created_at    timestamptz not null
);

create index drive_oauth_states_expires_idx on drive_oauth_states (expires_at);

-- Files CareerPilot created in the user's Drive. Deleting a row never deletes the Drive file;
-- Drive files are only trashed through an explicit, confirmed delete request.
create table drive_documents (
    id            uuid primary key,
    user_id       uuid          not null references users (id) on delete cascade,
    drive_file_id varchar(128)  not null,
    name          varchar(255)  not null,
    folder_id     varchar(128),
    mime_type     varchar(100)  not null,
    size_bytes    bigint,
    web_view_link varchar(2048),
    -- Client-generated id of the upload request, so a retried upload never creates a second file
    request_id    uuid,
    resume_id     uuid          references resumes (id) on delete set null,
    created_at    timestamptz   not null,
    updated_at    timestamptz   not null,

    constraint drive_documents_user_file_key unique (user_id, drive_file_id),
    constraint drive_documents_user_request_key unique (user_id, request_id)
);

create index drive_documents_user_updated_idx on drive_documents (user_id, updated_at desc);
