import express from "express"
import { prisma } from "./db";

const app = express();
app.use(express.json());

app.post("/user", async (req, res) => {
    try {
        const {email, password} = req.body;
        const user = await prisma.user.create({
            data: {
                email,
                password
            }
        })
        console.log(user);
        return res.status(201).json(user);
    }catch (e) {
        console.log(e);
        return res.status(500).json({message: "something went wrong"})
    }
})

app.listen(8080, () => {
    console.log("api is running on the post 8080")
})