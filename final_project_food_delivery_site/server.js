const express = require("express");
const multer  = require('multer');
const app = express();
const bcrypt = require("bcrypt");
const passport = require('passport');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const { name } = require("ejs");
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://liorsil:liorsil@cluster0.28u4gep.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    const db = client.db("deli");
    app.locals.users = db.collection("users");
    app.locals.checkouts = db.collection("checkouts");
    app.locals.orders = db.collection("orders");

    app.listen(3000, () => {
        console.log("listening at 3000");
    });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
} catch (error) {
    console.error("Could not connect to MongoDB:", error);
    process.exit(1);
}
}
run().catch(console.dir);

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'delicious.final.project@gmail.com',
        pass: 'hmbgzxxozniqyzbr'
    }
});


app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.use(express.static('public'));

const storage = multer.memoryStorage(); // Storing files in memory
const upload = multer({ storage: storage });

// client.connect(err => {
//     if (err) throw err;
// });
// client.connect();


// app.listen(3000, () => console.log("listening at 3000"));
app.use(function(req, res, next) {
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
});


// check if the the user loged in or not and show main page
const checkAuth = async (req, res) => {
    let showMainPageAfterLogin = false;
    let user = req.session.user;
    let name = req.session.name;

    if (user) {
        let targetPage = req.query.targetPage;
        let showMainPageAfterLogin = true;
        switch (targetPage) {
            case "products":
                let countCheckout1 = await countCheckoutCollection(req, user.email);
                let checkout1 = await getCheckOut(req, user.email);
                return res.render('products', {name, checkout1, countCheckout1});
                break;
            case "checkout":
                let countCheckout = await countCheckoutCollection(req, user.email);
                let checkout = await getCheckOut(req, user.email);
                return res.render('checkout', {name, checkout, countCheckout});
                break;

            case "order":
                let countCheckout2 = await countCheckoutCollection(req, user.email);
                let checkout2 = await getCheckOut(req, user.email);
                let countOrders = await countOrdersCollection(req, user.email);
                let order = await getOrders(req, user.email);
                return res.render('order', {name, order, countOrders, countCheckout2, checkout2});
            default:
                let countCheckout3 = await countCheckoutCollection(req, user.email);
                let checkout3 = await getCheckOut(req, user.email);
                return res.render('main', { showMainPageAfterLogin, name, countCheckout3, checkout3});
        }
    }
    let countCheckout3 = 1;
    let checkout3 = null;
    return res.render('main', { showMainPageAfterLogin, name, countCheckout3, checkout3});
}


app.get('/', checkAuth, (req, res) => {
        res.sendFile(path.join(__dirname + '/views/main.ejs'));
    })


app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname + '/views/login.html'));  
});


app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname + '/views/signup.html'));
});


app.get("/products", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname + '/views/products.ejs'));
})


app.get("/checkout", checkAuth, async (req, res) => {
    
    res.sendFile(path.join(__dirname + '/views/checkout.ejs'));
})

app.get("/order", checkAuth, async (req, res) => {
    
    res.sendFile(path.join(__dirname + '/views/order.ejs'));
})


app.get("/logout", (req, res) => {
    req.session.user = null;
    checkAuth(req, res);
})


app.post('/signup', async (req, res) => {
    const users = req.app.locals.users;
    try {
        const { name, email, password } = req.body;
        console.log("I'm here1");
        console.log(name, email, password);
        // Check if user email already exists in the database
        const user = await users.findOne({ email: email });
        
        console.log("I'm here2");

        if (user !== null) {
            console.log("User already exists");
            return res.redirect('/signup?message=Email%20already%20exist');
        }

        console.log("I'm here3");
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("I'm here4");

        // Insert the new user into the database
        await users.insertOne({ name: name, email: email, password: hashedPassword });

        // Redirect the user to the login page after successful signup
        return res.redirect('/login');

    } catch (error) {
        console.error("Signup error:", error.message);
        console.log("I'm here5");
        // Respond with an error status code and message
        // Ensure you only send one response, hence the return statement here
        return res.status(500).send('An error occurred during signup.');
    }
});


app.post("/login", async (req, res) => {
    const users = req.app.locals.users;
    try {
        const { email, password } = req.body;
        const user = await users.findOne({ email });
        if (!user) return res.redirect('/login?message=Email%20not%20found');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.redirect('/login?message=Invalid%20password');
        }

        req.session.user = user;
        req.session.name = user.name;
        req.session.email = user.email;
        res.redirect('/');

    } catch (error) {
        res.redirect('/login?message=Unknown%20error');
    }
});


app.post('/products', upload.none(), async (req, res) => {
    const orders = req.app.locals.orders;
    const checkouts = req.app.locals.checkouts;

    const { quantity, product, price} = req.body;
    let name = req.session.name;
    let email = req.session.email;
    const order = await checkouts.findOne({ email });
    if (!order){
        await checkouts.insertOne({ name: name, email: email, product: [product], price: [parseInt(price)], quantity: [parseInt(quantity)] })
        res.redirect('/products?targetPage=products');
        // res.render("products", { name: req.session.name, checkout: checkouts });
        return;
    }

    // if there's already this product in database, increase only his quantity
    const ordered_product = await checkouts.findOne({ email, product });
    if (ordered_product)
    {
        let index = ordered_product.product.indexOf(product);
        await checkouts.updateOne({email: email}, {$inc: { [`quantity.${index}`]: parseInt(quantity) }});
        res.redirect('/products?targetPage=products');
        // res.render("products", { name: req.session.name, checkout: checkouts });
        return;
    }

    checkouts.updateOne({ email: email}, { $push: {product: product, price: parseInt(price), quantity: parseInt(quantity)}} )
    res.redirect('/products?targetPage=products');
});


app.post('/checkout', async (req, res) => {
    const checkouts = req.app.locals.checkouts;
    const { product, index } = req.body;
    let email = req.session.email;
    let i = parseInt(index);
    await checkouts.updateOne({email: email}, {$inc: { [`quantity.${(i)}`]: -1 }});

    let order = await checkouts.find({email}).toArray()
    let price_list =[];
    let quantity_list =[];
    
    order.forEach(function(or){
        price_list = or.price;
        quantity_list = or.quantity;
    });
    
    if (quantity_list[i] === 0){  
        await checkouts.updateOne({ email: email }, { $pull: { product: product } });
        await checkouts.updateOne({ email: email }, { $set: { [`price.${i}`]: 0 }});
        await checkouts.updateOne({ email: email }, { $pull: { price: 0 }});
        await checkouts.updateOne({ email: email }, { $pull: { quantity: 0 }}); 
    } 
    res.redirect('/checkout?targetPage=checkout');
});

app.post('/orders', async (req, res) => {
    const orders = req.app.locals.orders;
    const checkouts = req.app.locals.checkouts;
    let email = req.session.email;
    let num = 0;
    let html2 = '';
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',timeZone: 'Asia/Jerusalem' });
    const formattedTime = currentDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true , timeZone: 'Asia/Jerusalem'});
    const { name, phone, address, comments, totalPrice } = req.body;

    let order = await checkouts.find({email}).toArray();
    // no order yet
    if (!order.length){
        res.redirect('/checkout?targetPage=checkout');
        return;
    }
    
    order.forEach(async function(or){
        // if cart isn't empty, add it to database
        if (or.product.length){
            await orders.insertOne({ date: formattedDate, 
                               hour: formattedTime,
                               name: name,
                               phone: phone,
                               email: email,
                               address: address, 
                               comments: comments, 
                               products: or.product, 
                               prices: or.price, 
                               quantities: or.quantity});

                 
            or.product.forEach( async function(pro){
                html2 += '<p>' + 'X' + or.quantity[num] + ' ' + pro + ' ' + or.price[num] + '₪ ' + '</p>'
                num++ 
            });

            let mailOptions = {
                from: 'delicious.final.project@gmail.com', // sender address
                to: email, // list of receivers
                subject: 'סיכום הזמנה - העוגיות של רונית', // Subject line
                text: 'שלום ' + name + ', תודה שהזמנת דרכינו.', // plain text body
                html: '<h1>שלום '+ name +'!</h1>' +
                '<p><b>פלאפון: </b>' + phone + '</p>' +
                '<p><b>כתובת: </b>' + address + '</p>' +
                '<p><b>הערות: </b>' + comments + '</p>' +
                '<p><b>מוצרים:</b></p>' + html2 + 
                '<br><p><b>מחיר כולל: </b>' + totalPrice + '₪</p>' +
                '<br><p>תודה רבה, תהנה מההזמנה שלך :)</p>' +
                '<p><a href="http://localhost:3000/main">Back to site</a></p>'
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
    });
    await checkouts.drop({email});
    res.redirect('/checkout?targetPage=checkout');
});


app.post('/deleteHistory', async (req, res) => {
    const orders = req.app.locals.orders;
    const checkouts = req.app.locals.checkouts;
    let email = req.session.email;
    let order = await orders.find({email}).toArray();
    console.log(order); 
    if (order.length){
        await orders.deleteMany({ email: email });
        res.redirect('/order?targetPage=order');
    }    
});


app.post('/deleteAllCheckouts', async (req, res) => {
    const orders = req.app.locals.orders;
    const checkouts = req.app.locals.checkouts;
    let email = req.session.email;
    let order = await checkouts.find({email}).toArray();
    if (order.length){
        checkouts.drop({email});
        res.redirect('/checkout?targetPage=checkout');
    }       
});


async function getCheckOut(req, email){
    const checkouts = req.app.locals.checkouts;
    let checkout = await checkouts.find({email}).toArray()
    return checkout;
}


async function getOrders(req, email){
    const orders = req.app.locals.orders;
    let order = await orders.find({email}).toArray();
    return order;
}


async function countCheckoutCollection(req, email) {
    const checkouts = req.app.locals.checkouts;
    let checkout = await checkouts.find({email}).toArray();
    let count = 0;
    if (!checkout.length){
        return true;
    }
    checkout.forEach(async function(order){
        count = order.product.length;
    });
    if (!count){
        await checkouts.drop({email});
        return true;
    }
    return false;
}


async function countOrdersCollection(req, email) {
    const orders = req.app.locals.orders;
    let order = await orders.find({email}).toArray();;
    let count = 0;
    if (!order.length) {
        return true;
    }

    order.forEach(async function(or){
        count = or.products.length;
    });
    if (!count) {
        return true;
    }
    return false;
}
