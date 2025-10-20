import WebSocket, { RawData } from "ws";
import PeerConnection from "./rtc";
import { def_script } from "../script";
import { Entity } from "./entity";
import db from "./db";

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
    private userId :string|null = null;
    private role : string|null = null;

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
        const messages = await this.entity.invoke_graph(
            script,
            (llmMsg) => this.getUserInput(llmMsg),
        )
        this.ws.send(JSON.stringify({ type: "end_of_interview" }));
        const {success , payload} = await this.storeResult(messages);
        // this.ws.send(JSON.stringify({type: 'result' , data:result}));
        const data = (success) ? {type:'complete' , data:payload} : {type:'interview_error' , data:payload};
        this.ws.send(JSON.stringify(data));
        this.pc.close();
    }

    private async storeResult(messages:any){
        try {
            const result = await this.entity.results(messages);
            if(!this.userId || !this.role) throw new Error("No userId found/ or Empty role")
            const score = Number((result.reduce((score , sec) => score + sec.score , 0) / result.length).toFixed(1));
            const res = await db.interview.create({
                data:{
                    userId : this.userId,
                    role: this.role,
                    score,
                    responses:{
                        create: result.map(r => ({
                            question : r.question,
                            answer: r.answer,
                            score: r.score,
                            remark: r.remark
                        }))
                    }
                }
            })
            return {success: true , payload: res.id};
        } catch (error) {
            console.log(`UserId : ${this.userId} , Role: ${this.role}`);
            return {success: false , payload:"Storing result failed"};
        }
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
                    const {userId , resumeId , role} = data;
                    this.userId = userId;
                    this.role = role;

                    const resume = await db.resume.findFirst({where:{id:resumeId}});
                    if(!resume) throw new Error(`No resume found with id: ${resumeId}`);

                    this.script = await def_script(resume.content,role);
                    // console.log(this.script);
                    this.ws.send(JSON.stringify({ type: "init", data: "success" }));
                } catch(err) {
                    this.ws.send(JSON.stringify({ type: "init", data: err}));
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