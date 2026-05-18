const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const uuid = require("node-uuid"); // Ensure 'npm install node-uuid' is run

// 1. Hardcoded Credentials for Testing
const AUTH_CREDENTIALS = {
  username: "Admin",
  password: "Password123",
};

// 2. HTTP File Server Layer
const server = http.createServer((req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204, { "Content-Type": "image/x-icon" });
    return res.end();
  }
  fs.readFile(path.join(__dirname, "client4.html"), (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Missing index.html file.");
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

// 3. WebSocket Engine Layer
const wss = new WebSocketServer({ server });
let clients = [];

function wsBroadcast(type, client_uuid, nickname, message) {
  clients.forEach((client) => {
    // Only broadcast to clients who have successfully authenticated
    if (client.ws.readyState === WebSocket.OPEN && client.authenticated) {
      client.ws.send(
        JSON.stringify({ type, id: client_uuid, nickname, message }),
      );
    }
  });
}

let clientIndex = 1;

wss.on("connection", function (ws) {
  const client_uuid = uuid.v4();
  // Store connection state, initialized as unauthenticated
  const clientState = {
    id: client_uuid,
    ws: ws,
    nickname: "Guest",
    authenticated: false,
  };
  clients.push(clientState);

  ws.on("message", function (message) {
    try {
      const data = JSON.parse(message.toString());

      // Handle Authentication Messages
      if (data.type === "login_attempt") {
        if (
          data.username === AUTH_CREDENTIALS.username &&
          data.password === AUTH_CREDENTIALS.password
        ) {
          clientState.authenticated = true;
          clientState.nickname = data.username + "_" + clientIndex++;

          ws.send(
            JSON.stringify({
              type: "auth_success",
              nickname: clientState.nickname,
              message: "Authentication successful!",
            }),
          );

          wsBroadcast(
            "notification",
            client_uuid,
            "System",
            `${clientState.nickname} joined the chat.`,
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "auth_failure",
              message: "Invalid credentials.",
            }),
          );
        }
        return;
      }

      // Block chat processing if client tries to send messages without authenticating
      if (!clientState.authenticated) {
        ws.send(
          JSON.stringify({
            type: "notification",
            message: "System: Please log in first.",
          }),
        );
        return;
      }

      // Handle Chat Custom Nicknames
      if (data.type === "chat_message" && data.message.indexOf("/nick") === 0) {
        const nickname_array = data.message.split(" ");
        if (nickname_array.length >= 2) {
          const old_nickname = clientState.nickname;
          clientState.nickname = nickname_array.slice(1).join(" ");
          wsBroadcast(
            "nick_update",
            client_uuid,
            clientState.nickname,
            `${old_nickname} changed to ${clientState.nickname}`,
          );
        }
      } else if (data.type === "chat_message") {
        wsBroadcast("message", client_uuid, clientState.nickname, data.message);
      }
    } catch (e) {
      console.error("Invalid payload format received");
    }
  });

  ws.on("close", function () {
    const index = clients.findIndex((c) => c.id === client_uuid);
    if (index !== -1) {
      if (clients[index].authenticated) {
        wsBroadcast(
          "notification",
          client_uuid,
          "System",
          `${clients[index].nickname} left the chat.`,
        );
      }
      clients.splice(index, 1);
    }
  });
});

server.listen(8181, () =>
  console.log("Authenticated Chat Server active on port 8181"),
);
