import express from "express"

const app = express();
app.use(express.json());

app.listen(8080, () => {
    console.log("api is running on the post 8080")
})