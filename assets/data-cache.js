/* 90MIN LABS: shared data loader for GitHub Pages.
 * In-flight requests are deduplicated, and recently checked JSON survives page navigation
 * in the same browser tab. Entries expire after three minutes and are refetched on demand.
 * This cache does not claim live scores or bypass source update schedules. */
(function (root) {
  "use strict";
  const PREFIX="90minlabs.data-cache.v1:";
  const DEFAULT_TTL=3*60*1000;
  const MAX_STORED_BYTES=1900000;
  const memory=new Map();
  const inflight=new Map();
  const validPath=path=>String(path||"").replace(/^\.\//,"").replace(/^\/+/,"");
  function canonical(path) {
    const name=validPath(path);
    if (!/^data\/[a-z0-9][a-z0-9._/-]*\.json$/i.test(name) || name.includes("..")) throw new Error("Unsupported data path");
    return name;
  }
  function read(name,ttl) {
    const item=memory.get(name);
    if(item && Date.now()-item.at<ttl)return item.data;
    try{
      const raw=sessionStorage.getItem(PREFIX+name);
      if(!raw)return null;
      const value=JSON.parse(raw);
      if(!value || !value.data || !Number.isFinite(value.at) || Date.now()-value.at>=ttl)return null;
      memory.set(name,value);
      return value.data;
    }catch(e){return null;}
  }
  function store(name,data) {
    const item={at:Date.now(),data};
    memory.set(name,item);
    try{
      const serialized=JSON.stringify(item);
      if(serialized.length<MAX_STORED_BYTES)sessionStorage.setItem(PREFIX+name,serialized);
    }catch(e){} // private mode and quota restrictions never block data loading
    return data;
  }
  async function get(path,options) {
    const name=canonical(path),opts=options||{};
    const ttl=Number.isFinite(opts.ttlMs)?Math.max(0,opts.ttlMs):DEFAULT_TTL;
    if(!opts.force){
      const saved=read(name,ttl);
      if(saved)return saved;
    }
    if(inflight.has(name))return inflight.get(name);
    const request=(async()=>{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),Number.isFinite(opts.timeoutMs)?opts.timeoutMs:15000);
      try{
        const response=await fetch("./"+name,{cache:"no-cache",signal:controller.signal});
        if(!response.ok)throw new Error(name+" HTTP "+response.status);
        const value=await response.json();
        if(!value || typeof value!=="object")throw new Error(name+" invalid JSON");
        return store(name,value);
      }finally{clearTimeout(timer);}
    })();
    inflight.set(name,request);
    try{return await request;}finally{if(inflight.get(name)===request)inflight.delete(name);}
  }
  root.NinetyMinData=Object.freeze({get});
})(window);
