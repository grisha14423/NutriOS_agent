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
      1 - (kc.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.knowledge_chunks kc
    order by kc.embedding operator(extensions.<=>) query_embedding
    limit match_count;
end;
$$;

notify pgrst, 'reload schema';
