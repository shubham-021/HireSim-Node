import { NextFunction, Request, Response } from "express";
import { verifyUser } from "./helper";
import db from "../user_services/db";
import { clerkClient } from '@clerk/express';

async function storeUser(req : Request, res:Response ,next:NextFunction){
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
            console.log("DB entry created for user with id: " , res.id);
        }
    } catch (error) {
        console.log("Error in user.ts" , error);
        res.status(401).json({error: 'Error while dealing with user data'});
    }
}

export default storeUser;