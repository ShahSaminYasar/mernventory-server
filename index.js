const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(
  "sk_test_51OI2WvIo8R7LUCg5FOrt0PpEXkBpFCOBNn3ZvmkJ6qHfMvL0ngFnJy5Am80p4BNrvgUmxnF7Er2Dt9g2WlLSSmIO00pCtLeu0L"
);
require("dotenv").config();

const secret = "admin";

// middleware
app.use(
  cors({
    origin: ["https://mernventory.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri =
  "mongodb+srv://udoydebnath1:1jDBrc92sjZDgGbJ@cluster0.ohhmlog.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("AllCollection").collection("users");
    const ShopCollection = client.db("AllCollection").collection("Shop");
    const cartCollection = client.db("AllCollection").collection("cart");
    const productsCollection = client
      .db("AllCollection")
      .collection("products");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user asa", insertedId: null });
      }
      user.role = "user";
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      try {
        const filter = {};

        if (req.query.email) {
          filter.email = req.query.email;
        }

        const result = await userCollection.find(filter).toArray();

        res.send(result);
      } catch (error) {
        res.status(404).send(error);
      }
    });

    app.put("/make-admin", async (req, res) => {
      try {
        const userId = req?.body?.userId;

        const result = await userCollection.updateOne(
          {
            _id: new ObjectId(userId),
          },
          {
            $set: {
              role: "admin",
            },
          }
        );

        if (result?.modifiedCount > 0) {
          return res.send({ message: "success" });
        } else {
          return res.send({ message: "could-not-update" });
        }
      } catch (error) {
        res.status(404).send({ error });
      }
    });

    app.post("/purchase", async (req, res) => {
      try {
        const userEmail = req.body.email;

        const result = await cartCollection.deleteOne({ userEmail });

        console.log(result);

        res.send({ message: "success" });
      } catch (error) {
        res.status(404).send({ error });
      }
    });

    app.get("/userRole", async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    });

    app.post("/jwt", async (req, res) => {
      const userData = req.body;
      // console.log("in JWT", userData);
      const email = userData.email;
      // console.log(email);

      let user = userData;

      const check = await userCollection.findOne({ email: email });
      // console.log(email, check);

      if (!check) {
        user.role = "user";
        // console.log("making user", user);
        const upload = await userCollection.insertOne(user);
        // console.log("Uploaded: ", user);
      } else {
        console.log("Found: ", check);
        user = check;
      }

      const token = jwt.sign({ email }, secret, {
        expiresIn: "1h",
      });

      // console.log(user, token);
      if (token) {
        return res
          .cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
          })
          .send(user);
      }
      // console.log(token);
      // console.log("User returned: ", user);
    });

    app.post("/shop", async (req, res) => {
      const data = req.body;
      console.log(data);

      const check = await ShopCollection.findOne({
        ownerEmail: data.ownerEmail,
      });
      if (check) {
        return res.send({ message: "already have a shop " });
      } else {
        data.limit = 3;
        const result = await ShopCollection.insertOne(data);
        const makeManager = await userCollection.updateOne(
          { email: data.ownerEmail },
          {
            $set: { role: "manager" },
          }
        );
        const user = await userCollection.findOne({ email: data?.ownerEmail });
        return res.send({ message: "shop added", user });
      }
    });

    app.get("/shops", async (req, res) => {
      try {
        const result = await ShopCollection.find().toArray();

        res.send(result);
      } catch (error) {
        res.status(404).send({ error });
      }
    });

    app.get("/shop", async (req, res) => {
      try {
        const email = req.query.email;

        const shop = await ShopCollection.findOne({ ownerEmail: email });

        res.send(shop);
      } catch (error) {
        res.status(404).send("Error", error);
      }
    });

    app.post("/products", async (req, res) => {
      try {
        const product = req.body;
        product.sales = 0;

        // console.log("in products")

        const shopData = await ShopCollection.findOne({
          ownerEmail: product?.email,
        });

        // console.log(shopData);

        const check = await productsCollection
          .find({ email: product?.email })
          .toArray();

        const limit = Number(shopData?.limit);

        console.log(check, limit);

        if (check?.length >= limit) {
          return res.send({ message: "products-limit-reached" });
        }

        const result = await productsCollection.insertOne(product);

        console.log(result);

        if (result.insertedId) {
          return res.send({ message: "success" });
        } else {
          return res.send({ message: "did-not-add-product" });
        }
      } catch (error) {
        res.status(404).send({ message: "error", error });
      }
    });

    app.get("/products", async (req, res) => {
      try {
        const filter = {};

        if (req.query.email) {
          filter.email = req.query.email;
          // filter = {email: email}
        } else if (req.query.id) {
          filter._id = new ObjectId(req.query.id);
        }

        const result = await productsCollection.find(filter).toArray();

        res.send(result);
      } catch (error) {
        res.status(404).send({ message: "error", error });
      }
    });

    app.put("/products", async (req, res) => {
      try {
        const productId = req.query.id;
        const updatedProduct = req.body;

        const result = await productsCollection.replaceOne(
          { _id: new ObjectId(productId) },
          updatedProduct
        );

        if (result?.modifiedCount > 0) {
          return res.send({ message: "success" });
        } else {
          return res.send({ message: "did-not-update" });
        }
      } catch (error) {
        res.status(404).send({ message: "error", error });
      }
    });

    app.delete("/products", async (req, res) => {
      try {
        const id = req.query.id;

        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({ message: "success" });
      } catch (error) {
        res.status(404).send({ message: "error", error });
      }
    });

    // app.post("/cart", async (req, res) => {
    //   try {
    //     const productId = req.body.productId;
    //     const userEmail = req.body.userEmail;
    //     const price = Number(req.body.price);

    //     const check = await cartCollection.findOne({ userEmail: userEmail });
    //     // console.log(check);

    //     let result;

    //     if (!check) {
    //       const cart = {
    //         userEmail,
    //         products: [{ productId, price }],
    //       };
    //       result = await cartCollection.insertOne(cart);
    //     } else {
    //       const checkTwo = await cartCollection.findOne({
    //         userEmail: userEmail,
    //         products: {
    //           $in: [productId],
    //         },
    //       });

    //       console.log(checkTwo);

    //       if (checkTwo) {
    //         return res.send({ message: "already-in-cart" });
    //       }
    //       result = await cartCollection.updateOne(
    //         { userEmail: userEmail },
    //         {
    //           $push: {
    //             products: { productId, price },
    //           },
    //         }
    //       );
    //     }

    //     res.send({ message: "success", result });
    //   } catch (error) {
    //     res.status(404).send(error);
    //   }
    // });

    app.post("/cart", async (req, res) => {
      try {
        const productId = req.body.productId;
        const userEmail = req.body.userEmail;
        const price = Number(req.body.price);

        const check = await cartCollection.findOne({ userEmail: userEmail });

        let result;

        if (!check) {
          const product = await productsCollection.findOne({
            _id: new ObjectId(productId),
          });
          const productQuantity = Number(product?.quantity) - 1;
          const setNewQuantity = await productsCollection.updateOne(
            { _id: new ObjectId(productId) },
            {
              $set: {
                quantity: productQuantity,
              },
            }
          );
          console.log(setNewQuantity);

          const cart = {
            userEmail,
            products: [{ productId, price }],
          };
          result = await cartCollection.insertOne(cart);
        } else {
          const checkTwo = await cartCollection.findOne({
            userEmail: userEmail,
            "products.productId": productId,
          });

          if (checkTwo) {
            return res.send({ message: "already-in-cart" });
          }

          const product = await productsCollection.findOne({
            _id: new ObjectId(productId),
          });
          const productQuantity = Number(product?.quantity) - 1;
          const setNewQuantity = await productsCollection.updateOne(
            { _id: new ObjectId(productId) },
            {
              $set: {
                quantity: productQuantity,
              },
            }
          );
          console.log(setNewQuantity);

          result = await cartCollection.updateOne(
            { userEmail: userEmail },
            {
              $push: {
                products: { productId, price },
              },
            }
          );
        }

        res.send({ message: "success", result });
      } catch (error) {
        res.status(404).send(error);
      }
    });

    app.get("/cart", async (req, res) => {
      try {
        const filter = {};

        if (req.query.email) {
          filter.userEmail = req.query.email;
        }

        const result = await cartCollection.find(filter).toArray();

        res.send(result);
      } catch (error) {
        res.status(404).send({ error });
      }
    });

    app.get("/limit", async (req, res) => {
      try {
        const email = req.query.email;

        const shop = await ShopCollection.findOne({ ownerEmail: email });

        const limit = Number(shop?.limit);

        res.send({ limit });
      } catch (error) {
        res.status(404).send(error);
      }
    });

    // Stripe Payment
    app.post("/create-payment-intent", async (req, res) => {
      try {
        // console.log("In Payment Intent");
        let price = req.body.price;
        price = parseInt(price * 100);

        // console.log(price);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency: "usd",
          payment_method_types: ["card"],
        });

        // console.log(paymentIntent.client_secret);

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(404).send({ message: "error", error });
      }
    });

    // Update Limit
    app.post("/update-limit", async (req, res) => {
      try {
        const limit = Number(req.body.limit);
        const email = req.body.email;

        const result = await ShopCollection.updateOne(
          { ownerEmail: email },
          {
            $set: {
              limit: limit,
            },
          }
        );

        if (result.modifiedCount > 0) {
          return res.send({ message: "success" });
        } else {
          return res.send("failed-to-increase-limit");
        }
      } catch (error) {
        res.status(404).send(error);
      }
    });

    app.get("/cart-total", async (req, res) => {
      try {
        const email = req.query.email; // TODO query -> body

        // const result = await cartCollection
        //   .aggregate([
        //     {
        //       $match: {
        //         userEmail: email,
        //       },
        //     },
        //     {
        //       $unwind: "$products",
        //     },
        //     {
        //       $lookup: {
        //         from: "products", // Assuming your products are in a collection named "products"
        //         localField: "products",
        //         foreignField: "_id",
        //         as: "productDetails",
        //       },
        //     },
        //     {
        //       $unwind: "$productDetails",
        //     },
        //     {
        //       $group: {
        //         _id: null,
        //         total: { hello: "$productDetails" },
        //       },
        //     },
        //   ])
        //   .toArray();

        const array = await cartCollection.findOne({ userEmail: email });

        const cart = await array?.products;

        console.log("Cart: ", cart);

        cart?.map((pid) => {
          const product = productsCollection.findOne({
            _id: new ObjectId(pid),
          });

          if (product) {
            const price = product?.selling;
            console.log(product, price);
          }
        });

        console.log(result);

        res.send({ totalPrice: result });
      } catch (error) {
        res.status(404).send({ error });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello EveryOne!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
