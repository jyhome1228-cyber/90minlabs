'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
test('unconfigured Firebase never downloads a remote SDK or fabricates a session',async()=>{
 const client=await import(pathToFileURL(path.join(root,'assets/firebase-client.js')).href);
 assert.equal(client.isFirebaseConfigured(),false);
 assert.equal(await client.getFirebaseAuthServices(),null);
 assert.equal(await client.getFirebaseAccountServices(),null);
});
test('header and My Page use one shared Firebase client rather than separate initializers',()=>{
 const client=fs.readFileSync(path.join(root,'assets/firebase-client.js'),'utf8');
 const shell=fs.readFileSync(path.join(root,'assets/site-shell.js'),'utf8');
 const account=fs.readFileSync(path.join(root,'assets/account.js'),'utf8');
 assert.match(client,/appSdk\.getApps\(\)\.find/);
 assert.match(client,/appSdk\.initializeApp\(firebaseConfig\)/);
 assert.match(client,/let authPromise = null/);
 assert.match(client,/let accountPromise = null/);
 assert.match(shell,/getFirebaseAuthServices\(\)/);
 assert.match(account,/getFirebaseAccountServices\(\)/);
 assert.doesNotMatch(shell,/appSdk\.initializeApp/);
 assert.doesNotMatch(account,/initializeApp\(config\)/);
});
