import page from './page.js';

const models = new Set(['nvidia/nemotron-3.5-lightning:free','nvidia/nemotron-3-ultra-550b-a55b:free','openrouter/free','nvidia/nemotron-3.5-super-vl:free','thinkingmachines/inkling-2-small:free']);
async function get(url) {
  const response = await fetch(url, {headers:{Accept:'application/json'}});
  if (!response.ok) throw Error('Источник временно недоступен (' + response.status + ')');
  return response.json();
}
async function model(env, selected, system, data) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+env.OPENROUTER_API_KEY},
    body:JSON.stringify({model:selected,temperature:0,max_tokens:4000,reasoning:{enabled:false},messages:[{role:'system',content:system},{role:'user',content:system+'\n'+JSON.stringify(data)}]})
  });
  if (!response.ok) throw Error(response.status === 429 ? 'OpenRouter ограничил запросы. Попробуйте позже.' : 'Ошибка OpenRouter ('+response.status+')');
  const dataOut = await response.json();
  const content = dataOut.choices?.[0]?.message?.content;
  if (!content) throw Error('Модель вернула пустой ответ.');
  return content.trim();
}
function parseDecision(raw) {
  const source = raw.replace(/^```(?:json)?\s*|\s*```$/gi, '');
  const escaped = source.replace(/"(?:[^"\\]|\\[\s\S])*"/g, value =>
    value.replace(/[\u0000-\u001f]/g, character => JSON.stringify(character).slice(1, -1)));
  return JSON.parse(escaped);
}

const aspects = {function:'molecular_function', process:'biological_process', location:'cellular_component'};
const tools = {
  uniprot_search: {
    description: 'Find reviewed human UniProt records by gene symbol or protein name',
    inputSchema: {type:'object', required:['query','field'], properties:{query:{type:'string'},field:{enum:['gene','protein']}}},
    async run(args) {
  const q=String(args.query).slice(0,120).replace(/["\\]/g,'');
  const find=async query=>get('https://rest.uniprot.org/uniprotkb/search?'+new URLSearchParams({query:'organism_id:9606 AND reviewed:true AND '+query,size:'6'}));
  let entries=[];
  if (args.field === 'gene' && /^[A-Za-z0-9_-]+$/.test(q)) entries=(await find('gene_exact:"'+q+'"')).results;
  if (!entries.length) entries=(await find('protein_name:"'+q+'"')).results;
      return entries.map(entry => ({
        primaryAccession: entry.primaryAccession,
        comments: (entry.comments || []).filter(comment => comment.commentType === 'FUNCTION')
      }));
    },
  },
  quickgo_annotations: {
    description: 'Get Gene Ontology annotations for a UniProt accession by aspect',
    inputSchema: {type:'object', required:['accession','focus'], properties:{accession:{type:'string'},focus:{type:'array',items:{enum:Object.keys(aspects)}}}},
    async run(args) {
      const accession = args.accession;
      if (!/^[A-Z0-9]{6,10}$/.test(accession)) throw Error('Недопустимый идентификатор UniProt.');
      const focus = [...new Set(args.focus)].filter(category => Object.hasOwn(aspects, category));
      const sources = {};
  for (const category of focus) {
    const params=new URLSearchParams({geneProductId:'UniProtKB:'+accession,aspect:aspects[category],limit:'50'});
    const annotations=(await get('https://www.ebi.ac.uk/QuickGO/services/annotation/search?'+params)).results;
    const unique=new Map();
    for (const item of annotations) if (!(item.qualifier||'').split('|').includes('NOT') && !unique.has(item.goId)) unique.set(item.goId,item);
    const chosen=[...unique.values()].slice(0,4);
    if (!chosen.length) continue;
    const terms=(await get('https://www.ebi.ac.uk/QuickGO/services/ontology/go/terms/'+chosen.map(a=>a.goId).join(','))).results;
    for (const item of chosen) {
      const id='G'+(Object.keys(sources).length+1), ref=item.reference||'';
      sources[id]={go_id:item.goId,term:terms.find(t=>t.id===item.goId)?.name||item.goId,aspect:aspects[category],evidence:item.goEvidence||item.evidenceCode,qualifier:item.qualifier,reference:ref,publication:ref.startsWith('PMID:')?'https://pubmed.ncbi.nlm.nih.gov/'+ref.slice(5)+'/':null,url:'https://www.ebi.ac.uk/QuickGO/annotations?'+new URLSearchParams({geneProductId:'UniProtKB:'+accession,goId:item.goId})};
    }
  }
      return sources;
    },
  },
};

async function mcp(message) {
  const {id, method, params} = message;
  let result;
  if (method === 'initialize') {
    result = {protocolVersion:'2025-03-26', capabilities:{tools:{}}, serverInfo:{name:'proteome',version:'1.0.0'}};
  } else if (method === 'tools/list') {
    result = {tools:Object.entries(tools).map(([name,{description,inputSchema}]) => ({name,description,inputSchema}))};
  } else if (method === 'tools/call' && Object.hasOwn(tools, params?.name ?? '')) {
    try {
      const data = await tools[params.name].run(params.arguments ?? {});
      result = {content:[{type:'text', text:JSON.stringify(data)}]};
    } catch (error) {
      result = {isError:true,content:[{type:'text',text:error.message}]};
    }
  } else {
    return {jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}};
  }
  return {jsonrpc:'2.0',id,result};
}

async function callTool(name, args) {
  const {result} = await mcp({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}});
  const text = result.content[0].text;
  if (result.isError) throw Error(text);
  return JSON.parse(text);
}

async function chat(payload, env, send) {
  const question = (payload.question || '').trim(), selected=payload.model;
  if (!question || question.length > 2000 || !models.has(selected)) throw Error('Проверьте вопрос и модель.');
  const context={question,previous_question:String(payload.previous||'').slice(-8500)};
  const style='Отвечай на языке вопроса пользователя, по существу, без лишнего представления. Учитывай историю диалога.';
  send({stage:'Разбираю вопрос'});
  const raw=await model(env,selected,style+' Определи действие и верни только JSON. Для приветствия, общего вопроса или объяснения уже сказанного верни {"intent":"reply","answer":"содержательный ответ"}. Для вопроса о конкретном белке или гене человека, требующего поиска, верни {"intent":"search","query":"символ гена или английское название белка","focus":["function","process","location"]}. В focus укажи только нужные категории. Общий вопрос о генах сопровождай примерами.',context);
  let parsed;
  try { parsed = parseDecision(raw); } catch { throw Error('Модель вернула ответ в неверном формате. Попробуйте ещё раз.'); }
  if (parsed.intent==='reply' && parsed.answer) return {answer:parsed.answer,sources:{}};
  if(parsed.intent!=='search' || !parsed.query) return {answer:'Уточните название белка или символ гена.',sources:{}};
  send({trace:'Агент чата → UniProt · найти белок «'+parsed.query+'»'});
  const searchPlan = parseDecision(await model(env,selected,
    'Ты агент UniProt. Выбери запрос в UniProtKB по символу гена или английскому названию белка. Верни только JSON {"query":"...","field":"gene или protein"}. Сохраняй точный символ, если он указан.',
    {...context,target:parsed.query}));
  const q = typeof searchPlan.query === 'string' && searchPlan.query.trim() ? searchPlan.query.trim() : String(parsed.query);
  const searchArgs = {query:q,field:searchPlan.field === 'protein' ? 'protein' : 'gene'};
  send({trace:'UniProt · uniprot_search('+searchArgs.field+': '+q+')'});
  const entries = await callTool('uniprot_search',searchArgs);
  if (!entries.length) return {answer:'Запись для «'+q+'» не найдена.',sources:{}};
  if (entries.length > 1) return {answer:'Найдено несколько записей: '+entries.map(e=>e.primaryAccession).join(', ')+'. Уточните название белка.',sources:{}};
  const entry=entries[0], accession=entry.primaryAccession;
  const text=(entry.comments||[]).filter(c=>c.commentType==='FUNCTION').flatMap(c=>c.texts||[]).map(t=>t.value).join(' ');
  const sources={U1:{text,url:'https://www.uniprot.org/uniprotkb/'+accession+'/entry'}};
  send({trace:'UniProt → Gene Ontology · передана запись '+accession});
  const goPlan = parseDecision(await model(env,selected,
    'Ты агент Gene Ontology. По вопросу выбери нужные аспекты GO. Верни только JSON {"focus":["function","process","location"]}, оставив только относящиеся к вопросу аспекты. Если GO не нужен, верни пустой список.',
    {...context,accession,uniprot: text,requested:parsed.focus}));
  const focus = Array.isArray(goPlan.focus) ? goPlan.focus.filter(category=>Object.hasOwn(aspects,category)) : [];
  if (focus.length) {
    send({trace:'Gene Ontology · quickgo_annotations('+accession+', '+focus.join(', ')+')'});
    Object.assign(sources, await callTool('quickgo_annotations',{accession,focus}));
    send({trace:'Gene Ontology → Агент чата · аннотаций '+(Object.keys(sources).length-1)});
  } else {
    send({trace:'Gene Ontology → Агент чата · для вопроса достаточно UniProt'});
  }
  send({stage:'Готовлю ответ со ссылками'});
  try {
    let answer=await model(env,selected,style+' Используй только переданные записи. После каждого факта укажи отдельную метку [U1] или [G1]. Учитывай значение qualifier. Если данных не хватает, скажи об этом.',{...context,records:sources});
    answer=answer.replace(/\[([UG]\d+(?:,\s*[UG]\d+)+)\]/g,(_,ids)=>ids.split(',').map(id=>'['+id.trim()+']').join(' '));
    const tags=[...answer.matchAll(/\[([UG]\d+)\]/g)].map(m=>m[1]);
    if (!tags.length || tags.some(id=>!sources[id])) throw Error('Модель вернула некорректные ссылки.');
    return {answer,sources,accession};
  } catch(e) { return {answer:'Ответ модели недоступен. '+e.message+'\nНайденные записи доступны ниже.',sources,accession}; }
}
export default {async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==='GET' && url.pathname==='/') return new Response(page,{headers:{'Content-Type':'text/html; charset=utf-8'}});
  if (request.method === 'POST' && url.pathname === '/mcp') {
    const message = await request.json();
    if (message.method?.startsWith('notifications/')) return new Response(null,{status:202});
    return Response.json(await mcp(message));
  }
  if(request.method==='POST' && url.pathname==='/chat') {
    const {readable,writable}=new TransformStream(), writer=writable.getWriter(), encoder=new TextEncoder();
    (async()=>{try {const payload=await request.json(); await chat(payload,env,event=>writer.write(encoder.encode(JSON.stringify(event)+'\n'))).then(result=>writer.write(encoder.encode(JSON.stringify({result})+'\n')));} catch(e){await writer.write(encoder.encode(JSON.stringify({error:e.message})+'\n'));} finally {await writer.close();}})();
    return new Response(readable,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'}});
  }
  return new Response('Not found',{status:404});
}};
