import 'dotenv/config';
import multer from "multer";
import PdfParse from "pdf-parse";
import { requireAuth } from '@clerk/express';
import { verifyUser } from "./auth/helper";
import { clerkClient } from '@clerk/express';
import storeUser from './auth/user';
import db from './user_services/db';
import app from "./app";

const upload = multer();

app.post("/api/create" , requireAuth() , storeUser);

app.post("/api/upload/resume", requireAuth(), storeUser , upload.single('file'), async (req, res) => {
    try {
        const authid = (req as any).authid;

        const file = req.file;
        if (!file || file.mimetype !== "application/pdf") {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        const data = await PdfParse(file.buffer);
        const text = data.text;

        // const user_id = user.privateMetadata.dbUserId as string;
        const user_id = await db.user.findFirst({where: {authid} , select:{id:true}});

        if(!user_id) return res.status(401).json({error: "No user found"});

        const id = await db.resume.create({
            data: { userId: user_id.id, content: text },
            select: { id: true }
        });

        res.status(200).json({ success: "file uploaded on db", id });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Uploading Failed" });
    }
});

app.get('/api/get/resume', requireAuth(), async (req, res) => {
    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const resume = await db.resume.findFirst({
            where: { user: { authid: user.id } },
            select: { content: true }
        });

        if (!resume) return res.status(400).json({ error: "Can't find any resume" });

        res.status(200).json({ text: resume });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Can't find any resume" });
    }
});

app.get('interview/result/:id' , requireAuth() , async (req,res)=>{
    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const id = req.params.id;

        const data = await db.interview.findFirst({
            where:{
                id,
                userId:user.id
            },
            select:{
                responses:true
            }
        })

        res.status(200).json({response: data});
    } catch (error) {
        res.sendStatus(400);
    }
})

app.get('interview/all' , requireAuth() , async (req,res)=>{
    try{
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const data = await db.user.findFirst({
            where:{id:user.id},
            select:{
                interview: true
            }
        })

        if(!data) throw new Error("No data found");

        res.status(200).json({data});
    }catch(error){
        res.status(400).json({data:"No data found"});
    }
})

