const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const uuid = require("node-uuid");

// 1 the first function added for ?
// 1. HTTP layer to serve the chat layout safely to remote links
const server = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204, { "Content-Type": "image/x-icon" });
    return res.end();
  }

  fs.readFile(path.join(__dirname, "client3.html"), (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Missing index.html file in this directory.");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

//the second one
const wss = new WebSocketServer({ server }); 
var clients = [];

function wsSend(type, client_uuid, nickname, message) {
  for (var i = 0; i < clients.length; i++) {
    var clientSocket = clients[i].ws;
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          type: type,
          id: client_uuid,
          nickname: nickname,
          message: message,
        }),
      );
    }
  }
}
var clientIndex = 1;
wss.on("connection", function (ws) {
  var client_uuid = uuid.v4();
  var nickname = "AnonymousUser" + clientIndex;
  clientIndex += 1;
  clients.push({ id: client_uuid, ws: ws, nickname: nickname });
  console.log("client [%s] connected", client_uuid);

  var connect_message = nickname + " has connected";
  wsSend("notification", client_uuid, nickname, connect_message);

  ws.on("message", function (message) {
    var messageString = message.toString();
    if (messageString.indexOf("/nick") === 0) {
      var nickname_array = messageString.split(" ");
      if (nickname_array.length >= 2) {
        var old_nickname = nickname;
        nickname = nickname_array[1];
        var nickname_message =
          "Client " + old_nickname + " changed to " + nickname;
        wsSend("nick_update", client_uuid, nickname, nickname_message);
      }
    } else {
      wsSend("message", client_uuid, nickname, messageString);
    }
  });

  var closeSocket = function (customMessage) {
    for (var i = 0; i < clients.length; i++) {
      if (clients[i].id == client_uuid) {
        var disconnect_message;
        if (customMessage) {
          disconnect_message = customMessage;
        } else {
          disconnect_message = nickname + " has disconnected";
        }
        wsSend("notification", client_uuid, nickname, disconnect_message);
        clients.splice(i, 1);
      }
    }
  };
  ws.on("close", function () {
    closeSocket();
  });
  process.on("SIGINT", function () {
    console.log("Closing things");
    closeSocket("Server has disconnected");
    process.exit();
  });
});
