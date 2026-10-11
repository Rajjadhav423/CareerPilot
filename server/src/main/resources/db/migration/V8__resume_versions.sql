-- Resume history and proposals. Every save of a resume records a SAVED version; imported or AI-made changes
-- arrive as PROPOSED versions that the owner reviews (diff) and accepts or discards. Data is ResumeData JSON.
create table resume_versions (
    id          uuid primary key,
    resume_id   uuid         not null references resumes (id) on delete cascade,
    user_id     uuid         not null references users (id) on delete cascade,
    number      integer      not null,
    label       varchar(120),
    -- EDITOR, IMPORT, AI or RESTORE
    source      varchar(20)  not null,
    -- SAVED, PROPOSED or ACCEPTED (an accepted proposal)
    status      varchar(20)  not null,
    template_id varchar(40)  not null,
    page_size   varchar(10)  not null,
    data        jsonb        not null,
    created_at  timestamptz  not null,

    constraint resume_versions_number_key unique (resume_id, number)
);

create index resume_versions_resume_idx on resume_versions (resume_id, number desc);
