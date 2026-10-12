-- A resume can also be a docEngine document (schema version 3 JSON). When set, the document is what gets
-- previewed, downloaded and saved to Drive; "data" keeps the last form content so the form can be used again.
alter table resumes add column document jsonb;
alter table resume_versions add column document jsonb;
