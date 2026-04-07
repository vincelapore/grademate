-- Dashboard hurdle support (mirrors /university hurdle UX)

alter table public.assessment_results
  add column if not exists is_hurdle boolean not null default false;

alter table public.assessment_results
  add column if not exists hurdle_threshold integer;

alter table public.assessment_results
  add column if not exists hurdle_requirements text;

alter table public.subject_enrolments
  add column if not exists hurdle_information text;

