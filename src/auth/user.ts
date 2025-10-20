import { NextFunction, Request, Response } from "express";
import { verifyUser } from "./helper";
import db from "../user_services/db";
import { clerkClient } from '@clerk/express';

async function storeUser(req : Request, res:Response ,next:NextFunction){
    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });
        console.log(user);

        // if(user.privateMetadata.created){
        //     await clerkClient.users.updateUserMetadata(user.id, {
        //         privateMetadata: {}
        //     });
        // }

        // console.log(user.privateMetadata)
    
        if (!user.privateMetadata?.created) {
            console.log("here")
            const newUser = await db.user.create({
                data: {
                    authid: user.id,
                    authProvider: user.externalAccounts?.[0]?.provider ?? 'credentials',
                    userName: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.emailAddresses[0]?.emailAddress,
                    phone: user.externalAccounts[0]?.phoneNumber ?? null
                },
                select: { id: true }
            });
    
            await clerkClient.users.updateUserMetadata(user.id, {
                privateMetadata: { created: true }
            });
        }

        (req as any).authid = user.id;
    } catch (error) {
        console.log("Error in user.ts" , error);
        res.status(401).json({error: 'Error while dealing with user data'});
    }
}

export default storeUser;