import WebSocket, { RawData } from "ws";
import PeerConnection from "./rtc";
import { def_script } from "../script";

type Message = {
    type: string,
    data: any
}

export class Connection{
    private ws:WebSocket;
    private pc:PeerConnection;

    constructor(ws:WebSocket){
        this.ws = ws;
        this.pc = new PeerConnection();

        this.ws.on("message", (msg) => this.handleMessage(msg));
        this.ws.on("close", () => this.cleanup());
        this.ws.on("error", (err) => console.error("WS error:", err));
    }

    async handleMessage(msg:RawData){
        const str = msg.toString();
        let message;
        try{
            message = JSON.parse(str);
        }catch(error){
            this.ws.send(JSON.stringify({type:"error",data:"Invalid JSON"}))
        }

        const {type , data} = message;

        switch (type) {
            case 'init':
                try {
                    const script = await def_script(data);
                    this.ws.send(JSON.stringify({ type: "init", data: "success" }));
                } catch {
                    this.ws.send(JSON.stringify({ type: "init", data: "error" }));
                }
                break;

            case 'begin':
                console.log(data);
                break;

            case 'offer':
                try {
                    this.pc.set_offer(data);
                    const answer = await this.pc.create_answer();
                    this.ws.send(JSON.stringify({type:"answer",data:answer}));
                } catch (err) {
                    console.error("Error handling offer:", err);
                    this.ws.send(JSON.stringify({ type: "error", data: "Failed to process offer" }));
                }
                break;
                
            default:
                console.log("Unknown message type:", type);
        }
    }

    cleanup(){
        this.pc.getConnection().close();
    }
}