-- Add optional per-assessment parts breakdown for the dashboard calculator.
-- Stored as JSON so we can evolve the UI without schema churn.

alter table public.assessment_results
  add column if not exists sub_assessments jsonb;

