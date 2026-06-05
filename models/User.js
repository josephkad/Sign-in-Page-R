const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    displayName: String,
    googleId: Number,
    email: String,
    password: String,
    accountType: String,
    activationKey: String,
    activationExpires: Date, 
    clicks: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('User', userSchema)