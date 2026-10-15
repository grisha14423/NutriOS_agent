alter table public.knowledge_chunks
  add column if not exists embedding_model text not null default 'requires-reingest';
alter table public.knowledge_chunks alter column embedding_model drop default;

create unique index if not exists knowledge_chunks_file_heading_idx
  on public.knowledge_chunks (file, heading);

drop function if exists public.search_knowledge(extensions.vector, integer);

create or replace function public.search_knowledge(
  query_embedding extensions.vector(1536),
  match_count integer,
  expected_model text
)
returns table (file text, heading text, content text, similarity double precision)
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.knowledge_chunks kc
    where kc.embedding_model is distinct from expected_model
  ) then
    raise exception 'Knowledge embeddings were created with a different model; run npm run ingest';
  end if;

  return query
    select kc.file, kc.heading, kc.content,
      1 - (kc.embedding <=> query_embedding) as similarity
    from public.knowledge_chunks kc
    order by kc.embedding <=> query_embedding
    limit match_count;
end;
$$;

revoke all on function public.search_knowledge(extensions.vector, integer, text) from public, anon, authenticated;
grant execute on function public.search_knowledge(extensions.vector, integer, text) to service_role;

create or replace function public.replace_knowledge_chunks(chunks jsonb, model_name text)
returns integer
language plpgsql security invoker
set search_path = ''
as $$
declare inserted_count integer;
begin
  if model_name is null or btrim(model_name) = '' or jsonb_typeof(chunks) is distinct from 'array' or jsonb_array_length(chunks) = 0 then
    raise exception 'Knowledge refresh requires a model name and nonempty chunk array';
  end if;

  delete from public.knowledge_chunks;
  insert into public.knowledge_chunks (file, heading, content, embedding, embedding_model)
    select item.file, item.heading, item.content,
      item.embedding::extensions.vector(1536), model_name
    from jsonb_to_recordset(chunks) as item(file text, heading text, content text, embedding text);
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_knowledge_chunks(jsonb, text) from public, anon, authenticated;
grant execute on function public.replace_knowledge_chunks(jsonb, text) to service_role;

notify pgrst, 'reload schema';
