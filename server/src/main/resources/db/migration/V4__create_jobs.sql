-- Jobs a user is tracking. Each belongs to exactly one user and is deleted with them.
create table jobs (
    id          uuid primary key,
    user_id     uuid          not null references users (id) on delete cascade,
    title       varchar(200)  not null,
    company     varchar(200)  not null,
    location    varchar(200),
    work_mode   varchar(16),
    job_url     varchar(2048),
    description text,
    notes       text,
    status      varchar(20)   not null,
    -- Where it came from: MANUAL, or the job board (GREENHOUSE / LEVER / ASHBY) when saved from Find jobs
    source      varchar(32)   not null,
    -- The Find-jobs posting id, so the same posting can't be saved twice
    external_id varchar(200),
    archived    boolean       not null default false,
    created_at  timestamptz   not null,
    updated_at  timestamptz   not null,

    constraint jobs_status_check check (status in
        ('SAVED', 'TO_REVIEW', 'PREPARING', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'CLOSED')),
    constraint jobs_work_mode_check check (work_mode in ('ONSITE', 'HYBRID', 'REMOTE'))
);

-- The board lists a user's active jobs
create index jobs_user_active_idx on jobs (user_id, updated_at desc) where not archived;
-- One saved copy per posting per user
create unique index jobs_user_external_id_key on jobs (user_id, external_id) where external_id is not null;
