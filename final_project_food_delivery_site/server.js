const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require('passport');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const { name } = require("ejs");
const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


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

client.connect(err => {
    if (err) throw err;
});

const db = client.db("deli");
const users = db.collection("users");
const checkouts = db.collection("checkouts");
const orders = db.collection("orders");

app.listen(3000, () => console.log("listening at 3000"));
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
                return res.render('products', {name});
                break;
            case "checkout":
                let countCheckout = await countCheckoutCollection(user.email);
                let checkout = await getCheckOut(user.email);
                return res.render('checkout', {name, checkout, countCheckout});
                break;

            case "order":
                let countOrders = await countOrdersCollection(user.email);
                let order = await getOrders(user.email);
                return res.render('order', {name, order, countOrders});
            default:
                return res.render('main', { showMainPageAfterLogin, name});
        }
    }
    return res.render('main', { showMainPageAfterLogin, name});
}


app.get('/main', checkAuth, (req, res) => {
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
    try {
        const { name, email, password } = req.body;

        // check if user email already exist in database
        const user = await users.findOne({ email });
        if (user) return res.redirect('/signup?message=Email%20already%20exist');

        const hashedPassword = await bcrypt.hash(password, 10);
        users.insertOne({ name: name, email: email, password: hashedPassword });
        res.redirect('/login');

    } catch (error) {
        res.status(500).send(error.message);
        res.redirect('/signup');
    }
});


app.post("/login", async (req, res) => {
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
        res.redirect('/main');

    } catch (error) {
        res.redirect('/login?message=Unknown%20error');
    }
});


app.post('/products', async (req, res) => {

    const { quantity, product, price} = req.body;
    let name = req.session.name;
    let email = req.session.email;
    const order = await checkouts.findOne({ email });
    if (!order){
        checkouts.insertOne({ name: name, email: email, product: [product], price: [parseInt(price)], quantity: [parseInt(quantity)] })
        res.redirect('/products?targetPage=products');
        return;
    }

    // if there's already this product in database, increase only his quantity
    const ordered_product = await checkouts.findOne({ email, product });
    if (ordered_product)
    {
        let index = ordered_product.product.indexOf(product);
        checkouts.updateOne({email: email}, {$inc: { [`quantity.${index}`]: parseInt(quantity) }});
        res.redirect('/products?targetPage=products');
        return;
    }

    checkouts.updateOne({ email: email}, { $push: {product: product, price: parseInt(price), quantity: parseInt(quantity)}} )
    res.redirect('/products?targetPage=products');
});


app.post('/checkout', async (req, res) => {
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
    let email = req.session.email;
    let num = 0;
    let html2 = '';
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = currentDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
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
                subject: 'Order confirmation', // Subject line
                text: 'Hello ' + name + ', thank you for order.', // plain text body
                html: '<h1>Hello '+ name +'!</h1>' +
                '<p><b>phone: </b>' + phone + '</p>' +
                '<p><b>address: </b>' + address + '</p>' +
                '<p><b>comments: </b>' + comments + '</p>' +
                '<p><b>products:</b></p>' + html2 + 
                '<br><p><b>Total price: </b>' + totalPrice + '₪</p>' +
                '<br><p>Thank you and have a great meal! :)</p>' +
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
    let email = req.session.email;
    let order = await orders.find({email}).toArray();
    if (order.length){
        orders.drop({email});
        res.redirect('/order?targetPage=order');
    }    
});


app.post('/deleteAllCheckouts', async (req, res) => {
    let email = req.session.email;
    let order = await checkouts.find({email}).toArray();
    if (order.length){
        checkouts.drop({email});
        res.redirect('/checkout?targetPage=checkout');
    }       
});


async function getCheckOut(email){
    let checkout = await checkouts.find({email}).toArray()
    return checkout;
}


async function getOrders(email){
    let order = await orders.find({email}).toArray();
    return order;
}


async function countCheckoutCollection(email) {
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


async function countOrdersCollection(email) {
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
