import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
process.env.ALLOWED_ORIGINS='http://127.0.0.1:4099'; process.env.NODE_ENV='test';
fs.mkdirSync('artifacts', { recursive: true });
for(const key of Object.keys(process.env)) if(/SUPABASE|GMAIL|GEMINI/.test(key)) delete process.env[key];
const {server}=await import('../backend/src/server.js');
await new Promise((resolve,reject)=>server.listen(4099,'127.0.0.1',resolve).on('error',reject));
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9349','--user-data-dir='+path.resolve('artifacts/browser-check-profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
 let pages;
 for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:9349/json')).json();break;}catch{await delay(250);}}
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let seq=0;const pending=new Map();const errors=[];
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);} if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 await send('Page.enable');await send('Runtime.enable');
 const results=[];
 for(const width of [390,1366]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  for(const route of ['/','/dat-kham/bac-si','/dat-kham/chuyen-khoa','/dat-kham/bac-si/midhealth-demo-minh-an','/dang-nhap','/dang-ky','/admin','/nhan-vien','/tai-khoan/lich-kham','/thong-tin/lien-he','/danh-cho-bac-si','/dat-kham/bac-si/%E0%A4%A']){
   await send('Page.navigate',{url:'http://127.0.0.1:4099'+route});await delay(900);
   const state=await send('Runtime.evaluate',{expression:JSON.stringify('')+' || JSON.stringify({title:document.querySelector("h1")?.textContent,width:innerWidth,scroll:document.documentElement.scrollWidth,hero:document.querySelector(".clinic-hero")?getComputedStyle(document.querySelector(".clinic-hero")).backgroundColor:null,body:document.body.innerText.slice(0,200)})',returnByValue:true});
   results.push({width,route,...JSON.parse(state.result.value)});
   if(route==='/' && [390,1366].includes(width)){const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/verified-home-'+width+'.png',Buffer.from(img.data,'base64'));}
   if(route==='/dang-nhap' && width===1366){const img=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/verified-login-1366.png',Buffer.from(img.data,'base64'));}
  }
 }
 fs.writeFileSync('artifacts/verified-browser-results.json',JSON.stringify({results,errors},null,2));
 const overflow = results.filter(r=>r.scroll>r.width);
 console.log(JSON.stringify({pages:results.length,errors,overflow},null,2));
 const doctorRouteBroken = results.some(r=>r.route==='/danh-cho-bac-si' && (!r.body?.includes('Đăng nhập') || r.body.includes('HTTP ERROR 404')));
 if(errors.length || overflow.length || doctorRouteBroken) process.exitCode=1;
 await send('Browser.close');
}finally{ws?.close();edge.kill();server.closeAllConnections();server.close();}
