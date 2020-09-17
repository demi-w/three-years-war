var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
const PORT = process.env.PORT || 5000

var queueList = [];
var matchC = 0;
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/scale.html')
});


io.on('connection', (socket) => {
  socket.on("QueueRequest", () =>{
    if(queueList.length > 0){
      let roomName = "match " + matchC.toString()
      socket.join(roomName)
      queueList[0].join(roomName)
      socket.matchID = roomName
      queueList[0].matchID = roomName
      let randOrder = Math.random() > 0.5
      let rngseed = new Date().toString()
      socket.emit("matchStart",randOrder,rngseed)
      queueList[0].emit("matchStart",1 - randOrder,rngseed)
      queueList.splice(0, 1);
      matchC++;
    }else{
      queueList.push(socket)
    }
    update();
  })
  socket.on("button", (type) => {
    socket.to(socket.matchID).emit("button",type)
  })
  socket.on("decision", (type,tile) => {
    socket.to(socket.matchID).emit("decision",type,tile)
  })
  socket.on('disconnecting', () => {
    leaveQueue(socket)
    if(Object.keys(socket.rooms).length > 1){
      leaveGame(socket)
    }
    update();
  });
  socket.on('notqueueing', () => {
    leaveQueue(socket)
    update();
  })
  socket.on("leftgame", () => {
    leaveGame(socket)
    console.log(matchC.toString() + " match" + (matchC != 1 ? "es" : "") + " running.")
    matchC--;
    update();
  })
});
function leaveQueue(socket){
  for(var i = 0; i < queueList.length; i++){
    if(queueList[i] == socket){
      queueList.splice(i, 1);
    }
  }
}
function leaveGame(socket){
  socket.to(Object.keys(socket.rooms)[1]).emit("matchClosed")
}
http.listen(PORT, () => {
  console.log('listening on *:' + PORT.toString());
});
function update(){
  console.clear()
  //console.log(io.sockets.length.toString() + " users connected")
  if(queueList.length > 0){
    console.log("Someone in queue")
  }else{
    console.log("No one in queue")
  }
}
update();