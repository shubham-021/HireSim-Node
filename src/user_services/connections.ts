import WebSocket, { RawData } from "ws";
import PeerConnection from "./rtc";
import { def_script } from "../script";
import { Entity } from "./entity";

type Message = {
    type: string,
    data: any
}

export class Connection{
    private ws:WebSocket;
    private pc:PeerConnection;
    private entity:Entity;
    private script!:string;
    private userInputResolver: ((input: string) => void) | null = null;

    constructor(ws:WebSocket){
        this.ws = ws;
        this.pc = new PeerConnection();
        this.entity = new Entity();

        this.ws.on("message", (msg) => this.handleMessage(msg));
        this.ws.on("close", () => this.cleanup());
        this.ws.on("error", (err) => console.error("WS error:", err));
    }

    async startInterview(script:string){
        await this.entity.invoke_graph(
            script,
            (llmMsg) => this.getUserInput(llmMsg),
        )
        // this.ws.send(JSON.stringify({ type: "end", data: "Interview finished" }));
    }

    getUserInput(llmResponse:string):Promise<string>{
        this.ws.send(JSON.stringify({ type: "ai_message", data: llmResponse }));
        return new Promise((resolve) => {
            this.userInputResolver = resolve;
        });

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
                    this.script = await def_script(data);
                    this.ws.send(JSON.stringify({ type: "init", data: "success" }));
                } catch {
                    this.ws.send(JSON.stringify({ type: "init", data: "error" }));
                }
                break;

            case 'begin':
                // console.log(data);
                this.startInterview(this.script);
                break;
            
            case 'user_reply':
                if(this.userInputResolver){
                    this.userInputResolver(data);
                    this.userInputResolver = null;
                }
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