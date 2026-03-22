const express = require("express");
const router = express.Router();

// controllers
const authController = require("../controller/auth.controller");

// middleware
const authMiddleware = require("../middleware/auth.middleware");

// routes
router.post("/register", authMiddleware.authRegisterInput, authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/logout", authController.logout);
router.get("/me", authController.getMe);

module.exports = router;