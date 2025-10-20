import { createServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import app from './app'
import './routes'
import { Connection } from "./user_services/connections";

const server = createServer(app);
const wss = new WebSocketServer({noServer:true});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, null);
  });
});


wss.on('connection', (ws: WebSocket, user: any) => {
    console.log("Client Connected");
    const conn = new Connection(ws);
});

// server.on('upgrade', async (req, socket, head) => {
//     try {
//         const url = new URL(req.url!, `http://${req.headers.host}`);
//         const token = url.searchParams.get("token");
//         const user = await verifyUserWithToken(token);
//         if (!user) {
//             socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
//             socket.destroy();
//             return;
//         }

//         wss.handleUpgrade(req, socket, head, (ws) => {
//             wss.emit('connection', ws, user);
//         });
//     } catch {
//         socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
//         socket.destroy();
//     }
// });

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`HTTP + WS server running on port ${PORT}`);
});


export default wss;