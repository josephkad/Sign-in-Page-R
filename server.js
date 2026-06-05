// Packages
const express = require("express");
const passport = require("passport");
const googleStrat = require('passport-google-oauth20').Strategy;
const _dotenv = require("dotenv");

const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');

const nodemailer = require('nodemailer');

// Variables
const app = express();
const PORT = process.env.PORT || 3000;

// Functions
function ensureAuth(req, res, next){
    if (req.isAuthenticated()) return next();
    res.redirect('/index.html');
};

// Use & Connect
_dotenv.config();

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.set('trust proxy', 1);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));
app.use(express.json());

passport.use(new googleStrat({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'https://sign-in-page-r.onrender.com/auth/google/callback'
},
(accessToken, refreshToken, profile, done) => {
    console.log(accessToken, refreshToken, profile, done);
    const email = profile.emails?.[0]?.value;

    if (!email) {
        return done(new Error("Google did not return email"), null);
    }

    User.findOne({ email: profile.emails[0].value })
        .then(existingUser => {
            if (existingUser) {
                done(null, existingUser);
            } else {
                User.create({
                    displayName: profile.displayName,
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    accountType: 'google',
                    clicks: 0
                })
                .then(user => done(null, user));
            }
        })
        .catch(err => done(err, null));
}));

passport.serializeUser((user, done) =>{
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => done(null, user))
        .catch(err => done(err, null));
});

// Post
async function signup(email, password, displayName, code, newDate){
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
        email: email,
        displayName: displayName,
        accountType: 'email',
        password: hashedPassword,
        activationKey: code,
        activationExpires: newDate,
    });

    return user;
};

app.post('/api/clicks', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const user = await User.findByIdAndUpdate(
        req.user.id,
        { clicks: req.body.clicks },
        { returnDocument: true }
    );

    res.json(user);
});

const bcrypt = require('bcrypt');

app.post('/signup', async (req, res) => {
    const { email, password, displayName } = req.body;
    const existingUser = await User.findOne({ email });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const newDate = Date.now() + 1000 * 60 * 2;
    
    const validPassword = existingUser != null && existingUser.password != null && await bcrypt.compare(password, existingUser.password);
    let user = existingUser;
    
    if (existingUser && existingUser.accountType == 'google'){
        return res.json({passwordIssue: 'A google account already exists for this email'});
    };

    if (!existingUser){
        user = await signup(email, password, displayName, code, newDate); 
    }else if (!validPassword){
        return res.json({passwordIssue: 'Wrong password'});
    };

    if (existingUser && (user.activationExpires != null && Date.now() <= user.activationExpires)){
        return res.json({
            override: 'An email has already been sent to your account, enter the pin',
            sent: true,
            email: email
        });
    };

    if (!existingUser || (user.activationKey == null && user.activationExpires == null) || (user.activationExpires != null && Date.now() > user.activationExpires)){
        if (existingUser){
            user.activationKey = code;
            user.activationExpires = newDate;
            await user.save();
        }
        
        res.status(200).json({
            sent: true,
            email: email,
        })

        await transporter.sendMail({
            from: `'Sign In Page' <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Activation Code',
            text: `Don't share this with anyone! your activation code is ${code}`
        });

        res.send('email sent');
    };

    return res.status(400).json({error: 'Something went wrong'});
});

app.post('/confirmLogin', async (req, res) => {
    if (!req.body.key || !req.body.email) {
        return res.status(400).json({error: 'KEY or EMAIL missing'});
    };

    const keySent = req.body.key;
    const user = await User.findOne({email: req.body.email});

    // requirements
    const userExists = user
    const activationDataExists = userExists && (user.activationKey != null && user.activationExpires != null)
    const keyNotExpired = userExists && (Date.now() <= user.activationExpires)
    const validKey = userExists && (req.body.key == user.activationKey)
    
    //checks
    if (!userExists) {
        return res.status(400).json({error: 'NO data found'});
    };

    if (!activationDataExists) {
        return res.status(400).json({error: 'NO actionKey or activationExpires in data'});
    };

    if (!keyNotExpired) {
        return res.status(400).json({error: 'key EXPIRED'});
    }

    if (!validKey){
        return res.status(400).json({error: 'wrong key'});
    }

    user.activationKey = null;
    user.activationExpires = null;
    user.displayName = user.email.split('@')[0]
    await user.save();

    req.login(user, () => {
        res.json({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
        });
    });
});

// Get
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

app.get('/dashboard', ensureAuth, (req, res) =>{
    res.sendFile(__dirname + '/public/dashboard.html');
});

app.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/'
    }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/api/user', (req, res)=>{
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    };
    res.json(req.user);
});

app.get('/logout', (req, res, next)=>{
    req.logout((err) =>{
        if (err) return next (err);

        req.session.destroy(() =>{
            res.clearCookie('connect.sid')
            res.redirect('/');
        });
    })
})

// Listen
app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
});