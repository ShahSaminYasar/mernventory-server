const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const cookieParser = require("cookie-parser");


const secret = 'admin';

// middleware
app.use(
    cors({
        origin: ["http://localhost:5173"],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());


const uri = "mongodb+srv://udoydebnath1:1jDBrc92sjZDgGbJ@cluster0.ohhmlog.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const userCollection = client.db("AllCollection").collection("users");
        const ShopCollection = client.db("AllCollection").collection("Shop");
        const productsCollection = client.db("AllCollection").collection("products");

        app.post('/users', async (req, res) => {
            const user = req.body;
            /*   const query = { email: user.email }
              const existingUser = await userCollection.findOne(query);
              if (existingUser) {
                  return res.send({ message: "user asa", insertedId: null })
              } */
            user.role = 'user'
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.get('/userRole', async (req, res) => {
            const user = await userCollection.find().toArray();
            res.send(user)
        })

        app.post('/jwt', async (req, res) => {
            const email = req.body.email;
            console.log(email);
            const token = jwt.sign({ email }, secret, {
                expiresIn: '1h',
            })
            const user = await userCollection.findOne({ email: email })
            console.log(user, token);
            if (token) {
                return res.cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                }).send(user)
            }
            console.log(token);
        })

        app.post('/shop', async (req, res) => {
            const data = req.body;
            console.log(data);

            const check = await ShopCollection.findOne({ ownerEmail: data.ownerEmail })
            if (check) {
                return res.send({ message: 'already have a shop ' })
            } else {
                const result = await ShopCollection.insertOne(data);
                const makeManager = await userCollection.updateOne({ email: data.ownerEmail }, {
                    $set: { role: 'manager' }
                })
                const user = await userCollection.findOne({ email: data?.ownerEmail })
                return res.send({ message: 'shop added', user })
            }

        })

        app.get("/shop", async (req, res) => {
            try {
                const email = req.query.email;

                const shop = await ShopCollection.findOne({ ownerEmail: email });

                res.send(shop);
            }
            catch (error) {
                res.status(404).send("Error", error)
            }
        })

        app.post("/products", async (req, res) => {
            try {
                const product = req.body;
                product.sales = 0;

                const check = await productsCollection.find({ email: product?.email }).toArray();

                if (check?.length >= 3) {
                    return res.send({ message: "products-limit-reached" })
                }

                const result = await productsCollection.insertOne(product);

                if (result.insertedId) {
                    return res.send({ message: "success" })
                } else {
                    return res.send({ message: "did-not-add-product" })
                }
            } catch (error) {
                res.status(404).send({ message: "error", error })
            }
        })

        app.get("/products", async (req, res) => {
            try {
                const filter = {};

                if (req.query.email) {
                    filter.email = req.query.email;
                    // filter = {email: email}
                } else if(req.query.id) {
                    filter._id = new ObjectId(req.query.id);
                }

                const result = await productsCollection.find(filter).toArray();

                res.send(result);
            }
            catch (error) {
                res.status(404).send({ message: "error", error })
            }
        })

        app.put("/products", async (req, res) => {
            try {
                const productId = req.query.id;
                const updatedProduct = req.body;

                const result = await productsCollection.replaceOne({_id: new ObjectId(productId)}, updatedProduct);

                if (result?.modifiedCount > 0) {
                    return res.send({ message: "success" })
                } else {
                    return res.send({ message: "did-not-update" })
                }
            }
            catch (error) {
                res.status(404).send({ message: "error", error })
            }
        })

        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);








app.get('/', (req, res) => {
    res.send('Hello EveryOne!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})