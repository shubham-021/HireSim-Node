import 'dotenv/config';
import multer from "multer";
import PdfParse from "pdf-parse";
import { requireAuth } from '@clerk/express';
import { verifyUser } from "./auth/helper";
import { clerkClient } from '@clerk/express';
import storeUser from './auth/user';
import db from './user_services/db';
import app from "./app";
import imagekit from './user_services/imagekit';
import { v4 as uuidv4 } from 'uuid';

const upload = multer();

app.post("/api/create" , requireAuth() , async (req,res) => {
    try {
        let user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });
        console.log(user);

        const idFromDB = await db.user.findFirst({where:{authid:user.id}});
    
        if (!idFromDB) {
            console.log("here")
            const res = await db.user.create({
                data: {
                    authid: user.id,
                    authProvider: user.externalAccounts?.[0]?.provider ?? 'credentials',
                    userName: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.emailAddresses[0]?.emailAddress,
                    phone: user.externalAccounts[0]?.phoneNumber ?? null
                }
            });
            console.log("DB entry created for user with id: ",res.id);
        }
    } catch (error) {
        console.log("Error in user.ts" , error);
        res.status(401).json({error: 'Error while dealing with user data'});
    }
});

app.post("/api/upload/resume", requireAuth() , upload.single('file'), async (req, res) => {
    try {
        const user = await verifyUser(req);
        if(!user) throw new Error("No user found");
        const authid = user.id

        const acc_file = req.file;
        if (!acc_file || acc_file.mimetype !== "application/pdf") {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        const data = await PdfParse(acc_file.buffer);
        const text = data.text;

        // const user_id = user.privateMetadata.dbUserId as string;
        const user_id = await db.user.findFirst({where: {authid} , select:{id:true}});

        if(!user_id) return res.status(401).json({error: "No user found"});

        const uuid = uuidv4();

        // correct this
        const response = await imagekit.upload({
            file: acc_file.buffer,
            fileName: uuid,
            folder: `${user_id.id}/${uuid}`
        })

        console.log(`Uploaded with these details: ${{
                id:uuid, 
                userId: user_id.id,
                originalName: acc_file.filename,
                url:response.url,
                thumbnailUrl:response.thumbnailUrl,
                content: text 
            }}`);

        const {id} = await db.resume.create({
            data: {
                id:uuid, 
                userId: user_id.id,
                originalName: acc_file.filename,
                url:response.url,
                thumbnailUrl:response.thumbnailUrl,
                content: text 
            },
            select: { id: true }
        });

        res.status(200).json({ success: "file uploaded on db", id });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Uploading Failed" });
    }
});

app.get('/api/get/resumes/list', requireAuth(), async (req, res) => {

    // expected response: 
    //id: string;
    //name: string;
    //uploadedAt: string;
    //imagekitUrl: string;
    //thumbnailUrl?: string;

    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const resumes = await db.resume.findMany({
            where: { user: { authid: user.id } },
            select:{
                id:true,
                originalName: true,
                url: true,
                thumbnailUrl: true,
                uploadedAt: true
            }
        });

        if (!resumes) return res.status(400).json({ error: "Can't find any resume" });

        res.status(200).json({ resumes });
    } catch (error) {
        console.log(error);
        res.status(400).json({ error: "Can't find any resume" });
    }
});

app.get('/api/resumes/:resumeId', requireAuth(), async(req,res)=>{
    try {
        const {resumeId} = req.params;
        if(!resumeId) throw new Error("Invalid resume id");

        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const resume = await db.resume.findFirst({
            where:{
                id: resumeId,
                user:{
                    authid: user.id
                }
            }
        })

        if(!resume) throw new Error("No resume found");

        res.status(200).json({text:resume});
    } catch (error) {
        console.log("Error /api/resumes" , error);
        res.status(400).json({error:"Fetching resume failed"})
    }
})

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

