import 'dotenv/config';
import express from "express";
import cors from 'cors';
import multer from "multer";
import PdfParse from "pdf-parse";
import { requireAuth } from '@clerk/express';
import { verifyUser } from "../auth/helper";
import { clerkClient } from '@clerk/express';
import db from '../user_services/db';

const app = express();
app.use(cors());

const upload = multer();

app.post("/api/upload/resume", requireAuth(), upload.single('file'), async (req, res) => {
    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        // if(user.privateMetadata.dbUserId){
        //     await clerkClient.users.updateUserMetadata(user.id, {
        //         privateMetadata: {}
        //     });
        // }

        // console.log(user.privateMetadata)

        if (!user.privateMetadata.dbUserId) {
            console.log("here")
            const newUser = await db.user.create({
                data: {
                    authid: user.id,
                    authProvider: user.externalAccounts[0].provider,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.emailAddresses[0]?.emailAddress,
                    phone: user.externalAccounts[0]?.phoneNumber
                },
                select: { id: true }
            });

            await clerkClient.users.updateUserMetadata(user.id, {
                privateMetadata: { dbUserId: newUser.id }
            });
        }

        console.log(user.privateMetadata.dbUserId)

        const file = req.file;
        if (!file || file.mimetype !== "application/pdf") {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        const data = await PdfParse(file.buffer);
        const text = data.text;

        const user_id = user.privateMetadata.dbUserId as string;

        const id = await db.resume.create({
            data: { userId: user_id, content: text },
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

        res.sendStatus(200).json({response: data});
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

        res.sendStatus(200).json({data});
    }catch(error){
        res.sendStatus(400);
    }
})

export default app;
