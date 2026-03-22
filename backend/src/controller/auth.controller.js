const userModel = require("../model/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

async function registerUser(req, res) {
    const {username, email, password} = req.body;
    try {
        const userExists = await userModel.findOne({
            $or: [
                {email},
                {username}
            ]
        });
    
        if(userExists) {
            return res.status(409).json({
                message: "User Already Exists."
            })
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
    
        const user = await userModel.create({
            email,
            username, 
            password: hashedPassword
        });
    
        if(user) {
            const token = jwt.sign({
                id: user._id,
                systemRole: user.systemRole,
            }, process.env.JWT_SECRET,
            { expiresIn: "1d" });

            res.cookie("token", token, {
                httpOnly: true,
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000
            });
            res.status(200).json({
                message: "User Created Successfully",
            });
        }
        
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
}

async function loginUser(req, res) {
    const {username, email, password} = req.body;
    
    try {
        const user = await userModel.findOne({
            $or: [{username}, {email}]
        }).select("+password");
        
        if(!user) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if(!isValidPassword) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }
        
        const token = jwt.sign({
            id: user._id,
            systemRole: user.systemRole,
        }, process.env.JWT_SECRET , { expiresIn: "1d" });
        
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000,
        });
        
        res.status(200).json({
            message: "Login Successfully.",
        })
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
}

async function logout(req, res) {
    try {
        res.clearCookie("token")

        return res.status(200).json({
            message: "Logged out successfully."
        });
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
}

async function getMe(req, res) {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ user });
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

module.exports = { registerUser, loginUser, logout, getMe };