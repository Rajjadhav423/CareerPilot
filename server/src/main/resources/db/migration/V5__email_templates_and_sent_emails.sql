-- Reusable email templates. Each belongs to one user; at most one is that user's default.
create table email_templates (
    id         uuid primary key,
    user_id    uuid         not null references users (id) on delete cascade,
    name       varchar(100) not null,
    subject    varchar(255) not null,
    body       text         not null,
    is_default boolean      not null default false,
    created_at timestamptz  not null,
    updated_at timestamptz  not null
);

create index email_templates_user_idx on email_templates (user_id, updated_at desc);
create unique index email_templates_one_default_per_user on email_templates (user_id) where is_default;

-- Application emails that Gmail accepted. The body is not stored (it may contain personal details).
create table sent_emails (
    id               uuid primary key,
    user_id          uuid         not null references users (id) on delete cascade,
    job_id           uuid         references jobs (id) on delete set null,
    template_id      uuid         references email_templates (id) on delete set null,
    recipient        varchar(320) not null,
    subject          varchar(255) not null,
    gmail_message_id varchar(128) not null,
    gmail_thread_id  varchar(128),
    sent_at          timestamptz  not null
);

create index sent_emails_user_job_idx on sent_emails (user_id, job_id, sent_at desc);

-- When the application was sent (set after Gmail accepts an application email).
alter table jobs add column applied_at timestamptz;
