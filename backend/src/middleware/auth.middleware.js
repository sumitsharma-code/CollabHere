const jwt = require("jsonwebtoken");

async function authUser(req, res, next) {

    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if(decoded.systemRole !== "user" && decoded.systemRole !== "admin") {
            return res.status(403).json({
                message: "Unautherized"
            })
        }
        req.user = decoded;
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
    
        res.clearCookie("token"); 
        
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }
}

async function authRegisterInput(req, res, next) {
    const {username, email, password} = req.body;

    if(!password || (!username || !email) ) {
        return res.status(400).json({
            message: "Invalid Credentials"
        })
    }
    next();
}

module.exports = { authUser, authRegisterInput };