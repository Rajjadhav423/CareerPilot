-- People who can sign in. A user may have a password, a Google identity, or both.
create table users (
    id                uuid primary key,
    email             varchar(320) not null,
    display_name      varchar(100),
    avatar_url        varchar(2048),
    -- bcrypt hash; null for accounts that only sign in with Google
    password_hash     varchar(100),
    email_verified_at timestamptz,
    created_at        timestamptz  not null,
    updated_at        timestamptz  not null,

    -- Emails are stored lower-cased so "Raj@Gmail.com" and "raj@gmail.com" are the same account.
    constraint users_email_lowercase check (email = lower(email)),
    constraint users_email_key unique (email)
);
