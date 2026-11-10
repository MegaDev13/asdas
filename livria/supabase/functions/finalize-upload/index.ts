import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {PDFDocument} from 'npm:pdf-lib@1.17.1';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Método indisponível.'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return json({error:'Entre na sua conta.'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:{user},error}=await admin.auth.getUser(token);if(error||!user)return json({error:'Sessão inválida.'},401);
  const {book_id}=await req.json();if(typeof book_id!=='string')return json({error:'Livro inválido.'},400);
  const {data:b}=await admin.from('books').select('*').eq('id',book_id).eq('owner_id',user.id).eq('status','draft').single();if(!b)return json({error:'Rascunho indisponível.'},403);
  const {data:file,error:downloadError}=await admin.storage.from('book-files').download(b.pdf_path);if(downloadError||!file)return json({error:'Envie o arquivo antes de concluir.'},400);
  if(file.size>20971520)return json({error:'PDF acima de 20 MB.'},400);const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return json({error:'O arquivo não é um PDF.'},400);
  let pages:number;try{pages=(await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount();}catch{return json({error:'PDF inválido ou protegido por senha. Exporte uma cópia sem senha.'},400);}
  if(pages<1)return json({error:'Documento sem páginas.'},400);
  const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const {error:saveError}=await admin.from('books').update({sha256:hash,pages,status:b.visibility==='community'?'pending':'approved'}).eq('id',book_id).eq('status','draft');
  if(saveError)return json({error:saveError.code==='23505'?'Este PDF já existe na biblioteca. Procure o título ou use sua cópia existente.':'Não foi possível concluir a validação.'},400);
  return json({ok:true,pages,status:b.visibility==='community'?'pending':'approved'});
 }catch{return json({error:'Não foi possível validar o arquivo.'},400);}
});
