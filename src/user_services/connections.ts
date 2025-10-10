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
    private script:string|null = null;
    private userInputResolver: ((input: string) => void) | null = null;

    constructor(ws:WebSocket){
        this.ws = ws;
        this.pc = new PeerConnection();
        this.entity = new Entity();

        this.ws.on("message", (msg) => this.handleMessage(msg));
        this.ws.on("close", () => this.cleanup());
        this.ws.on("error", (err) => console.error("WS error:", err));


        const pcInstance = this.pc.getConnection();
        pcInstance.onicecandidate = (event) => {
            if(event.candidate){
                this.ws.send(JSON.stringify({type:'IceCandidate' , data:event.candidate}));
            }
        }
    }

    async startInterview(script:string){
        await this.entity.invoke_graph(
            script,
            (llmMsg) => this.getUserInput(llmMsg),
        )
        this.ws.send(JSON.stringify({ type: "end_of_interview" }));
        this.pc.close();
    }

    async getUserInput(llmResponse:string):Promise<string>{
        try {
            await this.entity.stream_audio(llmResponse , this.pc , this.ws);
            this.ws.send(JSON.stringify({type:"Unmute"}));
        } catch(error) {
            console.error('Audio streaming error:', error);
        }
        
        return new Promise((resolve) => {
            this.userInputResolver = resolve;
        });
    }

    async handleMessage(msg:RawData){
        const str = msg.toString();
        let message:Message;
        try{
            message = JSON.parse(str);
        }catch(error){
            this.ws.send(JSON.stringify({type:"error",data:"Invalid JSON"}));
            return;
        }

        const {type , data} = message;

        switch (type) {
            case 'init':
                try {
                    console.log("Received init");
                    this.script = await def_script(data);
                    // console.log(this.script);
                    this.ws.send(JSON.stringify({ type: "init", data: "success" }));
                } catch {
                    this.ws.send(JSON.stringify({ type: "init", data: "error" }));
                }
                break;

            case 'begin':
                // console.log(data);
                console.log("got begin trigger");
                if(!this.script) {
                    this.ws.send(JSON.stringify({ type: "error", data: "Script not initialized" }));
                    return;
                }

                try {
                    // console.log(this.script);
                    await this.startInterview(this.script);
                } catch(error) {
                    console.error('Interview error:', error);
                    this.ws.send(JSON.stringify({ type: "error", data: "Interview failed" }));
                }
                break;
            
            case 'user_response':
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

            case 'IceCandidate':
                try{
                    this.pc.set_icecandidate(data);
                }catch(err){
                    console.log('Failed to add icecandidate: ',err);
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