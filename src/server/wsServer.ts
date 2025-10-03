import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { def_script } from "../script";
import httpApp from "./httpServer";
import { verifyUser } from "../auth/helper";
import PeerConnection from "../user_services/rtc";
import { Connection } from "../user_services/connections";

const server = createServer(httpApp);
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket, user: any) => {
    const conn = new Connection(ws);
});

server.on('upgrade', async (req, socket, head) => {
    try {
        const user = await verifyUser(req as any);
        if (!user) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, user);
        });
    } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
    }
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`HTTP + WS server running on port ${PORT}`);
});
