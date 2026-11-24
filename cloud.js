(()=>{'use strict';
const $=s=>document.querySelector(s), api=window.LifeQuest, config=window.LIFEQUEST_CLOUD||{};
const valid=config.url?.startsWith('https://')&&!config.url.includes('SEU-PROJETO')&&config.anonKey&&!config.anonKey.startsWith('COLE_');
const client=valid&&window.supabase?.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});
let user=null, busy=false, muted=false, timer=null, lastSerialized='', lastRemoteRevision=null;
const syncLabel=$('#cloud-last-sync');
function syncStamp(){const time=new Date();try{localStorage.setItem('lifequest-last-cloud-sync',time.toISOString())}catch{};if(syncLabel)syncLabel.textContent='Última sincronização: '+time.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}
function restoreStamp(){try{const saved=localStorage.getItem('lifequest-last-cloud-sync');if(saved&&syncLabel)syncLabel.textContent='Última sincronização: '+new Date(saved).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}catch{}}
restoreStamp();
const status=msg=>{$('#cloud-status').textContent=msg}, pushStatus=msg=>{$('#push-status').textContent=msg};
function localData(){return JSON.parse(JSON.stringify(api.getState()))}
function mark(){lastSerialized=JSON.stringify(localData())}
async function loadCloud(){if(!user)return;const {data,error}=await client.from('lifequest_states').select('data,revision').eq('user_id',user.id).maybeSingle();if(error)throw error;
 if(data){muted=true;try{api.replaceState(data.data)}finally{muted=false}lastRemoteRevision=data.revision;mark();syncStamp();status('Sincronizado: dados carregados da nuvem.')}else{lastRemoteRevision=null;await upload(true);status('Primeiro backup enviado à nuvem.')}}
async function upload(initial=false){if(!user||busy)return;busy=true;try{
 const current=localData();let q;
 if(lastRemoteRevision===null){q=client.from('lifequest_states').insert({user_id:user.id,data:current,revision:1}).select('revision').single()}
 else {q=client.from('lifequest_states').update({data:current,revision:lastRemoteRevision+1,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('revision',lastRemoteRevision).select('revision').maybeSingle()}
 const {data,error}=await q;if(error)throw error;if(!data){status('Alteração em outro dispositivo. Clique em Sincronizar agora para carregar a versão da nuvem.');return}
 lastRemoteRevision=data.revision;mark();syncStamp();status('Alterações salvas na nuvem.');
 }catch(e){status('Falha ao enviar: '+e.message)}finally{busy=false}}
function scheduleUpload(){if(!user||muted)return;clearTimeout(timer);timer=setTimeout(()=>upload(),1200)}
window.addEventListener('lifequest:local-save',scheduleUpload);
async function refresh(){if(!user||busy)return;try{const {data,error}=await client.from('lifequest_states').select('revision,data').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data)return;
 if(data.revision!==lastRemoteRevision){if(JSON.stringify(localData())!==lastSerialized){status('Existem alterações locais e remotas. Exporte seu backup JSON antes de sincronizar.');return}muted=true;try{api.replaceState(data.data)}finally{muted=false}lastRemoteRevision=data.revision;mark();syncStamp();status('Dados atualizados de outro dispositivo.')}}catch(e){status('Falha na atualização: '+e.message)}}
async function authUI(){const {data:{user:u}}=await client.auth.getUser();user=u;$('#cloud-login-form').hidden=!!user;$('#cloud-logout').hidden=!user;$('#cloud-sync').hidden=!user;if(user){status('Conectado: '+user.email);await loadCloud()}else status('Entre ou crie sua conta para sincronizar.')}
function urlBase64ToUint8Array(base64){const padding='='.repeat((4-base64.length%4)%4),base64safe=(base64+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64safe);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function enablePush(){if(!user)throw Error('Entre na sua conta primeiro.');if(!config.vapidPublicKey||config.vapidPublicKey.startsWith('COLE_'))throw Error('Configure a chave pública VAPID.');if(!('PushManager'in window)||!('serviceWorker'in navigator))throw Error('Push indisponível neste navegador. No iPhone, use iOS 16.4+ e abra pelo ícone da tela inicial.');if(Notification.permission==='denied')throw Error('Notificações bloqueadas nas configurações do dispositivo.');const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Permissão não concedida.');const registration=await navigator.serviceWorker.ready;let subscription=await registration.pushManager.getSubscription();if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(config.vapidPublicKey)});
 const {error}=await client.from('lifequest_push_subscriptions').upsert({user_id:user.id,endpoint:subscription.endpoint,subscription:subscription.toJSON()},{onConflict:'user_id,endpoint'});if(error)throw error;pushStatus('Push ativado neste dispositivo.');}
async function disablePush(){const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();if(subscription){if(user)await client.from('lifequest_push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',subscription.endpoint);await subscription.unsubscribe()}pushStatus('Push desativado neste dispositivo.')}
if(!client){status('Nuvem desativada: configure js/cloud-config.js com URL e chave pública do Supabase.');pushStatus('Aguardando configuração.');return}
$('#cloud-login-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const {error}=await client.auth.signInWithPassword({email:f.elements.email.value,password:f.elements.password.value});if(error)status(error.message);else await authUI()});
$('#cloud-signup').onclick=async()=>{const f=$('#cloud-login-form');if(!f.reportValidity())return;const {error}=await client.auth.signUp({email:f.elements.email.value,password:f.elements.password.value});status(error?error.message:'Cadastro solicitado. Verifique seu e-mail, se a confirmação estiver ativada.')};
$('#cloud-logout').onclick=async()=>{clearTimeout(timer);await client.auth.signOut();user=null;lastRemoteRevision=null;status('Sessão encerrada. Os dados locais continuam neste navegador.');$('#cloud-login-form').hidden=false;$('#cloud-sync').hidden=true;$('#cloud-logout').hidden=true};
$('#cloud-sync').onclick=async()=>{if(!user)return;if(JSON.stringify(localData())!==lastSerialized)await upload();else await refresh()};
$('#cloud-push').onclick=async()=>{try{await enablePush()}catch(e){pushStatus(e.message)}};
$('#cloud-push-off').onclick=async()=>{try{await disablePush()}catch(e){pushStatus(e.message)}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});setInterval(()=>{if(!document.hidden)refresh()},60000);
authUI().catch(e=>status('Erro de conexão: '+e.message));
})();
