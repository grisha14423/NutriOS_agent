create extension if not exists vector with schema extensions;

create table if not exists public.knowledge_chunks (
  id bigint generated always as identity primary key,
  file text not null,
  heading text not null,
  content text not null,
  embedding extensions.vector(1536) not null
);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;
grant select, insert, delete on public.knowledge_chunks to service_role;

create or replace function public.search_knowledge(query_embedding extensions.vector(1536), match_count integer default 5)
returns table (file text, heading text, content text, similarity double precision)
language sql stable security invoker
as $$
  select kc.file, kc.heading, kc.content, 1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

revoke all on function public.search_knowledge(extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.search_knowledge(extensions.vector, integer) to service_role;
