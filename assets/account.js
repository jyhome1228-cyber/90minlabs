/* Optional Firebase Auth + Firestore account layer. Configure assets/firebase-config.js first. */
const $=id=>document.getElementById(id);
const key="90minlabs.predictionSets.v1";
const msg=t=>{$("accountMessage").textContent=t||"";};
const status=t=>{$("accountStatus").textContent=t;};
const scope=t=>{$("storageScope").textContent=t;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let auth,db,user=null,remoteRevision=null,connected=false,busy=false;
let initializeApp,getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,updateProfile,getFirestore,doc,getDoc,runTransaction;
function local(){const raw=localStorage.getItem(key);return raw?PredictionStore.createStore(localStorage).load():{version:1,revision:0,sets:[]};}
function replaceLocal(value){const verified=validate(value);const old=localStorage.getItem(key);if(old!==null)localStorage.setItem("90minlabs.account-backup."+Date.now(),old);localStorage.setItem(key,JSON.stringify(verified));window.NinetyMinPage?.reloadRecords();}
function validate(data){const temp=new Map();const storage={getItem:k=>temp.get(k)??null,setItem:(k,v)=>temp.set(k,v)};temp.set(key,JSON.stringify(data));return PredictionStore.createStore(storage).load();}
function docRef(){return doc(db,"users",user.uid,"private","predictions");}
function showSignedOut(message){$("accountPanel").hidden=false;user=null;connected=false;remoteRevision=null;window.NinetyMinPage?.setAccountMode(false);$("accountSignout").hidden=true;$("accountAuth").hidden=false;$("accountConnected").hidden=true;status(message||"로그인하면 계정별 기록을 여러 기기에서 이용할 수 있습니다.");scope("로그인 전 기록은 이 브라우저에만 저장됩니다.");}
function showSignedIn(u){$("accountPanel").hidden=false;$("accountSignout").hidden=false;$("accountAuth").hidden=true;$("accountConnected").hidden=false;$("accountDisplay").textContent=(u.displayName||u.email)+" · "+u.email;status("로그인됨");}
function syncMessage(t){$("accountSyncStatus").textContent=t;}
async function attach(u){
 user=u;connected=false;window.NinetyMinPage?.setAccountMode(false);showSignedIn(u);syncMessage("계정 기록 확인 중…");
 try{
  const snapshot=await getDoc(docRef()),cloud=snapshot.exists()?validate(snapshot.data().payload):{version:1,revision:0,sets:[]};
  remoteRevision=snapshot.exists()?snapshot.data().cloudRevision:0;
  if(!Number.isSafeInteger(remoteRevision)||remoteRevision<0)throw Error("서버 기록 버전을 확인할 수 없습니다.");
  const device=local();
  if(device.sets.length && cloud.sets.length && JSON.stringify(device.sets)!==JSON.stringify(cloud.sets)){
   syncMessage("기기 기록과 계정 기록이 다릅니다. 기존 기록을 보호하기 위해 자동으로 합치지 않았습니다. 기록 가져오기를 눌러 병합해 주세요.");return;
  }
  if(cloud.sets.length&&!device.sets.length)replaceLocal(cloud);
  connected=true;window.NinetyMinPage?.setAccountMode(true);
  syncMessage(cloud.sets.length?"계정 기록 연결됨 · "+cloud.sets.length+"개 폴더":"계정 연결됨 · 첫 기록 저장 시 동기화됩니다.");
 }catch(e){syncMessage("동기화 실패 · 브라우저 기록은 유지됩니다. "+e.message);}
}
async function push(){
 if(!user||!connected||busy)return;
 busy=true;
 try{
  const payload=local(),expected=remoteRevision;
  const next=await runTransaction(db,async transaction=>{
   const ref=docRef(),snapshot=await transaction.get(ref);
   const actual=snapshot.exists()?snapshot.data().cloudRevision:0;
   if(actual!==expected)throw Error("다른 기기에서 기록이 변경됐습니다. 계정 기록을 새로고침한 뒤 확인해 주세요.");
   transaction.set(ref,{payload,cloudRevision:actual+1,updatedAt:new Date().toISOString()});return actual+1;
  });
  remoteRevision=next;syncMessage("계정에 저장됨 · "+new Date().toLocaleString("ko-KR"));
 }catch(e){connected=false;window.NinetyMinPage?.setAccountMode(false);syncMessage("계정 저장 실패 · 이 기기에는 기록이 남아 있습니다. "+e.message);}
 finally{busy=false;}
}
async function importLocal(){
 if(!user||busy)return;
 if(window.NinetyMinPage?.isDirty())return msg("작성 중인 예측을 먼저 저장해 주세요.");
 busy=true;
 try{
  const device=local(),ref=docRef();
  const result=await runTransaction(db,async transaction=>{
   const snap=await transaction.get(ref);
   const cloud=snap.exists()?validate(snap.data().payload):{version:1,revision:0,sets:[]};
   const revision=snap.exists()?snap.data().cloudRevision:0;
   const byId=new Map(cloud.sets.map(set=>[set.id,set]));
   let conflicts=0,added=0;
   for(const set of device.sets){
    if(!byId.has(set.id)){byId.set(set.id,set);added++;}
    else if(JSON.stringify(byId.get(set.id))!==JSON.stringify(set))conflicts++;
   }
   if(conflicts)throw Error("같은 폴더 ID에 다른 기록이 "+conflicts+"개 있습니다. 자동 덮어쓰기를 중단했습니다. CSV로 먼저 백업해 주세요.");
   const merged={version:1,revision:Math.max(cloud.revision,device.revision)+1,sets:[...byId.values()]};
   transaction.set(ref,{payload:merged,cloudRevision:revision+1,updatedAt:new Date().toISOString()});
   return {merged,revision:revision+1,added};
  });
  remoteRevision=result.revision;replaceLocal(result.merged);connected=true;window.NinetyMinPage?.setAccountMode(true);
  syncMessage("계정에 기록 "+result.merged.sets.length+"개 연결됨 · 새로 추가 "+result.added+"개");
 }catch(e){syncMessage("가져오기 중단 · 기존 기록 유지: "+e.message);}
 finally{busy=false;}
}
async function refresh(){
 if(!user)return; if(window.NinetyMinPage?.isDirty())return msg("작성 중인 예측을 먼저 저장해 주세요.");
 await attach(user);
}
function fail(e){const codes={"auth/invalid-credential":"이메일 또는 비밀번호를 확인해 주세요.","auth/email-already-in-use":"이미 가입된 이메일입니다.","auth/weak-password":"비밀번호를 8자 이상으로 설정해 주세요.","auth/invalid-email":"이메일 형식을 확인해 주세요.","auth/too-many-requests":"요청이 많습니다. 잠시 후 다시 시도해 주세요."};msg(codes[e.code]||e.message||"요청을 처리하지 못했습니다.");}
async function execute(action){
 if(!auth)return;
 const email=$("accountEmail").value.trim(),password=$("accountPassword").value;
 if(!email)return msg("이메일을 입력해 주세요.");
 msg("");
 try{
  if(action==="reset"){await sendPasswordResetEmail(auth,email);return msg("비밀번호 재설정 메일을 보냈습니다.");}
  if(password.length<8)return msg("비밀번호를 8자 이상 입력해 주세요.");
  if(action==="register"){
   const nick=$("accountNickname").value.trim();
   if(!nick){$("accountNicknameWrap").hidden=false;return msg("닉네임을 입력한 뒤 회원가입을 다시 눌러 주세요.");}
   const created=await createUserWithEmailAndPassword(auth,email,password);
   await updateProfile(created.user,{displayName:nick});return;
  }
  await signInWithEmailAndPassword(auth,email,password);
 }catch(e){fail(e);}
}
function disabled(message){
  const loginRequested=new URLSearchParams(location.search).get("login")==="1";
  const panel=$("accountPanel");
  panel.hidden=!loginRequested;
  status(loginRequested?"로그인 서비스 준비 중입니다. 현재는 브라우저에 저장한 예측 기록을 이용할 수 있습니다.":message);
  scope("계정 서비스 설정 전에는 기존 브라우저 저장 기능을 사용할 수 있습니다.");
  $("accountAuth").hidden=true;$("accountConnected").hidden=true;$("accountSignout").hidden=true;
  if(loginRequested&&location.hash==="#accountPanel"){
    requestAnimationFrame(()=>panel.scrollIntoView({block:"start"}));
  }
}
async function start(){
 let config;
 try{const module=await import("./firebase-config.js");config=module.firebaseConfig;}catch(e){disabled("계정 연결 준비 중 · Firebase 설정이 필요합니다.");return;}
 if(!config?.apiKey||!config?.projectId||!config?.authDomain){disabled("계정 연결 준비 중 · Firebase 프로젝트 설정을 확인해 주세요.");return;}
 try{
   // The public demo has no Firebase project connected yet. Avoid loading the heavy SDK until configured.
   const [appSdk,authSdk,storeSdk]=await Promise.all([
     import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
     import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
     import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js")
   ]);
   ({initializeApp}=appSdk);
   ({getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,updateProfile}=authSdk);
   ({getFirestore,doc,getDoc,runTransaction}=storeSdk);
   const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);
 }catch(e){disabled("계정 초기화 실패: "+e.message);return;}
 $("accountLogin").addEventListener("click",()=>execute("login"));
 $("accountRegister").addEventListener("click",()=>execute("register"));
 $("accountReset").addEventListener("click",()=>execute("reset"));
 $("accountSignout").addEventListener("click",async()=>{try{await signOut(auth);}catch(e){fail(e);}});
 $("accountImport").addEventListener("click",importLocal);
 $("accountSync").addEventListener("click",refresh);
 window.addEventListener("ninetymin:local-change",push);
 onAuthStateChanged(auth,u=>u?attach(u):showSignedOut());
}
start();
