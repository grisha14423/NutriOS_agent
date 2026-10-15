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

  delete from public.knowledge_chunks where id is not null;
  insert into public.knowledge_chunks (file, heading, content, embedding, embedding_model)
    select item.file, item.heading, item.content,
      item.embedding::extensions.vector(1536), model_name
    from jsonb_to_recordset(chunks) as item(file text, heading text, content text, embedding text);
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

notify pgrst, 'reload schema';
