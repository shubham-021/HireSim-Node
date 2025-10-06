import { nonstandard, RTCPeerConnection , RTCIceCandidate} from "@roamhq/wrtc";

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

    async set_icecandidate(candidate: RTCIceCandidate){
        await this.pc.addIceCandidate(candidate);
    }

    set_offer(offer:RTCSessionDescriptionInit){
        this.pc.setRemoteDescription(offer);
    }

    async create_answer() : Promise<RTCSessionDescriptionInit>{
        const answer = await this.pc.createAnswer();
        this.pc.setLocalDescription(answer);

        if(!this.pc.localDescription){
            throw new Error("Local description not set")
        }

        return this.pc.localDescription.toJSON();
    }

    pushOpus(opusPacket: Uint8Array, timestamp: number, duration: number) {
        const sender = this.pc.getSenders().find(s => s.track === this.audioTrack);

        if (!sender) {
            console.warn("No sender found for audio track");
            return;
        }

        if (!("sendEncodedAudio" in sender)) {
            console.warn("sendEncodedAudio not supported — build missing encoded transforms");
            return;
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

    close() {
        this.audioTrack.stop();
        this.pc.close();
    }
}

export default PeerConnection;