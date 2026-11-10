import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Método indisponível.'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return json({error:'Entre na sua conta.'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:{user},error}=await admin.auth.getUser(token);if(error||!user)return json({error:'Sessão inválida.'},401);
  const {action,confirmation}=await req.json();
  if(action==='export'){
   const data:Record<string,unknown>={exported_at:new Date().toISOString(),email:user.email};
   const tables:Record<string,string>={profiles:'id',profile_settings:'user_id',user_library:'user_id',reading_progress:'user_id',reading_sessions:'user_id',bookmarks:'user_id',highlights:'user_id',reading_notes:'user_id',posts:'user_id',post_comments:'user_id',post_reactions:'user_id',reviews:'user_id',messages:'user_id',audio_progress:'user_id',user_follows:'follower_id',user_blocks:'user_id',club_members:'user_id',books:'owner_id',book_clubs:'owner_id',notifications:'user_id'};
   for(const [table,key] of Object.entries(tables)){const all:unknown[]=[];for(let start=0;;start+=500){const {data:rows,error}=await admin.from(table).select('*').eq(key,user.id).range(start,start+499);if(error)throw error;all.push(...(rows||[]));if((rows?.length||0)<500)break;}data[table]=all;}
   return json(data);
  }
  if(action==='delete'&&confirmation==='EXCLUIR'){
   for(const bucket of ['book-files','book-covers','profile-images','message-attachments','audiobook-files']){
    async function clean(prefix:string){const {data:items,error}=await admin.storage.from(bucket).list(prefix,{limit:1000});if(error)throw error;const files:string[]=[];for(const x of items||[]){const p=prefix+'/'+x.name;if(x.id)files.push(p);else await clean(p);}if(files.length){const {error}=await admin.storage.from(bucket).remove(files);if(error)throw error;}if((items?.length||0)>=1000)await clean(prefix);}
    await clean(user.id);
   }
   await admin.auth.admin.signOut(token,'global');const {error}=await admin.auth.admin.deleteUser(user.id);if(error)throw error;return json({ok:true});
  }
  return json({error:'Ação inválida.'},400);
 }catch{return json({error:'Não foi possível concluir a solicitação. Nenhuma conclusão foi confirmada.'},400);}
});
