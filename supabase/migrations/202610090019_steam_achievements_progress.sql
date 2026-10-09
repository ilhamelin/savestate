begin;

-- Ampliar el tipo de progreso para incluir logros de Steam (PC)
alter table public.play_logs drop constraint if exists play_logs_console_progress_check;
alter table public.play_logs add constraint play_logs_console_progress_check check (
  console_progress is null or (
    jsonb_typeof(console_progress) = 'object'
    and console_progress ?& array['kind','current','total']
    and console_progress->>'kind' in ('gamerscore','trophies','achievements')
    and jsonb_typeof(console_progress->'current') = 'number'
    and jsonb_typeof(console_progress->'total') = 'number'
    and (console_progress->>'current')::numeric between 0 and 10000000
    and (console_progress->>'total')::numeric between 1 and 10000000
    and trunc((console_progress->>'current')::numeric) = (console_progress->>'current')::numeric
    and trunc((console_progress->>'total')::numeric) = (console_progress->>'total')::numeric
  )
);

commit;
