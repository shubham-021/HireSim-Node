import { nonstandard, RTCPeerConnection , RTCSessionDescription } from "@roamhq/wrtc";

class PeerConnection{
    private pc:RTCPeerConnection;
    private audioSource: nonstandard.RTCAudioSource;
    private audioTrack: MediaStreamTrack;

    constructor(){
        this.pc = new RTCPeerConnection();
        this.audioSource = new nonstandard.RTCAudioSource();
        this.audioTrack = this.audioSource.createTrack();
        this.pc.addTrack(this.audioTrack);
    }

    set_offer(offer:RTCSessionDescription){
        this.pc.setRemoteDescription(offer);
    }

    async create_answer() : Promise<RTCSessionDescriptionInit | null>{
        const answer = await this.pc?.createAnswer();
        this.pc.setLocalDescription(answer);
        return this.pc.localDescription;
    }

    pushOpus(opusPacket: Uint8Array, timestamp: number, duration: number) {
        const sender = this.pc.getSenders().find(s => s.track === this.audioTrack);

        if (!sender || !("sendEncodedAudio" in sender)) {
            throw new Error("sendEncodedAudio not supported in this build");
        }

        (sender as any).sendEncodedAudio({
            data: opusPacket,
            timestamp,
            duration,
        });
    }

    getConnection() {
        return this.pc;
    }
}

export default PeerConnection;