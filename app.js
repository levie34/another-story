(() => {
"use strict";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const csrf = $('meta[name="csrf-token"]')?.content || "";
const toast = $('#toast');
let toastTimer;
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),3200); }
const store = {
  get(key, fallback=null) { try { const v=localStorage.getItem(key); return v===null?fallback:JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { notify("This browser's local storage is full. Try removing a few gallery photos."); } }
};
let visitorId = store.get("cls_visitor_id");
if (!visitorId || typeof visitorId !== "string" || !/^[a-f0-9-]{16,100}$/i.test(visitorId)) {
  visitorId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);
  store.set("cls_visitor_id", visitorId);
}
const state = { answer:"", vibeScore:null, activities:[], preferredDate:"", budget:"", locationPreference:"Surprise me", dateNotes:"", songTitle:"", songArtist:"", dedication:"", letterReaction:"" };
let saveQueue = Promise.resolve();
async function postJSON(url, payload) {
  const response = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json","X-CSRF-Token":csrf}, body:JSON.stringify({...payload, visitor_id:visitorId})});
  const data = await response.json().catch(()=>({ok:false,error:"The server response was not readable."}));
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not save right now.");
  return data;
}
function saveResponse(extra={}) {
  const payload = {...state, ...extra, visitor_id:visitorId};
  saveQueue = saveQueue.then(()=>postJSON("/api/response", payload)).catch(err=>{notify(err.message || "Could not save your response. Please try again.");});
  return saveQueue;
}
$('#year').textContent = new Date().getFullYear();
$('#beginBtn').addEventListener('click', ()=>$('#letter').scrollIntoView({behavior:'smooth'}));
const openLetter = () => {
  const reveal=$('#letterReveal'); reveal.hidden=false;
  $('#envelope').classList.add('opened');
  reveal.classList.remove('letter-pop'); void reveal.offsetWidth; reveal.classList.add('letter-pop');
  confetti(26); reveal.scrollIntoView({behavior:'smooth',block:'nearest'});
};
$('#openLetter').addEventListener('click',openLetter); $('#envelope').addEventListener('click',openLetter);
$$('[data-letter-reaction]').forEach(btn=>btn.addEventListener('click',async()=>{
  state.letterReaction=btn.dataset.letterReaction; await saveResponse(); notify("Your reaction was sent with care. 💗");
  $$('[data-letter-reaction]').forEach(b=>b.classList.toggle('selected',b===btn));
}));
const clues=[
 {symbol:"✧",title:"Every story has a beginning…",text:"I'm full of tiny moments, messages, and things you might want to remember. What am I?",answers:[["A memory box","memory"],["A mirror","mirror"],["A cloud","cloud"]],correct:"memory",success:"Exactly! A memory box keeps little moments close. First clue found. 💌"},
 {symbol:"☾",title:"I glow when the world gets quiet.",text:"I can light up a night sky, but you can't hold me in your hands. What am I?",answers:[["A candle","candle"],["The moon","moon"],["A streetlamp","lamp"]],correct:"moon",success:"That's it — the moon! A calm little moment can feel magical. 🌙"},
 {symbol:"♡",title:"The final treasure is a feeling.",text:"It grows when it's freely given, feels safe when respected, and never needs to be forced. What is it?",answers:[["A perfect score","score"],["Kindness and care","care"],["A secret password","password"]],correct:"care",success:"Treasure found: kindness, honesty, and a choice that's truly yours. 💖"}
];
let clueIndex=0, clueSolved=[false,false,false];
function renderClue() {
 const c=clues[clueIndex]; $('#clueSymbol').textContent=c.symbol; $('#clueStepLabel').textContent=`CLUE ${String(clueIndex+1).padStart(2,'0')} / 03`;
 $('#cluePercent').textContent=`${Math.round(clueSolved.filter(Boolean).length/3*100)}%`; $('#huntProgress').style.width=`${clueSolved.filter(Boolean).length/3*100}%`;
 $('#clueTitle').textContent=c.title; $('#clueText').textContent=c.text; $('#clueFeedback').textContent=""; $('#clueEyebrow').textContent=clueIndex===2?"THE FINAL TREASURE":"A SMALL MYSTERY";
 $('#clueOptions').innerHTML=c.answers.map(([label,value])=>`<button type="button" data-answer="${value}">${label}</button>`).join("");
 $$('#clueOptions button').forEach(btn=>btn.addEventListener('click',()=>{
   if(btn.dataset.answer===c.correct){clueSolved[clueIndex]=true; $('#clueFeedback').textContent=c.success; $('#clueFeedback').className="inline-feedback good"; $$('#clueOptions button').forEach(b=>b.disabled=true); $('#nextClue').hidden=false; $('#nextClue').textContent=clueIndex===2?"Celebrate the treasure ✨":"Next clue →"; $('#huntProgress').style.width=`${clueSolved.filter(Boolean).length/3*100}%`; $('#cluePercent').textContent=`${Math.round(clueSolved.filter(Boolean).length/3*100)}%`; if(clueIndex===2) confetti(45);}
   else {$('#clueFeedback').textContent="Not quite — take another guess. No rush. ✨"; $('#clueFeedback').className="inline-feedback";}
 }));
 $('#nextClue').hidden=!clueSolved[clueIndex];
}
$('#nextClue').addEventListener('click',()=>{if(clueIndex<2){clueIndex++;renderClue();}else{notify("You found the real treasure: kindness with no pressure. 💖");$('#no-pressure').scrollIntoView({behavior:'smooth'});}});
renderClue();

const vibeAnswers={};
$$('[data-q]').forEach(btn=>btn.addEventListener('click',()=>{
 const q=btn.dataset.q; vibeAnswers[q]=btn.dataset.value;
 $$(`[data-q="${q}"]`).forEach(b=>b.classList.toggle('selected',b===btn));
}));
$('#scoreVibe').addEventListener('click',async()=>{
 if(Object.keys(vibeAnswers).length<4){notify("Pick one answer in each of the four questions first.");return;}
 const vals=Object.values(vibeAnswers);
 const variety=new Set(vals).size; const base=65 + Math.round((variety-1)*6) + (vals.filter(v=>["cozy","deep","soft","adapt"].includes(v)).length%3)*4;
 state.vibeScore=Math.max(68,Math.min(98,base)); $('#vibeScore').innerHTML=`${state.vibeScore}<small>/100</small>`; $('#scoreBar').style.width=`${state.vibeScore}%`;
 $('#scoreMessage').textContent=state.vibeScore>=90?"Sparkly energy detected. This is a fun score — real connection is built one conversation at a time. ✨":"A sweet little mix of vibes. Different tastes can make a great story too. 💗";
 await saveResponse(); confetti(20);
});
$('#dateForm').addEventListener('submit',async e=>{
 e.preventDefault(); state.preferredDate=$('#preferredDate').value; state.budget=$('#budget').value; state.locationPreference=$('#locationPreference').value; state.dateNotes=$('#dateNotes').value;
 state.activities=$$('input[name="activity"]:checked').map(x=>x.value);
 try { const d=await postJSON("/api/response", {...state,visitor_id:visitorId}); $('#dateFeedback').textContent=d.message; $('#dateFeedback').className="inline-feedback good"; notify("Your date ideas have been saved. ♡"); }
 catch(err){$('#dateFeedback').textContent=err.message;$('#dateFeedback').className="inline-feedback";}
});
$('#dedicationForm').addEventListener('submit',async e=>{
 e.preventDefault(); state.songTitle=$('#songTitle').value.trim(); state.songArtist=$('#songArtist').value.trim(); state.dedication=$('#dedication').value.trim();
 if(!state.songTitle && !state.dedication){notify("Add a song title or write a dedication first.");return;}
 try {await saveResponse(); $('#musicFeedback').textContent="Your song dedication was saved. 🎵";$('#musicFeedback').className="inline-feedback good";notify("A song has been dedicated. 🎶");}
 catch(err){$('#musicFeedback').textContent=err.message;}
});
$('#yesBtn').addEventListener('click',()=>setAnswer("Yes — I'd love to","That sounds lovely. Thank you for being honest about what you want. 💗"));
$('#maybeBtn').addEventListener('click',()=>setAnswer("Maybe — let's talk","A conversation is a lovely place to start. No rush, no pressure. 💌"));
$('#noBtn').addEventListener('click',()=>setAnswer("No, thank you","Thank you for being honest. Your no is respected, completely and without hard feelings. 💜"));
async function setAnswer(answer,message){state.answer=answer;$('#answerFeedback').textContent=message;$('#answerFeedback').className="inline-feedback good";try{await saveResponse();}catch{} if(answer.startsWith("Yes"))confetti(35);notify("Your choice has been recorded respectfully.");}
$('#refreshMessages').addEventListener('click',loadMessages);
$('#messageForm').addEventListener('submit',async e=>{
 e.preventDefault();const body=$('#messageBody').value.trim();if(!body)return;
 try{const res=await postJSON("/api/messages",{visitor_id:visitorId,body});$('#messageBody').value="";$('#chatFeedback').textContent=res.message;$('#chatFeedback').className="inline-feedback good";await loadMessages();}catch(err){$('#chatFeedback').textContent=err.message;$('#chatFeedback').className="inline-feedback";}
});
async function loadMessages(){
 try{const r=await fetch(`/api/messages?visitor_id=${encodeURIComponent(visitorId)}`,{cache:"no-store"});const data=await r.json();if(!data.ok)throw new Error(data.error);const box=$('#chatMessages');if(!data.messages.length){box.innerHTML='<div class="chat-empty">Your conversation will appear here. A little hello is a good start. 💌</div>';return;}
 box.innerHTML=data.messages.map(m=>`<div class="chat-bubble ${m.sender==='admin'?'received':'sent'}"><p>${escapeHTML(m.body)}</p><time>${new Date(m.created_at).toLocaleString()}</time></div>`).join("");box.scrollTop=box.scrollHeight;
 }catch(err){$('#chatFeedback').textContent="Couldn't load messages right now. Try again in a moment.";}
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
loadMessages(); setInterval(loadMessages,45000);

const companionLines=[
 "Psst… tiny reminder: you can be brave and gentle at the same time. 💗",
 "Hydration check! Even main characters need water. 💧",
 "A good connection feels safe, kind, and free to choose. ✨",
 "Plot twist: being yourself is already a pretty good superpower. 🪄",
 "If you're nervous, take a breath. No one needs a perfect line. 🌷",
 "The best memories are often simple: a walk, a laugh, and being present. 🌙"
];let companionIndex=0;
$('#companionToggle').addEventListener('click',()=>{$('#companionBubble').hidden=!$('#companionBubble').hidden;});
$('#closeCompanion').addEventListener('click',()=>$('#companionBubble').hidden=true);
$('#companionNext').addEventListener('click',()=>{companionIndex=(companionIndex+1)%companionLines.length;$('#companionText').textContent=companionLines[companionIndex];});
const audio={ctx:null,playing:false,timer:null,step:0};
const notes=[523.25,659.25,783.99,659.25,587.33,698.46,880,698.46,523.25,659.25,783.99,987.77,880,783.99,659.25,587.33];
function playNote(freq,duration=.28){if(!audio.ctx)return;const osc=audio.ctx.createOscillator(),gain=audio.ctx.createGain();osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(.0001,audio.ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.07,audio.ctx.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.0001,audio.ctx.currentTime+duration);osc.connect(gain);gain.connect(audio.ctx.destination);osc.start();osc.stop(audio.ctx.currentTime+duration+.03);}
$('#playMusic').addEventListener('click',async()=>{
 if(audio.playing){audio.playing=false;clearInterval(audio.timer);$('#playMusic').textContent="▶";$('#musicStatus').textContent="Paused";$('#vinyl').classList.remove('spinning');$('.music-bars').classList.remove('playing');return;}
 try{const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error();audio.ctx=audio.ctx||new AudioContext();await audio.ctx.resume();}catch{$('#musicStatus').textContent="Audio isn't supported in this browser.";return;}
 audio.playing=true;$('#playMusic').textContent="Ⅱ";$('#musicStatus').textContent="Playing your mini melody";$('#vinyl').classList.add('spinning');$('.music-bars').classList.add('playing');
 const tick=()=>{playNote(notes[audio.step%notes.length]);audio.step++;if(audio.step>=notes.length){audio.playing=false;clearInterval(audio.timer);$('#playMusic').textContent="▶";$('#musicStatus').textContent="A little melody, just for you";$('#vinyl').classList.remove('spinning');$('.music-bars').classList.remove('playing');}};tick();audio.timer=setInterval(tick,360);
});
const memoryKey="cls_memories";let memories=store.get(memoryKey,[]);
function renderMemories(){const gallery=$('#memoryGallery');if(!memories.length){gallery.innerHTML='<div class="memory-placeholder"><span>✧</span><b>Your first memory goes here.</b><p>Choose a photo to start your own tiny gallery.</p></div>';return;}gallery.innerHTML=memories.map((m,i)=>`<article class="memory-card"><img src="${m.src}" alt="${escapeHTML(m.caption||'A saved memory')}" loading="lazy"><div><p>${escapeHTML(m.caption||'A little moment')}</p><button type="button" data-remove-memory="${i}" class="remove-memory">Remove</button></div></article>`).join("");$$('[data-remove-memory]').forEach(btn=>btn.addEventListener('click',()=>{memories.splice(Number(btn.dataset.removeMemory),1);store.set(memoryKey,memories);renderMemories();}));}
$('#memoryUpload').addEventListener('change',async e=>{
 const files=[...e.target.files].slice(0,8);for(const file of files){if(!file.type.startsWith('image/'))continue;if(file.size>1.5*1024*1024){notify(`${file.name} is over 1.5 MB. Choose a smaller photo.`);continue;}
 try{const data=await compressImage(file);memories.unshift({src:data,caption:file.name.replace(/\.[^.]+$/,'').slice(0,80),createdAt:new Date().toISOString()});}catch{notify("That photo couldn't be added.");}}
 store.set(memoryKey,memories);renderMemories();e.target.value="";
});
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.78));};img.src=reader.result;};reader.readAsDataURL(file);});}
renderMemories();
const timelineKey="cls_timeline";let timelineItems=store.get(timelineKey,[]);
function renderTimeline(){const root=$('#timeline');const built=timelineItems.map((m,i)=>`<div class="timeline-item"><span class="timeline-dot"></span><small>${escapeHTML(m.date||'A LITTLE MOMENT')}</small><h3>${escapeHTML(m.title)}</h3><p>${escapeHTML(m.note||'Saved on this device.')}</p><button class="remove-memory" data-remove-timeline="${i}">Remove</button></div>`).join("");root.innerHTML=`<div class="timeline-item"><span class="timeline-dot"></span><small>THE BEGINNING</small><h3>The day this surprise was made</h3><p>A little courage became a little website.</p></div>${built}<div class="timeline-item"><span class="timeline-dot"></span><small>THE NEXT CHAPTER</small><h3>A memory waiting to happen</h3><p>Maybe a walk, a laugh, or a story you tell later.</p></div>`;$$('[data-remove-timeline]').forEach(btn=>btn.addEventListener('click',()=>{timelineItems.splice(Number(btn.dataset.removeTimeline),1);store.set(timelineKey,timelineItems);renderTimeline();}));}
$('#addMilestone').addEventListener('click',()=>{const title=prompt("Name this little moment:");if(!title||!title.trim())return;const note=prompt("Add a short note (optional):")||"";const date=prompt("Date or chapter (optional):")||new Date().toLocaleDateString();timelineItems.push({title:title.trim().slice(0,100),note:note.slice(0,240),date:date.slice(0,50)});store.set(timelineKey,timelineItems);renderTimeline();});renderTimeline();

function confetti(count=25){const layer=$('#confetti');const symbols=["♥","✦","♡","✧","❀"];for(let i=0;i<count;i++){const el=document.createElement('span');el.textContent=symbols[Math.floor(Math.random()*symbols.length)];el.style.left=`${Math.random()*100}%`;el.style.animationDuration=`${2+Math.random()*2}s`;el.style.fontSize=`${10+Math.random()*16}px`;layer.appendChild(el);setTimeout(()=>el.remove(),4300);}}
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').hidden=false;});
$('#installBtn').addEventListener('click',async()=>{if(!installPrompt){notify("Use your browser menu and choose Add to Home Screen / Install app.");return;}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').hidden=true;});
if('serviceWorker' in navigator && location.protocol!=="file:") navigator.serviceWorker.register('/sw.js').catch(()=>{});
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduceMotion){setInterval(()=>{if(Math.random()>.45){const h=document.createElement('span');h.className='sky-heart';h.textContent=Math.random()>.5?'♡':'✦';h.style.left=`${Math.random()*100}%`;h.style.animationDuration=`${7+Math.random()*7}s`;document.body.appendChild(h);setTimeout(()=>h.remove(),15000);}},1800);}
})();