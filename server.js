
const express=require("express");
const http=require("http");
const {Server}=require("socket.io");

const app=express();
const server=http.createServer(app);
const io=new Server(server);

app.use(express.static("public"));

let players={};
let words=[];
let activeWords=[];
let shownWords=[];
let gameRunning=false;
let nextId=1;
let spawnTimer=null;

function rankings(){
 return Object.values(players).sort((a,b)=>b.score-a.score);
}

function broadcast(){
 io.emit("players",rankings());
 io.emit("playerList",Object.values(players).map(p=>p.name));
}

function spawnBatch(){

 if(!gameRunning || words.length===0) return;

 const count=3+Math.floor(Math.random()*3); // 3~5 words at once

 for(let i=0;i<count;i++){

  const w=words[Math.floor(Math.random()*words.length)];

  const speeds=[
   {speed:0.08,points:2},
   {speed:0.12,points:4},
   {speed:0.16,points:6},
   {speed:0.22,points:10}
  ];

  const t=speeds[Math.floor(Math.random()*speeds.length)];

  const obj={
   id:nextId++,
   word:w.word,
   meaning:w.meaning,
   speed:t.speed,
   points:t.points,
   x:Math.random()*85+5
  };

  activeWords.push(obj);

  if(!shownWords.find(x=>x.word===obj.word)){
    shownWords.push(obj);
  }

  io.emit("spawnWord",obj);
 }

 spawnTimer=setTimeout(spawnBatch,2000);
}

io.on("connection",(socket)=>{

 socket.on("join",(name)=>{
  players[socket.id]={name:name||"학생",score:0,streak:0};
  broadcast();
 });

 socket.on("setWords",(list)=>{
  words=list;
 });

 socket.on("startGame",()=>{

  gameRunning=true;
  activeWords=[];
  shownWords=[];

  for(let id in players){
   players[id].score=0;
   players[id].streak=0;
  }

  broadcast();
  spawnBatch();

 });

 socket.on("answer",(text)=>{

  if(!gameRunning) return;

  const found=activeWords.find(w=>w.meaning===text);
  if(!found) return;

  activeWords=activeWords.filter(w=>w.id!==found.id);

  const p=players[socket.id];

  let pts=found.points;

  p.streak++;

  let combo="";
  if(p.streak>=3){ pts+=2; combo="🔥3 COMBO!" }
  if(p.streak>=5){ pts+=4; combo="🔥🔥5 COMBO!" }
  if(p.streak>=7){ pts+=6; combo="🔥🔥🔥7 COMBO!" }

  p.score+=pts;

  io.emit("wordSolved",{
    id:found.id,
    player:p.name,
    points:pts,
    combo:combo
  });

  broadcast();

 });

 socket.on("endGame",()=>{

  gameRunning=false;
  clearTimeout(spawnTimer);

  io.emit("gameEnded",{
   rankings:rankings(),
   words:shownWords
  });

 });

 socket.on("disconnect",()=>{
  delete players[socket.id];
  broadcast();
 });

});

server.listen(3000,()=>console.log("Word Rain v13 running"));
